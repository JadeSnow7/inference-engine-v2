from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from api.auth import get_current_user_id


router = APIRouter()


class AnalyzeRequest(BaseModel):
    text: str = Field(min_length=1)
    top_k: int = Field(default=5, ge=1, le=20)
    theta: float = Field(default=0.6, ge=0.0, le=1.0)
    refs: Optional[list[str]] = None


@router.post("/writing/analyze")
async def analyze_writing(
    req: AnalyzeRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    del user_id
    retriever = getattr(request.app.state, "norm_retriever", None)
    if retriever is None or len(retriever) == 0:
        return {"nodes": [], "expanded": [], "context": "", "validation": {}}

    nodes = retriever.retrieve(req.text, top_k=req.top_k, theta=0.0)
    expanded = retriever.expand([node["node_id"] for node in nodes], hops=1)
    nodes_by_id = {node["node_id"]: node for node in nodes + expanded}
    context = retriever.format_context(list(nodes_by_id.values()))

    validation = {}
    for ref_id in req.refs or []:
        passed, score = retriever.validate_ref(ref_id, req.text, theta=req.theta)
        validation[ref_id] = {
            "exists": retriever.get(ref_id) is not None,
            "score": score,
            "pass": passed,
        }

    return {
        "nodes": nodes,
        "expanded": expanded,
        "context": context,
        "validation": validation,
    }
