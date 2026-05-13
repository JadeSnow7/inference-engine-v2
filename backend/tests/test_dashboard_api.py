import asyncio
import json
import os
from types import SimpleNamespace
import unittest

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")

from api.dashboard import get_dashboard_summary
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


class DashboardApiTest(unittest.TestCase):
    def run_async(self, coro):
        return asyncio.run(coro)

    def test_dashboard_summary_has_metrics_tasks_courses_and_documents(self):
        response = self.run_async(get_dashboard_summary(make_request(), user_id="alice@hust.edu.cn"))

        data = response_data(response)
        self.assertEqual(data["metrics"]["documentBlocks"], 0)
        self.assertGreaterEqual(data["metrics"]["evidenceSources"], 0)
        self.assertIn("graphUpdates", data["metrics"])
        self.assertIn("normReminders", data["metrics"])
        self.assertGreaterEqual(len(data["tasks"]), 1)
        self.assertGreaterEqual(len(data["recentCourses"]), 1)
        self.assertGreaterEqual(len(data["recentDocuments"]), 1)

    def test_dashboard_summary_can_be_empty_when_no_courses_are_stored(self):
        request = make_request()
        self.run_async(request.app.state.course_store.client.set("research_spaces:alice@hust.edu.cn", "[]"))

        response = self.run_async(get_dashboard_summary(request, user_id="alice@hust.edu.cn"))

        data = response_data(response)
        self.assertEqual(data["recentCourses"], [])
        self.assertEqual(data["metrics"]["evidenceSources"], 0)


if __name__ == "__main__":
    unittest.main()
