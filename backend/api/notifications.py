from fastapi import APIRouter, Depends, HTTPException, Request

from api.auth import get_current_user_id
from api.responses import ok
from store.redis_store import RedisNotificationStore

router = APIRouter()


def _store(request: Request) -> RedisNotificationStore:
    return request.app.state.notification_store


@router.get("/notifications")
async def list_notifications(
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    items = await _store(request).list_notifications(user_id)
    unread_count = sum(1 for item in items if not item.get("read"))
    return ok({"items": items, "unreadCount": unread_count})


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    notification = await _store(request).mark_read(user_id, notification_id)
    if notification is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOTIFICATION_NOT_FOUND", "message": "通知不存在"},
        )
    return ok(notification)
