import asyncio
import json
import re
from collections.abc import AsyncIterator

from core.events import EventType, SSEEvent, fmt
from core.stream import call_model_once, stream_model
from pipelines.base import format_rag_context
from profile.inject import inject_user_profile
from prompts.system import ACADEMIC_SYSTEM_PROMPT

KEYWORD_PROMPT = """给定研究主题，扩展 5-8 个相关检索关键词（含英文），输出 JSON：
{"keywords":["关键词1","keyword2"]}

主题：{topic}"""


def _group_by_year(papers: list[dict]) -> list[list[dict]]:
    ordered = sorted(papers, key=lambda item: item.get("year", 0))
    return [ordered[i : i + 3] for i in range(0, len(ordered), 3)]


async def _stream_review(user_message: str, history: list[dict], profile: dict, rag) -> AsyncIterator[str]:
    yield fmt(SSEEvent(type=EventType.STAGE, stage="关键词扩展"))
    raw = await call_model_once([{"role": "user", "content": KEYWORD_PROMPT.format(topic=user_message)}], temperature=0)
    try:
        keywords = json.loads(raw).get("keywords", [])
    except Exception:
        keywords = [user_message]
    if not keywords:
        keywords = [user_message]

    yield fmt(SSEEvent(type=EventType.STAGE, stage="文献聚类检索"))
    batches = await asyncio.gather(*[asyncio.to_thread(rag.retrieve_literature, keyword, 5) for keyword in keywords[:8]])
    merged: dict[str, dict] = {}
    for batch in batches:
        for item in batch:
            current = merged.get(item["id"])
            if current is None or item.get("score", 0) > current.get("score", 0):
                merged[item["id"]] = item
    top_papers = sorted(merged.values(), key=lambda item: item.get("score", 0), reverse=True)[:10]
    yield fmt(SSEEvent(type=EventType.PAPERS, data=top_papers))

    sys_prompt = inject_user_profile(ACADEMIC_SYSTEM_PROMPT.format(paper_context=format_rag_context(top_papers, [])), profile)
    generated: list[str] = []
    groups = _group_by_year(top_papers)
    for idx, group in enumerate(groups):
        yield fmt(SSEEvent(type=EventType.STAGE, stage=f"综合写作 {idx + 1}/{len(groups)}"))
        paper_block = "\n".join([f"- {paper['title']}（{paper['year']}）" for paper in group])
        messages = [
            {"role": "system", "content": sys_prompt},
            *history[-4:],
            {"role": "user", "content": f"基于以下论文写 2-3 句文献综述段落：\n{paper_block}"},
        ]
        async for token in stream_model(messages, temperature=0.4):
            generated.append(token)
            yield fmt(SSEEvent(type=EventType.TOKEN, content=token))

    text = "".join(generated)
    pending_refs = len(re.findall(r"\[REF-待补充\]", text))
    yield fmt(SSEEvent(type=EventType.TOKEN, content=f"\n\n【引用核查】共 {pending_refs} 处待补充文献，请核实后填入。"))

