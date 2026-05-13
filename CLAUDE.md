# CLAUDE.md

Guidance for Claude Code and other coding agents working in this repository.

## Project Boundaries

ScholarScript is deployed from two components:

- `backend/`: FastAPI, Redis-backed persistence, SSE chat/writing APIs, optional local GraphRAG.
- `frontend/`: the only production React/Vite frontend.

`academic-workbench-fe/` is an archived prototype. Do not implement features there unless the user explicitly asks for prototype archaeology.

## Backend

Start locally:

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env
uvicorn main:app --reload --port 8000
```

Required for normal startup:

| Variable | Purpose |
| --- | --- |
| `DASHSCOPE_API_KEY` | DashScope/OpenAI-compatible LLM access |
| `SECRET_KEY` or `JWT_SECRET` | JWT signing secret |
| `REDIS_URL` | Redis connection, default `redis://localhost:6379/0` |

Optional local GraphRAG:

- `ENABLE_LOCAL_RAG=1` enables local GraphRAG only when a local embedding model directory exists.
- `MODELSCOPE_EMBED_MODEL_PATH` should point to the path printed by `python scripts/download_modelscope_embedding.py`.
- `EMBED_MODEL` may also be a local path, but remote identifiers are not loaded at startup.
- DashScope norm retrieval is separate from local GraphRAG and uses `backend/rag/embed_adapter.py`.

Important backend modules:

```text
main.py                  FastAPI app and lifespan wiring
api/chat.py              POST /api/chat SSE stream
api/documents.py         /api/documents and version endpoints
api/courses.py           research-space/course data
api/dashboard.py         dashboard summary
api/library.py           evidence library
api/graph.py             discovery graph
api/search.py            global/workspace/conversation search
api/notifications.py     notification list/read endpoints
api/settings.py          user workspace settings
api/writing.py           /v1/writing/analyze
store/redis_store.py     Redis stores for users, sessions, documents, courses, evidence, notifications, settings
rag/graph.py             KnowledgeGraph and demo graph builder
rag/retriever.py         local GraphRAG retriever
rag/norm_retriever.py    writing-norm retriever
```

Prefer targeted `unittest` commands for backend changes. Existing tests often call handlers directly instead of `TestClient`.

## Frontend

Start locally:

```bash
cd frontend
npm install
npm run dev
```

Verification:

```bash
npm run test -- --run
npm run build
```

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

## Current Known Residual Risks

- `workspaceMock` still seeds initial local workspace document/graph/reference state when no backend document is loaded.
- Full backend discovery can be environment-sensitive around optional transformer/sentence-transformer dependencies; targeted backend tests are the reliable gate for integration tasks.
- Auth token storage remains localStorage-based and is not production-hardened.
- Bundle splitting has not yet been optimized.
