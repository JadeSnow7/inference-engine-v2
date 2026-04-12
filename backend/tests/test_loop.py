import os
import unittest

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")

from core.events import EventType, SSEEvent, fmt


class FakeConversationManager:
    def __init__(self) -> None:
        self.saved: list[tuple[str, str, str]] = []

    async def load(self, user_id: str):
        return [{"role": "user", "content": "旧问题"}, {"role": "assistant", "content": "旧回答"}]

    async def save(self, user_id: str, user_msg: str, assistant_msg: str):
        self.saved.append((user_id, user_msg, assistant_msg))


class FakeProfileStore:
    async def get(self, user_id: str):
        return {"teaching_style": "directional"}


class LoopSmokeTest(unittest.IsolatedAsyncioTestCase):
    async def test_main_loop_saves_accumulated_tokens_on_success(self) -> None:
        from core import loop as loop_module

        conv = FakeConversationManager()
        profile_store = FakeProfileStore()

        async def fake_pipeline(*args, **kwargs):
            yield fmt(SSEEvent(type=EventType.TOKEN, content="第一段"))
            yield fmt(SSEEvent(type=EventType.TOKEN, content="第二段"))

        async def fake_router(user_input: str) -> str:
            return "paragraph"

        original_router = loop_module.route_scene
        original_paragraph = loop_module._get_pipeline_handler
        loop_module.route_scene = fake_router
        loop_module._get_pipeline_handler = lambda scene: fake_pipeline
        try:
            chunks = []
            async for chunk in loop_module.main_loop("u1", "测试消息", conv, profile_store, object()):
                chunks.append(chunk)
        finally:
            loop_module.route_scene = original_router
            loop_module._get_pipeline_handler = original_paragraph

        self.assertTrue(any('"type": "done"' in chunk for chunk in chunks))
        self.assertEqual(conv.saved, [("u1", "测试消息", "第一段第二段")])

    async def test_main_loop_emits_error_and_skips_save_on_exception(self) -> None:
        from core import loop as loop_module

        conv = FakeConversationManager()
        profile_store = FakeProfileStore()

        async def broken_pipeline(*args, **kwargs):
            raise RuntimeError("boom")
            yield  # pragma: no cover

        async def fake_router(user_input: str) -> str:
            return "paragraph"

        original_router = loop_module.route_scene
        original_paragraph = loop_module._get_pipeline_handler
        loop_module.route_scene = fake_router
        loop_module._get_pipeline_handler = lambda scene: broken_pipeline
        try:
            chunks = []
            async for chunk in loop_module.main_loop("u2", "测试消息", conv, profile_store, object()):
                chunks.append(chunk)
        finally:
            loop_module.route_scene = original_router
            loop_module._get_pipeline_handler = original_paragraph

        self.assertTrue(any('"type": "error"' in chunk for chunk in chunks))
        self.assertEqual(conv.saved, [])
