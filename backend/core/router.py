from core.stream import call_model_once

SCENE_ROUTER_PROMPT = """判断用户请求所属任务类型，只输出类型标识（不含任何解释或标点）：

- proposal   开题报告、中期汇报、组会材料、研究计划
- review     文献综述、文献梳理、相关工作整理
- paragraph  段落写作、章节撰写、论文润色改写
- format     引用格式化、字数压缩、摘要翻译

用户请求: {user_input}"""

VALID_SCENES = {"proposal", "review", "paragraph", "format"}


async def route_scene(user_input: str) -> str:
    result = await call_model_once(
        [{"role": "user", "content": SCENE_ROUTER_PROMPT.format(user_input=user_input)}],
        temperature=0,
    )
    scene = (result or "").strip().lower()
    return scene if scene in VALID_SCENES else "paragraph"

