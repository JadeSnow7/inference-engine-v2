from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from api.auth import get_current_user_id
from core.loop import main_loop
from profile.models import from_survey

router = APIRouter()


class ChatRequest(BaseModel):
    message: str


class ProfileInitRequest(BaseModel):
    q13: str
    q14: str
    q9: str = "零基础"
    q5: str = "集成"


@router.post("/chat")
async def chat(req: ChatRequest, request: Request, user_id: str = Depends(get_current_user_id)):
    app_state = request.app.state
    return StreamingResponse(
        main_loop(user_id, req.message, app_state.conv_manager, app_state.profile_store, app_state.rag),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.post("/profile/init")
async def init_profile(req: ProfileInitRequest, request: Request, user_id: str = Depends(get_current_user_id)):
    await request.app.state.profile_store.set(user_id, from_survey(req.q13, req.q14, req.q9, req.q5))
    return {"ok": True}

