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
            "active_provider": settings.active_ai_provider,
            "provider_preference": settings.AI_PROVIDER_PREFERENCE,
            "rag": rag_health,
            "bailian_app": {
                "enabled": settings.ENABLE_BAILIAN_APP,
                "configured": bool(settings.DASHSCOPE_API_KEY and settings.DASHSCOPE_APP_ID),
                "purpose": "academic_norms",
            },
            "local_rag_enabled": settings.ENABLE_LOCAL_RAG,
        }
    )
