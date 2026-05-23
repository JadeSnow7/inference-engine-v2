from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Callable

from openai import AsyncOpenAI

from config import settings


class RetryableModelError(RuntimeError):
    """Transient model output or service failure that can be retried."""


@dataclass(frozen=True)
class StageStrategy:
    model: str
    thinking: bool = False
    reasoning_effort: str | None = None
    temperature: float | None = None
    top_p: float | None = None
    json_output: bool = False
    max_tokens: int = 2048


class DeepSeekProvider:
    def __init__(self, client_factory: Callable[[], AsyncOpenAI] | None = None):
        self._client_factory = client_factory or (
            lambda: AsyncOpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)
        )

    async def complete_json(self, messages: list[dict], strategy: StageStrategy) -> dict:
        raw = await self._complete(messages, strategy)
        if not raw.strip():
            raise RetryableModelError("DeepSeek returned empty JSON content")
        try:
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            raise RetryableModelError("DeepSeek returned invalid JSON content") from exc

    async def revise_text(self, text: str, instruction: str, strategy: StageStrategy) -> str:
        raw = await self._complete([
            {"role": "system", "content": instruction},
            {"role": "user", "content": text},
        ], strategy)
        if not raw.strip():
            raise RetryableModelError("DeepSeek returned empty revision content")
        return raw.strip()

    async def _complete(self, messages: list[dict], strategy: StageStrategy) -> str:
        kwargs: dict[str, Any] = {
            "model": strategy.model,
            "messages": messages,
            "stream": False,
            "max_tokens": strategy.max_tokens,
        }
        if strategy.thinking:
            kwargs["extra_body"] = {"thinking": {"type": "enabled"}}
            if strategy.reasoning_effort:
                kwargs["reasoning_effort"] = strategy.reasoning_effort
        else:
            kwargs["extra_body"] = {"thinking": {"type": "disabled"}}
            if strategy.temperature is not None:
                kwargs["temperature"] = strategy.temperature
            if strategy.top_p is not None:
                kwargs["top_p"] = strategy.top_p
        if strategy.json_output:
            kwargs["response_format"] = {"type": "json_object"}

        try:
            async with self._client_factory() as client:
                response = await client.chat.completions.create(**kwargs)
        except Exception as exc:
            status_code = getattr(exc, "status_code", None)
            if status_code in {429, 500, 502, 503, 504}:
                raise RetryableModelError(f"DeepSeek retryable service error: {status_code}") from exc
            raise

        message = response.choices[0].message
        return message.content or ""


class HeuristicEditingProvider:
    """Deterministic local provider for tests and unconfigured development runs."""

    async def complete_json(self, messages: list[dict], strategy: StageStrategy) -> dict:
        _ = messages, strategy
        return {
            "summary": "已完成结构化诊断。",
            "risk_level": "low",
            "recommendations": ["保持事实边界", "优先做局部补丁"],
        }

    async def revise_text(self, text: str, instruction: str, strategy: StageStrategy) -> str:
        _ = strategy
        normalized = " ".join(text.split()) if "SCI" in instruction else text.strip()
        if "引用" in instruction and "unresolved" not in normalized:
            return f"{normalized}（需补充可核验引用）"
        if "降重" in instruction or "人类化" in instruction:
            return normalized.replace("本文首先", "在梳理既有研究的基础上，本文")
        return f"{normalized}（已优化）"
