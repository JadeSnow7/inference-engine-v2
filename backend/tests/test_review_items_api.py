import asyncio
import os
import unittest

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")

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


if __name__ == "__main__":
    unittest.main()
