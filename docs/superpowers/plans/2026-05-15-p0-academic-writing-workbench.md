# P0 Academic Writing Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the P0 academic writing workbench refactor: a document-centered workspace with a right-side context drawer, persistent review items, an evidence ledger, and a writing-analysis-to-review bridge.

**Architecture:** Keep the production boundary as `backend/` plus `frontend/`. Add lightweight Redis-backed review/evidence/version persistence in FastAPI, then expose it through typed frontend API clients and Zustand state. Refactor the workbench so review, evidence, graph, and versions live in one context drawer while the document remains the primary surface.

**Tech Stack:** FastAPI, Redis async client, Python `unittest`, React 19, Vite 8, Zustand, TypeScript, Vitest, Testing Library, Tailwind CSS, lucide-react.

---

## File Structure

Backend:

- Create `backend/api/review_items.py`: FastAPI router for review item list/create/update/accept/reject/defer.
- Modify `backend/main.py`: register `review_items` router and initialize `RedisReviewStore`.
- Modify `backend/store/redis_store.py`: add `RedisReviewStore`; add evidence patch support to `RedisEvidenceStore`.
- Modify `backend/api/library.py`: add `PATCH /api/library/evidence/{evidence_id}`.
- Modify `backend/api/documents.py`: let version creation accept optional metadata fields needed for review associations.
- Test `backend/tests/test_review_items_api.py`: review item API behavior.
- Test `backend/tests/test_library_api.py`: evidence status patch.
- Test `backend/tests/test_documents_api.py`: version metadata.

Frontend API/types:

- Modify `frontend/src/types/workspace.ts`: add review/evidence/version metadata types and expand `RightPanelMode`.
- Create `frontend/src/api/reviewItems.ts`: typed review item client.
- Modify `frontend/src/api/library.ts`: evidence status fields and patch client.
- Modify `frontend/src/api/documents.ts`: version metadata fields.
- Test `frontend/src/api/__tests__/reviewItems.test.ts`: API client paths and payloads.

Frontend workspace:

- Create `frontend/src/features/workspace/WorkspaceContextDrawer.tsx`: right drawer container.
- Create `frontend/src/features/review/ReviewQueuePanel.tsx`: review queue UI and actions.
- Create `frontend/src/features/evidence/EvidenceContextPanel.tsx`: selected-block evidence UI.
- Create `frontend/src/features/graph/GraphContextPanel.tsx`: wrapper around current graph components.
- Create `frontend/src/features/version/VersionContextPanel.tsx`: version UI wrapper and restore confirmation.
- Modify `frontend/src/features/workspace/WorkspaceLayout.tsx`: use the drawer.
- Modify `frontend/src/features/workspace/MainWorkspace.tsx`: remove bottom suggestion-dominant layout.
- Modify `frontend/src/features/ai/AISuggestionPanel.tsx`: reduce to embeddable review details or retire from main layout.
- Modify `frontend/src/store/workspace.ts`: review item state, context drawer mode, writing bridge helpers.
- Test `frontend/src/pages/__tests__/WorkspaceViews.test.tsx` and/or new `frontend/src/features/workspace/__tests__/WorkspaceContextDrawer.test.tsx`.

Frontend pages:

- Modify `frontend/src/pages/Library.tsx`: evidence ledger with status filters, rows, and detail area.
- Modify `frontend/src/pages/Writing.tsx`: push analysis results into review queue.
- Modify `frontend/src/features/writing/WritingAnalysisPanel.tsx`: expose result action.
- Modify `frontend/src/pages/Courses.tsx`: remove blank-workbench seed title and normalize copy.
- Modify `frontend/src/pages/Dashboard.tsx`, `frontend/src/features/workspace/TopBar.tsx`, `frontend/src/pages/LoginPage.tsx`: terminology cleanup.
- Test `frontend/src/pages/__tests__/Library.test.tsx`, `Writing.test.tsx`, `Courses.test.tsx`, `Dashboard.test.tsx`.

---

## Task 1: Backend Review Item Store

**Files:**
- Modify: `backend/store/redis_store.py`
- Test: `backend/tests/test_review_items_api.py`

- [ ] **Step 1: Write the failing store tests**

Create `backend/tests/test_review_items_api.py` with this initial store-focused test. This file will be expanded in Task 2.

```python
import asyncio
import json
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
            "status": "pending",
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
        bob_items = self.run_async(store.list_review_items("bob@hust.edu.cn", "doc-1"))

        self.assertEqual(alice_items[0]["id"], item["id"])
        self.assertEqual(alice_items[0]["status"], "pending")
        self.assertEqual(bob_items, [])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
cd /app/inference-engine
PYTHONPATH=backend python3 -B -m unittest backend.tests.test_review_items_api.ReviewItemsStoreTest
```

Expected: FAIL with an import error similar to `cannot import name 'RedisReviewStore'`.

- [ ] **Step 3: Implement `RedisReviewStore`**

Add this class to `backend/store/redis_store.py` after `RedisDocumentStore` and before `RedisCourseStore`.

```python
from datetime import datetime, timezone
from uuid import uuid4
```

If those imports are not already present near the top of the file, add them.

```python
class RedisReviewStore:
    """Per-user review item persistence for AI suggestions and writing analysis findings."""

    def __init__(self, client=None):
        self.client = client or redis.from_url(settings.REDIS_URL, decode_responses=True)

    @staticmethod
    def _review_items_key(user_id: str, document_id: str) -> str:
        return f"review_items:{user_id}:{document_id}"

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    async def list_review_items(self, user_id: str, document_id: str) -> list[dict]:
        raw = await self.client.get(self._review_items_key(user_id, document_id))
        if not raw:
            return []
        try:
            parsed = json.loads(raw)
        except Exception:
            return []
        if not isinstance(parsed, list):
            return []
        return [item for item in parsed if isinstance(item, dict)]

    async def save_review_items(self, user_id: str, document_id: str, items: list[dict]) -> None:
        await self.client.set(
            self._review_items_key(user_id, document_id),
            json.dumps(items, ensure_ascii=False),
        )

    async def create_review_item(self, user_id: str, item: dict) -> dict:
        document_id = item["documentId"]
        now = self._now_iso()
        created = {
            **item,
            "id": item.get("id") or uuid4().hex,
            "status": item.get("status") or "pending",
            "createdAt": item.get("createdAt") or now,
            "updatedAt": now,
        }
        items = await self.list_review_items(user_id, document_id)
        items.insert(0, created)
        await self.save_review_items(user_id, document_id, items)
        return created

    async def get_review_item(self, user_id: str, document_id: str, review_item_id: str) -> dict | None:
        for item in await self.list_review_items(user_id, document_id):
            if item.get("id") == review_item_id:
                return item
        return None

    async def update_review_item(self, user_id: str, document_id: str, review_item_id: str, updates: dict) -> dict | None:
        items = await self.list_review_items(user_id, document_id)
        matched = None
        for index, item in enumerate(items):
            if item.get("id") == review_item_id:
                next_item = {
                    **item,
                    **{key: value for key, value in updates.items() if value is not None},
                    "updatedAt": self._now_iso(),
                }
                items[index] = next_item
                matched = next_item
                break
        if matched is None:
            return None
        await self.save_review_items(user_id, document_id, items)
        return matched
```

- [ ] **Step 4: Run the store test and verify it passes**

Run:

```bash
cd /app/inference-engine
PYTHONPATH=backend python3 -B -m unittest backend.tests.test_review_items_api.ReviewItemsStoreTest
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /app/inference-engine
git add backend/store/redis_store.py backend/tests/test_review_items_api.py
git commit -m "feat: add review item redis store"
```

