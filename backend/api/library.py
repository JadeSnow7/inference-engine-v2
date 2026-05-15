from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict

from api.auth import get_current_user_id
from api.responses import ok
from store.redis_store import RedisEvidenceStore

router = APIRouter()


def _store(request: Request) -> RedisEvidenceStore:
    return request.app.state.evidence_store


EvidenceStatus = Literal["candidate", "inserted", "needs_review", "verified", "conflict"]


class EvidenceUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: EvidenceStatus | None = None
    linkedBlockIds: list[str] | None = None
    confidence: float | None = None
    sourceType: str | None = None
    verifiedAt: str | None = None
    usedAt: str | None = None


def _matches_query(item: dict, query: str) -> bool:
    haystack = " ".join(str(item.get(field, "")) for field in ("title", "venue", "type", "year"))
    return query.lower() in haystack.lower()


@router.get("/library/evidence")
async def list_evidence(
    request: Request,
    q: str | None = None,
    type: str | None = None,
    status: str | None = None,
    user_id: str = Depends(get_current_user_id),
):
    items = await _store(request).list_evidence(user_id)
    if q:
        items = [item for item in items if _matches_query(item, q)]
    if type:
        items = [item for item in items if item.get("type") == type]
    if status:
        items = [item for item in items if item.get("status", "candidate") == status]
    return ok({"items": items})


@router.patch("/library/evidence/{evidence_id}")
async def update_evidence(
    evidence_id: str,
    body: EvidenceUpdateRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    updated = await _store(request).update_evidence(
        user_id,
        evidence_id,
        body.model_dump(exclude_unset=True),
    )
    if updated is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "EVIDENCE_NOT_FOUND", "message": "证据不存在"},
        )
    return ok(updated)
