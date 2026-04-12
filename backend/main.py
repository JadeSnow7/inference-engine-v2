from contextlib import asynccontextmanager
from pathlib import Path

import redis.asyncio as redis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sentence_transformers import SentenceTransformer

from api.chat import router as chat_router
from config import settings
from conversation.manager import ConversationManager
from rag.graph import KnowledgeGraph, build_demo_graph
from rag.retriever import GraphRAGRetriever
from store.redis_store import RedisConversationStore, RedisProfileStore


@asynccontextmanager
async def lifespan(app: FastAPI):
    redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
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

    app.state.redis_client = redis_client
    app.state.embedder = embedder
    app.state.kg = kg
    app.state.rag = GraphRAGRetriever(kg, embedder)
    app.state.conv_manager = ConversationManager(RedisConversationStore(redis_client))
    app.state.profile_store = RedisProfileStore(redis_client)
    try:
        yield
    finally:
        await redis_client.aclose()


app = FastAPI(title="AI写作辅助平台", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(chat_router, prefix="/api")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
