import os
import asyncio
import json
from types import SimpleNamespace
import unittest

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")

from fastapi import HTTPException

from api.documents import (
    DocumentCreateRequest,
    DocumentUpdateRequest,
    VersionCreateRequest,
    create_document,
    create_version,
    get_document,
    list_documents,
    list_versions,
    restore_version,
    update_document,
)
from store.redis_store import RedisDocumentStore


class FakeRedis:
    def __init__(self):
        self.values = {}
        self.lists = {}

    async def get(self, key):
        return self.values.get(key)

    async def set(self, key, value, ex=None):
        self.values[key] = value

    async def delete(self, *keys):
        count = 0
        for key in keys:
            if key in self.values:
                count += 1
                del self.values[key]
            if key in self.lists:
                count += 1
                del self.lists[key]
        return count

    async def exists(self, key):
        return int(key in self.values or key in self.lists)

    async def lpush(self, key, value):
        self.lists.setdefault(key, []).insert(0, value)

    async def lrange(self, key, start, stop):
        items = self.lists.get(key, [])
        if stop == -1:
            return items[start:]
        return items[start:stop + 1]

    async def scan_iter(self, match=None):
        import fnmatch

        for key in list(self.values.keys()):
            if match is None or fnmatch.fnmatch(key, match):
                yield key


def make_request():
    return SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(document_store=RedisDocumentStore(FakeRedis()))))


def response_data(response):
    return json.loads(response.body)["data"]


