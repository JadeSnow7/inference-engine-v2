# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Boundaries

Production consists of `backend/` and `frontend/`. The archived `academic-workbench-fe/` prototype has been removed from this repository; historical references should not be used for production development, deployment checks, or acceptance testing.

- `backend/`: FastAPI, Redis-backed persistence, SSE chat/writing APIs, optional local GraphRAG.
- `frontend/`: the only production React/Vite frontend.

`AGENTS.md` currently mirrors this file for Codex. Keep both in sync when you change one.

## Backend

Start locally:

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env
uvicorn main:app --reload --port 8000
```

Or with the full stack via Docker Compose (from repo root, using `.env`):

```bash
docker compose up -d redis backend frontend
```

### Environment

| Variable | Purpose |
| --- | --- |
| `DEFAULT_PROVIDER` / `DEFAULT_MODEL` | Primary chat/writing provider (default: `deepseek` / `deepseek-v4`) |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` | DeepSeek credentials for the default provider |
| `SPECIAL_PROVIDER` / `SPECIAL_MODEL` | Hard-reasoning / final-polish provider (default: `openai` / `gpt-5.5`) |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` | OpenAI credentials for the special provider |
| `DASHSCOPE_API_KEY` / `DASHSCOPE_BASE_URL` | DashScope/OpenAI-compatible fallback LLM access |
| `AI_PROVIDER_PREFERENCE` | `bailian_first` routes through Bailian app when configured, else standard LLM |
| `ENABLE_BAILIAN_APP` / `DASHSCOPE_APP_ID` | Required together to enable Bailian app routing |
| `RAG_PROVIDER` | `disabled` (default) or `dashscope` — separate from local GraphRAG |
| `DASHSCOPE_KNOWLEDGE_BASE_ID` / `DASHSCOPE_RAG_MODEL` | Used when `RAG_PROVIDER=dashscope` |
| `SECRET_KEY` or `JWT_SECRET` | JWT signing secret (one is required) |
| `REDIS_URL` | Redis connection, default `redis://localhost:6379/0` |
| `CORS_ORIGINS` | Comma-separated allowed origins |

Optional local GraphRAG:

- `ENABLE_LOCAL_RAG=1` enables local GraphRAG only when a local embedding model directory exists.
- `MODELSCOPE_EMBED_MODEL_PATH` should point to the path printed by `python scripts/download_modelscope_embedding.py`.
- `EMBED_MODEL` may also be a local path, but remote identifiers are not loaded at startup.
- DashScope norm retrieval is separate from local GraphRAG and uses `backend/rag/embed_adapter.py`.

### Backend layout

Inference / streaming core:

```text
core/stream.py           DashScope/OpenAI-compatible model wrappers + <think>-tag sanitizer
core/loop.py             Main streaming inference loop
core/bailian_first.py    "Bailian first" router that falls back to main_loop
core/bailian_app.py      DashScope Bailian app SSE bridge
core/router.py           Scene router (proposal | review | paragraph | format)
core/events.py           SSE event envelope
core/thinking.py         Reasoning-trace handling
core/desensitize.py      PII scrubbing
core/norms.py            Writing-norm retrieval glue
```

Pipelines, per task scene:

```text
pipelines/proposal.py    Research proposals / 开题报告
pipelines/review.py      Literature review
pipelines/paragraph.py   Paragraph writing & polishing
pipelines/format_.py     Citation/format/summary tasks
pipelines/guided.py      Guided learning mode
```

API, conversation, profile, RAG, store:

