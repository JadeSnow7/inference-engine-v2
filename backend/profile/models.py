from dataclasses import asdict, dataclass


@dataclass
class UserProfile:
    teaching_style: str = "directional"
    feedback_verbosity: str = "balanced"
    writing_stage: str = "零基础"
    major: str = "集成"

    def to_dict(self) -> dict:
        return asdict(self)


def from_survey(q13: str, q14: str, q9: str = "零基础", q5: str = "集成") -> UserProfile:
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
    )

