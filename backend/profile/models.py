"""
profile/models.py
=================
UserProfile dataclass — source of truth for all user preference + run-time fields.

Changes vs original:
  - Added weak_points: dict  (concept → occurrence count)
  - Added total_sessions: int and last_session_at: int
  - from_survey() now initialises the new runtime fields to safe defaults
  - to_dict() uses asdict() which handles nested dicts correctly
"""

from __future__ import annotations

import time
from dataclasses import asdict, dataclass, field


@dataclass
class UserProfile:
    # -----------------------------------------------------------------------
    # Survey-initialised fields (set during onboarding, user-editable)
    # -----------------------------------------------------------------------
    teaching_style: str = "directional"       # step_by_step | directional | rewrite_first
    feedback_verbosity: str = "balanced"       # concise | balanced | detailed
    writing_stage: str = "零基础"
    major: str = "集成"

    # -----------------------------------------------------------------------
    # Runtime-accumulated fields (updated automatically during conversation)
    # -----------------------------------------------------------------------
    # concept → occurrence count.  Incremented when user ASKS about a concept;
    # decremented (never below 0) when user DEMONSTRATES understanding.
    # Entries at 0 are pruned.
    weak_points: dict = field(default_factory=dict)
    total_sessions: int = 0
    last_session_at: int = 0    # Unix timestamp of last conversation

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "UserProfile":
        """Reconstruct from a plain dict (e.g. loaded from Redis)."""
        known_fields = {f.name for f in cls.__dataclass_fields__.values()}  # type: ignore[attr-defined]
        filtered = {k: v for k, v in data.items() if k in known_fields}
        return cls(**filtered)


def from_survey(q13: str, q14: str, q9: str = "零基础", q5: str = "集成") -> UserProfile:
    """Map onboarding survey answers to a UserProfile with runtime defaults."""
    style_map = {
        "严格拆步推进，不直接代写": "step_by_step",
        "指出问题并给 2-3 个修改方向": "directional",
        "先给可用改写，再解释原因": "rewrite_first",
    }
    verbosity_map = {"简洁": "concise", "平衡": "balanced", "详细": "detailed"}
    return UserProfile(
        teaching_style=style_map.get(q13, "directional"),
        feedback_verbosity=verbosity_map.get(q14, "balanced"),
        writing_stage=q9,
        major=q5,
        weak_points={},
        total_sessions=0,
        last_session_at=int(time.time()),
    )
