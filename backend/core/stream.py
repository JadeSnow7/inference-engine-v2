"""
core/stream.py
==============
Low-level DashScope / OpenAI-compatible model wrappers.

Key changes vs original:
  - _ThinkingSanitizer: handles <think>...</think> tags that may span chunk
    boundaries, discarding thinking content and yielding only visible tokens.
  - stream_model() now pipes through the sanitizer.
  - call_model_once() accepts optional thinking / thinking_budget parameters
    for non-streaming calls that need the thinking mode (e.g. review stages).
"""

from __future__ import annotations

from collections.abc import AsyncIterator

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


def _client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=settings.DASHSCOPE_API_KEY, base_url=settings.DASHSCOPE_BASE_URL)


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
    extra_body = {"enable_thinking": True, "thinking_budget": thinking_budget} if thinking else None
    stream = await _client().chat.completions.create(
        model=settings.MODEL_NAME,
        messages=messages,
        temperature=temperature,
        stream=True,
        max_tokens=4096,
        extra_body=extra_body,
    )
    sanitizer = _ThinkingSanitizer()
    async for chunk in stream:
        choice = chunk.choices[0] if chunk.choices else None
        if choice is None:
            continue
        delta = choice.delta
        # DashScope exposes thinking content in reasoning_content, and the
        # visible text in content. We merge both through the sanitizer so that
        # either API surface (new reasoning_content field OR embedded tags)
        # is handled correctly.
        reasoning = getattr(delta, "reasoning_content", None) or ""
        content = getattr(delta, "content", None) or ""

        # If the API strips thinking into reasoning_content we discard it
        # directly. If it embeds <think> tags in content, the sanitizer strips them.
        if reasoning:
            # Already separated by API — discard.
            pass
        if content:
            visible = sanitizer.feed(content)
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
    extra_body = {"enable_thinking": True, "thinking_budget": thinking_budget} if thinking else None
    response = await _client().chat.completions.create(
        model=settings.MODEL_NAME,
        messages=messages,
        temperature=temperature,
        stream=False,
        max_tokens=max_tokens,
        extra_body=extra_body,
    )
    raw = response.choices[0].message.content or ""
    # Strip any embedded <think>...</think> from non-streaming responses as well.
    sanitizer = _ThinkingSanitizer()
    visible = sanitizer.feed(raw)
    visible += sanitizer.flush()
    return visible
