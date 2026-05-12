from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from api.auth import get_current_user_id
from api.responses import ok
from core.loop import main_loop
from core.norms import norms_loop
from profile.models import UserProfile, from_survey

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    mode: Optional[str] = None


class ProfileInitRequest(BaseModel):
    q13: str
    q14: str
    q9: str = "零基础"
    q5: str = "集成"


@router.post("/chat")
async def chat(req: ChatRequest, request: Request, user_id: str = Depends(get_current_user_id)):
    app_state = request.app.state
    session_id = await app_state.conv_manager.ensure_session(user_id, req.session_id, req.message)
    stream = (
        norms_loop(
            user_id,
            session_id,
            req.message,
            app_state.conv_manager,
            app_state.profile_store,
            getattr(app_state, "norm_retriever", None),
        )
        if (req.mode or "").strip().lower() == "norms"
        else main_loop(user_id, session_id, req.message, app_state.conv_manager, app_state.profile_store, app_state.rag)
    )
    return StreamingResponse(
        stream,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
            "X-Session-Id": session_id,
        },
    )


@router.post("/profile/init")
async def init_profile(req: ProfileInitRequest, request: Request, user_id: str = Depends(get_current_user_id)):
    await request.app.state.profile_store.set(user_id, from_survey(req.q13, req.q14, req.q9, req.q5))
    return ok({"initialized": True})


@router.get("/sessions")
async def list_sessions(
    request: Request,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(get_current_user_id),
):
    return ok(await request.app.state.conv_manager.list_sessions(user_id, limit=limit, offset=offset))


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, request: Request, user_id: str = Depends(get_current_user_id)):
    deleted = await request.app.state.conv_manager.delete_session(user_id, session_id)
    return ok({"deleted": deleted})


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: str, request: Request, user_id: str = Depends(get_current_user_id)):
    """Return the full message history for a session (user + assistant turns)."""
    history = await request.app.state.conv_manager.load(user_id, session_id)
    return ok({"messages": history})


@router.get("/sessions/{session_id}/artifact")
async def get_session_artifact(session_id: str, request: Request, user_id: str = Depends(get_current_user_id)):
    """Return saved pipeline artefacts (papers, gaps, final_outline) for sidebar restoration."""
    store = request.app.state.conv_manager._store
    if hasattr(store, "get_session_artifact"):
        artifact = await store.get_session_artifact(user_id, session_id)
    else:
        artifact = {}
    return ok(artifact)


@router.get("/profile/me")
async def get_profile(request: Request, user_id: str = Depends(get_current_user_id)):
    """Return the current user profile dict."""
    profile = await request.app.state.profile_store.get(user_id)
    normalized = profile if isinstance(profile, UserProfile) else UserProfile.from_dict(profile or {})
    return ok(normalized.to_dict())


@router.patch("/profile/me")
async def patch_profile(request: Request, user_id: str = Depends(get_current_user_id)):
    """Update subset of profile fields (teaching_style, feedback_verbosity)."""
    body = await request.json()
    profile = await request.app.state.profile_store.get(user_id) or {}
    allowed = {"teaching_style", "feedback_verbosity"}
    for k, v in body.items():
        if k in allowed:
            profile[k] = v
    await request.app.state.profile_store.set(user_id, UserProfile.from_dict(profile))
    return ok({"updated": True})
