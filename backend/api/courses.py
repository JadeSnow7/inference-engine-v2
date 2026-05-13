from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request

from api.auth import get_current_user_id
from api.responses import ok
from store.redis_store import RedisCourseStore

router = APIRouter()

ActionType = Literal["outline", "review", "gap", "polish", "blank"]
SourceType = Literal["course", "paper", "lecture", "manual"]


def _store(request: Request) -> RedisCourseStore:
    return request.app.state.course_store


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=404,
        detail={"code": "COURSE_NOT_FOUND", "message": "研究空间不存在"},
    )


@router.get("/courses")
async def list_research_spaces(
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    items = await _store(request).list_research_spaces(user_id)
    return ok({"items": items})


@router.post("/courses/{space_id}/open")
async def open_research_space(
    space_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    space = await _store(request).get_research_space(user_id, space_id)
    if space is None:
        raise _not_found()

    material = space.get("material") or {}
    action_type = material.get("type") or "blank"
    source_type = material.get("sourceType") or ("paper" if action_type == "review" else "lecture")
    context = {
        "sourceTitle": material.get("title") or space.get("topic") or space.get("title"),
        "actionType": action_type,
        "courseTitle": space.get("title"),
        "sourceType": source_type,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    return ok({"context": context, "space": space})
