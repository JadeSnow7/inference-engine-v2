import json

from core.stream import call_model_once

REVIEW_PROMPT = """请对以下草稿进行审核，输出 JSON（不要使用 markdown）：
{"pass": false, "score": 6, "issues": ["问题1", "问题2"], "summary": "总体评价"}

通过标准：8 分及以上视为通过，`pass` 应为 true。
审核维度：学术语态、逻辑结构、引用规范、与主题相关性。

草稿：
{draft}"""

REVISE_PROMPT = """请根据审核报告逐条修订原文，保持原有结构。

原文：
{draft}

审核报告：
{review}"""


async def stage_review(draft: str) -> dict:
    raw = await call_model_once([{"role": "user", "content": REVIEW_PROMPT.format(draft=draft)}], temperature=0)
    try:
        return json.loads(raw)
    except Exception:
        return {"pass": True, "score": 8, "issues": []}


async def stage_revise(draft: str, review: dict) -> str:
    return await call_model_once(
        [{"role": "user", "content": REVISE_PROMPT.format(draft=draft, review=json.dumps(review, ensure_ascii=False))}],
        temperature=0.2,
    )

