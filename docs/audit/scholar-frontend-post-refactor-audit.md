# ScholarScript Frontend Integration Audit

## 1. Audit Scope

- Branch: `codex/scholar-next-integration`
- Date: 2026-05-13
- Production frontend: `frontend/`
- Backend: `backend/`
- Archived prototype: `academic-workbench-fe/`

This report supersedes the 2026-05-12 post-refactor audit. It reflects the API integration work completed for document persistence, product pages, search, notifications/settings, document AI tools, web-search availability, and ModelScope runtime alignment.

## 2. Summary

- Overall result: PASS WITH KNOWN RESIDUAL RISKS
- Production frontend entry: YES, `frontend/`
- Archived prototype status: `academic-workbench-fe/` remains out of production scope.
- Highest remaining product risk: the default workspace still seeds initial document/graph/reference state from `workspaceMock` until a backend bootstrap/default-document endpoint replaces it.

## 3. Connected Surfaces

| Surface | Result | Evidence |
| --- | --- | --- |
| Workspace documents and versions | PASS | `/api/documents` backend and `frontend/src/api/documents.ts`; workspace store saves, versions, restore, and local fallback. |
| Courses | PASS | `/api/courses` and `Courses.tsx` API loading/empty/error states. |
| Dashboard | PASS | `/api/dashboard` and `Dashboard.tsx` summary loading/empty/error states. |
| Library | PASS | `/api/library` and evidence filters. |
| Discovery graph | PASS | `/api/graph` and ReactFlow local movement state. |
| Search | PASS | `/api/search` plus global/workspace/conversation search controls. |
| Notifications/settings | PASS | `/api/notifications`, `/api/settings`, popover/dialog UI. |
| Document AI tools | PASS | rewrite, expand, logic check, and citation enhancement route through `/api/chat` SSE and create reviewable suggestions. |
| Web search quick mode | PASS AS DISABLED | Disabled with explicit unavailable title until a real backend provider exists. |
| ModelScope local embedding | PASS | local GraphRAG only loads existing local paths from `MODELSCOPE_EMBED_MODEL_PATH`/`EMBED_MODEL`; no startup remote download path. |

## 4. Current Verification Evidence

Recent targeted verification from this branch:

- `WorkspacePage.test.tsx`: 28 tests passed after web-search clarification.
- Workspace shell related tests: 31 tests passed across `WorkspacePage.test.tsx` and `WorkspaceShell.test.tsx`.
- TypeScript: `tsc -b --pretty false` exited 0 for Task 9 and Task 10 changes.
- Backend ModelScope/config smoke: `backend.tests.test_config`, `backend.tests.test_retriever`, `backend.tests.test_main_norm_retriever`: 9 tests passed.
- Python compile: `backend/config.py`, `backend/main.py`, `backend/rag/graph.py`, `backend/rag/retriever.py`, and `scripts/download_modelscope_embedding.py` compiled successfully.

Full frontend and Docker verification remain part of the final push gate.

## 5. Fake Feature Audit

Resolved since the prior audit:

- Global/workspace/conversation search is now connected.
- Notifications and settings are connected.
- Document rewrite, expand, and logic-check toolbar actions are connected.
- Web search no longer presents itself as available; it is explicitly disabled.

Remaining local/demo data:

- `workspaceMock` seeds the initial workspace document, graph, versions, and references before backend document load.
- Course/library/dashboard/graph/search/notifications/settings production paths now call backend APIs rather than static page arrays.

## 6. Model And Retrieval Boundary

Local GraphRAG and DashScope norm retrieval are separate:

- Local GraphRAG uses `MODELSCOPE_EMBED_MODEL_PATH` or an existing local `EMBED_MODEL` path.
- Missing local model path disables local GraphRAG instead of triggering Hugging Face downloads.
- Norm retrieval uses DashScope embeddings through `DashScopeEmbedder` when available and falls back to local Jaccard retrieval.

## 7. Residual Risks

| ID | Severity | Area | Problem | Suggested Fix |
| --- | --- | --- | --- | --- |
| A-001 | P1 | Initial workspace seed | `workspaceMock` remains the default initial document/graph/reference source. | Add backend bootstrap/default-document endpoint and remove production mock seeding. |
| A-002 | P1 | Web search | No real provider exists yet. | Add backend provider, source attribution, timeout handling, product policy, and tests before enabling UI. |
| A-003 | P2 | Auth hardening | Token remains stored in localStorage. | Move to httpOnly cookie/session flow for production hardening. |
| A-004 | P2 | Bundle size | Route-level chunk splitting has not been optimized. | Add lazy routes or manual chunking. |
| A-005 | P2 | Full-suite environment | Full backend discovery can still be sensitive to optional transformer/sentence-transformer versions. | Keep targeted tests as integration gate and pin optional dependencies before release. |

## 8. Recommendation

The application is materially beyond the prior “PASS WITH ISSUES / NO” state: the major disabled/demo production surfaces in the approved integration plan are now API-backed or honestly disabled. Continue to final verification and push gate before merging, with A-001 and A-002 as the main remaining product decisions.
