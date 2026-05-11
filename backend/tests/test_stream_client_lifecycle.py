import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")

from core import stream


class FakeCompletions:
    async def create(self, **kwargs):
        return SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(content="visible feedback"),
                )
            ]
        )


class FakeAsyncOpenAI:
    def __init__(self):
        self.chat = SimpleNamespace(completions=FakeCompletions())
        self.entered = False
        self.exited = False

    async def __aenter__(self):
        self.entered = True
        return self

    async def __aexit__(self, exc_type, exc, tb):
        self.exited = True


class StreamClientLifecycleTest(unittest.IsolatedAsyncioTestCase):
    async def test_call_model_once_closes_async_client(self):
        fake_client = FakeAsyncOpenAI()

        with patch.object(stream, "_client", return_value=fake_client):
            result = await stream.call_model_once([{"role": "user", "content": "hello"}], temperature=0.2)

        self.assertEqual(result, "visible feedback")
        self.assertTrue(fake_client.entered)
        self.assertTrue(fake_client.exited)


if __name__ == "__main__":
    unittest.main()
