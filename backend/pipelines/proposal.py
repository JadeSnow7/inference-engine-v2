import asyncio
import json
from collections.abc import AsyncIterator

from core.events import EventType, SSEEvent, fmt
from core.stream import call_model_once, stream_model
from pipelines.base import format_rag_context, teaching_style_hint
from profile.inject import inject_user_profile
from prompts.review import stage_review, stage_revise
from prompts.system import ACADEMIC_SYSTEM_PROMPT

INTENT_PROMPT = """提取用户意图，输出 JSON：
{"topic":"研究主题","domain":"领域","stage":"开题/中期/组会","keywords":["关键词1"]}

用户请求：{user_message}"""


def _fallback_intent(user_message: str) -> dict:
    return {"topic": user_message[:30], "domain": "集成电路", "stage": "开题", "keywords": []}


async def _parse_intent(user_message: str) -> dict:
    raw = await call_model_once([{"role": "user", "content": INTENT_PROMPT.format(user_message=user_message)}], temperature=0)
    try:
        return json.loads(raw)
    except Exception:
        return _fallback_intent(user_message)


async def _stream_proposal(user_message: str, history: list[dict], profile: dict, rag) -> AsyncIterator[str]:
    yield fmt(SSEEvent(type=EventType.STAGE, stage="意图解析"))
    intent = await _parse_intent(user_message)

    yield fmt(SSEEvent(type=EventType.STAGE, stage="文献检索中"))
    papers, gaps = await asyncio.gather(
        asyncio.to_thread(rag.retrieve_literature, intent["topic"], 8),
        asyncio.to_thread(rag.discover_research_gaps, intent["domain"], intent["topic"], 5),
    )
    yield fmt(SSEEvent(type=EventType.PAPERS, data=papers[:5]))
    yield fmt(SSEEvent(type=EventType.GAPS, data=gaps[:3]))

    rag_context = format_rag_context(papers, gaps)
    sys_prompt = inject_user_profile(ACADEMIC_SYSTEM_PROMPT.format(paper_context=rag_context), profile)

    yield fmt(SSEEvent(type=EventType.STAGE, stage="研究空白分析"))
    gap_tokens: list[str] = []
    messages = [
        {"role": "system", "content": sys_prompt},
        *history[-4:],
        {"role": "user", "content": rag_context + "\n\n请结合研究主题给出研究空白分析：" + intent["topic"]},
    ]
    async for token in stream_model(messages, temperature=0.4, thinking=True):
        gap_tokens.append(token)
        yield fmt(SSEEvent(type=EventType.TOKEN, content=token))
    gap_analysis = "".join(gap_tokens)

    yield fmt(SSEEvent(type=EventType.STAGE, stage="大纲生成"))
    style_hint = teaching_style_hint(profile.get("teaching_style", "directional"))
    outline_tokens: list[str] = []
    messages = [
        {"role": "system", "content": sys_prompt},
        *history[-4:],
        {"role": "user", "content": "基于以下研究空白分析生成开题报告大纲：\n" + gap_analysis + "\n\n" + style_hint},
    ]
    async for token in stream_model(messages, temperature=0.5):
        outline_tokens.append(token)
        yield fmt(SSEEvent(type=EventType.TOKEN, content=token))

    yield fmt(SSEEvent(type=EventType.STAGE, stage="审核修订"))
    outline = "".join(outline_tokens)
    review = await stage_review(outline)
    if not review.get("pass") and review.get("score", 8) < 7:
        revised = await stage_revise(outline, review)
        yield fmt(SSEEvent(type=EventType.TOKEN, content="\n\n---\n【已根据审核意见修订】\n\n" + revised))

