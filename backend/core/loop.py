"""
core/loop.py
============
Main orchestration loop for SSE-streamed pipeline execution.

Changes vs original:
  - Imports and passes a _ProposalArtifacts collector into the proposal pipeline
    so that papers / gaps / final_outline are captured and persisted to Redis.
  - After the pipeline finishes, calls profile/weak_points.py to update the
    user's weak-point map based on their current message (user-behaviour-driven).
  - profile_store is expected to expose update_weak_points() (RedisProfileStore v2).
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator, Callable

from conversation.manager import ConversationManager
from core.desensitize import desensitize
from core.events import EventType, SSEEvent, extract_token, fmt
from core.router import route_scene

ROUTE_SCENE_TIMEOUT_SECONDS = 12


def _safe_error(e: Exception) -> str:
    if isinstance(e, json.JSONDecodeError):
        return "模型返回格式有误，请重试"
    if "rate_limit" in str(e).lower():
        return "请求频率过高，请稍等片刻"
    return "服务暂时不可用，请重试"


def _get_pipeline_handler(scene: str) -> Callable:
    if scene == "guided":
        from pipelines.guided import _stream_guided
        return _stream_guided
    if scene == "proposal":
        from pipelines.proposal import _stream_proposal
        return _stream_proposal
    if scene == "review":
        from pipelines.review import _stream_review
        return _stream_review
    if scene == "format":
        from pipelines.format_ import _stream_format
        return _stream_format
    from pipelines.paragraph import _stream_paragraph
    return _stream_paragraph


async def main_loop(
    user_id: str,
    session_id: str,
    user_message: str,
    conv: ConversationManager,
    profile_store,
    rag,
) -> AsyncIterator[str]:
    accumulated = ""
    scene = "paragraph"
    try:
        yield fmt(SSEEvent(type=EventType.STAGE, stage="路由中"))
        history, profile = await asyncio.gather(
            conv.load(user_id, session_id),
            profile_store.get(user_id),
        )
        profile = profile or {}

        # Desensitize before any content leaves this process to the cloud API.
        # safe_message is used for all LLM calls; user_message is kept for
        # local Redis storage so the user sees their original input in history.
        profile_dict = profile if isinstance(profile, dict) else vars(profile) if hasattr(profile, '__dict__') else {}
        safe_message = desensitize(user_message, profile_dict)

        try:
            scene = await asyncio.wait_for(route_scene(safe_message), timeout=ROUTE_SCENE_TIMEOUT_SECONDS)
        except asyncio.TimeoutError:
            scene = "paragraph"
            yield fmt(SSEEvent(type=EventType.STAGE, stage="路由超时，使用段落生成"))

        # --- Teaching-style override: step_by_step → guided pipeline ---
        teaching_style = (
            profile.get("teaching_style") if isinstance(profile, dict)
            else getattr(profile, "teaching_style", "directional")
        )
        if teaching_style == "step_by_step" and scene != "format":
            scene = "guided"

        handler = _get_pipeline_handler(scene)

        # For the proposal pipeline, inject a mutable artifacts collector so
        # we can persist papers/gaps/final_outline to Redis after streaming.
        artifacts = None
        if scene == "proposal":
            from pipelines.proposal import _ProposalArtifacts
            artifacts = _ProposalArtifacts()
            stream = handler(safe_message, history, profile, rag, artifacts)
        elif scene == "format":
            stream = handler(safe_message, history)
        else:
            stream = handler(safe_message, history, profile, rag)

        async for raw in stream:
            accumulated += extract_token(raw)
            yield raw

        yield fmt(SSEEvent(type=EventType.DONE))

        # ---- Post-pipeline persistence ----------------------------------
        # 1. Save conversation history
        await conv.save(user_id, session_id, user_message, accumulated, scene)

        # 2. Save rich session artifacts (papers / gaps / final_outline)
        if artifacts is not None:
            conv_store = conv._store  # RedisConversationStore backing the manager
            if hasattr(conv_store, "save_session_artifact"):
                await conv_store.save_session_artifact(
                    user_id=user_id,
                    session_id=session_id,
                    papers=artifacts.papers or None,
                    gaps=artifacts.gaps or None,
                    final_outline=artifacts.final_outline or None,
                )

        # 3. Update weak-point map from user's message (behaviour-driven)
        await _update_weak_points(user_id, user_message, profile_store)

        # 4. Increment total_sessions / last_session_at (non-critical)
        await _bump_session_stats(user_id, profile_store)

    except asyncio.CancelledError:
        if accumulated:
            await conv.save(user_id, session_id, user_message, accumulated, scene)
        raise
    except Exception as exc:
        yield fmt(SSEEvent(type=EventType.ERROR, content=_safe_error(exc)))
        return


async def _update_weak_points(user_id: str, user_message: str, profile_store) -> None:
    """Fire-and-forget weak-point update (errors are silent, never break SSE)."""
    try:
        from profile.weak_points import extract_user_intent_concepts, update_weak_points

        profile_data = await profile_store.get(user_id)
        if profile_data is None:
            return

        asking, demonstrated = await extract_user_intent_concepts(user_message)
        if not asking and not demonstrated:
            return

        current_wp = profile_data.get("weak_points", {})
        updated_wp = update_weak_points(current_wp, asking, demonstrated)

        if hasattr(profile_store, "update_weak_points"):
            await profile_store.update_weak_points(user_id, updated_wp)
    except Exception:
        # Never let weak-point failure surface to the user
        pass


async def _bump_session_stats(user_id: str, profile_store) -> None:
    """Increment total_sessions and refresh last_session_at in user profile.

    Non-critical — errors are swallowed silently.
    """
    try:
        import time
        if not hasattr(profile_store, "get_profile"):
            return
        profile = await profile_store.get_profile(user_id)
        if profile is None:
            return
        profile.total_sessions += 1
        profile.last_session_at = int(time.time())
        await profile_store.set(user_id, profile)
    except Exception:
        pass
