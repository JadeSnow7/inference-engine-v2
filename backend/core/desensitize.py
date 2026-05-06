"""
core/desensitize.py
===================
Desensitize user content before sending to external LLM APIs (e.g. DashScope).

Strategy:
  1. Profile-based substitution — replace known name / advisor / student_id
     from the user's stored profile (exact string match, most reliable).
  2. Regex-based substitution — catch structural PII (phone, email, ID card,
     student numbers) that doesn't require semantic understanding.

Intentionally NOT attempting blind Chinese name detection via regex — the
false-positive rate on academic text is unacceptably high.
"""

from __future__ import annotations

import re

# ---------------------------------------------------------------------------
# Regex rules: (compiled_pattern, placeholder)
# Order matters: more specific patterns first.
# ---------------------------------------------------------------------------
_RULES: list[tuple[re.Pattern[str], str]] = [
    # Order matters: most specific patterns first to avoid being swallowed by
    # broader digit patterns.

    # Chinese resident ID card: 18 digits (last may be X/x) — before generic digit rule
    (re.compile(r'(?<!\d)\d{17}[\dXx](?!\d)'), '[身份证]'),
    # Letter-prefixed student ID: single letter + 8-12 digits (e.g. U/S/B/...)
    (re.compile(r'\b[A-Za-z]\d{8,12}\b'), '[学号]'),
    # Chinese mobile: 1[3-9] + 9 digits (11 total) — before generic digit rule
    (re.compile(r'(?<!\d)1[3-9]\d{9}(?!\d)'), '[电话]'),
    # Email address
    (re.compile(r'[\w.+\-]+@[\w\-]+\.[\w.\-]+'), '[邮箱]'),
    # Generic numeric student ID (8-12 digits) — broadest, must come last
    (re.compile(r'(?<!\d)\d{8,12}(?!\d)'), '[学号]'),
]


def desensitize(text: str, profile: dict | None = None) -> str:
    """Return *text* with PII replaced by neutral placeholders.

    Args:
        text:    The raw user message to sanitize.
        profile: The user's profile dict (may contain 'name', 'advisor',
                 'student_id').  Pass None or {} to skip profile-based rules.

    Returns:
        A new string with PII replaced.  The original string is unchanged.

    Example:
        >>> desensitize("我是张三，学号U2021123456，请帮我修改摘要")
        '我是张三，学号[学号]，请帮我修改摘要'
        >>> desensitize("我是张三，请帮我修改摘要", profile={"name": "张三"})
        '我是[姓名]，请帮我修改摘要'
    """
    result = text

    # -- Profile-based substitution (exact match, highest precision) ----------
    if profile:
        name: str = (profile.get("name") or "").strip()
        if len(name) >= 2:
            result = result.replace(name, "[姓名]")

        advisor: str = (profile.get("advisor") or "").strip()
        if len(advisor) >= 2:
            result = result.replace(advisor, "[导师姓名]")

        student_id: str = (profile.get("student_id") or "").strip()
        if student_id:
            result = result.replace(student_id, "[学号]")

    # -- Regex-based substitution --------------------------------------------
    for pattern, placeholder in _RULES:
        result = pattern.sub(placeholder, result)

    return result