class DocumentsApiTest(unittest.TestCase):
    def setUp(self):
        self.request = make_request()

    def run_async(self, coro):
        return asyncio.run(coro)

    def test_authenticated_user_can_create_read_and_update_document(self):
        created = self.run_async(
            create_document(
                DocumentCreateRequest(
                    title="Norm analysis",
                    courseId="research-methods",
                    blocks=[
                        {"id": "b1", "type": "paragraph", "text": "Initial claim."},
                    ],
                ),
                self.request,
                user_id="alice@hust.edu.cn",
            )
        )
        self.assertEqual(created.status_code, 201)
        document = response_data(created)
        self.assertEqual(document["title"], "Norm analysis")
        self.assertEqual(document["blocks"][0]["text"], "Initial claim.")

        fetched = self.run_async(get_document(document["id"], self.request, user_id="alice@hust.edu.cn"))
        self.assertEqual(fetched.status_code, 200)
        self.assertEqual(response_data(fetched)["id"], document["id"])

        updated = self.run_async(
            update_document(
                document["id"],
                DocumentUpdateRequest(
                    title="Updated norm analysis",
                    blocks=[
                        {"id": "b1", "type": "paragraph", "text": "Revised claim."},
                        {"id": "b2", "type": "paragraph", "text": "Second paragraph."},
                    ],
                ),
                self.request,
                user_id="alice@hust.edu.cn",
            )
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(response_data(updated)["title"], "Updated norm analysis")
        self.assertEqual(len(response_data(updated)["blocks"]), 2)

    def test_document_versions_can_be_created_listed_and_restored(self):
        created = response_data(self.run_async(
            create_document(
                DocumentCreateRequest(
                    title="Versioned document",
                    blocks=[{"id": "intro", "type": "paragraph", "text": "First draft."}],
                    metadata={
                        "source": "manual",
                        "courseStage": "draft",
                    },
                ),
                self.request,
                user_id="alice@hust.edu.cn",
            )
        ))

        version = self.run_async(
            create_version(
                created["id"],
                VersionCreateRequest(
                    label="First draft",
                    metadata={
                        "reviewItemIds": ["review-1"],
                        "acceptedChangeCount": 2,
                        "source": "review_accept",
                    },
                ),
                self.request,
                user_id="alice@hust.edu.cn",
            )
        )
        self.assertEqual(version.status_code, 201)
        version_id = response_data(version)["id"]
        self.assertEqual(response_data(version)["metadata"]["reviewItemIds"], ["review-1"])
        self.assertEqual(response_data(version)["metadata"]["acceptedChangeCount"], 2)
        self.assertEqual(response_data(version)["metadata"]["source"], "review_accept")
        self.assertEqual(response_data(version)["metadata"]["courseStage"], "draft")

        self.run_async(
            update_document(
                created["id"],
                DocumentUpdateRequest(blocks=[{"id": "intro", "type": "paragraph", "text": "Second draft."}]),
                self.request,
                user_id="alice@hust.edu.cn",
            )
        )

        listed = self.run_async(list_versions(created["id"], self.request, user_id="alice@hust.edu.cn"))
        self.assertEqual(listed.status_code, 200)
        self.assertEqual([item["id"] for item in response_data(listed)], [version_id])

        restored = self.run_async(
            restore_version(created["id"], version_id, self.request, user_id="alice@hust.edu.cn")
        )
        self.assertEqual(restored.status_code, 200)
        self.assertEqual(response_data(restored)["blocks"][0]["text"], "First draft.")

    def test_version_creation_handles_legacy_null_document_metadata(self):
        awaitable = self.request.app.state.document_store.save_document("alice@hust.edu.cn", {
            "id": "legacy-null-metadata",
            "title": "Legacy document",
            "blocks": [{"id": "intro", "type": "paragraph", "text": "Draft."}],
            "metadata": None,
            "createdAt": "2026-05-13T00:00:00.000Z",
            "updatedAt": "2026-05-13T00:00:00.000Z",
        })
        self.run_async(awaitable)

        version = self.run_async(
            create_version(
                "legacy-null-metadata",
                VersionCreateRequest(label="Safe version"),
                self.request,
                user_id="alice@hust.edu.cn",
            )
        )

        self.assertEqual(version.status_code, 201)
        self.assertEqual(response_data(version)["metadata"], {})

    def test_documents_are_isolated_by_user(self):
        created = response_data(self.run_async(
            create_document(
                DocumentCreateRequest(title="Private document", blocks=[]),
                self.request,
                user_id="alice@hust.edu.cn",
            )
        ))

        with self.assertRaises(HTTPException) as missing:
            self.run_async(get_document(created["id"], self.request, user_id="bob@hust.edu.cn"))
        self.assertEqual(missing.exception.status_code, 404)
        self.assertEqual(missing.exception.detail["code"], "DOCUMENT_NOT_FOUND")

        with self.assertRaises(HTTPException) as forbidden_version:
            self.run_async(
                create_version(
                    created["id"],
                    VersionCreateRequest(label="Should not work"),
                    self.request,
                    user_id="bob@hust.edu.cn",
                )
            )
        self.assertEqual(forbidden_version.exception.status_code, 404)

    def test_list_documents_returns_current_user_documents_sorted_by_updated_at(self):
        store = self.request.app.state.document_store
        self.run_async(store.save_document("alice@hust.edu.cn", {
            "id": "older-doc",
            "title": "Older",
            "blocks": [],
            "metadata": {},
            "createdAt": "2026-05-12T00:00:00+00:00",
            "updatedAt": "2026-05-12T00:00:00+00:00",
        }))
        self.run_async(store.save_document("alice@hust.edu.cn", {
            "id": "newer-doc",
            "title": "Newer",
            "blocks": [],
            "metadata": {},
            "createdAt": "2026-05-13T00:00:00+00:00",
            "updatedAt": "2026-05-13T00:00:00+00:00",
        }))
        self.run_async(store.save_document("bob@hust.edu.cn", {
            "id": "other-user-doc",
            "title": "Should not leak",
            "blocks": [],
            "metadata": {},
            "createdAt": "2026-05-14T00:00:00+00:00",
            "updatedAt": "2026-05-14T00:00:00+00:00",
        }))

        listed = self.run_async(list_documents(self.request, user_id="alice@hust.edu.cn"))

        self.assertEqual(listed.status_code, 200)
        self.assertEqual([document["id"] for document in response_data(listed)], ["newer-doc", "older-doc"])

    def test_list_documents_returns_empty_array_for_new_user(self):
        listed = self.run_async(list_documents(self.request, user_id="new@hust.edu.cn"))

        self.assertEqual(listed.status_code, 200)
        self.assertEqual(response_data(listed), [])


if __name__ == "__main__":
    unittest.main()
