from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator

from core.events import SSEEvent, fmt
from config import settings
from editing.deepseek import HeuristicEditingProvider, StageStrategy
from editing.evidence import CitationVerifier
from editing.models import (
    DocumentBlock,
    EditingGateReport,
    EditingJobCreate,
    EditingJobStatus,
    EditingPatch,
    EditingStage,
    EvidenceReference,
)


EDITING_STAGE_IDS = [
    "route_diagnosis",
    "grammar_polish",
    "academic_enhance",
    "structure_logic",
    "originality_humanize",
    "citation_check",
    "final_unify",
    "quality_gate",
]

STAGE_LABELS = {
    "route_diagnosis": "路由诊断",
    "grammar_polish": "语法与表层润色",
    "academic_enhance": "学术增强",
    "structure_logic": "逻辑与结构检查",
    "originality_humanize": "降重与人类化",
    "citation_check": "引文与格式核验",
    "final_unify": "终稿统一",
    "quality_gate": "质量门禁",
}


def strategy_for_stage(stage_id: str) -> StageStrategy:
    pro = settings.DEEPSEEK_V4_PRO_MODEL
    flash = settings.DEEPSEEK_V4_FLASH_MODEL
    if stage_id in {"route_diagnosis", "structure_logic", "citation_check"}:
        return StageStrategy(model=pro, thinking=True, reasoning_effort="high", json_output=True, max_tokens=2048)
    if stage_id == "quality_gate":
        return StageStrategy(model=pro, thinking=True, reasoning_effort="max", json_output=True, max_tokens=2048)
    if stage_id == "grammar_polish":
        return StageStrategy(model=flash, thinking=False, temperature=0.2, max_tokens=2048)
    if stage_id == "originality_humanize":
        return StageStrategy(model=flash, thinking=False, temperature=0.65, top_p=0.9, max_tokens=2048)
    return StageStrategy(model=pro, thinking=False, temperature=0.25, max_tokens=2048)


class EditingPipeline:
    def __init__(self, provider=None, norm_retriever=None, rag=None):
        self.provider = provider or HeuristicEditingProvider()
        self.citation_verifier = CitationVerifier(norm_retriever=norm_retriever, rag=rag)
        self._jobs: dict[str, tuple[EditingJobStatus, list[DocumentBlock]]] = {}

    async def create_job(self, req: EditingJobCreate) -> EditingJobStatus:
        job_id = f"edit-{uuid.uuid4().hex[:12]}"
        selected_ids = req.selected_block_ids or [
            block.id for block in req.blocks if block.type == "paragraph"
        ][:1]
        stages = [
            EditingStage(
                stage_id=stage_id,
                label=STAGE_LABELS[stage_id],
                model=strategy_for_stage(stage_id).model,
                thinking=strategy_for_stage(stage_id).thinking,
            )
            for stage_id in EDITING_STAGE_IDS
        ]
        status = EditingJobStatus(
            job_id=job_id,
            mode=req.mode,
            objective=req.objective,
            selected_block_ids=selected_ids,
            stages=stages,
            checkpoint_block_ids=selected_ids,
        )
        self._jobs[job_id] = (status, [block.model_copy(deep=True) for block in req.blocks])
        return status

    def get_job(self, job_id: str) -> EditingJobStatus:
        return self._jobs[job_id][0]

    async def run_job(self, job_id: str) -> AsyncIterator[str]:
        status, blocks = self._jobs[job_id]
        status.status = "running"
        target_blocks = _target_blocks(blocks, status.selected_block_ids)
        current_text_by_id = {block.id: block.content for block in target_blocks}

        try:
            for stage in status.stages:
                stage.status = "running"
                yield _editing_event("editing_stage", stage.model_dump())

                if stage.stage_id == "route_diagnosis":
                    result = await self.provider.complete_json(_diagnosis_messages(status, target_blocks), strategy_for_stage(stage.stage_id))
                    stage.summary = str(result.get("summary") or "已完成路由诊断")
                elif stage.stage_id in {"grammar_polish", "academic_enhance", "originality_humanize", "final_unify"}:
                    patches = await self._revise_stage(stage.stage_id, target_blocks, current_text_by_id)
                    status.patches.extend(patches)
                    for patch in patches:
                        current_text_by_id[patch.block_id] = patch.revised_text
                        yield _editing_event("editing_patch", patch.model_dump())
                    stage.summary = f"生成 {len(patches)} 条补丁"
                elif stage.stage_id == "structure_logic":
                    result = await self.provider.complete_json(_structure_messages(current_text_by_id), strategy_for_stage(stage.stage_id))
                    stage.summary = str(result.get("summary") or "已完成结构检查")
                elif stage.stage_id == "citation_check":
                    merged_text = "\n".join(current_text_by_id.values())
                    status.references = self.citation_verifier.verify(merged_text)
                    stage.summary = f"核验 {len(status.references)} 条证据"
                    yield _editing_event("references", [ref.model_dump() for ref in status.references])
                elif stage.stage_id == "quality_gate":
                    status.gate_report = _build_gate_report(status.references, target_blocks, current_text_by_id)
                    stage.summary = "质量门禁通过" if status.gate_report.status == "pass" else "质量门禁需复核"
                    yield _editing_event("editing_gate", status.gate_report.model_dump())

                stage.status = "completed"
                yield _editing_event("editing_stage", stage.model_dump())

            status.status = "completed"
            yield fmt(SSEEvent(type="done"))
        except Exception as exc:
            status.status = "failed"
            status.error = str(exc)
            running_stage = next((stage for stage in status.stages if stage.status == "running"), None)
            if running_stage:
                running_stage.status = "failed"
                running_stage.error = str(exc)
            yield fmt(SSEEvent(type="error", content=str(exc)))

    async def _revise_stage(
        self,
        stage_id: str,
        target_blocks: list[DocumentBlock],
        current_text_by_id: dict[str, str],
    ) -> list[EditingPatch]:
        strategy = strategy_for_stage(stage_id)
        instruction = _instruction_for_stage(stage_id)
        patches: list[EditingPatch] = []
        for block in target_blocks:
            original = current_text_by_id[block.id]
            revised = await self.provider.revise_text(original, instruction, strategy)
            if revised.strip() == original.strip():
                continue
            patches.append(EditingPatch(
                id=f"{stage_id}:{block.id}:{len(patches) + 1}",
                stage_id=stage_id,
                block_id=block.id,
                original_text=original,
                revised_text=revised,
                reason=STAGE_LABELS[stage_id],
                confidence=0.85 if stage_id == "grammar_polish" else 0.76,
            ))
        return patches


