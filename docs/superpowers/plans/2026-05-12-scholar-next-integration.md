# ScholarScript Next Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace remaining demo/local-only surfaces with production-backed APIs, then update repository documentation so future agents operate on the current frontend/backend architecture.

**Architecture:** Keep `frontend/` as the only production UI and `backend/` as the API boundary. Add thin FastAPI routers and Redis-backed stores first, then wire frontend API clients and Zustand stores to those APIs while retaining clear empty/error states instead of mock fallbacks.

**Tech Stack:** FastAPI, Redis, Python unittest, React, Vite, TypeScript, Vitest, Zustand, Docker Compose, ModelScope model artifacts.

---

## Scope And Execution Rules

- Production frontend remains `frontend/`; do not develop `academic-workbench-fe/`.
- Do not commit `.env`, `data/`, secrets, logs, `node_modules`, or `dist`.
- Use TDD for each API/client/store change.
- Prefer one commit per task group.
- Validate with `npm run test -- --run`, `npm run build`, targeted backend unittest files, and Docker Compose before pushing.
- Do not ordinary-force-push. Fetch and compare remote state before any push.

## Planned File Map

- `backend/api/documents.py`: document, version, and resource endpoints.
- `backend/api/courses.py`: course/research-space endpoints.
- `backend/api/search.py`: global/workspace search endpoint.
- `backend/api/notifications.py`: notification list/read endpoints.
- `backend/api/settings.py`: user workspace settings endpoints.
- `backend/store/redis_store.py`: Redis stores for documents, courses, notifications, settings.
- `backend/main.py`: router registration.
- `backend/tests/test_documents_api.py`: document/version persistence tests.
- `backend/tests/test_courses_api.py`: course API tests.
- `backend/tests/test_search_api.py`: search API tests.
- `backend/tests/test_notifications_settings_api.py`: notification/settings tests.
- `frontend/src/api/documents.ts`: document/version API client.
- `frontend/src/api/courses.ts`: course API client.
- `frontend/src/api/search.ts`: search API client.
- `frontend/src/api/notifications.ts`: notification API client.
- `frontend/src/api/settings.ts`: settings API client.
- `frontend/src/store/workspace.ts`: replace local-only persistence with API-backed persistence plus explicit offline fallback.
- `frontend/src/store/layout.ts`: keep workbench context but load API-backed course/document data.
- `frontend/src/pages/Courses.tsx`: replace static spaces with API data.
- `frontend/src/pages/Dashboard.tsx`: replace static metrics/tasks/recent documents with API-backed data.
- `frontend/src/pages/Discovery.tsx`: replace static graph page data with workspace or API graph data.
- `frontend/src/pages/Library.tsx`: replace static evidence fallback and wire filters.
- `frontend/src/components/workspace/GlobalTopBar.tsx`: enable global search, notifications, settings.
- `frontend/src/features/workspace/TopBar.tsx`: enable workspace search.
- `frontend/src/features/workspace/LeftSidebar.tsx`: enable conversation/resource search and settings entry.
- `frontend/src/features/document/DocumentEditor.tsx`: wire rewrite, expand, and logic-check toolbar actions.
- `frontend/src/features/ai/AIChatInput.tsx`: make web-search mode honest: disabled until backend exists, or wire to a real search endpoint in a separate task.
- `scripts/download_modelscope_embedding.py`: keep as ModelScope artifact downloader.
- `backend/main.py` and `backend/config.py`: align local RAG runtime with ModelScope-downloaded model paths.
- `README.md`, `AGENTS.md`, `CLAUDE.md`, `frontend/README.md`, `docs/audit/scholar-frontend-post-refactor-audit.md`: update architecture, API, development, testing, deployment, and known-gap docs.

---

## Phase 1: Document And Version Persistence

### Task 1: Backend Documents API

**Files:**
- Create: `backend/api/documents.py`
- Modify: `backend/store/redis_store.py`
- Modify: `backend/main.py`
- Test: `backend/tests/test_documents_api.py`

- [ ] Write failing tests for authenticated document create/read/update, version create/list/restore, and per-user isolation.
- [ ] Implement Redis-backed document and version store using namespaced keys by user id.
- [ ] Register router under `/api`.
- [ ] Run `python3 -B -m unittest backend.tests.test_documents_api`.
- [ ] Commit: `feat: add document persistence api`.

### Task 2: Frontend Workspace Persistence Client

**Files:**
- Create: `frontend/src/api/documents.ts`
- Modify: `frontend/src/store/workspace.ts`
- Test: `frontend/src/store/__tests__/workspace.test.ts`

