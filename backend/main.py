from contextlib import asynccontextmanager
from pathlib import Path

import redis.asyncio as redis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.chat import router as chat_router
from api.health import router as health_router
from api.responses import register_error_handlers
from api.users import router as users_router
from config import settings
from conversation.manager import ConversationManager
from rag.dashscope_provider import DashScopeKnowledgeRAGRetriever
from rag.graph import KnowledgeGraph, build_demo_graph
from rag.retriever import DisabledRAGRetriever, GraphRAGRetriever
from store.redis_store import RedisConversationStore, RedisProfileStore, UserStore


@asynccontextmanager
async def lifespan(app: FastAPI):
    redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    embedder = None
    kg = None
    rag = DisabledRAGRetriever()

    if settings.ENABLE_LOCAL_RAG:
        from sentence_transformers import SentenceTransformer

        embedder = SentenceTransformer(settings.EMBED_MODEL)
        kg = KnowledgeGraph()
        persist_path = Path(settings.GRAPH_PERSIST_PATH)
        persist_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            kg.load(str(persist_path))
            if kg.get_graph().number_of_nodes() == 0:
                raise FileNotFoundError
        except Exception:
            kg = build_demo_graph()
            kg.save(str(persist_path))
        rag = GraphRAGRetriever(kg, embedder)
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
    app.state.conv_manager = ConversationManager(RedisConversationStore(redis_client))
    app.state.profile_store = RedisProfileStore(redis_client)
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
app.include_router(users_router, prefix="/api")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
