# Remaining Integrations Matrix

Date: 2026-05-13

| Area | Status | Current Path | Remaining Work |
| --- | --- | --- | --- |
| Workspace documents | API-backed | `/api/documents`, `/api/documents/{id}/versions` | Replace initial `workspaceMock` seed with backend bootstrap/default document data. |
| Document versions | API-backed | Redis document store and frontend version UI | Add richer conflict handling if multiple devices edit the same document. |
| Courses | Connected | `/api/courses` | Replace seeded defaults with real course imports when available. |
| Dashboard | Connected | `/api/dashboard` | Add user-specific analytics once real activity volume exists. |
| Library | Connected | `/api/library` | Continue expanding evidence sources beyond generated references. |
| Discovery graph | Connected | `/api/graph` | Persist user graph layout separately from API graph data if needed. |
| Global/workspace search | Connected | `/api/search` | Add ranking/permissions tuning as corpus grows. |
| Conversation search | Connected | `/api/search?scope=conversation` | Add pagination for long histories. |
| Notifications | Connected | `/api/notifications` | Add real event producers beyond seeded/system notifications. |
| Settings | Connected | `/api/settings` | Expand preferences as product settings grow. |
| Document rewrite | Connected | `/api/chat` SSE | Improve prompt tuning with acceptance telemetry. |
| Document expand | Connected | `/api/chat` SSE | Improve prompt tuning with acceptance telemetry. |
| Document logic check | Connected | `/api/chat` SSE | Add structured diagnostics if backend returns richer events. |
| Citation enhancement | Connected | `/api/chat` SSE plus `/v1/writing/analyze` evidence enrichment | Add stricter citation attribution and source verification. |
| Web search quick mode | Disabled | Frontend button disabled with explicit unavailable title | Add backend provider, source attribution, timeout handling, tests, and product policy before enabling. |
| Local GraphRAG embedding | Local-path gated | `MODELSCOPE_EMBED_MODEL_PATH`, `scripts/download_modelscope_embedding.py` | Ensure deployment environments refresh the ModelScope artifact before setting `ENABLE_LOCAL_RAG=1`. |
| DashScope norm retriever | Connected separately | `DashScopeEmbedder`, `NormNodeRetriever` | Keep separate from local GraphRAG embedding path. |
| Auth hardening | Deferred | JWT stored in frontend localStorage | Move to httpOnly cookie/session flow for production-hardening. |
| Bundle splitting | Deferred | Vite default chunks | Add route-level lazy imports or manual chunking. |
