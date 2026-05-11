# Norm Engineering Integration Design

## Goal

Implement the remaining engineering integration for the thesis Chapter 4 boundary: semantic norm-node retrieval, norm-context injection for `/api/chat` with `mode=norms`, and a registered `/v1/writing/analyze` endpoint.

The implementation must preserve the current production path: online norm feedback still flows through the Bailian application. The local norm retriever only supplies relevant norm-node context, graph expansion, and reference validation.

## Current System Facts

- `/api/chat` routes `mode=norms` through `api/chat.py -> core.norms.norms_loop() -> stream_bailian_app()`.
- `mode=norms` does not use `core.loop.main_loop()`.
- The current norm corpus contains 107 nodes in `data/rq2_traceability/norm_nodes.json`.
- `/v1/writing/analyze` is not registered.
- `backend/main.py` may initialize `GraphRAGRetriever` for a demo academic literature graph when `ENABLE_LOCAL_RAG` is enabled; that graph is not the writing-norm corpus.
- Secrets must only be read from process environment variables. No implementation or test may print API keys.

## Architecture

The integration adds a local `NormNodeRetriever` dedicated to the 107-node writing-norm corpus. It loads `norm_nodes_with_embeddings.json` when available. If embeddings or a query embedder are unavailable, it falls back to local Jaccard scoring so the backend can still boot and tests can run without external API access.

DashScope embedding is isolated behind `DashScopeEmbedder`, a small adapter exposing `.embed(text) -> list[float]`. A reproducible script builds the node embedding cache with `text-embedding-v3`; this script is run manually or during deployment, not during unit tests.

The FastAPI lifespan initializes `app.state.norm_retriever` independently from `app.state.rag`. The existing Bailian norms generation path is preserved. `api/chat.py` passes `app.state.norm_retriever` into `norms_loop()`, and `norms_loop()` injects formatted norm-node context into the prompt sent to `stream_bailian_app()`.

`/v1/writing/analyze` exposes retrieval, graph expansion, formatted context, and optional reference validation. Public API responses must not include the raw `embedding` field or any NumPy arrays.

## Components

### `backend/rag/norm_retriever.py`

Responsibilities:

- Load norm nodes from `data/rq2_traceability/norm_nodes_with_embeddings.json` by default.
- Store embeddings internally as NumPy arrays when present.
- Provide `retrieve(query, top_k=5, theta=0.0) -> list[dict]`.
- Provide `expand(node_ids, hops=1) -> list[dict]`.
- Provide `validate_ref(node_id, query, theta=0.6) -> tuple[bool, float]`.
- Provide `format_context(nodes) -> str` for prompt/API context.
- Strip internal `embedding` data from all returned public nodes.

Fallback behavior:

- If the embedding cache file is missing, load zero nodes and allow startup.
- If an embedder is not configured, use Jaccard scoring over node text.
- If the embedder raises during retrieval, fail that call with a sanitized error only if the caller cannot safely fall back. Startup must fall back to Jaccard.

### `backend/rag/embed_adapter.py`

Responsibilities:

- Wrap DashScope OpenAI-compatible embedding API.
- Read `DASHSCOPE_API_KEY` from the existing `config.settings`.
- Use `text-embedding-v3` and `settings.DASHSCOPE_BASE_URL`.
- Never print or log the API key.

### `scripts/build_norm_node_embeddings.py`

Responsibilities:

- Read `data/rq2_traceability/norm_nodes.json`.
- Batch-call DashScope embeddings for node `text`.
- Write `data/rq2_traceability/norm_nodes_with_embeddings.json`.
- Print progress counts and output path only.
- Validate that all output nodes have one embedding, dimensions are consistent, and node count matches the source.

### `backend/main.py`

Responsibilities:

- Initialize `app.state.norm_retriever` during lifespan.
- Use `DashScopeEmbedder` when configured.
- Fall back to `NormNodeRetriever()` without embedder if embedding configuration or dependency is unavailable.
- Register `/v1/writing/analyze` under prefix `/v1`.
- Avoid printing raw exception strings from provider setup.

### `backend/api/chat.py` and `backend/core/norms.py`

Responsibilities:

