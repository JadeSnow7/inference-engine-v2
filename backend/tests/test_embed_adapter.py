import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")


class FakeEmbeddings:
    def __init__(self):
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(data=[SimpleNamespace(embedding=[0.1, 0.2])])


class FakeOpenAI:
    instances = []

    def __init__(self, **kwargs):
        self.kwargs = kwargs
        self.embeddings = FakeEmbeddings()
        FakeOpenAI.instances.append(self)


class EmbedAdapterTest(unittest.TestCase):
    def test_dashscope_embedder_uses_settings_and_returns_vector(self):
        from rag import embed_adapter

        FakeOpenAI.instances = []
        with (
            patch.object(embed_adapter, "OpenAI", FakeOpenAI),
            patch.object(embed_adapter.settings, "DASHSCOPE_API_KEY", "test-key"),
        ):
            embedder = embed_adapter.DashScopeEmbedder()
            vector = embedder.embed("citation text")

        self.assertEqual(vector, [0.1, 0.2])
        self.assertEqual(FakeOpenAI.instances[0].kwargs["api_key"], "test-key")
        self.assertIn("dashscope", FakeOpenAI.instances[0].kwargs["base_url"])
        self.assertEqual(FakeOpenAI.instances[0].embeddings.calls[0]["model"], "text-embedding-v3")
        self.assertEqual(FakeOpenAI.instances[0].embeddings.calls[0]["input"], ["citation text"])


if __name__ == "__main__":
    unittest.main()
