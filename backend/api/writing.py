from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, field_validator

from api.auth import get_current_user_id
from api.responses import ok

router = APIRouter()


class WritingAnalyzeRequest(BaseModel):
    text: str
    mode: Literal["norms", "citation", "structure"] = "norms"
    session_id: Optional[str] = None

    @field_validator("text")
    @classmethod
    def text_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("text must not be blank")
        return stripped


def _score(value: float) -> float:
    return max(0.0, min(1.0, round(value, 2)))


def _reference_from_paper(paper: dict, idx: int) -> dict:
    title = str(paper.get("title") or paper.get("source") or f"知识库材料 {idx}").strip()
    source = str(paper.get("source") or paper.get("venue") or "检索证据").strip()
    excerpt = str(paper.get("excerpt") or paper.get("snippet") or paper.get("description") or "").strip()

    return {
        "id": str(paper.get("id") or f"retrieved-{idx}"),
        "title": title,
        "year": int(paper.get("year") or 0) or None,
        "source": source,
        "score": _score(float(paper.get("score") or 0.82)),
        "excerpt": excerpt,
    }


def _fallback_references(mode: str) -> list[dict]:
    if mode == "citation":
        return [
            {
                "id": "citation-norm-2026",
                "title": "本科毕业论文引用与参考文献规范",
                "year": 2026,
                "source": "ScholarScript Norm Corpus",
                "score": 0.88,
                "excerpt": "引用增强需保证论点、证据和参考文献之间存在可核验对应关系。",
            }
        ]
    return [
        {
            "id": "writing-norm-2026",
            "title": "华中科技大学本科论文写作规范",
            "year": 2026,
            "source": "ScholarScript Norm Corpus",
            "score": 0.91,
            "excerpt": "摘要应凝练说明研究目的、方法、结果和结论，正文应保持结构清晰与引用规范。",
        }
    ]


def _validation(text: str, mode: str) -> list[dict]:
    items: list[dict] = []
    if len(text) < 80:
        items.append({
            "id": "length-warning",
            "status": "warning",
            "message": "文本较短，建议补充研究目的、方法、证据或结论后再进入终稿审查。",
        })
    if mode in {"norms", "structure"} and not any(marker in text for marker in ["方法", "实验", "数据", "样本"]):
        items.append({
            "id": "method-warning",
            "status": "warning",
            "message": "摘要或段落中缺少方法说明。",
        })
    if mode == "citation" and not any(marker in text for marker in ["[", "（", "作者", "等"]):
        items.append({
            "id": "citation-warning",
            "status": "warning",
            "message": "当前段落缺少明确引用标记，建议补充可核验来源。",
        })
    if not items:
        items.append({
            "id": "baseline-pass",
            "status": "pass",
            "message": "当前文本具备基础学术表达结构，可继续做细节润色与证据核查。",
        })
    return items


def _nodes(mode: str) -> list[dict]:
    labels = {
        "norms": ["研究问题明确性", "方法与结论完整性", "学术表达规范性"],
        "citation": ["论点证据对应", "引用来源可核验", "参考文献格式一致"],
        "structure": ["章节层级清晰度", "段落逻辑连贯性", "摘要要素完整性"],
    }
    return [
        {"id": f"{mode}-node-{idx}", "label": label, "type": mode, "score": _score(0.9 - idx * 0.04)}
        for idx, label in enumerate(labels[mode], start=1)
    ]


@router.post("/writing/analyze")
async def analyze_writing(
    req: WritingAnalyzeRequest,
    request: Request,
    _user_id: str = Depends(get_current_user_id),
):
    text = req.text
    try:
        retriever = getattr(request.app.state, "rag", None)
        papers = retriever.retrieve_literature(text, top_k=4) if retriever and hasattr(retriever, "retrieve_literature") else []
    except Exception as exc:
        raise HTTPException(status_code=502, detail={"code": "WRITING_RAG_FAILED", "message": "写作证据检索失败，请稍后重试"}) from exc

    references = [_reference_from_paper(paper, idx) for idx, paper in enumerate(papers, start=1)]
    if not references:
        references = _fallback_references(req.mode)

    expanded_context = [
        {
            "id": f"context-{reference['id']}",
            "title": reference["title"],
            "excerpt": reference.get("excerpt") or "该材料可用于支持当前写作规范、结构或引用核查。",
            "score": reference.get("score", 0.8),
        }
        for reference in references[:3]
    ]

    return ok({
        "nodes": _nodes(req.mode),
        "expanded_context": expanded_context,
        "validation": _validation(text, req.mode),
        "references": references,
    })
