import json
import os
import unittest

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")


class FakeConversationManager:
    def __init__(self) -> None:
        self.loaded_app_sessions = []
        self.saved_app_sessions = []
        self.saved_messages = []

    async def get_bailian_app_session(self, user_id: str, session_id: str):
        self.loaded_app_sessions.append((user_id, session_id))
        return "old-app-session"

    async def save_bailian_app_session(self, user_id: str, session_id: str, app_session_id: str):
        self.saved_app_sessions.append((user_id, session_id, app_session_id))

    async def save(self, user_id: str, session_id: str, user_message: str, assistant_message: str, scene: str):
        self.saved_messages.append((user_id, session_id, user_message, assistant_message, scene))


class FakeProfileStore:
    async def get(self, user_id: str):
        return {"student_id": "S123456", "name": "张三"}


def parse_sse(chunk: str) -> dict:
    assert chunk.startswith("data: ")
    return json.loads(chunk.removeprefix("data: ").strip())


class NormsLoopTest(unittest.IsolatedAsyncioTestCase):
    async def test_norms_loop_streams_references_tokens_done_and_saves_session(self) -> None:
        from core import norms as norms_module
        from core.bailian_app import BailianAppChunk

        prompts = []

        async def fake_stream(prompt: str, session_id: str | None = None):
            prompts.append((prompt, session_id))
            yield BailianAppChunk(text="第一段", session_id="new-app-session", references=[{"title": "规范A"}])
            yield BailianAppChunk(text="第二段", session_id="new-app-session")

        conv = FakeConversationManager()
        original_stream = norms_module.stream_bailian_app
        norms_module.stream_bailian_app = fake_stream
        try:
            chunks = [
                parse_sse(chunk)
                async for chunk in norms_module.norms_loop("u1", "sess-1", "我是张三，学号S123456，请检查格式", conv, FakeProfileStore())
            ]
        finally:
            norms_module.stream_bailian_app = original_stream

        self.assertEqual(chunks[0]["type"], "stage")
        self.assertEqual(chunks[0]["stage"], "学术规范检索中")
        self.assertEqual(chunks[1]["type"], "references")
        self.assertEqual(chunks[1]["data"], [{"title": "规范A"}])
        self.assertEqual([chunk.get("content") for chunk in chunks if chunk["type"] == "token"], ["第一段", "第二段"])
        self.assertEqual(chunks[-1]["type"], "done")
        self.assertEqual(prompts, [("我是[姓名]，学号[学号]，请检查格式", "old-app-session")])
        self.assertEqual(conv.saved_app_sessions, [("u1", "sess-1", "new-app-session")])
        self.assertEqual(conv.saved_messages, [("u1", "sess-1", "我是张三，学号S123456，请检查格式", "第一段第二段", "norms")])

    async def test_norms_loop_emits_safe_error_without_saving_empty_response(self) -> None:
        from core import norms as norms_module
        from core.bailian_app import BailianAppError

        async def fake_stream(*_args, **_kwargs):
            raise BailianAppError("InvalidApiKey request_id=req-1")
            yield  # pragma: no cover

        conv = FakeConversationManager()
        original_stream = norms_module.stream_bailian_app
        norms_module.stream_bailian_app = fake_stream
        try:
            chunks = [
                parse_sse(chunk)
                async for chunk in norms_module.norms_loop("u1", "sess-1", "检查格式", conv, FakeProfileStore())
            ]
        finally:
            norms_module.stream_bailian_app = original_stream

        self.assertEqual(chunks[-1]["type"], "error")
        self.assertIn("百炼 API Key 无效", chunks[-1]["content"])
        self.assertEqual(conv.saved_messages, [])


if __name__ == "__main__":
    unittest.main()
