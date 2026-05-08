from fastapi import APIRouter, Request

from api.responses import ok
from config import settings

router = APIRouter()


@router.get("/healthz")
async def healthz():
    return ok({"status": "ok"})


@router.get("/config/status")
async def config_status(request: Request):
    rag = getattr(request.app.state, "rag", None)
    rag_health = rag.health() if hasattr(rag, "health") else {"provider": "unknown", "configured": False}
    return ok(
        {
            "llm": {
                "dashscope": "configured" if bool(settings.DASHSCOPE_API_KEY) else "missing",
                "model": settings.MODEL_NAME,
            },
            "rag": rag_health,
            "local_rag_enabled": settings.ENABLE_LOCAL_RAG,
        }
    )
