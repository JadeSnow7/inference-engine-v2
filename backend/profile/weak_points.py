"""
profile/weak_points.py
======================
User-behaviour-driven weak-point tracking system.

Design principle (approved by reviewer):
  Weak-point updates are driven by USER INPUT BEHAVIOUR, not by what the
  assistant says.  Specifically:
    - A user ASKING about a concept  → concepts += 1  (surfacing ignorance)
    - A user DEMONSTRATING knowledge → concepts -= 1  (forgetting curve decay)
  Entries that reach 0 are pruned from the map.

Why this matters:
  Recording assistant output as weak-point evidence risks marking "things the
  system mentioned" as "things the user doesn't understand" — a false positive
  that degrades personalisation quality.
"""

from __future__ import annotations

import json
import logging

from core.stream import call_model_once

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

_EXTRACT_ASK_PROMPT = """\
你是一个学术概念提取器。

以下是用户发送给学术写作助手的消息。请判断用户是否在主动询问、寻求解释、或表达对某个学术概念的困惑。
如果是，提取这些概念；如果用户只是下达任务指令（比如"帮我生成开题报告"），则返回空列表。

输出格式（只输出 JSON，不要 markdown）：
{"asking_concepts": ["概念1", "概念2"]}

用户消息：
{user_message}"""

_EXTRACT_DEMONSTRATE_PROMPT = """\
你是一个学术概念提取器。

以下是用户发送给学术写作助手的消息。请判断用户是否在运用、复述、或主动引用某个学术概念，
表现出对该概念的理解（与"询问"相反）。提取这些概念。

输出格式（只输出 JSON，不要 markdown）：
{"demonstrated_concepts": ["概念1", "概念2"]}

用户消息：
{user_message}"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def extract_user_intent_concepts(user_message: str) -> tuple[list[str], list[str]]:
    """Analyse *user_message* and return (asking_concepts, demonstrated_concepts).

    Both lists contain raw concept strings as returned by the model.
    Empty lists are returned gracefully on any error.
    """
    try:
        ask_raw, demo_raw = await _call_both(user_message)
        asking = _parse_list(ask_raw, "asking_concepts")
        demonstrated = _parse_list(demo_raw, "demonstrated_concepts")
        return asking, demonstrated
    except Exception:
        logger.exception("weak_points: concept extraction failed — skipping update")
        return [], []


def update_weak_points(weak_points: dict, asking: list[str], demonstrated: list[str]) -> dict:
    """Return an updated copy of *weak_points* based on this round's evidence.

    Rules:
      - Newly asked concepts: count += 1
      - Demonstrated concepts: count -= 1
      - Entries that reach <= 0 are removed
    """
    updated = dict(weak_points)

    for concept in asking:
        concept = concept.strip()
        if concept:
            updated[concept] = updated.get(concept, 0) + 1

    for concept in demonstrated:
        concept = concept.strip()
        if concept and concept in updated:
            updated[concept] = updated[concept] - 1
            if updated[concept] <= 0:
                del updated[concept]

    return updated


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _call_both(user_message: str) -> tuple[str, str]:
    """Issue both extraction calls. We do them sequentially to avoid
    overloading the rate limit on smaller-quota accounts."""
    ask_raw = await call_model_once(
        [{"role": "user", "content": _EXTRACT_ASK_PROMPT.format(user_message=user_message)}],
        temperature=0.0,
        max_tokens=200,
    )
    demo_raw = await call_model_once(
        [{"role": "user", "content": _EXTRACT_DEMONSTRATE_PROMPT.format(user_message=user_message)}],
        temperature=0.0,
        max_tokens=200,
    )
    return ask_raw, demo_raw


def _parse_list(raw: str, key: str) -> list[str]:
    try:
        data = json.loads(raw.strip())
        items = data.get(key, [])
        return [str(item) for item in items if item]
    except Exception:
        return []
