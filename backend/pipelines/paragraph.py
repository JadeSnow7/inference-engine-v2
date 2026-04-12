import asyncio
from collections.abc import AsyncIterator

from core.events import EventType, SSEEvent, fmt
from core.stream import stream_model
from profile.inject import inject_user_profile
from prompts.system import ACADEMIC_SYSTEM_PROMPT

ORAL_WORDS = ["就是", "其实", "大概", "应该"]


async def _stream_paragraph(user_message: str, history: list[dict], profile: dict, rag) -> AsyncIterator[str]:
    papers = await asyncio.to_thread(rag.retrieve_literature, user_message, 3)
    context = "\n".join([f"- {item['title']}（{item['year']}）" for item in papers[:3]])
    system_with_context = inject_user_profile(ACADEMIC_SYSTEM_PROMPT.format(paper_context=context), profile)

    generated: list[str] = []
    yield fmt(SSEEvent(type=EventType.STAGE, stage="段落生成"))
    async for token in stream_model(
        [{"role": "system", "content": system_with_context}, *history[-6:], {"role": "user", "content": user_message}],
        temperature=0.3,
    ):
        generated.append(token)
        yield fmt(SSEEvent(type=EventType.TOKEN, content=token))

    text = "".join(generated)
    issues = [word for word in ORAL_WORDS if word in text]
    if issues:
        yield fmt(SSEEvent(type=EventType.TOKEN, content="\n\n【语态提示】以下表达建议修改：\n" + "\n".join(issues)))
