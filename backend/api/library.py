from fastapi import APIRouter, Depends, Request

from api.auth import get_current_user_id
from api.responses import ok
from store.redis_store import RedisEvidenceStore

router = APIRouter()


def _store(request: Request) -> RedisEvidenceStore:
    return request.app.state.evidence_store


def _matches_query(item: dict, query: str) -> bool:
    haystack = " ".join(str(item.get(field, "")) for field in ("title", "venue", "type", "year"))
    return query.lower() in haystack.lower()


@router.get("/library/evidence")
async def list_evidence(
    request: Request,
    q: str | None = None,
    type: str | None = None,
    user_id: str = Depends(get_current_user_id),
):
    items = await _store(request).list_evidence(user_id)
    if q:
        items = [item for item in items if _matches_query(item, q)]
    if type:
        items = [item for item in items if item.get("type") == type]
    return ok({"items": items})
