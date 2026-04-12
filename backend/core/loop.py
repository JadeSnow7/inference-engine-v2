import asyncio
import json
from collections.abc import AsyncIterator, Callable

from conversation.manager import ConversationManager
from core.events import EventType, SSEEvent, extract_token, fmt
from core.router import route_scene


def _safe_error(e: Exception) -> str:
    if isinstance(e, json.JSONDecodeError):
        return "模型返回格式有误，请重试"
    if "rate_limit" in str(e).lower():
        return "请求频率过高，请稍等片刻"
    return "服务暂时不可用，请重试"


def _get_pipeline_handler(scene: str) -> Callable:
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


async def main_loop(user_id: str, user_message: str, conv: ConversationManager, profile_store, rag) -> AsyncIterator[str]:
    accumulated = ""
    try:
        yield fmt(SSEEvent(type=EventType.STAGE, stage="路由中"))
        history, profile = await asyncio.gather(conv.load(user_id), profile_store.get(user_id))
        profile = profile or {}
        scene = await route_scene(user_message)
        handler = _get_pipeline_handler(scene)

        if scene == "format":
            stream = handler(user_message, history)
        else:
            stream = handler(user_message, history, profile, rag)

        async for raw in stream:
            accumulated += extract_token(raw)
            yield raw

        yield fmt(SSEEvent(type=EventType.DONE))
        await conv.save(user_id, user_message, accumulated)
    except asyncio.CancelledError:
        if accumulated:
            await conv.save(user_id, user_message, accumulated)
        raise
    except Exception as exc:
        yield fmt(SSEEvent(type=EventType.ERROR, content=_safe_error(exc)))
        return

