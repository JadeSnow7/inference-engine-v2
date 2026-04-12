from collections.abc import AsyncIterator

from core.events import EventType, SSEEvent, fmt
from core.stream import call_model_once


def _detect_task(user_message: str) -> str:
    if "摘要" in user_message and ("英文" in user_message or "翻译" in user_message):
        return "请将以下内容翻译为学术英文摘要：\n"
    if "压缩" in user_message or "精简" in user_message:
        return "请在保留核心信息的前提下压缩字数：\n"
    return "请按 GB/T 7714-2015 格式整理以下引用：\n"


async def _stream_format(user_message: str, history: list[dict]) -> AsyncIterator[str]:
    prompt = _detect_task(user_message) + user_message
    result = await call_model_once([*history[-4:], {"role": "user", "content": prompt}], temperature=0)
    yield fmt(SSEEvent(type=EventType.TOKEN, content=result))

