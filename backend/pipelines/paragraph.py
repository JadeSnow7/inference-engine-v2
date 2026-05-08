"""
pipelines/paragraph.py
=======================
段落写作流水线。

阶段：
  Stage 1  文献支撑检索  — 取 top-3 最相关文献作为写作背景
  Stage 2  段落生成     — streaming 输出学术段落
  Stage 3  语态检查     — 标记口语化表达
  Stage 4  薄弱点提示   — 根据 profile.weak_points 追加个性化提醒

ThinkingConfig: paragraph_write (ON, budget=3000, temp=0.3)
"""

import asyncio
from collections.abc import AsyncIterator

from core.events import EventType, SSEEvent, fmt
from core.stream import stream_model
from core.thinking import cfg
from profile.inject import inject_user_profile
from prompts.system import ACADEMIC_SYSTEM_PROMPT

ORAL_WORDS = ["就是", "其实", "大概", "应该", "感觉", "好像", "然后就", "总之就"]


async def _stream_paragraph(
    user_message: str,
    history: list[dict],
    profile: dict,
    rag,
) -> AsyncIterator[str]:

    # ── Stage 1: 文献支撑检索 ─────────────────────────────────
    yield fmt(SSEEvent(type=EventType.STAGE, stage="文献支撑检索"))
    papers = await asyncio.to_thread(rag.retrieve_literature, user_message, 5)
    papers = papers[:3]

    if papers:
        yield fmt(SSEEvent(type=EventType.PAPERS, data=papers))

    context_lines = []
    for item in papers:
        line = f"- {item.get('title', '未命名资料')}（{item.get('year') or '年份未知'}）"
        if item.get("snippet"):
            line += f"\n  摘要：{item['snippet']}"
        context_lines.append(line)
    paper_context = "\n".join(context_lines) if context_lines else "（暂无相关文献）"

    # ── Stage 2: 段落生成 ────────────────────────────────────
    yield fmt(SSEEvent(type=EventType.STAGE, stage="段落生成"))
    system_with_context = inject_user_profile(
        ACADEMIC_SYSTEM_PROMPT.format(paper_context=paper_context), profile
    )

    generated: list[str] = []
    tc = cfg("paragraph_write")
    async for token in stream_model(
        [
            {"role": "system", "content": system_with_context},
            *history[-6:],
            {"role": "user", "content": user_message},
        ],
        temperature=tc.temperature,
        thinking=tc.thinking,
        thinking_budget=tc.budget,
    ):
        generated.append(token)
        yield fmt(SSEEvent(type=EventType.TOKEN, content=token))

    text = "".join(generated)

    # ── Stage 3: 语态检查 ────────────────────────────────────
    issues = [word for word in ORAL_WORDS if word in text]
    if issues:
        hint = (
            "\n\n---\n**【语态检查】** 以下口语化表达建议修改为书面语："
            + "、".join(f"`{w}`" for w in issues)
        )
        yield fmt(SSEEvent(type=EventType.TOKEN, content=hint))

    # ── Stage 4: 薄弱点个性化提示 ───────────────────────────
    weak_points: dict = {}
    if isinstance(profile, dict):
        weak_points = profile.get("weak_points", {})
    else:
        weak_points = getattr(profile, "weak_points", {})

    if weak_points:
        top_wp = sorted(weak_points.items(), key=lambda kv: kv[1], reverse=True)
        terms = "、".join(k for k, _ in top_wp[:3])
        wp_hint = f"\n\n💡 **个性化提示**：你在写作时可以重点关注「{terms}」等概念的精准使用。"
        yield fmt(SSEEvent(type=EventType.TOKEN, content=wp_hint))
