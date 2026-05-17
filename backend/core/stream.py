"""
core/stream.py
==============
Low-level model wrappers for the configured DashScope App-compatible Responses API.

Key changes vs original:
  - _ThinkingSanitizer: handles <think>...</think> tags that may span chunk
    boundaries, discarding thinking content and yielding only visible tokens.
  - stream_model() now pipes through the sanitizer.
  - call_model_once() accepts optional thinking / thinking_budget parameters
    for non-streaming calls that need the thinking mode (e.g. review stages).
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from openai import AsyncOpenAI

from config import settings

# Longest tag we need to detect across a chunk boundary is </think> = 8 chars.
# We keep a trailing buffer of (8-1)=7 chars so a split tag is always caught.
_BOUNDARY_WINDOW = len("</think>") - 1  # = 7


class _ThinkingSanitizer:
    """Stream filter that drops <think>…</think> blocks from model output.

    Qwen3 thinking mode may emit:
        <think>\\n...reasoning text...\\n</think>\\n visible content

    across multiple streaming chunks. This sanitizer maintains a small
    carry-over buffer to detect tags that straddle chunk boundaries.
    """

    def __init__(self):
        self._buf: str = ""
        self._in_think: bool = False

    def feed(self, chunk: str) -> str:
        """Feed a raw chunk; return the visible portion (may be empty string)."""
        self._buf += chunk
        out_parts: list[str] = []

        while True:
            if self._in_think:
                end = self._buf.find("</think>")
                if end == -1:
                    # End tag not found — keep tail as buffer, discard the rest.
                    self._buf = self._buf[-_BOUNDARY_WINDOW:]
                    break
                # Found the closing tag; discard everything up to and including it.
                self._buf = self._buf[end + len("</think>"):]
                self._in_think = False
            else:
                start = self._buf.find("<think>")
                if start == -1:
                    # No opening tag — yield all but the boundary window.
                    safe_len = max(0, len(self._buf) - _BOUNDARY_WINDOW)
                    out_parts.append(self._buf[:safe_len])
                    self._buf = self._buf[safe_len:]
                    break
                # Emit text before the tag, then enter thinking mode.
                out_parts.append(self._buf[:start])
                self._buf = self._buf[start + len("<think>"):]
                self._in_think = True

        return "".join(out_parts)

    def flush(self) -> str:
        """Flush any remaining buffered visible content at end-of-stream."""
        if self._in_think:
            # Stream ended inside a thinking block — discard remaining buffer.
            self._buf = ""
            return ""
        out = self._buf
        self._buf = ""
        return out


def _messages_to_prompt(messages: list[dict]) -> str:
    parts: list[str] = []
    for message in messages:
        role = str(message.get("role") or "user")
        content = message.get("content") or ""
        parts.append(f"[{role}]\n{content}")
    return "\n\n".join(parts)


async def stream_model(
    messages: list[dict],
    temperature: float,
    thinking: bool = False,
    thinking_budget: int = 2000,
) -> AsyncIterator[str]:
    """Yield visible token chunks from a streaming model call.

    If *thinking* is True the response may contain <think>…</think> blocks
    which are transparently stripped by *_ThinkingSanitizer*.
    """
    _ = temperature, thinking, thinking_budget
    sanitizer = _ThinkingSanitizer()
    async with _dashscope_app_client() as client:
        events = await client.responses.create(input=_messages_to_prompt(messages), stream=True)
        async for event in events:
            text = _stream_event_text(event)
            if text:
                visible = sanitizer.feed(text)
                if visible:
                    yield visible

    # Flush any remaining visible text.
    remaining = sanitizer.flush()
    if remaining:
        yield remaining


async def call_model_once(
    messages: list[dict],
    temperature: float,
    thinking: bool = False,
    thinking_budget: int = 500,
    max_tokens: int = 1000,
) -> str:
    """Non-streaming model call. Returns the full assistant text."""
    _ = temperature, thinking, thinking_budget, max_tokens
    async with _dashscope_app_client() as client:
        response = await client.responses.create(input=_messages_to_prompt(messages), stream=False)
    raw = _response_text(response)
    # Strip any embedded <think>...</think> from non-streaming responses as well.
    sanitizer = _ThinkingSanitizer()
    visible = sanitizer.feed(raw)
    visible += sanitizer.flush()
    return visible


def _dashscope_app_client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=settings.DASHSCOPE_API_KEY, base_url=settings.dashscope_app_base_url)


def _response_text(response: Any) -> str:
    output_text = getattr(response, "output_text", None)
    if output_text:
        return str(output_text)

    parts: list[str] = []
    for item in getattr(response, "output", []) or []:
        for content in getattr(item, "content", []) or []:
            text = getattr(content, "text", None)
            if text:
                parts.append(str(text))
    return "\n".join(parts)


def _stream_event_text(event: Any) -> str:
    if getattr(event, "type", "") == "response.output_text.delta":
        return str(getattr(event, "delta", "") or "")
    delta = getattr(event, "delta", None)
    if isinstance(delta, str):
        return delta
    return ""
