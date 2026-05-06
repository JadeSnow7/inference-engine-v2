"""
pipelines/proposal.py
=====================
开题报告五阶段流水线

Stage 1  意图解析         ThinkingConfig: intent_parse  (OFF, temp=0.0)
Stage 2  Graph-RAG 检索  asyncio.gather — emits papers / gaps SSE events
Stage 3  研究空白分析    ThinkingConfig: gap_analysis   (ON,  budget=3000, temp=0.3)
Stage 4  大纲生成        ThinkingConfig: outline_gen    (ON,  budget=1500, temp=0.4)
Stage 5  审核修订        Loop LM, budget decreasing (2000→800→400), quality-driven exit
         Demo mode:      max_loops=1 (DEMO_MODE=True in core/thinking.py)

产物收集:
  Pipeline returns _ProposalArtifacts alongside the SSE stream so that
  main_loop can persist papers / gaps / final_outline to Redis.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

from core.events import EventType, SSEEvent, fmt
from core.stream import call_model_once, stream_model
from core.thinking import DEMO_MODE, LOOP_CONFIGS, cfg
from pipelines.base import format_rag_context, teaching_style_hint
from profile.inject import inject_user_profile
from prompts.system import ACADEMIC_SYSTEM_PROMPT

# ---------------------------------------------------------------------------
# Intent parsing
# ---------------------------------------------------------------------------

_INTENT_PROMPT = """\
提取用户意图，输出 JSON（不要 markdown）：
{"topic":"研究主题","domain":"领域","stage":"开题/中期/组会","keywords":["关键词1"]}

用户请求：{user_message}"""


def _fallback_intent(user_message: str) -> dict:
    return {"topic": user_message[:30], "domain": "集成电路", "stage": "开题", "keywords": []}


async def _parse_intent(user_message: str) -> dict:
    tc = cfg("intent_parse")
    raw = await call_model_once(
        [{"role": "user", "content": _INTENT_PROMPT.format(user_message=user_message)}],
        temperature=tc.temperature,
    )
    try:
        return json.loads(raw)
    except Exception:
        return _fallback_intent(user_message)


# ---------------------------------------------------------------------------
# Self-critique loop (Stage 5)
# ---------------------------------------------------------------------------

_LOOP_REVIEW_PROMPT = """\
你是严格的学术大纲审核专家。请对以下开题报告大纲进行审核，输出 JSON（不要 markdown）：

{{
  "revised_outline": "<如果需要修改则输出修订后的大纲，否则原样返回>",
  "continue_reason": "<如仍不满意，说明继续修订的理由；如满意则留空字符串>",
  "score": <0-10 的整数评分>
}}

评分标准：
  8+ 分 = 结构完整、逻辑清晰、与研究方向高度相关
  6-7 分 = 基本合格，存在小问题
  ≤5 分 = 需要大幅修订