---

## Task 2: Backend Review Item API

**Files:**
- Create: `backend/api/review_items.py`
- Modify: `backend/main.py`
- Test: `backend/tests/test_review_items_api.py`

- [ ] **Step 1: Extend the failing API tests**

Append these imports near the top of `backend/tests/test_review_items_api.py`:

```python
from types import SimpleNamespace
from fastapi import HTTPException

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
```

Append these helpers and test class below `ReviewItemsStoreTest`.

```python
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
```

- [ ] **Step 2: Run the API tests and verify they fail**

Run:

```bash
cd /app/inference-engine
PYTHONPATH=backend python3 -B -m unittest backend.tests.test_review_items_api
```

Expected: FAIL with `ModuleNotFoundError: No module named 'api.review_items'`.

- [ ] **Step 3: Create the review items router**

Create `backend/api/review_items.py`:

```python
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from api.auth import get_current_user_id
from api.responses import ok
from store.redis_store import RedisReviewStore

router = APIRouter()

ReviewStatus = Literal["pending", "accepted", "rejected", "deferred"]
ReviewSource = Literal["chat", "document_tool", "writing_analysis", "manual"]
ReviewKind = Literal["rewrite", "expand", "logic_check", "citation", "norm", "structure"]


def _store(request: Request) -> RedisReviewStore:
    return request.app.state.review_store


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=404,
        detail={"code": "REVIEW_ITEM_NOT_FOUND", "message": "审阅项不存在"},
    )


class ReviewItemCreateRequest(BaseModel):
    documentId: str = Field(min_length=1)
    source: ReviewSource
    kind: ReviewKind
    targetBlockIds: list[str] = Field(default_factory=list)
    beforeBlocks: list[dict[str, Any]] = Field(default_factory=list)
    afterBlocks: list[dict[str, Any]] = Field(default_factory=list)
    changes: list[dict[str, Any]] = Field(default_factory=list)
    reason: str = ""
    evidenceIds: list[str] = Field(default_factory=list)
    versionBeforeId: str | None = None
    versionAfterId: str | None = None


class ReviewItemUpdateRequest(BaseModel):
    documentId: str = Field(min_length=1)
    status: ReviewStatus | None = None
    targetBlockIds: list[str] | None = None
    beforeBlocks: list[dict[str, Any]] | None = None
    afterBlocks: list[dict[str, Any]] | None = None
    changes: list[dict[str, Any]] | None = None
    reason: str | None = None
    evidenceIds: list[str] | None = None
    versionBeforeId: str | None = None
    versionAfterId: str | None = None


@router.get("/review-items")
async def list_review_items(
    documentId: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    items = await _store(request).list_review_items(user_id, documentId)
    return ok({"items": items})


@router.post("/review-items", status_code=201)
async def create_review_item(
    body: ReviewItemCreateRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    item = await _store(request).create_review_item(user_id, body.model_dump())
    return ok(item, status_code=201)


@router.patch("/review-items/{review_item_id}")
async def update_review_item(
    review_item_id: str,
    body: ReviewItemUpdateRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    updates = body.model_dump(exclude_unset=True)
    document_id = updates.pop("documentId")
    item = await _store(request).update_review_item(user_id, document_id, review_item_id, updates)
    if item is None:
        raise _not_found()
    return ok(item)


async def _transition_review_item(
    review_item_id: str,
    body: ReviewItemUpdateRequest,
    request: Request,
    user_id: str,
    status: ReviewStatus,
):
    updates = body.model_dump(exclude_unset=True)
    document_id = updates.pop("documentId")
    updates["status"] = status
    item = await _store(request).update_review_item(user_id, document_id, review_item_id, updates)
    if item is None:
        raise _not_found()
    return ok(item)


@router.post("/review-items/{review_item_id}/accept")
async def accept_review_item(
    review_item_id: str,
    body: ReviewItemUpdateRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    return await _transition_review_item(review_item_id, body, request, user_id, "accepted")


@router.post("/review-items/{review_item_id}/reject")
async def reject_review_item(
    review_item_id: str,
    body: ReviewItemUpdateRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    return await _transition_review_item(review_item_id, body, request, user_id, "rejected")


@router.post("/review-items/{review_item_id}/defer")
async def defer_review_item(
    review_item_id: str,
    body: ReviewItemUpdateRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    return await _transition_review_item(review_item_id, body, request, user_id, "deferred")
```

- [ ] **Step 4: Register the router**

Modify `backend/main.py`:

```python
from api.review_items import router as review_items_router
```

Add `RedisReviewStore` to the store imports:

```python
    RedisReviewStore,
```

Inside lifespan, after `app.state.notification_store = ...`, add:

```python
    app.state.review_store = RedisReviewStore(redis_client)
```

Near the other router registrations, add:

```python
app.include_router(review_items_router, prefix="/api")
```

- [ ] **Step 5: Run review item API tests**

Run:

```bash
cd /app/inference-engine
PYTHONPATH=backend python3 -B -m unittest backend.tests.test_review_items_api
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /app/inference-engine
git add backend/api/review_items.py backend/main.py backend/store/redis_store.py backend/tests/test_review_items_api.py
git commit -m "feat: expose review item api"
```

---

## Task 3: Backend Evidence Status Patch

**Files:**
- Modify: `backend/store/redis_store.py`
- Modify: `backend/api/library.py`
- Test: `backend/tests/test_library_api.py`

- [ ] **Step 1: Write failing evidence patch tests**

Modify `backend/tests/test_library_api.py` imports:

```python
from fastapi import HTTPException
from api.library import EvidenceUpdateRequest, list_evidence, update_evidence
```

Append tests:

```python
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
```

- [ ] **Step 2: Run the library tests and verify they fail**

Run:

```bash
cd /app/inference-engine
PYTHONPATH=backend python3 -B -m unittest backend.tests.test_library_api
```

Expected: FAIL with import errors for `EvidenceUpdateRequest` or `update_evidence`.

- [ ] **Step 3: Add evidence update support to the store**

Add this method to `RedisEvidenceStore` in `backend/store/redis_store.py`:

```python
    async def update_evidence(self, user_id: str, evidence_id: str, updates: dict) -> dict | None:
        items = await self.list_evidence(user_id)
        matched = None
        for index, item in enumerate(items):
            if item.get("id") == evidence_id:
                next_item = {
                    **item,
                    **{key: value for key, value in updates.items() if value is not None},
                }
                items[index] = next_item
                matched = next_item
                break
        if matched is None:
            return None
        await self.save_evidence(user_id, items)
        return matched
```

- [ ] **Step 4: Add the PATCH route**

Modify `backend/api/library.py`:

```python
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
```

Add below `_store`:

```python
EvidenceStatus = Literal["candidate", "inserted", "needs_review", "verified", "conflict"]


class EvidenceUpdateRequest(BaseModel):
    status: EvidenceStatus | None = None
    linkedBlockIds: list[str] | None = None
    confidence: float | None = None
    sourceType: str | None = None
    verifiedAt: str | None = None
    usedAt: str | None = None
```

Add after `list_evidence`:

```python
@router.patch("/library/evidence/{evidence_id}")
async def update_evidence(
    evidence_id: str,
    body: EvidenceUpdateRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    updated = await _store(request).update_evidence(
        user_id,
        evidence_id,
        body.model_dump(exclude_unset=True),
    )
    if updated is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "EVIDENCE_NOT_FOUND", "message": "证据不存在"},
        )
    return ok(updated)
```

