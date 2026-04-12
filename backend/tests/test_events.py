import os
import unittest

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")

from core.events import EventType, SSEEvent, extract_token, fmt


class EventsTest(unittest.TestCase):
    def test_fmt_serializes_event_to_sse_payload(self) -> None:
        payload = fmt(SSEEvent(type=EventType.STAGE, stage="路由中"))
        self.assertTrue(payload.startswith("data: "))
        self.assertIn('"stage": "路由中"', payload)

    def test_extract_token_only_returns_token_content(self) -> None:
        raw = fmt(SSEEvent(type=EventType.TOKEN, content="你好"))
        self.assertEqual(extract_token(raw), "你好")
        self.assertEqual(extract_token(fmt(SSEEvent(type=EventType.STAGE, stage="x"))), "")
