from __future__ import annotations

from collections.abc import AsyncIterator

from config import settings
from conversation.manager import ConversationManager
from core.bailian_app import stream_bailian_app
from core.desensitize import desensitize
from core.events import EventType, SSEEvent, fmt
from core.loop import main_loop
from core.norms import _safe_error as safe_bailian_error


def _should_use_bailian() -> bool:
    return settings.AI_PROVIDER_PREFERENCE == "bailian_first" and settings.bailian_app_configured


async def bailian_first_loop(
    user_id: str,
    session_id: str,
    user_message: str,
    conv: ConversationManager,
    profile_store,
    rag,
) -> AsyncIterator[str]:
    if not _should_use_bailian():
        async for chunk in main_loop(user_id, session_id, user_message, conv, profile_store, rag):
            yield chunk
        return

    accumulated = ""
    latest_app_session_id = ""
    emitted_references = False

    try:
        yield fmt(SSEEvent(type=EventType.STAGE, stage="百炼应用处理中"))

        profile = await profile_store.get(user_id)
        profile_dict = profile if isinstance(profile, dict) else vars(profile) if hasattr(profile, "__dict__") else {}
        safe_message = desensitize(user_message, profile_dict)
        app_session_id = await conv.get_bailian_app_session(user_id, session_id)

        async for chunk in stream_bailian_app(safe_message, session_id=app_session_id):
            if chunk.session_id:
                latest_app_session_id = chunk.session_id
            if chunk.references and not emitted_references:
                emitted_references = True
                yield fmt(SSEEvent(type=EventType.REFERENCES, data=chunk.references))
            if chunk.text:
                accumulated += chunk.text
                yield fmt(SSEEvent(type=EventType.TOKEN, content=chunk.text))

        if latest_app_session_id:
            await conv.save_bailian_app_session(user_id, session_id, latest_app_session_id)

        yield fmt(SSEEvent(type=EventType.DONE))
        await conv.save(user_id, session_id, user_message, accumulated, "bailian")

    except Exception as exc:
        if accumulated:
            await conv.save(user_id, session_id, user_message, accumulated, "bailian")
            yield fmt(SSEEvent(type=EventType.ERROR, content=safe_bailian_error(exc)))
            return

        yield fmt(SSEEvent(type=EventType.STAGE, stage="百炼不可用，切换通用模型"))
        async for chunk in main_loop(user_id, session_id, user_message, conv, profile_store, rag):
            yield chunk