- [ ] **Step 5: Run library tests**

Run:

```bash
cd /app/inference-engine
PYTHONPATH=backend python3 -B -m unittest backend.tests.test_library_api
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /app/inference-engine
git add backend/api/library.py backend/store/redis_store.py backend/tests/test_library_api.py
git commit -m "feat: persist evidence ledger status"
```

---

## Task 4: Backend Version Metadata

**Files:**
- Modify: `backend/api/documents.py`
- Modify: `frontend/src/api/documents.ts`
- Test: `backend/tests/test_documents_api.py`

- [ ] **Step 1: Write failing metadata test**

Append this assertion block to `test_document_versions_can_be_created_listed_and_restored` in `backend/tests/test_documents_api.py` by changing the `VersionCreateRequest` call:

```python
                VersionCreateRequest(
                    label="First draft",
                    metadata={
                        "reviewItemIds": ["review-1"],
                        "acceptedChangeCount": 2,
                        "source": "review_accept",
                    },
                ),
```

Then add after `version_id = response_data(version)["id"]`:

```python
        self.assertEqual(response_data(version)["metadata"]["reviewItemIds"], ["review-1"])
        self.assertEqual(response_data(version)["metadata"]["acceptedChangeCount"], 2)
        self.assertEqual(response_data(version)["metadata"]["source"], "review_accept")
```

- [ ] **Step 2: Run the document tests and verify they fail**

Run:

```bash
cd /app/inference-engine
PYTHONPATH=backend python3 -B -m unittest backend.tests.test_documents_api
```

Expected: FAIL because `VersionCreateRequest` does not accept `metadata`.

- [ ] **Step 3: Extend version request model**

Modify `VersionCreateRequest` in `backend/api/documents.py`:

```python
class VersionCreateRequest(BaseModel):
    label: str | None = Field(default=None, max_length=120)
    metadata: dict[str, Any] = Field(default_factory=dict)
```

Modify the `version` dict in `create_version`:

```python
        "metadata": {**document.get("metadata", {}), **body.metadata},
```

- [ ] **Step 4: Update frontend document API types**

Modify `frontend/src/api/documents.ts`.

Add:

```ts
export interface DocumentVersionMetadata {
  reviewItemIds?: string[]
  acceptedChangeCount?: number
  source?: 'manual' | 'review_accept' | 'restore'
  [key: string]: unknown
}
```

Change `PersistedDocumentVersion`:

```ts
  metadata?: DocumentVersionMetadata
```

Change `createDocumentVersion` signature:

```ts
export function createDocumentVersion(
  documentId: string,
  label?: string,
  metadata: DocumentVersionMetadata = {},
): Promise<PersistedDocumentVersion> {
  return apiFetch<PersistedDocumentVersion>(`/api/documents/${documentId}/versions`, {
    method: 'POST',
    body: JSON.stringify({ label, metadata }),
  })
}
```

- [ ] **Step 5: Run backend document tests**

Run:

```bash
cd /app/inference-engine
PYTHONPATH=backend python3 -B -m unittest backend.tests.test_documents_api
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /app/inference-engine
git add backend/api/documents.py backend/tests/test_documents_api.py frontend/src/api/documents.ts
git commit -m "feat: attach metadata to document versions"
```

---

## Task 5: Frontend Review and Evidence API Clients

**Files:**
- Modify: `frontend/src/types/workspace.ts`
- Create: `frontend/src/api/reviewItems.ts`
- Modify: `frontend/src/api/library.ts`
- Test: `frontend/src/api/__tests__/reviewItems.test.ts`
- Test: `frontend/src/api/__tests__/client.test.ts`

- [ ] **Step 1: Write failing API client tests**

Create `frontend/src/api/__tests__/reviewItems.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acceptReviewItem,
  createReviewItem,
  fetchReviewItems,
  updateReviewItem,
} from '../reviewItems'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  localStorage.clear()
})

function ok(data: unknown) {
  return Promise.resolve(new Response(JSON.stringify({ ok: true, data }), { status: 200 }))
}

describe('review item api client', () => {
  it('fetches review items by document id', async () => {
    fetchMock.mockResolvedValue(ok({ items: [] }))

    await fetchReviewItems('doc-1')

    expect(fetchMock).toHaveBeenCalledWith('/api/review-items?documentId=doc-1', expect.objectContaining({
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
    }))
  })

  it('creates and transitions review items', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'review-1', status: 'pending' }))

    await createReviewItem({
      documentId: 'doc-1',
      source: 'document_tool',
      kind: 'rewrite',
      targetBlockIds: ['b1'],
      beforeBlocks: [],
      afterBlocks: [],
      changes: [],
      reason: 'Improve clarity',
      evidenceIds: [],
    })
    await updateReviewItem('review-1', { documentId: 'doc-1', status: 'deferred' })
    await acceptReviewItem('review-1', { documentId: 'doc-1', versionAfterId: 'v2' })

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/review-items', expect.objectContaining({ method: 'POST' }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/review-items/review-1', expect.objectContaining({ method: 'PATCH' }))
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/review-items/review-1/accept', expect.objectContaining({ method: 'POST' }))
  })
})
```

- [ ] **Step 2: Run the frontend API test and verify it fails**

Run:

```bash
cd /app/inference-engine/frontend
npm run test -- src/api/__tests__/reviewItems.test.ts --run
```

Expected: FAIL because `../reviewItems` does not exist.

- [ ] **Step 3: Add review and evidence types**

Modify `frontend/src/types/workspace.ts`:

```ts
export type ReviewItemStatus = 'pending' | 'accepted' | 'rejected' | 'deferred'
export type ReviewItemSource = 'chat' | 'document_tool' | 'writing_analysis' | 'manual'
export type ReviewItemKind = 'rewrite' | 'expand' | 'logic_check' | 'citation' | 'norm' | 'structure'

export interface ReviewItem {
  id: string
  documentId: string
  source: ReviewItemSource
  kind: ReviewItemKind
  status: ReviewItemStatus
  targetBlockIds: string[]
  beforeBlocks: DocumentBlock[]
  afterBlocks: DocumentBlock[]
  changes: SuggestionChange[]
  reason: string
  evidenceIds: string[]
  versionBeforeId?: string | null
  versionAfterId?: string | null
  createdAt: string
  updatedAt: string
}

export type EvidenceStatus = 'candidate' | 'inserted' | 'needs_review' | 'verified' | 'conflict'

export interface EvidenceLedgerItem extends ReferenceItem {
  type?: 'paper' | 'norm' | 'dataset' | 'other'
  status?: EvidenceStatus
  linkedBlockIds?: string[]
  confidence?: number
  sourceType?: string
  verifiedAt?: string
  usedAt?: string
}

export type RightPanelMode = 'review' | 'evidence' | 'graph' | 'versions'
```

Remove or replace the old `RightPanelMode = 'graph' | 'list'` definition.

- [ ] **Step 4: Create review API client**

Create `frontend/src/api/reviewItems.ts`:

