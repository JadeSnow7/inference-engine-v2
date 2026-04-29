"""
pipelines/guided.py
====================
苏格拉底式引导学习流水线 — 适用于 teaching_style='step_by_step' 用户。

设计原则：
  不代写任何段落，而是通过提问引导用户自己思考。每次只给一个问题 + 支撑依据，
  等待用户回答后再给下一个问题（对话驱动）。

触发条件：
  user profile.teaching_style == 'step_by_step' 时，main_loop 路由到此流水线。

阶段：
  Stage 1  意图理解      确认用户想完成的具体目标
  Stage 2  文献引入      从 Graph-RAG 提取 1-2 篇最相关文献作为问题背景
  Stage 3  苏格拉底提问  生成 3 个层进式问题（认知→分析→创新）
  Stage 4  弱点提示      根据 weak_points 在结尾追加个性化提示

ThinkingConfig: guided_learning (ON, budget=1000, temp=0.4)
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

from core.events import EventType, SSEEvent, fmt
from core.stream import call_model_once, stream_model
from core.thinking import cfg
from pipelines.base import format_rag_context
from profile.inject import inject_user_profile
from prompts.system import ACADEMIC_SYSTEM_PROMPT

# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

_GUIDED_PROMPT = """\
你是一个学术写作教练，采用苏格拉底提问法引导学生完成论文写作。

学生正在处理以下写作任务：
{user_message}

可参考的文献背景（无需全部使用）：
{rag_context}

学生的薄弱知识点（请在问题中适当关注）：
{weak_points_hint}

请设计 3 个层进式引导问题，格式如下：
**问题 1（认知层）**：帮助学生理解领域基本概念
**问题 2（分析层）**：引导学生梳理文献发现
**问题 3（创新层）**：激发学生思考研究切入点

只给问题，不给答案，不代写。用鼓励性语气，每个问题不超过 3 句。"""

_INTENT_CONFIRM_PROMPT = """\
请用一句话（不超过 30 字）确认以下写作任务的核心目标，只输出该句话：
{user_message}"""


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

async def _stream_guided(
    user_message: str,
    history: list[dict],
    profile: dict,
    rag,
) -> AsyncIterator[str]:
    """Guided Socratic pipeline for step_by_step teaching style."""

    # ---- Stage 1: Intent confirmation ----------------------------------
    yield fmt(SSEEvent(type=EventType.STAGE, stage="任务理解"))
    tc = cfg("intent_parse")
    confirmed_intent = await call_model_once(
        [{"role": "user", "content": _INTENT_CONFIRM_PROMPT.format(user_message=user_message)}],
        temperature=tc.temperature,
    )
    yield fmt(SSEEvent(type=EventType.TOKEN, content=f"📌 **任务确认**：{confirmed_intent}\n\n"))

    # ---- Stage 2: Literature retrieval (single round, lightweight) ------
    yield fmt(SSEEvent(type=EventType.STAGE, stage="文献背景引入"))
    papers = await asyncio.to_thread(rag.retrieve_literature, user_message, 3)
    papers = papers[:2]   # Only top-2 for guided mode (keep it focused)
    if papers:
        yield fmt(SSEEvent(type=EventType.PAPERS, data=papers))

    rag_context = format_rag_context(papers, [])

    # ---- Stage 3: Socratic question generation -------------------------
    yield fmt(SSEEvent(type=EventType.STAGE, stage="引导问题生成"))

    # Build weak_points hint string
    weak_points: dict = {}
    if isinstance(profile, dict):
        weak_points = profile.get("weak_points", {})
    else:
        weak_points = getattr(profile, "weak_points", {})

    weak_points_hint = (
        "、".join(list(weak_points.keys())[:5]) if weak_points else "（暂无记录，全面引导）"
    )

    sys_prompt = inject_user_profile(ACADEMIC_SYSTEM_PROMPT.format(paper_context=rag_context), profile)
    tc_guided = cfg("guided_learning")
    messages = [
        {"role": "system", "content": sys_prompt},
        *history[-4:],
        {
            "role": "user",
            "content": _GUIDED_PROMPT.format(
                user_message=user_message,
                rag_context=rag_context,
                weak_points_hint=weak_points_hint,
            ),
        },
    ]

    async for token in stream_model(
        messages,
        temperature=tc_guided.temperature,
        thinking=tc_guided.thinking,
        thinking_budget=tc_guided.budget,
    ):
        yield fmt(SSEEvent(type=EventType.TOKEN, content=token))

    # ---- Stage 4: Personalised weak-point reminder ----------------------
    if weak_points:
        top_wp = list(weak_points.items())
        top_wp.sort(key=lambda kv: kv[1], reverse=True)
        top_terms = "、".join(k for k, _ in top_wp[:3])
        reminder = (
            f"\n\n---\n💡 **个性化提示**：根据你之前的提问记录，"
            f"建议在回答时重点关注「{top_terms}」等概念，这些是你历史上多次关注的知识点。"
        )
        yield fmt(SSEEvent(type=EventType.TOKEN, content=reminder))
