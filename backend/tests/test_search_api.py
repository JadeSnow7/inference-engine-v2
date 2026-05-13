import asyncio
import json
import os
from types import SimpleNamespace
import unittest

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")

from api.search import search_items


class FakeDocumentStore:
    async def list_documents(self, user_id):
        return [
            {
                "id": "doc-llm",
                "title": "LLM Education Review",
                "blocks": [{"content": "AI feedback in classrooms"}],
                "updatedAt": "2026-05-13T00:00:00Z",
            },
            {"id": "doc-other", "title": "Unrelated Notes", "blocks": [{"content": "biology"}]},
        ]


class FakeCourseStore:
    async def list_research_spaces(self, user_id):
        return [
            {"id": "course-llm", "title": "Research Methods", "topic": "LLM classroom feedback", "status": "writing"},
            {"id": "course-other", "title": "Microeconomics", "topic": "market equilibrium"},
        ]


class FakeEvidenceStore:
    async def list_evidence(self, user_id):
        return [
            {"id": "evidence-llm", "title": "LLM Feedback Evidence", "venue": "Learning Analytics", "type": "paper"},
            {"id": "evidence-other", "title": "Citation Norm", "venue": "HUST"},
        ]


class FakeConversationManager:
    async def list_sessions(self, user_id, limit=20, offset=0):
        return {
            "total": 2,
            "items": [
                {"session_id": "session-llm", "title": "LLM feedback discussion", "scene": "review", "message_count": 4},
                {"session_id": "session-other", "title": "Format check", "scene": "format", "message_count": 2},
            ],
        }


def response_data(response):
    return json.loads(response.body)["data"]


def make_request():
    return SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(
        document_store=FakeDocumentStore(),
        course_store=FakeCourseStore(),
        evidence_store=FakeEvidenceStore(),
        conv_manager=FakeConversationManager(),
    )))


class SearchApiTest(unittest.TestCase):
    def run_async(self, coro):
        return asyncio.run(coro)

    def test_searches_documents_sessions_evidence_and_courses(self):
        response = self.run_async(search_items(make_request(), q="LLM", user_id="alice@hust.edu.cn"))

        items = response_data(response)["items"]
        self.assertEqual(
            {item["type"] for item in items},
            {"document", "conversation", "evidence", "course"},
        )
        self.assertTrue(any(item["title"] == "LLM Education Review" for item in items))
        self.assertTrue(all("embedding" not in json.dumps(item) for item in items))

    def test_workspace_scope_excludes_courses(self):
        response = self.run_async(search_items(make_request(), q="LLM", scope="workspace", user_id="alice@hust.edu.cn"))

        items = response_data(response)["items"]
        self.assertTrue(items)
        self.assertNotIn("course", {item["type"] for item in items})

    def test_blank_query_returns_empty_results(self):
        response = self.run_async(search_items(make_request(), q="  ", user_id="alice@hust.edu.cn"))

        self.assertEqual(response_data(response), {"items": []})


if __name__ == "__main__":
    unittest.main()
