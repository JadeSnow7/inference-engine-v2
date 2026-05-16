# Current Production Architecture

Date: 2026-05-13

## Deployment Boundary

Production consists of `backend/` and `frontend/`. The archived `academic-workbench-fe/` prototype has been removed from this repository; historical references should not be used for production development, deployment checks, or acceptance testing.

- `backend/` exposes FastAPI routes, Redis-backed stores, SSE generation, writing analysis, and optional local GraphRAG.
- `frontend/` is the only production React/Vite UI.

## Backend Runtime

`backend/main.py` wires application state during FastAPI lifespan:

- Redis client
- conversation, profile, user, document, course, evidence, notification, and settings stores
- RAG retriever, either disabled, DashScope knowledge-base backed, or local GraphRAG
- writing norm retriever for `/v1/writing/analyze` and `mode=norms`

Local GraphRAG only loads an embedding model from an existing local path. Set `MODELSCOPE_EMBED_MODEL_PATH` to the path printed by `scripts/download_modelscope_embedding.py`. If no local model path exists, startup keeps local GraphRAG disabled rather than downloading from Hugging Face.

## API Surface

| Surface | Purpose |
| --- | --- |
| `/api/chat` | SSE writing/chat stream and document tool generation |
| `/api/documents` | workspace document persistence |
| `/api/documents/{id}/versions` | document version create/list/restore |
| `/api/review-items` | persisted review queue for AI suggestions and writing-analysis findings |
| `/api/courses` | research-space/course listing and workbench context |
| `/api/dashboard` | dashboard metrics, tasks, recent courses, recent documents |
| `/api/library` | evidence list and filters |
| `/api/graph` | discovery graph nodes and edges |
| `/api/search` | global, workspace, conversation, reference, and course search |
| `/api/notifications` | notification list and read state |
| `/api/settings` | workspace/user preferences |
| `/api/auth`, `/api/users`, `/api/sessions` | auth, profile, and history |
| `/api/healthz`, `/api/config/status` | health and runtime configuration |
| `/v1/writing/analyze` | writing norm/citation analysis |

## Frontend Runtime

The Vite frontend proxies `/api` and `/v1` to the backend in development. The workspace page uses `/api/chat` SSE for manual chat, citation enhancement, rewrite, expand, and logic-check document tools. Generated document changes are not applied directly; they become reviewable suggestions that users can accept or reject.

Product pages are API-backed:

- Dashboard: `/api/dashboard`
- Courses: `/api/courses`
- Library: `/api/library`
- Discovery: `/api/graph`
- Search controls: `/api/search`
- Notifications/settings: `/api/notifications`, `/api/settings`

## Persistence

Redis is the backend persistence boundary for sessions, users, documents, versions, review items, courses, evidence, notifications, and settings. The frontend still keeps an explicit local draft fallback when document saves fail.

`workspaceMock` remains as an initial local seed/test fixture for the default workspace state. New production features should not add more mock fallbacks.

## Known Deferred Work

- Replace the initial `workspaceMock` seed with a backend bootstrap/default document endpoint.
- Add a real web-search provider before enabling the web-search quick mode.
- Harden auth token storage beyond localStorage.
- Optimize frontend bundle splitting.
