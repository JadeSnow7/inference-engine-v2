import os
import unittest
from unittest.mock import patch

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")

from core import stream


class StreamClientLifecycleTest(unittest.IsolatedAsyncioTestCase):
    async def test_call_model_once_uses_dashscope_app_responses_endpoint(self):
        captured = {}

        class FakeResponses:
            async def create(self, **kwargs):
                captured.update(kwargs)
                return type("Response", (), {"output_text": "visible feedback"})()

        class FakeClient:
            def __init__(self, **kwargs):
                captured["client_kwargs"] = kwargs
                self.responses = FakeResponses()

            async def __aenter__(self):
                return self

            async def __aexit__(self, *_args):
                return None

        async def forbidden_call(*_args, **_kwargs):
            raise AssertionError("call_model_once must use DashScope app-compatible Responses")

        with (
            patch.object(stream.settings, "DASHSCOPE_API_KEY", "test-key"),
            patch.object(stream.settings, "DASHSCOPE_APP_ID", "app-id"),
            patch.object(stream, "AsyncOpenAI", FakeClient, create=True),
            patch.object(stream, "call_bailian_app_once", forbidden_call, create=True),
        ):
            result = await stream.call_model_once([{"role": "user", "content": "hello"}], temperature=0.2)

        self.assertEqual(result, "visible feedback")
        self.assertIn("/api/v2/apps/agent/", captured["client_kwargs"]["base_url"])
        self.assertIn("/compatible-mode/v1", captured["client_kwargs"]["base_url"])
        self.assertEqual(captured["client_kwargs"]["api_key"], "test-key")
        self.assertIn("[user]", captured["input"])
        self.assertIn("hello", captured["input"])
        self.assertFalse(captured["stream"])

    async def test_stream_model_uses_dashscope_app_responses_endpoint(self):
        captured = {}

        class FakeEvent:
            def __init__(self, event_type: str, delta: str = ""):
                self.type = event_type
                self.delta = delta

        class FakeResponses:
            async def create(self, **kwargs):
                captured.update(kwargs)

                async def events():
                    yield FakeEvent("response.output_text.delta", "第一")
                    yield FakeEvent("response.output_text.delta", "第二")

                return events()

        class FakeClient:
            def __init__(self, **kwargs):
                captured["client_kwargs"] = kwargs
                self.responses = FakeResponses()

            async def __aenter__(self):
                return self

            async def __aexit__(self, *_args):
                return None

        async def forbidden_stream(*_args, **_kwargs):
            raise AssertionError("stream_model must use DashScope app-compatible Responses")
            yield

        with (
            patch.object(stream.settings, "DASHSCOPE_API_KEY", "test-key"),
            patch.object(stream.settings, "DASHSCOPE_APP_ID", "app-id"),
            patch.object(stream, "AsyncOpenAI", FakeClient, create=True),
            patch.object(stream, "stream_bailian_app", forbidden_stream, create=True),
        ):
            tokens = [
                token
                async for token in stream.stream_model([{"role": "user", "content": "hello"}], temperature=0.2)
            ]

        self.assertEqual("".join(tokens), "第一第二")
        self.assertIn("/api/v2/apps/agent/", captured["client_kwargs"]["base_url"])
        self.assertIn("/compatible-mode/v1", captured["client_kwargs"]["base_url"])
        self.assertEqual(captured["client_kwargs"]["api_key"], "test-key")
        self.assertIn("[user]", captured["input"])
        self.assertIn("hello", captured["input"])
        self.assertTrue(captured["stream"])


if __name__ == "__main__":
    unittest.main()
