import os
import unittest
from unittest.mock import patch

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")

from rag import dashscope_provider


class DashScopeKnowledgeRAGRetrieverTest(unittest.TestCase):
    def test_uses_app_compatible_responses_base_url(self):
        captured = {}

        class FakeOpenAI:
            def __init__(self, **kwargs):
                captured["client_kwargs"] = kwargs
                self.responses = type("Responses", (), {"create": self.create})()

            def create(self, **kwargs):
                captured["response_kwargs"] = kwargs
                return type("Response", (), {"output_text": "[]"})()

        with patch.object(dashscope_provider, "OpenAI", FakeOpenAI):
            retriever = dashscope_provider.DashScopeKnowledgeRAGRetriever(
                api_key="dashscope-key",
                base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                app_id="app-id",
                knowledge_base_id="kb-id",
                model="deepseek-v4-pro",
            )
            retriever.retrieve_literature("RAG writing", top_k=3)

        self.assertEqual(captured["client_kwargs"]["api_key"], "dashscope-key")
        self.assertEqual(
            captured["client_kwargs"]["base_url"],
            "https://dashscope.aliyuncs.com/api/v2/apps/agent/app-id/compatible-mode/v1",
        )
        self.assertEqual(captured["response_kwargs"]["model"], "deepseek-v4-pro")
        self.assertEqual(captured["response_kwargs"]["tools"][0]["type"], "file_search")
        self.assertEqual(captured["response_kwargs"]["tools"][0]["vector_store_ids"], ["kb-id"])


if __name__ == "__main__":
    unittest.main()
