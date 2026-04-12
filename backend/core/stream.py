from collections.abc import AsyncIterator

from openai import AsyncOpenAI

from config import settings


def _client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=settings.DASHSCOPE_API_KEY, base_url=settings.DASHSCOPE_BASE_URL)


async def stream_model(messages, temperature: float, thinking: bool = False, thinking_budget: int = 2000) -> AsyncIterator[str]:
    extra_body = {"enable_thinking": True, "thinking_budget": thinking_budget} if thinking else None
    stream = await _client().chat.completions.create(
        model=settings.MODEL_NAME,
        messages=messages,
        temperature=temperature,
        stream=True,
        max_tokens=2000,
        extra_body=extra_body,
    )
    async for chunk in stream:
        choice = chunk.choices[0] if chunk.choices else None
        if choice is None:
            continue
        delta = choice.delta
        _ = getattr(delta, "reasoning_content", None)
        content = getattr(delta, "content", None)
        if content:
            yield content


async def call_model_once(messages, temperature: float) -> str:
    response = await _client().chat.completions.create(
        model=settings.MODEL_NAME,
        messages=messages,
        temperature=temperature,
        stream=False,
        max_tokens=500,
    )
    return response.choices[0].message.content or ""

