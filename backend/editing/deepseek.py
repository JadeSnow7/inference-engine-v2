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
        self._client_factory = client_factory

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
            {"role": "system", "content": (
                "你是学术论文编辑器。\n"
                f"{instruction}\n"
                "工作规则：你已经收到待修订正文，不要要求用户再次提供原文；"
                "仅返回修订后正文，不要解释、确认、列出步骤或输出 Markdown 列表。"
            )},
            {"role": "user", "content": f"待修订正文：\n<<<正文>>>\n{text}\n<<<正文结束>>>"},
        ], strategy)
        if not raw.strip():
            raise RetryableModelError("DeepSeek returned empty revision content")
        return raw.strip()

    async def _complete(self, messages: list[dict], strategy: StageStrategy) -> str:
        if self._should_use_dashscope_app():
            async with _dashscope_app_client() as client:
                response = await client.responses.create(
                    input=_messages_to_app_prompt(messages, strategy),
                    stream=False,
                )
            return _response_text(response)

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
            client_factory = self._client_factory or _default_client_factory
            async with client_factory() as client:
                response = await client.chat.completions.create(**kwargs)
        except Exception as exc:
            status_code = getattr(exc, "status_code", None)
            if status_code in {429, 500, 502, 503, 504}:
                raise RetryableModelError(f"DeepSeek retryable service error: {status_code}") from exc
            raise

        message = response.choices[0].message
        return message.content or ""

    def _should_use_dashscope_app(self) -> bool:
        return self._client_factory is None and not settings.DEEPSEEK_API_KEY


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


def _default_client_factory() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)


def _dashscope_app_client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=settings.DASHSCOPE_API_KEY, base_url=settings.dashscope_app_base_url)


def _messages_to_app_prompt(messages: list[dict], strategy: StageStrategy) -> str:
    parts = [
        "[editing_strategy]",
        f"model={strategy.model}",
        f"thinking={strategy.thinking}",
        f"reasoning_effort={strategy.reasoning_effort or ''}",
        f"response_format={'json_object' if strategy.json_output else 'text'}",
        f"max_tokens={strategy.max_tokens}",
    ]
    if strategy.temperature is not None:
        parts.append(f"temperature={strategy.temperature}")
    if strategy.top_p is not None:
        parts.append(f"top_p={strategy.top_p}")
    for message in messages:
        role = str(message.get("role") or "user")
        content = message.get("content") or ""
        parts.append(f"\n[{role}]\n{content}")
    return "\n".join(parts)


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
