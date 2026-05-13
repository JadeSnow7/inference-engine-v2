from contextlib import asynccontextmanager
from pathlib import Path

import redis.asyncio as redis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.chat import router as chat_router
from api.courses import router as courses_router
from api.dashboard import router as dashboard_router
from api.documents import router as documents_router
from api.graph import router as graph_router
from api.health import router as health_router
from api.library import router as library_router
from api.notifications import router as notifications_router
from api.responses import register_error_handlers
from api.search import router as search_router
from api.settings import router as settings_router
from api.users import router as users_router
from api.writing import router as writing_router
from config import settings
from conversation.manager import ConversationManager
from rag.dashscope_provider import DashScopeKnowledgeRAGRetriever
from rag.embed_adapter import DashScopeEmbedder
from rag.graph import KnowledgeGraph, build_demo_graph
from rag.norm_retriever import NormNodeRetriever
from rag.retriever import DisabledRAGRetriever, GraphRAGRetriever
from store.redis_store import (
    RedisConversationStore,
    RedisCourseStore,
    RedisDocumentStore,
    RedisEvidenceStore,
    RedisNotificationStore,
    RedisProfileStore,
    RedisSettingsStore,
    UserStore,
)


def build_norm_retriever() -> NormNodeRetriever:
    try:
        retriever = NormNodeRetriever(embedder=DashScopeEmbedder())
        print(f"[startup] NormNodeRetriever loaded: {len(retriever)} nodes, embedder=DashScope")
        return retriever
    except Exception:
        retriever = NormNodeRetriever()
        print(f"[startup] NormNodeRetriever loaded with Jaccard fallback: {len(retriever)} nodes")
        return retriever


def build_local_rag():
    local_model_path = settings.local_embed_model_path
    if not local_model_path:
        print("[startup] Local GraphRAG disabled: MODELSCOPE_EMBED_MODEL_PATH or EMBED_MODEL must point to an existing local model path")
        return None, None, DisabledRAGRetriever()

    from sentence_transformers import SentenceTransformer

    embedder = SentenceTransformer(local_model_path)
    kg = KnowledgeGraph()
    persist_path = Path(settings.GRAPH_PERSIST_PATH)
    persist_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        kg.load(str(persist_path))
        if kg.get_graph().number_of_nodes() == 0:
            raise FileNotFoundError
    except Exception:
        kg = build_demo_graph(embedder)
        kg.save(str(persist_path))
    return embedder, kg, GraphRAGRetriever(kg, embedder)


@asynccontextmanager
async def lifespan(app: FastAPI):
    redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    embedder = None
    kg = None
    rag = DisabledRAGRetriever()

    if settings.ENABLE_LOCAL_RAG:
        embedder, kg, rag = build_local_rag()
    elif settings.RAG_PROVIDER.lower() == "dashscope":
        rag = DashScopeKnowledgeRAGRetriever(
            api_key=settings.DASHSCOPE_API_KEY,
            base_url=settings.DASHSCOPE_BASE_URL,
            knowledge_base_id=settings.DASHSCOPE_KNOWLEDGE_BASE_ID,
            model=settings.DASHSCOPE_RAG_MODEL,
        )

    app.state.redis_client = redis_client
    app.state.embedder = embedder
    app.state.kg = kg
    app.state.rag = rag
    app.state.norm_retriever = build_norm_retriever()
    app.state.conv_manager = ConversationManager(RedisConversationStore(redis_client))
    app.state.course_store = RedisCourseStore(redis_client)
    app.state.document_store = RedisDocumentStore(redis_client)
    app.state.evidence_store = RedisEvidenceStore(redis_client)
    app.state.notification_store = RedisNotificationStore(redis_client)
    app.state.profile_store = RedisProfileStore(redis_client)
    app.state.settings_store = RedisSettingsStore(redis_client)
    app.state.user_store = UserStore(redis_client)
    try:
        yield
    finally:
        await redis_client.aclose()


app = FastAPI(title="AI写作辅助平台", version="1.0.0", lifespan=lifespan)
register_error_handlers(app)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(courses_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(documents_router, prefix="/api")
app.include_router(graph_router, prefix="/api")
app.include_router(library_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(search_router, prefix="/api")
app.include_router(settings_router, prefix="/api")
app.include_router(writing_router, prefix="/v1")
app.include_router(users_router, prefix="/api")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