```ts
import { apiFetch } from './client'
import type { ReviewItem, ReviewItemKind, ReviewItemSource, ReviewItemStatus } from '../types/workspace'

export interface ReviewItemsResponse {
  items: ReviewItem[]
}

export interface ReviewItemCreateInput {
  documentId: string
  source: ReviewItemSource
  kind: ReviewItemKind
  targetBlockIds: string[]
  beforeBlocks: ReviewItem['beforeBlocks']
  afterBlocks: ReviewItem['afterBlocks']
  changes: ReviewItem['changes']
  reason: string
  evidenceIds: string[]
  versionBeforeId?: string | null
  versionAfterId?: string | null
}

export interface ReviewItemUpdateInput {
  documentId: string
  status?: ReviewItemStatus
  targetBlockIds?: string[]
  beforeBlocks?: ReviewItem['beforeBlocks']
  afterBlocks?: ReviewItem['afterBlocks']
  changes?: ReviewItem['changes']
  reason?: string
  evidenceIds?: string[]
  versionBeforeId?: string | null
  versionAfterId?: string | null
}

export function fetchReviewItems(documentId: string): Promise<ReviewItemsResponse> {
  const params = new URLSearchParams({ documentId })
  return apiFetch<ReviewItemsResponse>(`/api/review-items?${params.toString()}`)
}

export function createReviewItem(input: ReviewItemCreateInput): Promise<ReviewItem> {
  return apiFetch<ReviewItem>('/api/review-items', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateReviewItem(id: string, input: ReviewItemUpdateInput): Promise<ReviewItem> {
  return apiFetch<ReviewItem>(`/api/review-items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function acceptReviewItem(id: string, input: ReviewItemUpdateInput): Promise<ReviewItem> {
  return apiFetch<ReviewItem>(`/api/review-items/${id}/accept`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function rejectReviewItem(id: string, input: ReviewItemUpdateInput): Promise<ReviewItem> {
  return apiFetch<ReviewItem>(`/api/review-items/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function deferReviewItem(id: string, input: ReviewItemUpdateInput): Promise<ReviewItem> {
  return apiFetch<ReviewItem>(`/api/review-items/${id}/defer`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
```

- [ ] **Step 5: Extend library API client**

Modify `frontend/src/api/library.ts`:

```ts
import type { EvidenceLedgerItem, EvidenceStatus } from '../types/workspace'

export interface EvidenceItem extends EvidenceLedgerItem {}
```

Add:

```ts
export interface EvidenceUpdateInput {
  status?: EvidenceStatus
  linkedBlockIds?: string[]
  confidence?: number
  sourceType?: string
  verifiedAt?: string
  usedAt?: string
}

export function updateEvidence(evidenceId: string, input: EvidenceUpdateInput): Promise<EvidenceItem> {
  return apiFetch<EvidenceItem>(`/api/library/evidence/${evidenceId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}
```

- [ ] **Step 6: Run frontend API test**

Run:

```bash
cd /app/inference-engine/frontend
npm run test -- src/api/__tests__/reviewItems.test.ts src/api/__tests__/client.test.ts --run
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd /app/inference-engine
git add frontend/src/types/workspace.ts frontend/src/api/reviewItems.ts frontend/src/api/library.ts frontend/src/api/__tests__/reviewItems.test.ts
git commit -m "feat: add review and evidence api clients"
```

---

## Task 6: Workspace Store Review State

**Files:**
- Modify: `frontend/src/store/workspace.ts`
- Test: `frontend/src/store/__tests__/workspace.test.ts`

- [ ] **Step 1: Write failing store tests**

Append to `frontend/src/store/__tests__/workspace.test.ts`:

```ts
it('stores review items and updates review status locally', () => {
  const store = useWorkspaceStore.getState()
  store.setReviewItems([{
    id: 'review-1',
    documentId: 'doc-1',
    source: 'document_tool',
    kind: 'rewrite',
    status: 'pending',
    targetBlockIds: ['b1'],
    beforeBlocks: [],
    afterBlocks: [],
    changes: [],
    reason: 'Improve clarity',
    evidenceIds: [],
    versionBeforeId: null,
    versionAfterId: null,
    createdAt: '2026-05-15T00:00:00Z',
    updatedAt: '2026-05-15T00:00:00Z',
  }])

  expect(useWorkspaceStore.getState().reviewItems).toHaveLength(1)
  store.upsertReviewItem({ ...useWorkspaceStore.getState().reviewItems[0], status: 'deferred' })

  expect(useWorkspaceStore.getState().reviewItems[0].status).toBe('deferred')
})
```

- [ ] **Step 2: Run store test and verify it fails**

Run:

```bash
cd /app/inference-engine/frontend
npm run test -- src/store/__tests__/workspace.test.ts --run
```

Expected: FAIL because `setReviewItems` and `upsertReviewItem` do not exist.

- [ ] **Step 3: Add state fields and actions**

Modify imports in `frontend/src/store/workspace.ts` to include `ReviewItem`.

Add to `WorkspaceState`:

```ts
  reviewItems: ReviewItem[]
  setReviewItems: (items: ReviewItem[]) => void
  upsertReviewItem: (item: ReviewItem) => void
  setReviewItemStatus: (id: string, status: ReviewItem['status'], versionAfterId?: string | null) => void
```

Add to `initialWorkspaceState()` return:

```ts
    reviewItems: [],
```

Add actions inside the `create<WorkspaceState>()` implementation:

```ts
    setReviewItems: (items) => set({ reviewItems: items }),
    upsertReviewItem: (item) => set(state => {
      const existingIndex = state.reviewItems.findIndex(entry => entry.id === item.id)
      if (existingIndex === -1) {
        return { reviewItems: [item, ...state.reviewItems] }
      }
      const next = [...state.reviewItems]
      next[existingIndex] = item
      return { reviewItems: next }
    }),
    setReviewItemStatus: (id, status, versionAfterId) => set(state => ({
      reviewItems: state.reviewItems.map(item => (
        item.id === id
          ? { ...item, status, versionAfterId: versionAfterId ?? item.versionAfterId, updatedAt: new Date().toISOString() }
          : item
      )),
    })),
```

- [ ] **Step 4: Set right panel default to Review**

In `initialWorkspaceState()`, change:

```ts
    rightPanelMode: 'review' as RightPanelMode,
```

- [ ] **Step 5: Run store tests**

Run:

```bash
cd /app/inference-engine/frontend
npm run test -- src/store/__tests__/workspace.test.ts --run
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /app/inference-engine
git add frontend/src/store/workspace.ts frontend/src/store/__tests__/workspace.test.ts
git commit -m "feat: track review items in workspace store"
```

---

## Task 7: Workspace Context Drawer

**Files:**
- Create: `frontend/src/features/workspace/WorkspaceContextDrawer.tsx`
- Create: `frontend/src/features/review/ReviewQueuePanel.tsx`
- Create: `frontend/src/features/evidence/EvidenceContextPanel.tsx`
- Create: `frontend/src/features/graph/GraphContextPanel.tsx`
- Create: `frontend/src/features/version/VersionContextPanel.tsx`
- Modify: `frontend/src/features/workspace/WorkspaceLayout.tsx`
- Modify: `frontend/src/features/workspace/MainWorkspace.tsx`
- Test: `frontend/src/pages/__tests__/WorkspaceViews.test.tsx`

- [ ] **Step 1: Write failing workspace UI test**

Append to `frontend/src/pages/__tests__/WorkspaceViews.test.tsx`:

```ts
  it('renders the workspace context drawer tabs', async () => {
    window.history.pushState({}, '', '/workbench')

    render(<App />)

    expect(screen.getByRole('tab', { name: '审阅' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '证据' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '图谱' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '版本' })).toBeInTheDocument()
    expect(screen.getByText('暂无待处理审阅项')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run workspace test and verify it fails**

Run:

```bash
cd /app/inference-engine/frontend
npm run test -- src/pages/__tests__/WorkspaceViews.test.tsx --run
```

Expected: FAIL because the tabs do not exist.

- [ ] **Step 3: Create ReviewQueuePanel**

Create `frontend/src/features/review/ReviewQueuePanel.tsx`:

```tsx
import { Check, Clock3, X } from 'lucide-react'
import { useWorkspaceStore } from '../../store/workspace'

export function ReviewQueuePanel() {
  const reviewItems = useWorkspaceStore(state => state.reviewItems)

  if (reviewItems.length === 0) {
    return (
      <div className="flex h-full min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-scholar-border bg-scholar-bg-canvas p-4 text-center">
        <div className="text-sm font-semibold text-scholar-text-primary">暂无待处理审阅项</div>
        <p className="mt-1 text-xs leading-5 text-scholar-text-secondary">AI 建议和写作校审结果会先进入这里，确认后再写入正文。</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {reviewItems.map(item => (
        <article key={item.id} className="rounded-xl border border-scholar-border bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-scholar-text-primary">{item.reason || '待审阅修改'}</h3>
              <p className="mt-1 text-xs text-scholar-text-secondary">{item.kind} · {item.status}</p>
            </div>
            <StatusIcon status={item.status} />
          </div>
          {item.changes[0]?.revisedText && (
            <p className="mt-3 line-clamp-3 text-xs leading-5 text-scholar-text-secondary">{item.changes[0].revisedText}</p>
          )}
        </article>
      ))}
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'accepted') return <Check size={16} className="text-emerald-600" />
  if (status === 'rejected') return <X size={16} className="text-red-600" />
  return <Clock3 size={16} className="text-amber-600" />
}
```

- [ ] **Step 4: Create context panels**

Create `frontend/src/features/evidence/EvidenceContextPanel.tsx`:

```tsx
import { useWorkspaceStore } from '../../store/workspace'

export function EvidenceContextPanel() {
  const references = useWorkspaceStore(state => state.references)
  const selectedBlockId = useWorkspaceStore(state => state.selectedBlockId)
  const linked = references.filter(reference => !selectedBlockId || reference.id)

  if (linked.length === 0) {
    return <div className="rounded-xl border border-dashed border-scholar-border bg-scholar-bg-canvas p-4 text-sm text-scholar-text-secondary">暂无关联证据</div>
  }

  return (
    <div className="space-y-3">
      {linked.map(reference => (
        <article key={reference.id} className="rounded-xl border border-scholar-border bg-white p-3">
          <h3 className="text-sm font-bold text-scholar-text-primary">{reference.title}</h3>
          <p className="mt-1 text-xs text-scholar-text-secondary">{[reference.venue, reference.year].filter(Boolean).join(' · ') || '来源待补充'}</p>
        </article>
      ))}
    </div>
  )
}
```

Create `frontend/src/features/graph/GraphContextPanel.tsx`:

```tsx
import { useWorkspaceStore } from '../../store/workspace'
import { GraphToolbar } from './GraphToolbar'
import { KnowledgeGraph } from './KnowledgeGraph'
import { NodeDetailCard } from './NodeDetailCard'

export function GraphContextPanel() {
  const selectedGraphNodeId = useWorkspaceStore(state => state.selectedGraphNodeId)
  const graphNodes = useWorkspaceStore(state => state.graphNodes)
  const selectedNode = graphNodes.find(node => node.id === selectedGraphNodeId) ?? graphNodes[0]

  return (
    <div className="flex h-full min-h-0 flex-col">
      <GraphToolbar />
      <div className="min-h-0 flex-1 border-y border-scholar-border">
        {graphNodes.length > 0 ? <KnowledgeGraph /> : <div className="p-4 text-sm text-scholar-text-secondary">暂无图谱节点</div>}
      </div>
      <div className="p-3">
        {selectedNode ? <NodeDetailCard node={selectedNode} /> : <div className="text-sm text-scholar-text-secondary">暂无节点详情</div>}
      </div>
    </div>
  )
}
```

Create `frontend/src/features/version/VersionContextPanel.tsx`:

```tsx
import { VersionList } from './VersionList'

export function VersionContextPanel() {
  return <VersionList />
}
```

- [ ] **Step 5: Create WorkspaceContextDrawer**

Create `frontend/src/features/workspace/WorkspaceContextDrawer.tsx`:

```tsx
import { BookMarked, GitBranch, Network, Sparkles } from 'lucide-react'
import { EvidenceContextPanel } from '../evidence/EvidenceContextPanel'
import { GraphContextPanel } from '../graph/GraphContextPanel'
import { ReviewQueuePanel } from '../review/ReviewQueuePanel'
import { VersionContextPanel } from '../version/VersionContextPanel'
import { useWorkspaceStore } from '../../store/workspace'
import type { RightPanelMode } from '../../types/workspace'

const tabs: Array<{ id: RightPanelMode; label: string; icon: React.ReactNode }> = [
  { id: 'review', label: '审阅', icon: <Sparkles size={14} /> },
  { id: 'evidence', label: '证据', icon: <BookMarked size={14} /> },
  { id: 'graph', label: '图谱', icon: <Network size={14} /> },
  { id: 'versions', label: '版本', icon: <GitBranch size={14} /> },
]

export function WorkspaceContextDrawer() {
  const mode = useWorkspaceStore(state => state.rightPanelMode)
  const setMode = useWorkspaceStore(state => state.setRightPanelMode)

  return (
    <aside className="hidden w-[400px] shrink-0 flex-col overflow-hidden rounded-2xl border border-scholar-border bg-white shadow-sm xl:flex">
      <div className="border-b border-scholar-border px-4 py-3">
        <h2 className="text-base font-black text-scholar-text-primary">上下文</h2>
        <div role="tablist" aria-label="工作台上下文" className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-scholar-bg-canvas p-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={mode === tab.id}
              className={`flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                mode === tab.id ? 'bg-white text-scholar-primary shadow-sm' : 'text-scholar-text-secondary'
              }`}
              onClick={() => setMode(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {mode === 'review' && <ReviewQueuePanel />}
        {mode === 'evidence' && <EvidenceContextPanel />}
        {mode === 'graph' && <GraphContextPanel />}
        {mode === 'versions' && <VersionContextPanel />}
      </div>
    </aside>
  )
}
```

- [ ] **Step 6: Use the drawer in the workspace layout**

Modify `frontend/src/features/workspace/WorkspaceLayout.tsx`:

```tsx
import { WorkspaceContextDrawer } from './WorkspaceContextDrawer'
```

Replace:

```tsx
        <RightKnowledgePanel />
```

With:

```tsx
        <WorkspaceContextDrawer />
```

Remove the unused `RightKnowledgePanel` import.

Modify `frontend/src/features/workspace/MainWorkspace.tsx` so the AI suggestion panel no longer dominates the bottom. For P0, keep the input below the editor:

```tsx
export function MainWorkspace() {
  return (
    <main className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">
        <DocumentEditor />
      </div>
      <section className="shrink-0 rounded-2xl border border-scholar-border bg-white shadow-sm">
        <AIChatInput />
      </section>
    </main>
  )
}
```

- [ ] **Step 7: Run workspace UI tests**

Run:

```bash
cd /app/inference-engine/frontend
npm run test -- src/pages/__tests__/WorkspaceViews.test.tsx --run
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
cd /app/inference-engine
git add frontend/src/features/workspace/WorkspaceContextDrawer.tsx frontend/src/features/review/ReviewQueuePanel.tsx frontend/src/features/evidence/EvidenceContextPanel.tsx frontend/src/features/graph/GraphContextPanel.tsx frontend/src/features/version/VersionContextPanel.tsx frontend/src/features/workspace/WorkspaceLayout.tsx frontend/src/features/workspace/MainWorkspace.tsx frontend/src/pages/__tests__/WorkspaceViews.test.tsx
git commit -m "feat: add workspace context drawer"
```

---

## Task 8: Move AI Suggestions Into Review Items

**Files:**
- Modify: `frontend/src/store/workspace.ts`
- Modify: `frontend/src/features/ai/AIChatInput.tsx`
- Modify: `frontend/src/features/review/ReviewQueuePanel.tsx`
- Test: `frontend/src/store/__tests__/workspace.test.ts`

- [ ] **Step 1: Write failing suggestion conversion test**

Append to `frontend/src/store/__tests__/workspace.test.ts`:

```ts
it('converts current suggestion into a pending review item', () => {
  const store = useWorkspaceStore.getState()
  store.setCurrentSuggestion({
    id: 'suggestion-1',
    title: 'AI 生成的修改建议',
    summary: 'Improve clarity',
    targetBlockIds: ['b1'],
    operation: 'replace_blocks',
    beforeBlocks: [],
    afterBlocks: [],
    reason: 'Improve clarity',
    confidence: 0.8,
    changes: [],
    reasons: ['Improve clarity'],
    reasoningSteps: ['Generated from selected paragraph'],
    createdAt: '2026-05-15T00:00:00Z',
  })

  store.enqueueCurrentSuggestionAsReviewItem('doc-1')

  expect(useWorkspaceStore.getState().reviewItems[0]).toMatchObject({
    documentId: 'doc-1',
    source: 'document_tool',
    kind: 'rewrite',
    status: 'pending',
    reason: 'Improve clarity',
  })
})
```

- [ ] **Step 2: Run store test and verify it fails**

Run:

```bash
cd /app/inference-engine/frontend
npm run test -- src/store/__tests__/workspace.test.ts --run
```

Expected: FAIL because `enqueueCurrentSuggestionAsReviewItem` does not exist.

- [ ] **Step 3: Add conversion action**

Modify `WorkspaceState` in `frontend/src/store/workspace.ts`:

```ts
  enqueueCurrentSuggestionAsReviewItem: (documentId: string) => void
```

Add action:

```ts
    enqueueCurrentSuggestionAsReviewItem: (documentId) => set(state => {
      if (!state.currentSuggestion) return {}
      const suggestion = state.currentSuggestion
      const now = new Date().toISOString()
      const item: ReviewItem = {
        id: `review-${suggestion.id}`,
        documentId,
        source: state.aiRunMode === 'citation_enhance' ? 'document_tool' : 'document_tool',
        kind: state.aiRunMode === 'expand' ? 'expand' : state.aiRunMode === 'logic_check' ? 'logic_check' : state.aiRunMode === 'citation_enhance' ? 'citation' : 'rewrite',
        status: 'pending',
        targetBlockIds: suggestion.targetBlockIds,
        beforeBlocks: suggestion.beforeBlocks,
        afterBlocks: suggestion.afterBlocks,
        changes: suggestion.changes,
        reason: suggestion.reason || suggestion.summary,
        evidenceIds: [],
        versionBeforeId: state.activeVersionId,
        versionAfterId: null,
        createdAt: now,
        updatedAt: now,
      }
      return { reviewItems: [item, ...state.reviewItems] }
    }),
```

- [ ] **Step 4: Enqueue suggestions when generation finishes**

In `finishAIRunAsSuggestion()` inside `frontend/src/store/workspace.ts`, after `currentSuggestion` is set, also add the created item to `reviewItems`. Use the same shape as `enqueueCurrentSuggestionAsReviewItem` and `activeDocumentId ?? 'local-draft'` as the document id.

Code to place where the suggestion object is available:

```ts
        const reviewItem: ReviewItem = {
          id: `review-${suggestion.id}`,
          documentId: state.activeDocumentId ?? 'local-draft',
          source: 'document_tool',
          kind: state.aiRunMode === 'expand' ? 'expand' : state.aiRunMode === 'logic_check' ? 'logic_check' : state.aiRunMode === 'citation_enhance' ? 'citation' : 'rewrite',
          status: 'pending',
          targetBlockIds: suggestion.targetBlockIds,
          beforeBlocks: suggestion.beforeBlocks,
          afterBlocks: suggestion.afterBlocks,
          changes: suggestion.changes,
          reason: suggestion.reason || suggestion.summary,
          evidenceIds: [],
          versionBeforeId: state.activeVersionId,
          versionAfterId: null,
          createdAt: suggestion.createdAt,
          updatedAt: suggestion.createdAt,
        }
```

Then return:

```ts
        reviewItems: [reviewItem, ...state.reviewItems],
        rightPanelMode: 'review',
```

- [ ] **Step 5: Add decision actions in ReviewQueuePanel**

Modify `ReviewQueuePanel.tsx`:

```tsx
  const setReviewItemStatus = useWorkspaceStore(state => state.setReviewItemStatus)
```

Add buttons inside each article:

```tsx
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-scholar-primary" onClick={() => setReviewItemStatus(item.id, 'accepted')}>
              接受
            </button>
            <button className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-scholar-text-secondary" onClick={() => setReviewItemStatus(item.id, 'deferred')}>
              稍后
            </button>
            <button className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600" onClick={() => setReviewItemStatus(item.id, 'rejected')}>
              拒绝
            </button>
          </div>
```

- [ ] **Step 6: Run store tests**

Run:

```bash
cd /app/inference-engine/frontend
npm run test -- src/store/__tests__/workspace.test.ts --run
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd /app/inference-engine
git add frontend/src/store/workspace.ts frontend/src/features/review/ReviewQueuePanel.tsx frontend/src/store/__tests__/workspace.test.ts
git commit -m "feat: route ai suggestions into review queue"
```

---

## Task 9: Evidence Ledger Page

**Files:**
- Modify: `frontend/src/pages/Library.tsx`
- Modify: `frontend/src/pages/__tests__/Library.test.tsx`

- [ ] **Step 1: Replace Library tests with ledger expectations**

Modify the first test mock item in `frontend/src/pages/__tests__/Library.test.tsx`:

```ts
      items: [{
        id: 'api-evidence',
        title: 'API Evidence',
        venue: 'API Venue',
        year: 2026,
        score: 0.92,
        type: 'paper',
        status: 'needs_review',
        linkedBlockIds: ['intro'],
        confidence: 0.92,
      }],
```

Add expectations:

```ts
    expect(await screen.findByText('API Evidence')).toBeInTheDocument()
    expect(screen.getByText('待核验')).toBeInTheDocument()
    expect(screen.getByText('关联段落 1')).toBeInTheDocument()
```

Add a new test:

```ts
  it('filters evidence by status in the ledger', async () => {
    fetchEvidence.mockResolvedValue({ items: [] })

    renderLibrary()

    fireEvent.change(screen.getByLabelText('证据状态'), { target: { value: 'verified' } })

    await waitFor(() => {
      expect(fetchEvidence).toHaveBeenLastCalledWith({ status: 'verified' })
    })
  })
```

- [ ] **Step 2: Run Library test and verify it fails**

Run:

```bash
cd /app/inference-engine/frontend
npm run test -- src/pages/__tests__/Library.test.tsx --run
```

Expected: FAIL because the status filter and ledger fields do not exist.

- [ ] **Step 3: Extend frontend library filters**

Modify `frontend/src/api/library.ts`:

```ts
export interface EvidenceFilters {
  q?: string
  type?: string
  status?: EvidenceStatus
}
```

In `fetchEvidence`:

```ts
  if (filters.status) params.set('status', filters.status)
```

Modify backend `list_evidence` later if status filtering is needed server-side. For this page test, the client call is enough; Task 10 covers backend status query.

- [ ] **Step 4: Rework Library component state and filters**

In `frontend/src/pages/Library.tsx`, add:

```tsx
import type { EvidenceStatus } from '../types/workspace'
```

State:

```tsx
  const [status, setStatus] = useState<EvidenceStatus | ''>('')
```

Fetch call:

```tsx
    fetchEvidence({
      q: query.trim() || undefined,
      type: type || undefined,
      status: status || undefined,
    })
```

Add status select beside type:

```tsx
            <label className="flex flex-col gap-1 text-xs font-semibold text-scholar-text-secondary">
              证据状态
              <select
                aria-label="证据状态"
                value={status}
                onChange={event => setStatus(event.target.value as EvidenceStatus | '')}
                className="h-10 rounded-xl border border-scholar-border bg-white px-3 text-sm font-normal text-scholar-text-primary outline-none transition focus:border-scholar-primary focus:ring-4 focus:ring-blue-100"
              >
                <option value="">全部</option>
                <option value="candidate">候选</option>
                <option value="inserted">已插入</option>
                <option value="needs_review">待核验</option>
                <option value="verified">已核验</option>
                <option value="conflict">冲突</option>
              </select>
            </label>
```

- [ ] **Step 5: Replace static badges with real ledger fields**

Replace the static badge block in `Library.tsx`:

```tsx
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge>引用候选</Badge>
                    <Badge tone="success">可用于综述</Badge>
                    <Badge>待核验格式</Badge>
                  </div>
```

With:

```tsx
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge tone={getEvidenceStatusTone(reference.status)}>{getEvidenceStatusLabel(reference.status)}</Badge>
                    {typeof reference.confidence === 'number' && <Badge>可信度 {Math.round(reference.confidence * 100)}%</Badge>}
                    {reference.linkedBlockIds?.length ? <Badge>关联段落 {reference.linkedBlockIds.length}</Badge> : <Badge>未关联正文</Badge>}
                  </div>
```

Add helpers at the bottom:

```tsx
function getEvidenceStatusLabel(status?: string): string {
  switch (status) {
    case 'inserted':
      return '已插入'
    case 'needs_review':
      return '待核验'
    case 'verified':
      return '已核验'
    case 'conflict':
      return '冲突'
    case 'candidate':
    default:
      return '候选'
  }
}

function getEvidenceStatusTone(status?: string): 'neutral' | 'primary' | 'success' | 'warning' | 'danger' {
  if (status === 'verified') return 'success'
  if (status === 'needs_review') return 'warning'
  if (status === 'conflict') return 'danger'
  if (status === 'inserted') return 'primary'
  return 'neutral'
}
```

- [ ] **Step 6: Run Library test**

Run:

```bash
cd /app/inference-engine/frontend
npm run test -- src/pages/__tests__/Library.test.tsx --run
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd /app/inference-engine
git add frontend/src/pages/Library.tsx frontend/src/api/library.ts frontend/src/pages/__tests__/Library.test.tsx
git commit -m "feat: present library as evidence ledger"
```

---

## Task 10: Backend Library Status Filtering

**Files:**
- Modify: `backend/api/library.py`
- Test: `backend/tests/test_library_api.py`

- [ ] **Step 1: Write failing status filter test**

Append to `backend/tests/test_library_api.py`:

```python
    def test_filters_evidence_by_status(self):
        request = make_request()
        self.run_async(update_evidence(
            "norm-hust-2026",
            EvidenceUpdateRequest(status="verified"),
            request,
            user_id="alice@hust.edu.cn",
        ))

        response = self.run_async(list_evidence(request, status="verified", user_id="alice@hust.edu.cn"))

        items = response_data(response)["items"]
        self.assertTrue(items)
        self.assertTrue(all(item.get("status") == "verified" for item in items))
```

- [ ] **Step 2: Run backend library tests and verify failure**

Run:

```bash
cd /app/inference-engine
PYTHONPATH=backend python3 -B -m unittest backend.tests.test_library_api
```

Expected: FAIL because `list_evidence` does not accept `status`.

- [ ] **Step 3: Add status query filtering**

Modify `list_evidence` signature in `backend/api/library.py`:

```python
    status: str | None = None,
```

Add after type filtering:

```python
    if status:
        items = [item for item in items if item.get("status") == status]
```

- [ ] **Step 4: Run backend library tests**

Run:

```bash
cd /app/inference-engine
PYTHONPATH=backend python3 -B -m unittest backend.tests.test_library_api
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /app/inference-engine
git add backend/api/library.py backend/tests/test_library_api.py
git commit -m "feat: filter evidence by ledger status"
```

---

## Task 11: Writing Analysis to Review Queue Bridge

**Files:**
- Modify: `frontend/src/features/writing/WritingAnalysisPanel.tsx`
- Modify: `frontend/src/pages/Writing.tsx`
- Modify: `frontend/src/pages/__tests__/Writing.test.tsx`

- [ ] **Step 1: Inspect result shape before editing**

Run:

```bash
cd /app/inference-engine
sed -n '1,220p' frontend/src/features/writing/useWritingAnalysis.ts
sed -n '1,260p' frontend/src/features/writing/WritingAnalysisPanel.tsx
```

Expected: identify the exact result properties already rendered by the panel.

- [ ] **Step 2: Write failing Writing test**

Modify `frontend/src/pages/__tests__/Writing.test.tsx` by adding an expectation after a mocked successful analysis result renders:

```ts
expect(await screen.findByRole('button', { name: '推入审阅队列' })).toBeInTheDocument()
```

Then click it:

```ts
fireEvent.click(screen.getByRole('button', { name: '推入审阅队列' }))
expect(screen.getByText('已推入工作台审阅队列')).toBeInTheDocument()
```

- [ ] **Step 3: Run Writing test and verify it fails**

Run:

```bash
cd /app/inference-engine/frontend
npm run test -- src/pages/__tests__/Writing.test.tsx --run
```

Expected: FAIL because the button does not exist.

- [ ] **Step 4: Add callback prop to WritingAnalysisPanel**

Modify `WritingAnalysisPanel` props:

```tsx
interface WritingAnalysisPanelProps {
  result: WritingAnalysisResult | null
  loading: boolean
  error: string
  onRetry: () => void
  onPushToReview?: () => void
}
```

Add the button where a successful result is shown:

```tsx
{result && onPushToReview && (
  <button
    type="button"
    className="mt-4 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-semibold text-scholar-primary transition hover:bg-blue-100"
    onClick={onPushToReview}
  >
    推入审阅队列
  </button>
)}
```

- [ ] **Step 5: Wire Writing page to workspace store**

In `frontend/src/pages/Writing.tsx`, add:

```tsx
  const [reviewNotice, setReviewNotice] = useState('')
  const upsertReviewItem = useWorkspaceStore(state => state.upsertReviewItem)
  const activeDocumentId = useWorkspaceStore(state => state.activeDocumentId)
  const activeVersionId = useWorkspaceStore(state => state.activeVersionId)
```

Add handler:

```tsx
  const handlePushToReview = () => {
    if (!result) return
    const now = new Date().toISOString()
    upsertReviewItem({
      id: `writing-${now}`,
      documentId: activeDocumentId ?? 'local-draft',
      source: 'writing_analysis',
      kind: mode === 'citation' ? 'citation' : mode === 'structure' ? 'structure' : 'norm',
      status: 'pending',
      targetBlockIds: [],
      beforeBlocks: [],
      afterBlocks: [],
      changes: [],
      reason: result.summary ?? '写作分析结果',
      evidenceIds: [],
      versionBeforeId: activeVersionId,
      versionAfterId: null,
      createdAt: now,
      updatedAt: now,
    })
    setReviewNotice('已推入工作台审阅队列')
  }
```

Pass props:

```tsx
<WritingAnalysisPanel result={result} loading={loading} error={error} onRetry={handleAnalyze} onPushToReview={handlePushToReview} />
```

Render notice:

```tsx
{reviewNotice && <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">{reviewNotice}</div>}
```

- [ ] **Step 6: Run Writing test**

Run:

```bash
cd /app/inference-engine/frontend
npm run test -- src/pages/__tests__/Writing.test.tsx --run
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd /app/inference-engine
git add frontend/src/pages/Writing.tsx frontend/src/features/writing/WritingAnalysisPanel.tsx frontend/src/pages/__tests__/Writing.test.tsx
git commit -m "feat: push writing analysis into review queue"
```

---

## Task 12: Courses Seed Cleanup and Terminology

**Files:**
- Modify: `frontend/src/pages/Courses.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/features/workspace/TopBar.tsx`
- Modify: `frontend/src/pages/LoginPage.tsx`
- Test: `frontend/src/pages/__tests__/Courses.test.tsx`
- Test: `frontend/src/pages/__tests__/Dashboard.test.tsx`
- Test: `frontend/src/pages/__tests__/WorkspaceViews.test.tsx`

- [ ] **Step 1: Write failing seed cleanup assertion**

In `frontend/src/pages/__tests__/Courses.test.tsx` or `WorkspaceViews.test.tsx`, update the course blank button expectation:

```ts
expect(screen.getByRole('button', { name: /打开空白工作台/ })).toBeInTheDocument()
expect(screen.queryByRole('button', { name: /进入研究工作台/ })).not.toBeInTheDocument()
```

If the test clicks the blank button, assert:

```ts
expect(screen.queryByText('大语言模型在教育领域的应用综述')).not.toBeInTheDocument()
```

- [ ] **Step 2: Run course and workspace tests and verify failure**

Run:

```bash
cd /app/inference-engine/frontend
npm run test -- src/pages/__tests__/Courses.test.tsx src/pages/__tests__/WorkspaceViews.test.tsx --run
```

Expected: FAIL because old button copy or seed title still exists.

- [ ] **Step 3: Remove blank seed title**

Modify `handleOpenBlank` in `frontend/src/pages/Courses.tsx`:

```tsx
  const handleOpenBlank = () => {
    setWorkbenchContext({
      sourceTitle: '未命名研究文档',
      actionType: 'blank',
      courseTitle: '空白工作台',
      sourceType: 'manual',
      createdAt: new Date().toISOString(),
    })
    navigate('/workbench')
  }
```

Change top button text:

```tsx
打开空白工作台
```

Change card button text:

```tsx
{openingSpaceId === space.id ? '正在载入' : '打开工作台'}
```

- [ ] **Step 4: Normalize product naming**

Use this copy:

`frontend/src/pages/Dashboard.tsx`:

```tsx
学术写作助手
```

as the eyebrow, and:

```tsx
写作工作台总览
```

as the heading.

`frontend/src/features/workspace/TopBar.tsx`:

```tsx
<span className="whitespace-nowrap text-base font-bold tracking-tight">学术写作助手</span>
```

`frontend/src/pages/LoginPage.tsx` already uses `学术写作助手`; leave it.

- [ ] **Step 5: Run updated page tests**

Run:

```bash
cd /app/inference-engine/frontend
npm run test -- src/pages/__tests__/Courses.test.tsx src/pages/__tests__/Dashboard.test.tsx src/pages/__tests__/WorkspaceViews.test.tsx --run
```

Expected: PASS after updating assertions to the new headings where needed.

- [ ] **Step 6: Commit**

```bash
cd /app/inference-engine
git add frontend/src/pages/Courses.tsx frontend/src/pages/Dashboard.tsx frontend/src/features/workspace/TopBar.tsx frontend/src/pages/__tests__/Courses.test.tsx frontend/src/pages/__tests__/Dashboard.test.tsx frontend/src/pages/__tests__/WorkspaceViews.test.tsx
git commit -m "chore: align p0 product terminology"
```

---

## Task 13: Final Verification and Documentation Sync

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/architecture/current-production-architecture.md`
- Modify: `docs/roadmap/remaining-integrations.md`

- [ ] **Step 1: Update production boundary wording**

Ensure these files no longer describe `academic-workbench-fe/` as present in the repo. Use this wording where appropriate:

```markdown
Production consists of `backend/` and `frontend/`. The archived `academic-workbench-fe/` prototype has been removed from this repository; historical references should not be used for production development, deployment checks, or acceptance testing.
```

- [ ] **Step 2: Update roadmap P0 status**

In `docs/roadmap/remaining-integrations.md`, update rows for workspace documents, library, writing analysis, and document tools to mention:

```markdown
P0 refactor introduces review items, evidence statuses, and version associations for the document-centered workbench.
```

- [ ] **Step 3: Run targeted backend tests**

Run:

```bash
cd /app/inference-engine
PYTHONPATH=backend python3 -B -m unittest \
  backend.tests.test_documents_api \
  backend.tests.test_library_api \
  backend.tests.test_review_items_api
```

Expected: PASS.

- [ ] **Step 4: Run targeted frontend tests**

Run:

```bash
cd /app/inference-engine/frontend
npm run test -- \
  src/api/__tests__/reviewItems.test.ts \
  src/store/__tests__/workspace.test.ts \
  src/pages/__tests__/Library.test.tsx \
  src/pages/__tests__/Writing.test.tsx \
  src/pages/__tests__/Courses.test.tsx \
  src/pages/__tests__/Dashboard.test.tsx \
  src/pages/__tests__/WorkspaceViews.test.tsx \
  --run
```

Expected: PASS.

- [ ] **Step 5: Run frontend build**

Run:

```bash
cd /app/inference-engine/frontend
npm run build
```

Expected: PASS and Vite emits production assets.

- [ ] **Step 6: Check git status**

Run:

```bash
cd /app/inference-engine
git status --short
```

Expected: only intended documentation changes are present before commit.

- [ ] **Step 7: Commit docs and verification updates**

```bash
cd /app/inference-engine
git add README.md AGENTS.md docs/architecture/current-production-architecture.md docs/roadmap/remaining-integrations.md
git commit -m "docs: document p0 workbench integration"
```

---

## Self-Review

Spec coverage:

- Production boundary and prototype removal: Task 13, already preceded by committed deletion.
- Review item persistence: Tasks 1 and 2.
- Evidence ledger status persistence: Tasks 3, 9, and 10.
- Version metadata associations: Task 4.
- Frontend review/evidence typed clients: Task 5.
- Workbench context drawer: Task 7.
- AI suggestions as review items: Task 8.
- Writing analysis bridge: Task 11.
- Courses seed cleanup and terminology: Task 12.
- Verification: Task 13.

Placeholder scan:

- This plan has no placeholder markers or vague deferred-work instructions.
- Each implementation task has explicit files, code snippets, commands, and expected results.

Type consistency:

- Review statuses are consistently `pending`, `accepted`, `rejected`, and `deferred`.
- Evidence statuses are consistently `candidate`, `inserted`, `needs_review`, `verified`, and `conflict`.
- `RightPanelMode` is consistently `review`, `evidence`, `graph`, and `versions`.
