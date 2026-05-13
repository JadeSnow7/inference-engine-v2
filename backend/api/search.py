from typing import Any

from fastapi import APIRouter, Depends, Request

from api.auth import get_current_user_id
from api.responses import ok

router = APIRouter()

SEARCH_SCOPES = {
    "global": {"document", "conversation", "evidence", "course"},
    "workspace": {"document", "conversation", "evidence"},
    "documents": {"document"},
    "conversations": {"conversation"},
    "library": {"evidence"},
    "courses": {"course"},
}


def _matches(value: str, query: str) -> bool:
    return query.lower() in value.lower()


def _text_from_blocks(blocks: list[dict]) -> str:
    parts = []
    for block in blocks:
        for field in ("content", "text", "title"):
            value = block.get(field)
            if isinstance(value, str) and value:
                parts.append(value)
    return " ".join(parts)


def _excerpt(text: str, fallback: str = "") -> str:
    compact = " ".join(text.split()).strip() or fallback
    return compact[:160]


def _result(result_type: str, item_id: str, title: str, excerpt: str, target: str, meta: str = "") -> dict[str, str]:
    return {
        "id": f"{result_type}:{item_id}",
        "type": result_type,
        "title": title,
        "excerpt": excerpt,
        "target": target,
        "meta": meta,
    }


async def _search_documents(request: Request, user_id: str, query: str) -> list[dict[str, str]]:
    store = request.app.state.document_store
    if not hasattr(store, "list_documents"):
        return []
    results = []
    for document in await store.list_documents(user_id):
        blocks_text = _text_from_blocks(document.get("blocks") or [])
        haystack = " ".join([str(document.get("title", "")), blocks_text])
        if _matches(haystack, query):
            results.append(_result(
                "document",
                str(document.get("id", "")),
                str(document.get("title") or "未命名文档"),
                _excerpt(blocks_text, "文档内容匹配"),
                f"/workbench?document={document.get('id', '')}",
                str(document.get("updatedAt") or ""),
            ))
    return results


async def _search_conversations(request: Request, user_id: str, query: str) -> list[dict[str, str]]:
    sessions = await request.app.state.conv_manager.list_sessions(user_id, limit=50, offset=0)
    results = []
    for session in sessions.get("items", []):
        haystack = " ".join(str(session.get(field, "")) for field in ("title", "scene", "session_id"))
        if _matches(haystack, query):
            session_id = str(session.get("session_id", ""))
            results.append(_result(
                "conversation",
                session_id,
                str(session.get("title") or "未命名会话"),
                f"{session.get('scene') or 'workspace'} · {session.get('message_count', 0)} 条消息",
                f"/workbench?session={session_id}",
                "会话",
            ))
    return results


async def _search_evidence(request: Request, user_id: str, query: str) -> list[dict[str, str]]:
    results = []
    for item in await request.app.state.evidence_store.list_evidence(user_id):
        haystack = " ".join(str(item.get(field, "")) for field in ("title", "venue", "type", "year", "excerpt"))
        if _matches(haystack, query):
            results.append(_result(
                "evidence",
                str(item.get("id", "")),
                str(item.get("title") or "未命名证据"),
                _excerpt(str(item.get("excerpt") or item.get("venue") or ""), "证据来源匹配"),
                f"/library?q={item.get('id', '')}",
                str(item.get("venue") or item.get("type") or ""),
            ))
    return results


async def _search_courses(request: Request, user_id: str, query: str) -> list[dict[str, str]]:
    results = []
    for space in await request.app.state.course_store.list_research_spaces(user_id):
        material = space.get("material") if isinstance(space.get("material"), dict) else {}
        haystack = " ".join(str(value) for value in [
            space.get("title", ""),
            space.get("topic", ""),
            space.get("teacher", ""),
            space.get("status", ""),
            material.get("title", ""),
        ])
        if _matches(haystack, query):
            results.append(_result(
                "course",
                str(space.get("id", "")),
                str(space.get("title") or "未命名研究空间"),
                _excerpt(str(space.get("topic") or space.get("status") or ""), "研究空间匹配"),
                f"/courses?space={space.get('id', '')}",
                str(space.get("teacher") or ""),
            ))
    return results


@router.get("/search")
async def search_items(
    request: Request,
    q: str,
    scope: str = "global",
    user_id: str = Depends(get_current_user_id),
):
    query = q.strip()
    if not query:
        return ok({"items": []})

    enabled_types = SEARCH_SCOPES.get(scope, SEARCH_SCOPES["global"])
    searchers: dict[str, Any] = {
        "document": _search_documents,
        "conversation": _search_conversations,
        "evidence": _search_evidence,
        "course": _search_courses,
    }
    items: list[dict[str, str]] = []
    for result_type, searcher in searchers.items():
        if result_type in enabled_types:
            items.extend(await searcher(request, user_id, query))
    return ok({"items": items[:25]})