- [ ] Write failing Vitest coverage for loading a backend document, saving edited blocks, creating versions, restoring versions, and API error states.
- [ ] Replace default production persistence path with `/api/documents` and `/api/documents/{id}/versions`.
- [ ] Keep localStorage only as explicit draft/offline fallback with visible save status.
- [ ] Run `npm run test -- --run src/store`.
- [ ] Commit: `feat: persist workspace documents`.

---

## Phase 2: Replace Static Product Pages

### Task 3: Courses API And Page Wiring

**Files:**
- Create: `backend/api/courses.py`
- Modify: `backend/store/redis_store.py`
- Modify: `backend/main.py`
- Create: `frontend/src/api/courses.ts`
- Modify: `frontend/src/pages/Courses.tsx`
- Test: `backend/tests/test_courses_api.py`
- Test: `frontend/src/pages/__tests__/Courses.test.tsx`

- [ ] Write backend tests for listing research spaces and opening a space into a workbench context.
- [ ] Add course/research-space store seeded from safe non-secret defaults.
- [ ] Write frontend tests for loading courses, empty state, error state, and `载入工作台剖析`.
- [ ] Remove hardcoded `spaces` from production render path.
- [ ] Run backend and frontend targeted tests.
- [ ] Commit: `feat: connect courses to backend`.

### Task 4: Dashboard API-Backed Metrics

**Files:**
- Extend: `backend/api/courses.py` or create `backend/api/dashboard.py`
- Create: `frontend/src/api/dashboard.ts`
- Modify: `frontend/src/pages/Dashboard.tsx`
- Test: `frontend/src/pages/__tests__/Dashboard.test.tsx`

- [ ] Define one compact dashboard payload for metrics, tasks, recent courses, and recent documents.
- [ ] Write tests covering loaded, empty, and error states.
- [ ] Remove hardcoded `taskItems`, `recentDocuments`, graph update count, and norm reminder count from production render path.
- [ ] Run targeted frontend tests.
- [ ] Commit: `feat: connect dashboard summary`.

### Task 5: Library And Evidence Management

**Files:**
- Extend: `backend/api/documents.py` or create `backend/api/library.py`
- Create: `frontend/src/api/library.ts`
- Modify: `frontend/src/pages/Library.tsx`
- Test: `backend/tests/test_library_api.py`
- Test: `frontend/src/pages/__tests__/Library.test.tsx`

- [ ] Add evidence list/filter endpoint backed by generated references and persisted workspace evidence.
- [ ] Wire Library filters to backend query params.
- [ ] Remove static `curatedEvidence` as a production fallback.
- [ ] Keep an empty state that explains evidence appears after writing analysis/SSE retrieval.
- [ ] Run targeted tests.
- [ ] Commit: `feat: connect evidence library`.

### Task 6: Discovery Graph Data

**Files:**
- Create: `backend/api/graph.py`
- Create: `frontend/src/api/graph.ts`
- Modify: `frontend/src/pages/Discovery.tsx`
- Test: `backend/tests/test_graph_api.py`
- Test: `frontend/src/pages/__tests__/Discovery.test.tsx`

- [ ] Add endpoint returning graph nodes/edges for the active workspace or current RAG graph.
- [ ] Replace static `initialNodes` and `initialEdges` with API data.
- [ ] Keep ReactFlow local node movement state client-side only.
- [ ] Run targeted tests.
- [ ] Commit: `feat: connect discovery graph`.

---

## Phase 3: Enable Disabled Shell Tools

### Task 7: Search

**Files:**
- Create: `backend/api/search.py`
- Create: `frontend/src/api/search.ts`
- Modify: `frontend/src/components/workspace/GlobalTopBar.tsx`
- Modify: `frontend/src/features/workspace/TopBar.tsx`
- Modify: `frontend/src/features/workspace/LeftSidebar.tsx`
- Test: `backend/tests/test_search_api.py`
- Test: frontend component tests for search controls

- [ ] Implement `/api/search?q=&scope=` over user documents, sessions, references, and courses.
- [ ] Enable global search and workspace search with debounce and visible loading/error/empty states.
- [ ] Enable conversation search in the left sidebar.
- [ ] Run targeted backend and frontend tests.
- [ ] Commit: `feat: enable workspace search`.

### Task 8: Notifications And Settings

**Files:**
- Create: `backend/api/notifications.py`
- Create: `backend/api/settings.py`
- Create: `frontend/src/api/notifications.ts`
- Create: `frontend/src/api/settings.ts`
- Modify: `frontend/src/components/workspace/GlobalTopBar.tsx`
- Modify: `frontend/src/features/workspace/LeftSidebar.tsx`
- Test: `backend/tests/test_notifications_settings_api.py`
- Test: frontend component tests for notification/settings flows

- [ ] Add notification list/read endpoints.
- [ ] Add user settings get/update endpoints for workspace preferences.
- [ ] Replace disabled notification/settings controls with popover or modal flows.
- [ ] Run targeted tests.
- [ ] Commit: `feat: enable notifications and settings`.

