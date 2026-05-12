from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field, field_validator

from api.auth import get_current_user_id
from api.responses import ok

router = APIRouter()


class WritingAnalyzeRequest(BaseModel):
    text: str
    mode: Literal["norms", "citation", "structure"] = "norms"
    session_id: Optional[str] = None
    top_k: int = Field(default=5, ge=1, le=20)
    theta: float = Field(default=0.6, ge=0.0, le=1.0)
    refs: Optional[list[str]] = None

    @field_validator("text")
    @classmethod
    def text_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("text must not be blank")
        return stripped


def _score(value: float) -> float:
    return max(0.0, min(1.0, round(value, 2)))


def _fallback_nodes(mode: str) -> list[dict]:
    labels = {
        "norms": ["研究问题明确性", "方法与结论完整性", "学术表达规范性"],
        "citation": ["论点证据对应", "引用来源可核验", "参考文献格式一致"],
        "structure": ["章节层级清晰度", "段落逻辑连贯性", "摘要要素完整性"],
    }
    return [
        {"id": f"{mode}-node-{idx}", "label": label, "type": mode, "score": _score(0.9 - idx * 0.04)}
        for idx, label in enumerate(labels[mode], start=1)
    ]


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


def _has_items(value: object) -> bool:
    try:
        return len(value) > 0  # type: ignore[arg-type]
    except Exception:
        return False


def _frontend_node(node: dict, idx: int) -> dict:
    node_id = str(node.get("node_id") or node.get("id") or f"node-{idx}")
    label = str(node.get("dimension") or node.get("label") or node_id)
    node_type = str(node.get("node_type") or node.get("type") or "规范节点")
    text = str(node.get("text") or node.get("excerpt") or "")
    result = {
        "id": node_id,
        "label": label,
        "type": node_type,
        "score": _score(float(node.get("score") or 0.0)),
        "node_id": node_id,
        "node_type": node_type,
        "dimension": label,
        "text": text,
        "related": list(node.get("related", [])),
    }
    if node.get("via_expand"):
        result["via_expand"] = True
    return result


def _reference_from_node(node: dict, idx: int) -> dict:
    return {
        "id": str(node.get("node_id") or node.get("id") or f"norm-ref-{idx}"),
        "title": str(node.get("dimension") or node.get("label") or f"规范节点 {idx}"),
        "year": None,
        "source": "ScholarScript Norm Corpus",
        "score": _score(float(node.get("score") or 0.0)),
        "excerpt": str(node.get("text") or node.get("excerpt") or ""),
    }


def _reference_from_paper(paper: dict, idx: int) -> dict:
    return {
        "id": str(paper.get("id") or f"retrieved-{idx}"),
        "title": str(paper.get("title") or paper.get("source") or f"知识库材料 {idx}").strip(),
        "year": int(paper.get("year") or 0) or None,
        "source": str(paper.get("source") or paper.get("venue") or "检索证据").strip(),
        "score": _score(float(paper.get("score") or 0.82)),
        "excerpt": str(paper.get("excerpt") or paper.get("snippet") or paper.get("description") or "").strip(),
    }


def _expanded_context(items: list[dict], references: list[dict]) -> list[dict]:
    if items:
        return [
            {
                "id": item["id"],
                "title": item.get("label") or item["id"],
                "excerpt": item.get("text") or "该材料可用于支持当前写作规范、结构或引用核查。",
                "score": item.get("score"),
            }
            for item in items[:5]
        ]
    return [
        {
            "id": f"context-{reference['id']}",
            "title": reference["title"],
            "excerpt": reference.get("excerpt") or "该材料可用于支持当前写作规范、结构或引用核查。",
            "score": reference.get("score", 0.8),
        }
        for reference in references[:3]
    ]


@router.post("/writing/analyze")
async def analyze_writing(
    req: WritingAnalyzeRequest,
    request: Request,
    _user_id: str = Depends(get_current_user_id),
):
    text = req.text
    norm_retriever = getattr(request.app.state, "norm_retriever", None)
    rag = getattr(request.app.state, "rag", None)

    nodes: list[dict] = []
    expanded: list[dict] = []
    context = ""
    references: list[dict] = []

    if norm_retriever is not None and _has_items(norm_retriever):
        retrieved = norm_retriever.retrieve(text, top_k=req.top_k, theta=0.0)
        expanded_raw = norm_retriever.expand([node["node_id"] for node in retrieved], hops=1)
        nodes = [_frontend_node(node, idx) for idx, node in enumerate(retrieved, start=1)]
        expanded = [_frontend_node(node, idx) for idx, node in enumerate(expanded_raw, start=1)]
        context_nodes = [
            {
                "node_id": item["node_id"],
                "node_type": item["node_type"],
                "dimension": item["dimension"],
                "text": item["text"],
            }
            for item in nodes + expanded
        ]
        context = norm_retriever.format_context(context_nodes)
        references = [_reference_from_node(node, idx) for idx, node in enumerate(nodes[:3] or expanded[:3], start=1)]

    if not references and rag is not None and hasattr(rag, "retrieve_literature"):
        papers = rag.retrieve_literature(text, top_k=req.top_k)
        references = [_reference_from_paper(paper, idx) for idx, paper in enumerate(papers, start=1)]

    if not nodes:
        nodes = _fallback_nodes(req.mode)
    if not references:
        references = _fallback_references(req.mode)

    validation = _validation(text, req.mode)
    if norm_retriever is not None and _has_items(norm_retriever):
        for ref_id in req.refs or []:
            passed, score = norm_retriever.validate_ref(ref_id, text, theta=req.theta)
            exists = norm_retriever.get(ref_id) is not None
            validation.append({
                "id": ref_id,
                "status": "pass" if passed else "warning",
                "message": f"引用 {ref_id} {'通过' if passed else '未通过'}规范校验（exists={exists}, score={score:.2f}）。",
            })

    return ok({
        "nodes": nodes,
        "expanded_context": _expanded_context(expanded, references),
        "validation": validation,
        "references": references,
        "context": context,
        "expanded": expanded,
    })
