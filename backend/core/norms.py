from __future__ import annotations

import json
from collections.abc import AsyncIterator

from conversation.manager import ConversationManager
from core.bailian_app import BailianAppError, stream_bailian_app
from core.desensitize import desensitize
from core.events import EventType, SSEEvent, fmt


def _safe_error(exc: Exception) -> str:
    if isinstance(exc, BailianAppError):
        message = str(exc)
        if "DASHSCOPE_API_KEY" in message:
            return "百炼规范助手缺少 API Key 配置"
        if "InvalidApiKey" in message or "Invalid API-key" in message:
            return "百炼 API Key 无效，请更新 DASHSCOPE_API_KEY"
        if "overdue-payment" in message or "account is in good standing" in message:
            return "百炼账户当前不可用，请检查阿里云账号余额、欠费状态或模型服务开通状态"
        if "DASHSCOPE_APP_ID" in message:
            return "百炼规范助手缺少 App ID 配置"
        return message
    if isinstance(exc, json.JSONDecodeError):
        return "百炼规范助手返回格式有误，请重试"
    if "rate_limit" in str(exc).lower():
        return "请求频率过高，请稍等片刻"
    return "百炼规范助手暂时不可用，请重试"


def _build_norm_prompt(safe_message: str, norm_retriever) -> str:
    if norm_retriever is None or len(norm_retriever) == 0:
        return safe_message
    candidates = norm_retriever.retrieve(safe_message, top_k=5)
    if not candidates:
        return safe_message
    expanded = norm_retriever.expand([node["node_id"] for node in candidates], hops=1)
    nodes_by_id = {node["node_id"]: node for node in candidates + expanded}
    context = norm_retriever.format_context(list(nodes_by_id.values()))
    if not context:
        return safe_message
    return f"{context}\n\nWriting snippet:\n{safe_message}"


async def norms_loop(
    user_id: str,
    session_id: str,
    user_message: str,
    conv: ConversationManager,
    profile_store,
    norm_retriever=None,
) -> AsyncIterator[str]:
    accumulated = ""
    latest_app_session_id = ""
    emitted_references = False

    try:
        yield fmt(SSEEvent(type=EventType.STAGE, stage="学术规范检索中"))

        profile = await profile_store.get(user_id)
        profile_dict = profile if isinstance(profile, dict) else vars(profile) if hasattr(profile, "__dict__") else {}
        safe_message = desensitize(user_message, profile_dict)
        app_session_id = await conv.get_bailian_app_session(user_id, session_id)

        prompt = _build_norm_prompt(safe_message, norm_retriever)
        async for chunk in stream_bailian_app(prompt, session_id=app_session_id):
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
        await conv.save(user_id, session_id, user_message, accumulated, "norms")

    except Exception as exc:
        if accumulated:
            await conv.save(user_id, session_id, user_message, accumulated, "norms")
        yield fmt(SSEEvent(type=EventType.ERROR, content=_safe_error(exc)))
