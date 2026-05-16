import asyncio
import json
import os
import unittest
from types import SimpleNamespace

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DEEPSEEK_API_KEY", "deepseek-test-key")

from fastapi import HTTPException

from api.editing import create_editing_job, get_editing_job, run_editing_job
from editing.models import EditingJobCreate


def make_request():
    return SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(
        norm_retriever=None,
        rag=None,
        editing_jobs={},
    )))


def response_data(response):
    return json.loads(response.body)["data"]


async def collect_sse_frames(response):
    frames = []
    async for chunk in response.body_iterator:
        for line in str(chunk).splitlines():
            if line.startswith("data: "):
                frames.append(json.loads(line.removeprefix("data: ")))
    return frames


class EditingApiTest(unittest.TestCase):
    def setUp(self):
        self.request = make_request()

    def run_async(self, coro):
        return asyncio.run(coro)

    def test_create_get_and_run_editing_job(self):
        created = self.run_async(create_editing_job(
            EditingJobCreate(
                blocks=[{"id": "p1", "type": "paragraph", "content": "本文提出一个方法，但缺少引用。"}],
                selected_block_ids=["p1"],
                mode="academic_enhance",
                objective="提升学术表达",
            ),
            self.request,
            _user_id="u1",
        ))

        self.assertEqual(created.status_code, 200)
        job_id = response_data(created)["job_id"]

        status = self.run_async(get_editing_job(job_id, self.request, _user_id="u1"))
        self.assertEqual(status.status_code, 200)
        self.assertEqual(response_data(status)["job_id"], job_id)
        self.assertEqual(response_data(status)["stages"][0]["stage_id"], "route_diagnosis")

        response = self.run_async(run_editing_job(job_id, self.request, _user_id="u1"))
        self.assertEqual(response.status_code, 200)
        frames = self.run_async(collect_sse_frames(response))

        self.assertIn("editing_stage", [frame["type"] for frame in frames])
        self.assertIn("editing_patch", [frame["type"] for frame in frames])
        self.assertIn("editing_gate", [frame["type"] for frame in frames])
        self.assertEqual(frames[-1]["type"], "done")

    def test_unknown_job_returns_not_found_error(self):
        with self.assertRaises(HTTPException) as missing:
            self.run_async(get_editing_job("missing", self.request, _user_id="u1"))

        self.assertEqual(missing.exception.status_code, 404)
        self.assertEqual(missing.exception.detail["code"], "NOT_FOUND")


if __name__ == "__main__":
    unittest.main()
