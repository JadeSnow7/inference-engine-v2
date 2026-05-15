import asyncio
import json
import os
import unittest
from types import SimpleNamespace

from fastapi import HTTPException

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")

from api.review_items import (
    ReviewItemCreateRequest,
    ReviewItemUpdateRequest,
    accept_review_item,
    create_review_item,
    defer_review_item,
    list_review_items,
    reject_review_item,
    update_review_item,
)
from store.redis_store import RedisReviewStore


class FakeRedis:
    def __init__(self):
        self.values = {}

    async def get(self, key):
        return self.values.get(key)

    async def set(self, key, value, ex=None):
        self.values[key] = value


class ReviewItemsStoreTest(unittest.TestCase):
    def run_async(self, coro):
        return asyncio.run(coro)

    def test_review_items_are_user_and_document_scoped(self):
        store = RedisReviewStore(FakeRedis())
        item = self.run_async(store.create_review_item("alice@hust.edu.cn", {
            "documentId": "doc-1",
            "source": "document_tool",
            "kind": "rewrite",
            "targetBlockIds": ["b1"],
            "beforeBlocks": [{"id": "b1", "type": "paragraph", "content": "old"}],
            "afterBlocks": [{"id": "b1", "type": "paragraph", "content": "new"}],
            "changes": [],
            "reason": "Improve clarity",
            "evidenceIds": [],
            "versionBeforeId": None,
            "versionAfterId": None,
        }))

        alice_items = self.run_async(store.list_review_items("alice@hust.edu.cn", "doc-1"))
        alice_other_doc_items = self.run_async(store.list_review_items("alice@hust.edu.cn", "doc-2"))
        bob_items = self.run_async(store.list_review_items("bob@hust.edu.cn", "doc-1"))

        self.assertEqual(alice_items[0]["id"], item["id"])
        self.assertEqual(alice_items[0]["status"], "pending")
        self.assertEqual(alice_other_doc_items, [])
        self.assertEqual(bob_items, [])


def response_data(response):
    return json.loads(response.body)["data"]


def make_request():
    return SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(review_store=RedisReviewStore(FakeRedis()))))


class ReviewItemsApiTest(unittest.TestCase):
    def run_async(self, coro):
        return asyncio.run(coro)

    def test_review_items_can_be_created_listed_and_transitioned(self):
        request = make_request()
        created = self.run_async(create_review_item(
            ReviewItemCreateRequest(
                documentId="doc-1",
                source="document_tool",
                kind="rewrite",
                targetBlockIds=["b1"],
                beforeBlocks=[{"id": "b1", "type": "paragraph", "content": "old"}],
                afterBlocks=[{"id": "b1", "type": "paragraph", "content": "new"}],
                changes=[],
                reason="Improve clarity",
                evidenceIds=["paper-1"],
                versionBeforeId="v-before",
            ),
            request,
            user_id="alice@hust.edu.cn",
        ))

        item = response_data(created)
        self.assertEqual(created.status_code, 201)
        self.assertEqual(item["status"], "pending")

        listed = response_data(self.run_async(list_review_items("doc-1", request, user_id="alice@hust.edu.cn")))
        self.assertEqual([entry["id"] for entry in listed["items"]], [item["id"]])

        accepted = response_data(self.run_async(accept_review_item(
            item["id"],
            ReviewItemUpdateRequest(documentId="doc-1", versionAfterId="v-after"),
            request,
            user_id="alice@hust.edu.cn",
        )))
        self.assertEqual(accepted["status"], "accepted")
        self.assertEqual(accepted["versionAfterId"], "v-after")

    def test_missing_review_item_returns_404(self):
        request = make_request()
        with self.assertRaises(HTTPException) as missing:
            self.run_async(reject_review_item(
                "missing",
                ReviewItemUpdateRequest(documentId="doc-1"),
                request,
                user_id="alice@hust.edu.cn",
            ))
        self.assertEqual(missing.exception.status_code, 404)
        self.assertEqual(missing.exception.detail["code"], "REVIEW_ITEM_NOT_FOUND")


if __name__ == "__main__":
    unittest.main()
