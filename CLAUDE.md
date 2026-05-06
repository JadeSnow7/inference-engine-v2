# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Standalone demo of an AI academic writing assistant ("学术工作台"). Students submit writing tasks; the backend routes them through domain-specific pipelines (proposal / review / paragraph / format), retrieves literature and research gaps via GraphRAG, streams results to the frontend over SSE.

Two deployable components: `backend/` (Python FastAPI) and `frontend/` (React + Vite). `academic-workbench-fe/` is an archived prototype — do not develop in it.

---

## Backend (`backend/`)

### Start

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Requires a running Redis instance. Copy `.env.example` to `.env` and fill in keys.

### Required env vars

| Variable | Purpose |
|----------|---------|
| `DASHSCOPE_API_KEY` | Alibaba Cloud LLM API key (Qwen models) |
| `SECRET_KEY` or `JWT_SECRET` | JWT signing secret (either name works) |
| `REDIS_URL` | Default `redis://localhost:6379/0` |

### Run tests

```bash
cd backend
pytest                          # all tests
pytest tests/test_loop.py -v    # single file
pytest -k test_route_scene -v   # single test
```

### Architecture

```
main.py                   FastAPI app, lifespan wires all singletons into app.state
api/
  chat.py                 POST /api/chat  →  StreamingResponse(main_loop(...))
  users.py                Auth endpoints, profile init/get/update, session CRUD
  auth.py                 JWT dependency (get_current_user_id)
core/
  router.py               LLM-based scene classifier → proposal|review|paragraph|format
  loop.py                 main_loop(): orchestrates router → pipeline → SSE stream
  events.py               SSEEvent dataclass + fmt() serializer
  stream.py               call_model_once() / stream_model() wrappers (DashScope/OpenAI-compat)
pipelines/
  proposal.py             开题报告: intent parse → RAG retrieve → gap analysis → outline → review/revise
  review.py               文献综述
  paragraph.py            段落写作
  format_.py              引用格式化 / 摘要翻译
rag/
  graph.py                KnowledgeGraph (NetworkX), build_demo_graph(), load/save gpickle
  retriever.py            GraphRAGRetriever: retrieve_literature() / discover_research_gaps()
  nodes.py                NodeType enum (CONCEPT / PAPER / METHOD / GAP)
store/
  redis_store.py          RedisConversationStore, RedisProfileStore, UserStore
conversation/
  manager.py              ConversationManager: load()/save() with token budget trimming
profile/
  inject.py               inject_user_profile() — prepends teaching style hint to system prompt
  models.py               from_survey() — maps onboarding answers to profile dict
```

**Data flow for a chat request:**
1. `POST /api/chat` authenticates, calls `main_loop()`
2. `main_loop` yields `stage:"路由中"`, loads history + profile in parallel, routes to a pipeline
3. Pipeline yields SSE events: `stage` → `papers` → `gaps` → `token` (many) → `done`
4. `main_loop` accumulates tokens, saves to Redis on `done` or `CancelledError`

**Knowledge graph** persists at `data/knowledge_graph.gpickle`. If missing or empty, `build_demo_graph()` seeds a demo graph. Embeddings use `BAAI/bge-small-zh-v1.5` via `sentence-transformers`.

---

## Frontend (`frontend/`)

### Start

```bash
cd frontend
npm install
npm run dev       # http://localhost:5173, proxies /api → localhost:8000
```

### Build & lint

```bash
npm run build     # tsc -b + vite build (strict, no errors tolerated)
npm run lint
```

### Run tests

```bash
npm run test                        # vitest (watch mode)
npm run test -- --run               # single pass
npm run test -- --run src/store     # single directory
```

### Architecture

```
src/
  main.tsx              Mounts App inside ErrorBoundary; window.onerror fallback
  App.tsx               BrowserRouter: /login → LoginPage; / → WorkbenchLayout (ProtectedRoute)
  components/
    layout/
      WorkbenchLayout.tsx  Three-column shell (nav | main | right panel). Right panel has
                           "证据" and "历史" tabs. History calls GET /api/sessions.
      ProtectedRoute.tsx   Redirects to /login if no token in useUserStore
    ErrorBoundary.tsx
  pages/
    LoginPage.tsx         POST /api/auth/login, stores token in useUserStore
    Dashboard.tsx         Landing grid, links to other pages
    Courses.tsx           Sets workbenchContext in useLayoutStore, navigates to /workbench
    Workbench.tsx         Main AI workspace: connectSSE() → renders papers/gaps cards +
                          Markdown output (react-markdown + remark-gfm)
    Discovery.tsx         @xyflow/react knowledge graph visualization
    ChatPage.tsx          Legacy chat UI (route: /chat), uses useSSE hook
  api/
    client.ts             apiFetch<T>() — reads token from useUserStore.getState(), parses
                          {ok, data/error} envelope, throws ApiError(code, message, status)
    sse.ts                connectSSE(message, handlers, sessionId?) — fetch-based SSE,
                          TextDecoder stream: true for multi-byte safety
    sessions.ts           fetchSessions() / deleteSession()
  store/
    user.ts               useUserStore — token, userId, profile; persisted to localStorage
    chat.ts               useChatStore — messages[], streaming state (used by ChatPage)
    pipeline.ts           usePipelineStore — current stage string
    sidebar.ts            useSidebarStore — papers[], gaps[] (used by ChatPage sidebar)
    layout.ts             useLayoutStore — isMobile, workbenchContext, isRightPanelOpen
  hooks/
    useSSE.ts             Wraps connectSSE, wires to useChatStore/usePipelineStore/useSidebarStore
  types/
    events.ts             SSEEvent, PaperItem, GapItem, Message — single source of truth
```

### TypeScript strict flags (tsconfig.app.json)

Two flags cause non-obvious compile failures:

- **`verbatimModuleSyntax`** — types must use `import type { Foo }`, not `import { Foo }` when `Foo` is only used as a type. Applies to `@xyflow/react` and similar packages that export both values and types.
- **`erasableSyntaxOnly`** — forbids TypeScript-only syntax that emits JavaScript (e.g., constructor parameter shorthand `public foo: T`). Use explicit property declarations instead.

### Tailwind tokens (v3)

All `scholar-*` color tokens are defined in `tailwind.config.js` under `theme.extend.colors.scholar`. Do **not** use Tailwind v4 `@theme {}` syntax — the project uses Tailwind v3.

| Token | Value | Usage |
|-------|-------|-------|
| `scholar-primary` | `#3370ff` | 主操作色 |
| `scholar-academic` | `#164082` | 学术模式高亮 |
| `scholar-discovery` | `#7b2cbf` | 知识图谱 |
| `scholar-bg-canvas` | `#f5f6f7` | 页面底板 |
| `scholar-border` | `#dee0e3` | 边框 |

### SSE event protocol

Both backend and frontend share this schema (see `types/events.ts` and `core/events.py`):

```
stage  → pipeline progress string (update UI indicator)
papers → PaperItem[] (max 5, show retrieval card)
gaps   → GapItem[] (max 3, severity: high|medium|low)
token  → content string (accumulate into Markdown output)
done   → stream complete
error  → content is user-readable Chinese; append as "> ⚠ {content}", no done follows
```

### Zustand convention

Always use selector form — never destructure the whole store:
```ts
const token = useUserStore(state => state.token)   // ✓
const { token } = useUserStore()                   // ✗ (deprecated v4 pattern)
```

For outside-React access (in api/, hooks/): `useUserStore.getState().token`