---

## Phase 4: Document AI Tools

### Task 9: Rewrite, Expand, Logic Check

**Files:**
- Modify: `frontend/src/features/document/DocumentEditor.tsx`
- Modify: `frontend/src/features/ai/AIChatInput.tsx`
- Modify: `frontend/src/store/workspace.ts`
- Test: `frontend/src/pages/WorkspacePage/__tests__/WorkspacePage.test.tsx`

- [ ] Convert toolbar disabled actions into real commands using the existing `/api/chat` SSE path.
- [ ] Use distinct prompt templates for rewrite, expand, logic check, and citation enhancement.
- [ ] Preserve suggestion review/accept/reject behavior.
- [ ] Run workspace page tests.
- [ ] Commit: `feat: enable document ai tools`.

### Task 10: Web Search Mode Decision

**Files:**
- Modify: `frontend/src/features/ai/AIChatInput.tsx`
- Optional create: `backend/api/web_search.py`
- Optional create: `frontend/src/api/webSearch.ts`
- Test: frontend AI chat input tests

- [ ] Choose one production-safe option before implementation: keep web search disabled with honest UI, or add a real backend web-search provider.
- [ ] If no provider is configured, disable the mode and show an explicit tooltip.
- [ ] If a provider is configured, add backend endpoint, source attribution, timeout handling, and tests.
- [ ] Commit: `fix: clarify web search availability` or `feat: add web search provider`.

---

## Phase 5: ModelScope Runtime Alignment

### Task 11: ModelScope Local Embedding Runtime

**Files:**
- Modify: `backend/config.py`
- Modify: `backend/main.py`
- Modify: `scripts/download_modelscope_embedding.py`
- Modify: `docker-compose.yml`
- Test: `backend/tests/test_config.py`
- Test: retriever startup smoke test

- [ ] Add config for a local ModelScope-downloaded embedding path.
- [ ] Prefer local path when present; do not trigger Hugging Face downloads in production startup.
- [ ] Keep DashScope norm retriever embedding path separate unless explicitly changed.
- [ ] Document how to refresh the ModelScope model artifact.
- [ ] Run targeted config tests and backend startup smoke test.
- [ ] Commit: `chore: align embedding runtime with modelscope`.

---

## Phase 6: Repository Documentation

### Task 12: Refresh Repo Guidance

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `frontend/README.md`
- Modify: `docs/audit/scholar-frontend-post-refactor-audit.md`
- Create: `docs/architecture/current-production-architecture.md`
- Create: `docs/roadmap/remaining-integrations.md`

- [ ] Update production architecture: `frontend/` only, `academic-workbench-fe/` archived.
- [ ] Document current API surface and new endpoints added in prior phases.
- [ ] Document local dev, Docker Compose, proxy rules for `/api` and `/v1`, and ModelScope artifact workflow.
- [ ] Add a remaining-integrations matrix with status: connected, API-backed, local fallback, disabled, intentionally deferred.
- [ ] Update audit report from historical `PASS WITH ISSUES / NO` to current state with exact known residual risks.
- [ ] Run docs link/path scan with `rg "academic-workbench-fe|workspaceMock|未接入|ModelScope|/v1|/api/documents" README.md AGENTS.md CLAUDE.md frontend/README.md docs`.
- [ ] Commit: `docs: refresh production architecture guidance`.

---

## Final Verification And Push Gate

- [ ] Run frontend tests: `cd frontend && npm run test -- --run`.
- [ ] Run frontend build: `cd frontend && npm run build`.
- [ ] Run targeted backend tests for all new routers.
- [ ] Run backend full test suite or document any environment-only blocker.
- [ ] Run Docker builds: `docker compose build frontend backend`.
- [ ] Start services: `docker compose up -d backend frontend redis`.
- [ ] Verify `/api/healthz`, `/api/config/status`, `/api/chat mode=norms`, `/v1/writing/analyze`, document persistence, course-to-workbench, search, library, graph.
- [ ] Check secrets/artifacts: `git status --short`, `git ls-files | grep -E '(^|/)(\\.env|secret|data|node_modules|dist|\\.pem|\\.key|\\.log)$' || true`.
- [ ] Fetch and compare remote main/production before push.
- [ ] Push only if remote comparison is safe; use normal push when possible, `--force-with-lease` only if explicitly justified.

## Recommended Execution Order

1. Phase 1 document/version persistence.
2. Phase 2 static page replacement.
3. Phase 3 disabled shell tools.
4. Phase 4 document AI tools and web-search decision.
5. Phase 5 ModelScope runtime alignment.
6. Phase 6 documentation refresh.
7. Final verification and push gate.
