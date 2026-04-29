"""
core/thinking.py
================
Centralised Thinking configuration for every pipeline stage.

Each entry maps to a ThinkingConfig that controls:
  - whether thinking mode is enabled for that stage
  - the token budget for thinking (only meaningful when thinking=True)
  - the temperature to use when calling the model

Usage:
    from core.thinking import cfg

    tc = cfg("gap_analysis")
    await stream_model(messages, temperature=tc.temperature,
                       thinking=tc.thinking, thinking_budget=tc.budget)
"""

from dataclasses import dataclass

# ---------------------------------------------------------------------------
# Set to True during development / demo day to cap max_loops=1 for fast runs.
# ---------------------------------------------------------------------------
DEMO_MODE: bool = True


@dataclass(frozen=True)
class ThinkingConfig:
    thinking: bool
    budget: int   # ignored when thinking=False
    temperature: float


# ---------------------------------------------------------------------------
# Global stage configuration table
# Keys match the stage identifiers used across pipelines.
# ---------------------------------------------------------------------------
_CONFIGS: dict[str, ThinkingConfig] = {
    # --- 场景路由 ---
    "routing":          ThinkingConfig(thinking=False, budget=0,    temperature=0.0),
    # --- 开题报告流水线 ---
    "intent_parse":     ThinkingConfig(thinking=False, budget=0,    temperature=0.0),
    "gap_analysis":     ThinkingConfig(thinking=True,  budget=3000, temperature=0.3),
    "outline_gen":      ThinkingConfig(thinking=True,  budget=1500, temperature=0.4),
    "review_critic":    ThinkingConfig(thinking=True,  budget=800,  temperature=0.1),
    "revise_exec":      ThinkingConfig(thinking=False, budget=0,    temperature=0.2),
    # --- Loop LM 外循环（递减预算） ---
    "loop_round_1":     ThinkingConfig(thinking=True,  budget=2000, temperature=0.3),
    "loop_round_2":     ThinkingConfig(thinking=True,  budget=800,  temperature=0.2),
    "loop_round_3":     ThinkingConfig(thinking=True,  budget=400,  temperature=0.2),
    # --- 用户画像与引导 ---
    "guided_learning":  ThinkingConfig(thinking=True,  budget=1000, temperature=0.4),
    "weak_point_extract": ThinkingConfig(thinking=False, budget=0,  temperature=0.0),
    # --- 段落写作 ---
    "paragraph_write":  ThinkingConfig(thinking=True,  budget=3000, temperature=0.3),
    # --- 格式化 ---
    "format_":          ThinkingConfig(thinking=False, budget=0,    temperature=0.2),
}

# Pre-built list for the loop rounds, indexed 0..2
LOOP_CONFIGS: list[ThinkingConfig] = [
    _CONFIGS["loop_round_1"],
    _CONFIGS["loop_round_2"],
    _CONFIGS["loop_round_3"],
]


def cfg(stage: str) -> ThinkingConfig:
    """Return the ThinkingConfig for *stage*.

    Falls back to a safe default (thinking=False, temp=0.3) if the stage
    key is not found, so callers never get a KeyError.
    """
    return _CONFIGS.get(stage, ThinkingConfig(thinking=False, budget=0, temperature=0.3))
