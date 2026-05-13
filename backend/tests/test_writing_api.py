import os
import asyncio
import json
import unittest
from types import SimpleNamespace
from pydantic import ValidationError

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.auth import get_current_user_id
from api.responses import register_error_handlers
from api.writing import router as writing_router


class FakeNormRetriever:
    def __len__(self):
        return 2

    def retrieve(self, query, top_k=5, theta=0.0):
        return [{
            "node_id": "NRM-CIT-001",
            "node_type": "规范条款",
            "dimension": "引用格式",
            "text": "Claims must cite sources.",
            "related": ["SUG-CIT-001"],
            "score": 0.91,
        }][:top_k]

    def expand(self, node_ids, hops=1):
        return [{
            "node_id": "SUG-CIT-001",
            "node_type": "修改建议",
            "dimension": "引用格式",
            "text": "Add a citation after each claim.",
            "related": ["NRM-CIT-001"],
            "score": 0.72,
            "via_expand": True,
        }]

    def validate_ref(self, node_id, query, theta=0.6):
        if node_id == "NRM-CIT-001":
            return True, 0.91
        return False, 0.0

    def get(self, node_id):
        return {"node_id": node_id} if node_id == "NRM-CIT-001" else None

    def format_context(self, nodes):
        return "Relevant norm nodes. Cite them as [REF:node_id].\n- [REF:NRM-CIT-001] type=规范条款 dimension=引用格式 text=Claims must cite sources."


class WritingApiTest(unittest.TestCase):
    def _client(self, norm_retriever=None, rag=None):
        app = FastAPI()
        register_error_handlers(app)
        app.include_router(writing_router, prefix="/v1")
        app.dependency_overrides[get_current_user_id] = lambda: "u1"
        app.state.norm_retriever = norm_retriever
        app.state.rag = rag
        return TestClient(app)

    def test_analyze_returns_frontend_envelope_with_norm_retriever_context(self):
        import api.writing as writing_module

        async def fake_bailian(prompt, session_id=None):
            self.assertIn("Smith (2020)", prompt)
            self.assertIn("[REF:NRM-CIT-001]", prompt)
            return writing_module.BailianAppChunk(text="百炼分析：引用格式基本完整，但应补充来源页码。")

        request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(norm_retriever=FakeNormRetriever(), rag=None)))
        original_call = writing_module.call_bailian_app_once
        writing_module.call_bailian_app_once = fake_bailian
        try:
            response = asyncio.run(writing_module.analyze_writing(
                writing_module.WritingAnalyzeRequest(
                    text="Smith (2020) reported similar findings.",
                    mode="citation",
                    top_k=5,
                    theta=0.6,
                    refs=["NRM-CIT-001", "INVALID-999"],
                ),
                request,
                _user_id="u1",
            ))
        finally:
            writing_module.call_bailian_app_once = original_call

        payload = json.loads(response.body)["data"]
        self.assertEqual(payload["provider"], "bailian_app")
        self.assertIn("百炼分析", payload["analysis"])
        self.assertEqual(payload["nodes"][0]["id"], "NRM-CIT-001")
        self.assertEqual(payload["nodes"][0]["node_id"], "NRM-CIT-001")
        self.assertEqual(payload["expanded"][0]["node_id"], "SUG-CIT-001")
        self.assertIn("[REF:NRM-CIT-001]", payload["context"])
        self.assertTrue(any(item["id"] == "NRM-CIT-001" and item["status"] == "pass" for item in payload["validation"]))
        self.assertTrue(any(item["id"] == "INVALID-999" and item["status"] == "warning" for item in payload["validation"]))
        self.assertNotIn("embedding", payload["nodes"][0])
        self.assertGreaterEqual(len(payload["expanded_context"]), 1)
        self.assertGreaterEqual(len(payload["references"]), 1)

    def test_analyze_returns_fallback_when_retriever_missing(self):
        import api.writing as writing_module

        request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(norm_retriever=None, rag=None)))
        response = asyncio.run(writing_module.analyze_writing(
            writing_module.WritingAnalyzeRequest(text="本文研究大语言模型在教育领域中的应用。", mode="norms"),
            request,
            _user_id="u1",
        ))

        payload = json.loads(response.body)["data"]
        self.assertIn("nodes", payload)
        self.assertIn("expanded_context", payload)
        self.assertIn("validation", payload)
        self.assertIn("references", payload)
        self.assertGreaterEqual(len(payload["references"]), 1)

    def test_analyze_rejects_empty_text(self):
        from api.writing import WritingAnalyzeRequest

        with self.assertRaises(ValidationError):
            WritingAnalyzeRequest(text="   ")

    def test_top_k_limit_is_enforced(self):
        from api.writing import WritingAnalyzeRequest

        with self.assertRaises(ValidationError):
            WritingAnalyzeRequest(text="sample", top_k=21)


if __name__ == "__main__":
    unittest.main()
