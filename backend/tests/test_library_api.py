import asyncio
import json
import os
from types import SimpleNamespace
import unittest

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")

from fastapi import HTTPException

from api.library import EvidenceUpdateRequest, list_evidence, update_evidence
from store.redis_store import RedisEvidenceStore


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
    return SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(evidence_store=RedisEvidenceStore(FakeRedis()))))


class LibraryApiTest(unittest.TestCase):
    def run_async(self, coro):
        return asyncio.run(coro)

    def test_lists_seeded_and_persisted_evidence(self):
        request = make_request()
        self.run_async(request.app.state.evidence_store.save_evidence("alice@hust.edu.cn", [{
            "id": "paper-live",
            "title": "Live Retrieved Evidence",
            "venue": "GraphRAG",
            "year": 2026,
            "score": 0.93,
            "type": "paper",
        }]))

        response = self.run_async(list_evidence(request, user_id="alice@hust.edu.cn"))

        items = response_data(response)["items"]
        self.assertTrue(any(item["id"] == "paper-live" for item in items))
        self.assertTrue(any(item["id"] == "norm-hust-2026" for item in items))

    def test_filters_evidence_by_query_and_type(self):
        request = make_request()

        response = self.run_async(list_evidence(request, q="HUST", type="norm", user_id="alice@hust.edu.cn"))

        items = response_data(response)["items"]
        self.assertGreaterEqual(len(items), 1)
        self.assertTrue(all(item["type"] == "norm" for item in items))
        self.assertTrue(all("hust" in item["title"].lower() or "hust" in str(item.get("venue", "")).lower() for item in items))

    def test_updates_evidence_status_and_linked_blocks(self):
        request = make_request()

        response = self.run_async(update_evidence(
            "norm-hust-2026",
            EvidenceUpdateRequest(status="verified", linkedBlockIds=["intro"], usedAt="2026-05-15T00:00:00Z"),
            request,
            user_id="alice@hust.edu.cn",
        ))

        updated = response_data(response)
        self.assertEqual(updated["status"], "verified")
        self.assertEqual(updated["linkedBlockIds"], ["intro"])
        self.assertEqual(updated["usedAt"], "2026-05-15T00:00:00Z")

        listed = response_data(self.run_async(list_evidence(request, user_id="alice@hust.edu.cn")))["items"]
        matched = next(item for item in listed if item["id"] == "norm-hust-2026")
        self.assertEqual(matched["status"], "verified")

    def test_updating_missing_evidence_returns_404(self):
        request = make_request()

        with self.assertRaises(HTTPException) as missing:
            self.run_async(update_evidence(
                "missing",
                EvidenceUpdateRequest(status="verified"),
                request,
                user_id="alice@hust.edu.cn",
            ))
        self.assertEqual(missing.exception.status_code, 404)
        self.assertEqual(missing.exception.detail["code"], "EVIDENCE_NOT_FOUND")


if __name__ == "__main__":
    unittest.main()
