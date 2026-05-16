import os
import asyncio
import unittest

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")

from core.events import EventType, SSEEvent, fmt


class FakeConversationManager:
    def __init__(self) -> None:
        self.loaded: list[tuple[str, str]] = []
        self.saved: list[tuple[str, str, str, str, str, str]] = []

    async def load(self, user_id: str, session_id: str):
        self.loaded.append((user_id, session_id))
        return [{"role": "user", "content": "旧问题"}, {"role": "assistant", "content": "旧回答"}]

    async def save(self, user_id: str, session_id: str, user_msg: str, assistant_msg: str, scene: str):
        self.saved.append((user_id, session_id, user_msg, assistant_msg, scene, "saved"))


class FakeProfileStore:
    async def get(self, user_id: str):
        return {"teaching_style": "directional"}


class LoopSmokeTest(unittest.IsolatedAsyncioTestCase):
    async def test_main_loop_falls_back_to_paragraph_when_router_times_out(self) -> None:
        from core import loop as loop_module

        conv = FakeConversationManager()
        profile_store = FakeProfileStore()
        handled_scenes: list[str] = []

        async def timed_out_router(user_input: str) -> str:
            raise asyncio.TimeoutError

        async def fake_pipeline(*args, **kwargs):
            yield fmt(SSEEvent(type=EventType.TOKEN, content="兜底段落"))

        original_router = loop_module.route_scene
        original_handler = loop_module._get_pipeline_handler
        loop_module.route_scene = timed_out_router
        loop_module._get_pipeline_handler = lambda scene: handled_scenes.append(scene) or fake_pipeline
        try:
            chunks = []
            async for chunk in loop_module.main_loop("u-timeout", "sess-timeout", "测试消息", conv, profile_store, object()):
                chunks.append(chunk)
        finally:
            loop_module.route_scene = original_router
            loop_module._get_pipeline_handler = original_handler

        self.assertEqual(handled_scenes, ["paragraph"])
        self.assertTrue(any('"type": "done"' in chunk for chunk in chunks))
        self.assertEqual(conv.saved, [("u-timeout", "sess-timeout", "测试消息", "兜底段落", "paragraph", "saved")])

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
            async for chunk in loop_module.main_loop("u1", "sess-1", "测试消息", conv, profile_store, object()):
                chunks.append(chunk)
        finally:
            loop_module.route_scene = original_router
            loop_module._get_pipeline_handler = original_paragraph

        self.assertTrue(any('"type": "done"' in chunk for chunk in chunks))
        self.assertEqual(conv.loaded, [("u1", "sess-1")])
        self.assertEqual(conv.saved, [("u1", "sess-1", "测试消息", "第一段第二段", "paragraph", "saved")])

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
            async for chunk in loop_module.main_loop("u2", "sess-2", "测试消息", conv, profile_store, object()):
                chunks.append(chunk)
        finally:
            loop_module.route_scene = original_router
            loop_module._get_pipeline_handler = original_paragraph

        self.assertTrue(any('"type": "error"' in chunk for chunk in chunks))
        self.assertEqual(conv.saved, [])