- `api/chat.py` passes `app_state.norm_retriever` to `norms_loop()` for `mode=norms`.
- `norms_loop()` keeps its current conversation persistence, desensitization, Bailian session reuse, reference streaming, token streaming, and safe error behavior.
- Before calling `stream_bailian_app()`, `norms_loop()` builds norm context from the desensitized message and appends it to the prompt.
- If no retriever is loaded or no nodes match, it sends the current sanitized user message unchanged.

### `backend/api/writing.py`

Responsibilities:

- Register `POST /v1/writing/analyze`.
- Require the existing JWT dependency through `get_current_user_id`.
- Accept `text`, `top_k`, `theta`, and optional `refs`.
- Return `nodes`, `expanded`, `context`, and `validation`.
- Bound `top_k` and `theta` using Pydantic field constraints.
- Return empty results rather than 500 when no norm retriever is loaded.

## Data Flow

Embedding cache generation:

1. Deployment operator exports `DASHSCOPE_API_KEY` in the shell.
2. `scripts/build_norm_node_embeddings.py` reads `norm_nodes.json`.
3. The script calls DashScope embeddings in batches.
4. The script writes `norm_nodes_with_embeddings.json` with the original node fields plus `embedding`.

Backend startup:

1. FastAPI lifespan initializes Redis, existing RAG state, and stores.
2. Lifespan attempts to create `DashScopeEmbedder`.
3. Lifespan creates `NormNodeRetriever(embedder=embedder)` if possible.
4. If embedder creation fails, lifespan creates `NormNodeRetriever()` for Jaccard fallback.
5. `app.state.norm_retriever` is available to chat and writing APIs.

`/api/chat mode=norms`:

1. `api/chat.py` authenticates the user and ensures the session.
2. It calls `norms_loop(..., norm_retriever=app_state.norm_retriever)`.
3. `norms_loop()` desensitizes the user message.
4. It retrieves and expands relevant norm nodes.
5. It formats context with `[REF:node_id]` instructions.
6. It sends context plus sanitized message to `stream_bailian_app()`.
7. It streams Bailian references and tokens unchanged.

`/v1/writing/analyze`:

1. The endpoint authenticates the user.
2. It retrieves top-k norm nodes and one-hop expanded nodes.
3. It formats the same kind of context string expected by the LLM path.
4. It optionally validates requested ref IDs against the query and threshold.
5. It returns JSON-safe public nodes without embeddings.

## Error Handling And Security

- Never read `.env` directly.
- Never print API keys or raw provider configuration.
- Startup embedding failures degrade to Jaccard fallback.
- API responses must not expose embeddings.
- `/v1/writing/analyze` returns empty result sets when no retriever is available.
- Provider exceptions in normal user flows must be sanitized through existing error handling.
- Desensitization remains before cloud calls in `norms_loop()`.

## Testing Strategy

Unit tests must not call external APIs.

- `backend/tests/test_norm_retriever.py`
  - load a temporary corpus
  - verify Jaccard fallback retrieval
  - verify fake embedder cosine retrieval
  - verify graph expansion
  - verify validation
  - verify public nodes omit `embedding`

- `backend/tests/test_norms_loop.py`
  - verify `norms_loop()` injects formatted norm context into `stream_bailian_app()`
  - verify it preserves desensitization and conversation saving

- `backend/tests/test_chat_api.py`
  - verify `mode=norms` passes `app.state.norm_retriever` into `norms_loop()`

- `backend/tests/test_writing_api.py`
  - verify `/v1/writing/analyze` returns nodes, expanded nodes, context, and validation
  - verify no `embedding` field appears

- `backend/tests/test_embed_adapter.py`
  - mock the OpenAI client and verify the adapter calls embeddings correctly
  - verify no test needs a real API key

- Script test for `build_norm_node_embeddings.py`
  - mock embedding client
  - verify output count and dimension consistency

Integration verification may call the real DashScope API only when environment variables are already present in the process environment.

## Acceptance Criteria

- `norm_nodes_with_embeddings.json` can be generated by a committed script.
- Backend startup creates `app.state.norm_retriever`.
- `/api/chat mode=norms` includes local norm-node context before calling Bailian.
- `/v1/writing/analyze` returns HTTP 200 for an authenticated request.
- API responses do not include raw embeddings.
- Unit tests pass without real external API calls.
- Full backend and script test suites pass.
- Final implementation commits do not include secrets.
