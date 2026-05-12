import os
import unittest

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
        client = self._client(norm_retriever=FakeNormRetriever())
        response = client.post("/v1/writing/analyze", json={
            "text": "Smith (2020) reported similar findings.",
            "mode": "citation",
            "top_k": 5,
            "theta": 0.6,
            "refs": ["NRM-CIT-001", "INVALID-999"],
        })

        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
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
        client = self._client(norm_retriever=None)
        response = client.post("/v1/writing/analyze", json={"text": "本文研究大语言模型在教育领域中的应用。", "mode": "norms"})

        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
        self.assertIn("nodes", payload)
        self.assertIn("expanded_context", payload)
        self.assertIn("validation", payload)
        self.assertIn("references", payload)
        self.assertGreaterEqual(len(payload["references"]), 1)

    def test_analyze_rejects_empty_text(self):
        client = self._client()
        response = client.post("/v1/writing/analyze", json={"text": "   "})

        self.assertEqual(response.status_code, 422)

    def test_top_k_limit_is_enforced(self):
        client = self._client(norm_retriever=FakeNormRetriever())
        response = client.post("/v1/writing/analyze", json={"text": "sample", "top_k": 21})

        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
