# P0 Academic Writing Workbench Design

Date: 2026-05-15

## Scope

This spec covers the P0 UI/UX refactor for the production `inference-engine` application. The production boundary remains `backend/` plus `frontend/`. The archived `academic-workbench-fe/` prototype is removed and must not be used for development, deployment checks, or acceptance testing.

P0 focuses on the first implementation phase:

- Unified product shell and terminology.
- Workbench information architecture based on a main document area plus a right-side context drawer.
- AI suggestions and writing analysis results as reviewable items.
- Evidence library upgraded into an evidence ledger with real statuses.
- Lightweight backend persistence for review items, evidence status, and version associations.

Out of scope for P0:

- Full teacher, collaborator, reviewer, and admin permission workflows.
- httpOnly cookie/session migration.
- Multi-device edit conflict resolution.
- Graph layout persistence.
- Route-level bundle splitting.
- Full teacher dashboard or classroom analytics.

## Product Principle

The product should stop behaving like several adjacent modules and instead organize the core experience around three shared objects:

1. Document
2. Evidence
3. Review item

Versions provide traceability and rollback for changes made to documents. AI output must enter a review flow before it changes the document. Evidence must have a real status instead of static presentation badges. Review decisions must be visible and persistent.

## Confirmed Direction

The chosen P0 direction is "main document plus right-side context drawer."

The workbench keeps the document as the user's primary surface. The right side becomes a `WorkspaceContextDrawer` with four tabs:

- Review
- Evidence
- Graph
- Versions

This replaces the current graph-only `RightKnowledgePanel` and avoids turning the workbench into a task dashboard. The current document editor remains central, while review, evidence, graph, and version details become context for the current document, paragraph, or selection.

## Architecture

P0 uses frontend information architecture changes plus lightweight backend support.

Frontend responsibilities:

- Introduce a context drawer that unifies review, evidence, graph, and versions.
- Move AI suggestions and writing analysis results into a review queue.
- Show citation and evidence risk in document context.
- Rework the library page into an evidence ledger.
- Clean up product terminology and demo/seed leakage.

Backend responsibilities:

- Persist review items per user and document.
- Persist evidence status and block associations.
- Store version metadata linking versions to accepted review items.
- Keep current FastAPI envelope behavior and Redis persistence patterns.

The backend should remain intentionally small in this phase. It should not introduce a new database, a broad authorization system, or a full audit subsystem.

## Core Objects

### Document

Current document storage through `/api/documents` remains the base. P0 may add metadata for review/version traceability, but the document block model should not be replaced.

Important fields:

- `id`
- `title`
- `courseId`
- `blocks`
- `metadata`
- `createdAt`
- `updatedAt`

### Review Item

Review items represent AI-generated suggestions and writing analysis findings that require a user decision.

Minimum fields:

- `id`
- `documentId`
- `source`: `chat`, `document_tool`, `writing_analysis`, or `manual`
- `kind`: `rewrite`, `expand`, `logic_check`, `citation`, `norm`, or `structure`
- `status`: `pending`, `accepted`, `rejected`, or `deferred`
- `targetBlockIds`
- `beforeBlocks`
- `afterBlocks`
- `changes`
- `reason`
- `evidenceIds`
- `versionBeforeId`
- `versionAfterId`
- `createdAt`
- `updatedAt`

P0 does not include teacher approval statuses. `deferred` is enough for "handle later."

### Evidence

The existing evidence objects are extended rather than replaced.

Minimum added fields:

- `status`: `candidate`, `inserted`, `needs_review`, `verified`, or `conflict`
- `linkedBlockIds`
- `confidence`
- `sourceType`
- `verifiedAt`
- `usedAt`

The library page and workbench evidence tab must read the same status data.

### Version

Existing document versions remain the rollback mechanism.

Minimum added metadata:

- `reviewItemIds`
- `acceptedChangeCount`
- `source`: `manual`, `review_accept`, or `restore`

Accepting a review item should create or update version associations so the accepted change can be traced.

## Frontend Design

### Workbench

`WorkspaceLayout` remains the top-level workbench entry.

Target structure:

- `LeftRail`
  - Current research context.
  - Document outline.
  - Save/version status.
- `DocumentWorkspace`
  - `InlineEditorToolbar`
  - `CitationRiskStrip`
  - `DocumentEditor`
  - `AICommandBar`
- `WorkspaceContextDrawer`
  - `ReviewQueuePanel`
  - `EvidenceContextPanel`
  - `GraphContextPanel`
  - `VersionContextPanel`

The current `RightKnowledgePanel` should be replaced or refactored into the graph tab inside the context drawer. Existing graph components should be reused where possible.

The current bottom AI suggestion area should not remain the dominant review surface. Suggestions should appear in the Review tab with explicit decisions.

### Review Tab