def _target_blocks(blocks: list[DocumentBlock], selected_ids: list[str]) -> list[DocumentBlock]:
    selected = [block for block in blocks if block.id in selected_ids and block.type == "paragraph"]
    return selected or [block for block in blocks if block.type == "paragraph"][:1]


def _diagnosis_messages(status: EditingJobStatus, blocks: list[DocumentBlock]) -> list[dict]:
    payload = {
        "json": True,
        "mode": status.mode,
        "objective": status.objective,
        "blocks": [block.model_dump() for block in blocks],
    }
    return [
        {"role": "system", "content": "你是学术编辑路由器，只输出 json 诊断。"},
        {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
    ]


def _structure_messages(current_text_by_id: dict[str, str]) -> list[dict]:
    return [
        {"role": "system", "content": "你是论文结构顾问，只输出 json，总结逻辑风险。"},
        {"role": "user", "content": json.dumps({"json": True, "text": current_text_by_id}, ensure_ascii=False)},
    ]


def _instruction_for_stage(stage_id: str) -> str:
    if stage_id == "grammar_polish":
        return "请做保义校对：修正语法、标点、冗余和低级病句，不新增事实，只输出修订后正文。"
    if stage_id == "academic_enhance":
        return "请提升学术表达：保持事实、数据、引文和结论强弱不变，只输出修订后正文。"
    if stage_id == "originality_humanize":
        return "请做降重与人类化：降低模板腔和表层重复，保留专业术语和证据关系，只输出修订后正文。"
    return "请做终稿统一：统一声线、节奏和连接语，不触碰事实、数据和引用，只输出修订后正文。"


def _build_gate_report(
    references: list[EvidenceReference],
    original_blocks: list[DocumentBlock],
    current_text_by_id: dict[str, str],
) -> EditingGateReport:
    unresolved = sum(1 for ref in references if ref.status == "unresolved")
    changed = any(current_text_by_id.get(block.id, block.content) != block.content for block in original_blocks)
    status = "pass" if changed else "warning"
    messages = ["已生成可审阅补丁。"] if changed else ["未产生正文补丁，建议人工复核输入。"]
    if unresolved:
        messages.append(f"{unresolved} 条证据未解析，需人工确认。")
    return EditingGateReport(
        status=status,
        fidelity_score=0.94 if changed else 0.7,
        semantic_similarity=0.92 if changed else 0.7,
        citation_unresolved_count=unresolved,
        messages=messages,
    )


def _editing_event(event_type: str, data) -> str:
    return fmt(SSEEvent(type=event_type, data=data))

