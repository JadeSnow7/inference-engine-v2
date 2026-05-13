import os
import asyncio
import json
from types import SimpleNamespace
import unittest

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")

from fastapi import HTTPException

from api.courses import list_research_spaces, open_research_space
from store.redis_store import RedisCourseStore


class FakeRedis:
    def __init__(self):
        self.values = {}

    async def get(self, key):
        return self.values.get(key)

    async def set(self, key, value, ex=None):
        self.values[key] = value


def response_data(response):
    return json.loads(response.body)["data"]


def make_request():
    return SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(course_store=RedisCourseStore(FakeRedis()))))


class CoursesApiTest(unittest.TestCase):
    def setUp(self):
        self.request = make_request()

    def run_async(self, coro):
        return asyncio.run(coro)

    def test_lists_seeded_research_spaces(self):
        response = self.run_async(list_research_spaces(self.request, user_id="alice@hust.edu.cn"))

        data = response_data(response)
        self.assertGreaterEqual(len(data["items"]), 1)
        first = data["items"][0]
        self.assertEqual(first["id"], "microeconomics-llm-education")
        self.assertEqual(first["title"], "Principles of Microeconomics")
        self.assertIn("literatureCount", first)
        self.assertIn("material", first)

    def test_opens_space_as_workbench_context(self):
        response = self.run_async(
            open_research_space("microeconomics-llm-education", self.request, user_id="alice@hust.edu.cn")
        )

        context = response_data(response)["context"]
        self.assertEqual(context["sourceTitle"], "Theory of the Firm")
        self.assertEqual(context["actionType"], "outline")
        self.assertEqual(context["courseTitle"], "Principles of Microeconomics")
        self.assertEqual(context["sourceType"], "lecture")
        self.assertIn("createdAt", context)

    def test_opening_missing_space_returns_404(self):
        with self.assertRaises(HTTPException) as missing:
            self.run_async(open_research_space("missing-space", self.request, user_id="alice@hust.edu.cn"))

        self.assertEqual(missing.exception.status_code, 404)
        self.assertEqual(missing.exception.detail["code"], "COURSE_NOT_FOUND")


if __name__ == "__main__":
    unittest.main()