The Review tab shows pending, accepted, rejected, and deferred review items.

Each item should expose:

- Summary
- Affected block or section
- Diff or before/after text
- Reason or generation basis
- Evidence links when present
- Actions: accept, reject, defer

The label "思考过程" should be replaced with user-facing language such as "生成依据" or "变更依据."

### Evidence Tab

The Evidence tab shows evidence related to the selected block or active review item.

It should support:

- Status display.
- Status update.
- Linked block display.
- Inserted/needs-review/verified/conflict distinction.
- Jump to full library.

### Graph Tab

The Graph tab reuses:

- `GraphToolbar`
- `KnowledgeGraph`
- `NodeDetailCard`

P0 should avoid new graph layout persistence. The graph becomes one context among four, not the primary right panel.

### Versions Tab

The Versions tab reuses the existing version model and UI where possible.

P0 adds:

- Review item associations.
- Clearer restore confirmation.
- Replacement of `window.confirm` with an in-app confirmation panel.

### Library Page

`/library` becomes an evidence ledger.

P0 requirements:

- Status filters.
- Type filters.
- Search.
- Evidence rows with status, title, source, confidence, linked blocks, and last-used/verified state.
- Detail drawer.
- Action to open workbench with the related block or context.

Static badges like "引用候选 / 可用于综述 / 待核验格式" should be replaced by real fields.

### Writing Page

`/writing` remains an independent whole-text analysis entry.

P0 adds one critical bridge: analysis results can be pushed into the review queue as review items. Results should not remain isolated in the writing page.

### Courses Page

P0 removes the seed/demo leakage in blank workbench creation. The hardcoded title "大语言模型在教育领域的应用综述" must not be used as a blank default.

Button copy should be normalized to "打开工作台" or equivalent clear wording.

### Dashboard

P0 includes terminology cleanup and better task entry points. Trend charts, teacher analytics, and role-specific dashboards remain P1.

## Backend Design

### Review API

Add a small router, likely `backend/api/review_items.py`.

Proposed routes:

- `GET /api/review-items?documentId=...`
- `POST /api/review-items`
- `PATCH /api/review-items/{id}`
- `POST /api/review-items/{id}/accept`
- `POST /api/review-items/{id}/reject`
- `POST /api/review-items/{id}/defer`

The accept endpoint should update the review item status and record version associations. It does not need to perform complex document patching if the frontend still controls final document updates in P0, but the accepted state and version link must persist.

### Evidence API

Extend `backend/api/library.py`.

Proposed additions:

- `PATCH /api/library/evidence/{id}`

Patchable P0 fields:

- `status`
- `linkedBlockIds`
- `verifiedAt`
- `usedAt`

### Store Layer

Extend `backend/store/redis_store.py` with:

- `RedisReviewStore`
- Evidence update support in `RedisEvidenceStore`
- Version metadata support through the existing document store version payloads

Follow the current per-user Redis key pattern.

## Error Handling

Backend routes should keep using the existing `ok(...)` response envelope and existing error handler pattern.

Frontend API clients should surface backend error messages and show consistent empty, loading, and error states in the context drawer and evidence ledger.

SSE behavior should continue to parse non-2xx JSON envelope errors, as the current `frontend/src/api/sse.ts` already does.

## Testing

Backend tests should use the existing targeted `unittest` style.

Required backend coverage:

- Review item create/list/update.
- Review item accept/reject/defer.
- Evidence status patch.
- Version metadata associations.

Frontend tests should use Vitest and Testing Library.

Required frontend coverage:

- Context drawer tab switching.
- Review item list and state transitions.
- Accept/reject/defer UI behavior.
- Evidence ledger filters and status updates.
- Writing analysis result pushed to review queue.
- Courses blank workbench no longer uses seed title.

Primary acceptance flow:

1. Open course or workbench.
2. Select a document block.
3. Generate or create an AI suggestion.
4. See it as a pending review item.
5. Accept the item.
6. Persist the decision.
7. Update evidence status if the item includes evidence.
8. Create or associate a document version.
9. Restore or preview version from the Versions tab.

## Delivery Order

1. Remove archived `academic-workbench-fe/` prototype and keep production boundary docs clear.
2. Add backend review item persistence and API tests.
3. Extend evidence persistence and API tests.
4. Add frontend review/evidence types and API clients.
5. Refactor the workbench right side into `WorkspaceContextDrawer`.
6. Move AI suggestion review into the Review tab.
7. Rework `/library` into the evidence ledger.
8. Connect `/writing` results to review items.
9. Clean terminology, seed/demo text, and disabled/demo controls.
10. Run targeted backend tests and frontend build/test checks.

## Open Decisions

No blocking open decisions remain for P0 planning. Teacher approval, hard auth migration, multi-device conflict handling, graph layout persistence, and bundle optimization are explicitly deferred.
