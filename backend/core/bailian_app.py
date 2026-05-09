from __future__ import annotations

import asyncio
import threading
from dataclasses import dataclass
from http import HTTPStatus
from typing import Any

from config import settings


class BailianAppError(RuntimeError):
    pass


@dataclass
class BailianAppChunk:
    text: str = ""
    session_id: str = ""
    request_id: str = ""
    references: list[dict] | None = None


def _require_configured() -> None:
    if not settings.ENABLE_BAILIAN_APP:
        raise BailianAppError("百炼规范助手未启用")
    if not settings.DASHSCOPE_APP_ID:
        raise BailianAppError("缺少 DASHSCOPE_APP_ID")
    if not settings.DASHSCOPE_API_KEY:
        raise BailianAppError("缺少 DASHSCOPE_API_KEY")


def _load_application():
    try:
        from dashscope import Application
    except ImportError as exc:
        raise BailianAppError("缺少 dashscope SDK，请先安装依赖") from exc
    return Application


def _sanitize_references(value: Any) -> list[dict]:
    if value is None:
        return []
    if isinstance(value, dict):
        items = [value]
    elif isinstance(value, list):
        items = [item for item in value if isinstance(item, dict)]
    else:
        return []
    return [_strip_sensitive_urls(item) for item in items]


def _strip_sensitive_urls(value: Any) -> Any:
    if isinstance(value, dict):
        cleaned = {}
        for key, item in value.items():
            lowered = str(key).lower()
            if lowered in {"fileurl", "downloadurl", "signedurl"} or lowered.endswith("url"):
                continue
            cleaned[key] = _strip_sensitive_urls(item)
        return cleaned
    if isinstance(value, list):
        return [_strip_sensitive_urls(item) for item in value]
    return value


def _output_attr(output: Any, name: str, default: Any = "") -> Any:
    if output is None:
        return default
    if isinstance(output, dict):
        return output.get(name, default)
    return getattr(output, name, default)


def _raise_for_response(response: Any) -> None:
    status_code = getattr(response, "status_code", None)
    if status_code == HTTPStatus.OK:
        return
    request_id = getattr(response, "request_id", "")
    code = getattr(response, "code", "")
    message = getattr(response, "message", "") or "百炼应用调用失败"
    raise BailianAppError(f"{message} request_id={request_id} error_code={code} status_code={status_code}")


def _chunk_from_response(response: Any) -> BailianAppChunk:
    output = getattr(response, "output", None)
    return BailianAppChunk(
        text=str(_output_attr(output, "text", "") or ""),
        session_id=str(_output_attr(output, "session_id", "") or ""),
        request_id=str(getattr(response, "request_id", "") or ""),
        references=_sanitize_references(_output_attr(output, "doc_references", None)),
    )


async def call_bailian_app_once(prompt: str, session_id: str | None = None) -> BailianAppChunk:
    _require_configured()
    Application = _load_application()

    def _call() -> BailianAppChunk:
        kwargs = {
            "api_key": settings.DASHSCOPE_API_KEY,
            "app_id": settings.DASHSCOPE_APP_ID,
            "prompt": prompt,
        }
        if session_id:
            kwargs["session_id"] = session_id
        response = Application.call(**kwargs)
        _raise_for_response(response)
        return _chunk_from_response(response)

    return await asyncio.to_thread(_call)


async def stream_bailian_app(prompt: str, session_id: str | None = None):
    _require_configured()
    Application = _load_application()
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()
    sentinel = object()

    def _worker() -> None:
        try:
            kwargs = {
                "api_key": settings.DASHSCOPE_API_KEY,
                "app_id": settings.DASHSCOPE_APP_ID,
                "prompt": prompt,
                "stream": True,
                "incremental_output": True,
            }
            if session_id:
                kwargs["session_id"] = session_id

            responses = Application.call(**kwargs)
            for response in responses:
                _raise_for_response(response)
                loop.call_soon_threadsafe(queue.put_nowait, _chunk_from_response(response))
        except Exception as exc:
            loop.call_soon_threadsafe(queue.put_nowait, exc)
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, sentinel)

    threading.Thread(target=_worker, daemon=True).start()

    while True:
        item = await queue.get()
        if item is sentinel:
            break
        if isinstance(item, Exception):
            raise item
        yield item