```text
main.py                  FastAPI app and lifespan wiring
api/chat.py              POST /api/chat SSE stream
api/writing.py           /v1/writing/analyze
api/documents.py         /api/documents and version endpoints
api/review_items.py      /api/review-items persisted review queue
api/courses.py           research-space/course data
api/dashboard.py         dashboard summary
api/library.py           evidence library
api/graph.py             discovery graph
api/search.py            global/workspace/conversation search
api/notifications.py     notification list/read endpoints
api/settings.py          user workspace settings
api/auth.py              auth endpoints
api/users.py             user profile / session history
api/health.py            /api/healthz, /api/config/status
conversation/manager.py  Per-user session/history with token budget
profile/models.py        Learning-profile data shapes
profile/inject.py        Profile injection into prompts
profile/weak_points.py   Weak-point detection from session history
prompts/system.py        System prompts
prompts/review.py        Review-stage prompts
rag/graph.py             KnowledgeGraph and demo graph builder
rag/retriever.py         Local GraphRAG retriever
rag/norm_retriever.py    Writing-norm retriever
rag/dashscope_provider.py  DashScope knowledge-base RAG retriever
rag/embed_adapter.py     DashScope embedding adapter
store/redis_store.py     Redis stores for users, sessions, documents, review items, courses, evidence, notifications, settings
```

### Backend tests

Existing tests usually call handlers directly instead of using `TestClient`. Prefer targeted `unittest` runs:

```bash
# Run one module
PYTHONPATH=backend python3 -m unittest backend.tests.test_chat_api -v

# Run one test case
PYTHONPATH=backend python3 -m unittest backend.tests.test_paragraph_pipeline.ParagraphPipelineTests.test_xxx
```

Integration regression set used by recent integration work:

```bash
PYTHONPATH=backend python3 -B -m unittest \
  backend.tests.test_documents_api \
  backend.tests.test_courses_api \
  backend.tests.test_dashboard_api \
  backend.tests.test_library_api \
  backend.tests.test_graph_api \
  backend.tests.test_search_api \
  backend.tests.test_notifications_settings_api \
  backend.tests.test_config
```

Use the project backend virtualenv when available, for example `/root/.venvs/inference-engine-backend/bin/python`.

## Frontend

Start locally:

```bash
cd frontend
npm install
npm run dev
```

Verification:

```bash
# From the repository root:
make test-frontend

# Host Node/npm checks require Node 20 or newer:
cd frontend
npm run lint
npm run build
```

`make test-frontend` uses the Node 20 Docker image
`inference-engine-frontend-build:verify` for the editing workflow Vitest files
and does not depend on host `frontend/node_modules`.

Production frontend architecture:

```text
src/App.tsx                         route shell
src/pages/Dashboard.tsx             API-backed dashboard
src/pages/Courses.tsx               API-backed research spaces
src/pages/Library.tsx               API-backed evidence library
src/pages/Discovery.tsx             API-backed graph view
src/pages/WorkspacePage/            main academic writing workspace
src/components/workspace/           global shell, search, notifications, settings
src/features/document/              editor, toolbar, citation highlighting
src/features/ai/AIChatInput.tsx     SSE entrypoint and document AI tools
src/store/workspace.ts              document/version/suggestion state
src/store/layout.ts                 workbench context
src/api/                            typed API clients
```

Frontend conventions:

- Use selector form for Zustand: `useStore(state => state.value)`.
- Use `import type` for type-only imports because `verbatimModuleSyntax` is enabled.
- Keep `/api` and `/v1` backend paths behind the Vite proxy.
- Keep web search disabled unless a real backend provider with attribution and timeout handling is added.

## Scripts

Most of `scripts/` is research/evaluation harness (`run_rq2_*.py`, `summarize_rq2_results.py`, `build_rq2_theta_sweep.py`, `audit_screenshots.mjs`) and is not part of normal development.

The one script you typically need for local setup is:

```bash
python scripts/download_modelscope_embedding.py
```

which populates `data/modelscope/...` for optional local GraphRAG.

## Current Known Residual Risks

- `workspaceMock` still seeds initial local workspace document/graph/reference state when no backend document is loaded.
- Full backend discovery can be environment-sensitive around optional transformer/sentence-transformer dependencies; targeted backend tests are the reliable gate for integration tasks.
- Auth token storage remains localStorage-based and is not production-hardened.
- Bundle splitting has not yet been optimized.
