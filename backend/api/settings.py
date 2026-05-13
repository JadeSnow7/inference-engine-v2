from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from api.auth import get_current_user_id
from api.responses import ok
from store.redis_store import RedisSettingsStore

router = APIRouter()


class SettingsUpdateRequest(BaseModel):
    workspaceDensity: str | None = None
    autoSave: bool | None = None
    notificationsEnabled: bool | None = None
    citationStyle: str | None = None


def _store(request: Request) -> RedisSettingsStore:
    return request.app.state.settings_store


@router.get("/settings")
async def get_settings(
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    return ok(await _store(request).get_settings(user_id))


@router.patch("/settings")
async def update_settings(
    body: SettingsUpdateRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    updates = body.model_dump(exclude_unset=True)
    return ok(await _store(request).update_settings(user_id, updates))