当前大纲：
{outline}"""


async def _loop_refine(
    outline: str,
    sys_prompt: str,
    history: list[dict],
) -> AsyncIterator[tuple[str, str]]:
    """Async generator that yields (stage_label, token) pairs.

    Runs the self-critique loop up to max_loops iterations with decreasing
    thinking budgets.  Exits early when the model is satisfied (score >= 8
    or continue_reason == '').

    In DEMO_MODE, max_loops is capped at 1 to ensure fast demo runs.
    """
    max_loops = 1 if DEMO_MODE else len(LOOP_CONFIGS)
    current_outline = outline

    for i in range(max_loops):
        tc = LOOP_CONFIGS[i]
        round_label = f"审核修订（第 {i + 1} 轮）"
        yield (round_label, "")   # sentinel — caller emits stage event

        messages = [
            {"role": "system", "content": sys_prompt},
            *history[-4:],
            {"role": "user", "content": _LOOP_REVIEW_PROMPT.format(outline=current_outline)},
        ]

        # Collect full response to parse JSON result
        tokens: list[str] = []
        async for token in stream_model(
            messages,
            temperature=tc.temperature,
            thinking=tc.thinking,
            thinking_budget=tc.budget,
        ):
            tokens.append(token)
            yield (round_label, token)   # forward token to caller

        raw_response = "".join(tokens)

        # Parse JSON evaluation from the model's response
        try:
            # Model may wrap JSON in markdown fences — strip them
            cleaned = raw_response.strip().removeprefix("```json").removesuffix("```").strip()
            result = json.loads(cleaned)
        except Exception:
            # Can't parse — treat as satisfied to avoid infinite loop
            break

        score = result.get("score", 10)
        continue_reason = result.get("continue_reason", "")
        revised = result.get("revised_outline", "")

        if revised:
            current_outline = revised

        # Exit conditions: model is satisfied OR score is ≥8
        if not continue_reason or score >= 8:
            break


# ---------------------------------------------------------------------------
# Artifacts dataclass — returned via the pipeline's _artifacts ref
# ---------------------------------------------------------------------------

@dataclass
class _ProposalArtifacts:
    papers: list[dict] = field(default_factory=list)
    gaps: list[dict] = field(default_factory=list)
    final_outline: str = ""


# ---------------------------------------------------------------------------
# Main pipeline entry point
# ---------------------------------------------------------------------------

async def _stream_proposal(
    user_message: str,
    history: list[dict],
    profile: dict,
    rag,
    artifacts: "_ProposalArtifacts | None" = None,
) -> AsyncIterator[str]:
    """Stream the proposal pipeline SSE events.

    If *artifacts* is provided (a _ProposalArtifacts instance), it is
    populated in-place so main_loop can persist the data to Redis.
    """
    # ---- Stage 1: Intent parsing ----------------------------------------
    yield fmt(SSEEvent(type=EventType.STAGE, stage="意图解析"))
    intent = await _parse_intent(user_message)

    # ---- Stage 2: Iterative Graph-RAG retrieval -------------------------
    # iterative_gap_discovery is a synchronous generator; run it in a thread
    # to avoid blocking the async event loop.
    def _run_iterative():
        rounds = []
        for round_num, round_papers, round_gaps in rag.iterative_gap_discovery(
            query=intent["topic"],
            domain=intent["domain"],
            max_rounds=3,
        ):
            rounds.append((round_num, round_papers, round_gaps))
        return rounds

    iter_rounds = await asyncio.to_thread(_run_iterative)

    all_papers: dict[str, dict] = {}
    all_gaps: dict[str, dict] = {}

    for round_num, round_papers, round_gaps in iter_rounds:
        label = "文献检索中" if round_num == 1 else f"文献检索中（第 {round_num} 轮扩展）"
        yield fmt(SSEEvent(type=EventType.STAGE, stage=label))

        for p in round_papers:
            pid = p.get("id")
            if pid and (pid not in all_papers or p.get("score", 0) > all_papers[pid].get("score", 0)):
                all_papers[pid] = p
        for g in round_gaps:
            gid = g.get("id")
            if gid and gid not in all_gaps:
                all_gaps[gid] = g

    papers = sorted(all_papers.values(), key=lambda x: x.get("score", 0), reverse=True)[:5]
    gaps = sorted(all_gaps.values(), key=lambda x: x.get("score", 0), reverse=True)[:3]



    if artifacts is not None:
        artifacts.papers = papers
        artifacts.gaps = gaps

    yield fmt(SSEEvent(type=EventType.PAPERS, data=papers))
    yield fmt(SSEEvent(type=EventType.GAPS, data=gaps))

    # ---- Stage 3: Gap analysis ------------------------------------------
    rag_context = format_rag_context(papers, gaps)
    sys_prompt = inject_user_profile(ACADEMIC_SYSTEM_PROMPT.format(paper_context=rag_context), profile)

    tc = cfg("gap_analysis")
    yield fmt(SSEEvent(type=EventType.STAGE, stage="研究空白分析"))
    gap_tokens: list[str] = []
    messages = [
        {"role": "system", "content": sys_prompt},
        *history[-4:],
        {"role": "user", "content": rag_context + "\n\n请结合研究主题给出研究空白分析：" + intent["topic"]},
    ]
    async for token in stream_model(messages, temperature=tc.temperature, thinking=tc.thinking, thinking_budget=tc.budget):
        gap_tokens.append(token)
        yield fmt(SSEEvent(type=EventType.TOKEN, content=token))
    gap_analysis = "".join(gap_tokens)

    # ---- Stage 4: Outline generation ------------------------------------
    tc = cfg("outline_gen")
    yield fmt(SSEEvent(type=EventType.STAGE, stage="大纲生成"))
    style_hint = teaching_style_hint(profile.get("teaching_style", "directional") if isinstance(profile, dict) else getattr(profile, "teaching_style", "directional"))
    outline_tokens: list[str] = []
    messages = [
        {"role": "system", "content": sys_prompt},
        *history[-4:],
        {"role": "user", "content": "基于以下研究空白分析生成开题报告大纲：\n" + gap_analysis + "\n\n" + style_hint},
    ]
    async for token in stream_model(messages, temperature=tc.temperature, thinking=tc.thinking, thinking_budget=tc.budget):
        outline_tokens.append(token)
        yield fmt(SSEEvent(type=EventType.TOKEN, content=token))
    outline = "".join(outline_tokens)

    # ---- Stage 5: Self-critique loop ------------------------------------
    async for (stage_label, token) in _loop_refine(outline, sys_prompt, history):
        if not token:
            # Sentinel — emit stage event
            yield fmt(SSEEvent(type=EventType.STAGE, stage=stage_label))
        else:
            yield fmt(SSEEvent(type=EventType.TOKEN, content=token))

    if artifacts is not None:
        # final outline is the accumulated Stage 4 output (Loop may refine it
        # but the raw outline is the primary product for history sidebar)
        artifacts.final_outline = outline
