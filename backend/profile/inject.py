from typing import Union

from profile.models import UserProfile

STYLE_HINTS = {
    "step_by_step": "严格拆步骤引导，不代写任何段落，让用户逐步完成",
    "directional": "指出问题，提供 2-3 个改进方向，由用户自主选择",
    "rewrite_first": "先给一段可参考的示例，再解释修改逻辑",
}

VERBOSITY_HINTS = {
    "concise": "每条反馈不超过 2 句，简洁直接",
    "balanced": "重点问题展开，细节问题一句带过",
    "detailed": "逐条给出原因和修改建议，不省略",
}


def inject_user_profile(system_prompt: str, profile: Union[UserProfile, dict]) -> str:
    if isinstance(profile, dict):
        profile = UserProfile(**profile)
    result = (
        system_prompt
        + "\n\n## 当前用户画像\n- 写作阶段: {}\n- 带教风格: {}\n- 反馈详略: {}\n- 专业方向: {}".format(
            profile.writing_stage,
            STYLE_HINTS.get(profile.teaching_style, STYLE_HINTS["directional"]),
            VERBOSITY_HINTS.get(profile.feedback_verbosity, VERBOSITY_HINTS["balanced"]),
            profile.major,
        )
    )
    if profile.writing_stage == "零基础":
        result += "\n- 用户处于零基础阶段，用鼓励性语气，避免批评性措辞"
    return result
