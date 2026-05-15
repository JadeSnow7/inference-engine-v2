# Inference Engine V2

ScholarScript production integration repo. The deployable application is a FastAPI backend plus the React/Vite frontend in `frontend/`.

`academic-workbench-fe/` is an archived prototype. Do not use it for production development, deployment checks, or acceptance testing.

## Local Development

```bash
redis-server

cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env
uvicorn main:app --reload --port 8000

cd ../frontend
npm install
npm run dev
```

Default local services:

- Redis: `redis://localhost:6379/0`
- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`
- Vite proxies both `/api` and `/v1` to the backend.

## Docker Compose

```bash
cp .env.example .env
docker compose up -d redis backend frontend
```

The frontend is exposed at `http://127.0.0.1:8080`. Compose mounts `./data` into the backend as `/app/data`.

## API Surface

Current production frontend calls these backend surfaces:

- `/api/chat`: SSE writing/chat stream.
- `/api/documents` and `/api/documents/{id}/versions`: workspace document and version persistence.
- `/api/courses`, `/api/dashboard`, `/api/library`, `/api/graph`: product pages and evidence/graph data.
- `/api/search`: global, workspace, conversation, reference, and course search.
- `/api/notifications`, `/api/settings`: shell notifications and workspace preferences.
- `/api/auth`, `/api/users`, `/api/sessions`: auth, profile, and session history.
- `/api/healthz`, `/api/config/status`: health and runtime configuration status.
- `/v1/writing/analyze`: writing norm/citation analysis.

## ModelScope Embedding Artifact

Local GraphRAG is off by default. To enable it without Hugging Face runtime downloads:

```bash
python scripts/download_modelscope_embedding.py
export MODELSCOPE_EMBED_MODEL_PATH=<printed local path>
export ENABLE_LOCAL_RAG=1
```

`MODELSCOPE_EMBED_MODEL_PATH` or `EMBED_MODEL` must point to an existing local directory. If no local path exists, the backend leaves local GraphRAG disabled instead of downloading a remote model during startup. DashScope norm retrieval is separate and still uses DashScope embeddings when configured.

## Verification

Frontend:

```bash
make test-frontend

# Full local frontend checks still require a compatible host Node/npm:
cd frontend && npm run lint && npm run build
```

`make test-frontend` runs the editing workflow Vitest coverage in the Node 20
Docker image `inference-engine-frontend-build:verify` and does not use host
`frontend/node_modules`.

Backend targeted checks used by recent integration work:

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
