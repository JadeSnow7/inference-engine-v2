import os
import unittest
from types import SimpleNamespace
from typing import Optional

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.auth import get_current_user_id
from api.chat import router as chat_router
from api.responses import register_error_handlers
from core.events import EventType, SSEEvent, fmt


class FakeConversationManager:
    def __init__(self) -> None:
        self.ensure_calls: list[tuple[str, Optional[str], str]] = []
        self.list_calls: list[tuple[str, int, int]] = []
        self.delete_calls: list[tuple[str, str]] = []
        self.next_session_id = "sess-new"

    async def ensure_session(self, user_id: str, session_id: Optional[str], initial_message: str) -> str:
        self.ensure_calls.append((user_id, session_id, initial_message))
        return session_id or self.next_session_id

    async def list_sessions(self, user_id: str, limit: int, offset: int) -> dict:
        self.list_calls.append((user_id, limit, offset))
        return {
            "total": 1,
            "items": [
                {
                    "session_id": "sess-new",
                    "title": "测试会话",
                    "scene": "review",
                    "updated_at": 1710000000,
                    "message_count": 2,
                }
            ],
        }

    async def delete_session(self, user_id: str, session_id: str) -> bool:
        self.delete_calls.append((user_id, session_id))
        return session_id == "sess-new"


class ChatApiTest(unittest.TestCase):
    def _make_app(self) -> tuple[TestClient, FakeConversationManager]:
        app = FastAPI()
        register_error_handlers(app)
        app.include_router(chat_router, prefix="/api")
        app.dependency_overrides[get_current_user_id] = lambda: "u1"

        conv = FakeConversationManager()
        app.state.conv_manager = conv
        app.state.profile_store = SimpleNamespace()
        app.state.rag = object()
        app.state.norm_retriever = SimpleNamespace()
        return TestClient(app), conv

    def test_chat_creates_session_and_returns_session_header(self) -> None:
        import api.chat as chat_module

        async def fake_loop(*_args, **_kwargs):
            yield fmt(SSEEvent(type=EventType.STAGE, stage="路由中"))
            yield fmt(SSEEvent(type=EventType.DONE))

        client, conv = self._make_app()
        original_loop = chat_module.main_loop
        chat_module.main_loop = fake_loop
        try:
            response = client.post("/api/chat", json={"message": "帮我写综述"})
        finally:
            chat_module.main_loop = original_loop

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["x-session-id"], "sess-new")
        self.assertEqual(conv.ensure_calls, [("u1", None, "帮我写综述")])

    def test_chat_reuses_existing_session_id(self) -> None:
        import api.chat as chat_module

        async def fake_loop(*_args, **_kwargs):
            yield fmt(SSEEvent(type=EventType.DONE))

        client, conv = self._make_app()
        original_loop = chat_module.main_loop
        chat_module.main_loop = fake_loop
        try:
            response = client.post("/api/chat", json={"message": "继续", "session_id": "sess-old"})
        finally:
            chat_module.main_loop = original_loop

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["x-session-id"], "sess-old")
        self.assertEqual(conv.ensure_calls, [("u1", "sess-old", "继续")])

    def test_chat_norms_mode_routes_to_norms_loop(self) -> None:
        import api.chat as chat_module

        calls = []

        async def fake_norms_loop(*args, **_kwargs):
            calls.append(args)
            yield fmt(SSEEvent(type=EventType.STAGE, stage="学术规范检索中"))
            yield fmt(SSEEvent(type=EventType.DONE))

        async def forbidden_main_loop(*_args, **_kwargs):
            raise AssertionError("main_loop should not handle mode=norms")
            yield  # pragma: no cover

        client, conv = self._make_app()
        original_norms_loop = chat_module.norms_loop
        original_main_loop = chat_module.main_loop
        chat_module.norms_loop = fake_norms_loop
        chat_module.main_loop = forbidden_main_loop
        try:
            response = client.post("/api/chat", json={"message": "检查论文格式规范", "session_id": "sess-1", "mode": "norms"})
        finally:
            chat_module.norms_loop = original_norms_loop
            chat_module.main_loop = original_main_loop

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["x-session-id"], "sess-1")
        self.assertEqual(conv.ensure_calls, [("u1", "sess-1", "检查论文格式规范")])
        self.assertEqual(calls[0][0:3], ("u1", "sess-1", "检查论文格式规范"))
        self.assertIs(calls[0][5], client.app.state.norm_retriever)

    def test_list_sessions_returns_enveloped_data(self) -> None:
        client, conv = self._make_app()

        response = client.get("/api/sessions?limit=10&offset=5")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["total"], 1)
        self.assertEqual(conv.list_calls, [("u1", 10, 5)])

    def test_delete_session_returns_deleted_flag(self) -> None:
        client, conv = self._make_app()

        response = client.delete("/api/sessions/sess-new")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"ok": True, "data": {"deleted": True}})
        self.assertEqual(conv.delete_calls, [("u1", "sess-new")])
