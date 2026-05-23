import json
import os
import unittest

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DEEPSEEK_API_KEY", "deepseek-test-key")

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.auth import get_current_user_id
from api.responses import register_error_handlers


class EditingApiTest(unittest.TestCase):
    def _client(self):
        from api.editing import router as editing_router

        app = FastAPI()
        register_error_handlers(app)
        app.include_router(editing_router, prefix="/v1")
        app.dependency_overrides[get_current_user_id] = lambda: "u1"
        app.state.norm_retriever = None
        app.state.rag = None
        app.state.editing_jobs = {}
        return TestClient(app)

    def test_create_get_and_run_editing_job(self):
        client = self._client()

        created = client.post("/v1/editing/jobs", json={
            "blocks": [{"id": "p1", "type": "paragraph", "content": "本文提出一个方法，但缺少引用。"}],
            "selected_block_ids": ["p1"],
            "mode": "academic_enhance",
            "objective": "提升学术表达",
        })

        self.assertEqual(created.status_code, 200)
        job_id = created.json()["data"]["job_id"]

        status = client.get(f"/v1/editing/jobs/{job_id}")
        self.assertEqual(status.status_code, 200)
        self.assertEqual(status.json()["data"]["job_id"], job_id)
        self.assertEqual(status.json()["data"]["stages"][0]["stage_id"], "route_diagnosis")

        with client.stream("POST", f"/v1/editing/jobs/{job_id}/run") as response:
            self.assertEqual(response.status_code, 200)
            frames = [
                json.loads(line.removeprefix("data: "))
                for line in response.iter_lines()
                if line.startswith("data: ")
            ]

        self.assertIn("editing_stage", [frame["type"] for frame in frames])
        self.assertIn("editing_patch", [frame["type"] for frame in frames])
        self.assertIn("editing_gate", [frame["type"] for frame in frames])
        self.assertEqual(frames[-1]["type"], "done")

    def test_unknown_job_returns_not_found_envelope(self):
        client = self._client()
        response = client.get("/v1/editing/jobs/missing")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["ok"], False)
        self.assertEqual(response.json()["error"]["code"], "NOT_FOUND")


if __name__ == "__main__":
    unittest.main()
