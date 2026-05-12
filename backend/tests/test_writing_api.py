import os
import unittest

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.auth import get_current_user_id
from api.responses import register_error_handlers
from api.writing import router as writing_router


class WritingApiTest(unittest.TestCase):
    def _make_app(self) -> TestClient:
        app = FastAPI()
        register_error_handlers(app)
        app.include_router(writing_router, prefix="/v1")
        app.dependency_overrides[get_current_user_id] = lambda: "u1"
        app.state.rag = None
        return TestClient(app)

    def test_analyze_returns_nodes_context_validation_and_references(self) -> None:
        client = self._make_app()

        response = client.post(
            "/v1/writing/analyze",
            json={"text": "本文研究大语言模型在教育领域中的应用。摘要缺少方法说明。", "mode": "norms"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
        self.assertIn("nodes", payload)
        self.assertIn("expanded_context", payload)
        self.assertIn("validation", payload)
        self.assertIn("references", payload)
        self.assertTrue(any(item["status"] == "warning" for item in payload["validation"]))
        self.assertGreaterEqual(len(payload["references"]), 1)

    def test_analyze_rejects_empty_text(self) -> None:
        client = self._make_app()

        response = client.post("/v1/writing/analyze", json={"text": "   "})

        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
