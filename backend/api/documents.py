from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from api.auth import get_current_user_id
from api.responses import ok
from store.redis_store import RedisDocumentStore

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=404,
        detail={"code": "DOCUMENT_NOT_FOUND", "message": "文档不存在"},
    )


def _store(request: Request) -> RedisDocumentStore:
    return request.app.state.document_store


class DocumentCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    courseId: str | None = None
    blocks: list[dict[str, Any]] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class DocumentUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    courseId: str | None = None
    blocks: list[dict[str, Any]] | None = None
    metadata: dict[str, Any] | None = None


class VersionCreateRequest(BaseModel):
    label: str | None = Field(default=None, max_length=120)
    metadata: dict[str, Any] = Field(default_factory=dict)


@router.post("/documents", status_code=201)
async def create_document(
    body: DocumentCreateRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    now = _now_iso()
    document = {
        "id": uuid4().hex,
        "title": body.title,
        "courseId": body.courseId,
        "blocks": body.blocks,
        "metadata": body.metadata,
        "createdAt": now,
        "updatedAt": now,
    }
    await _store(request).save_document(user_id, document)
    return ok(document, status_code=201)


@router.get("/documents/{document_id}")
async def get_document(
    document_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    document = await _store(request).get_document(user_id, document_id)
    if document is None:
        raise _not_found()
    return ok(document)


@router.patch("/documents/{document_id}")
async def update_document(
    document_id: str,
    body: DocumentUpdateRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    store = _store(request)
    document = await store.get_document(user_id, document_id)
    if document is None:
        raise _not_found()

    update = body.model_dump(exclude_unset=True)
    document.update(update)
    document["updatedAt"] = _now_iso()
    await store.save_document(user_id, document)
    return ok(document)


@router.post("/documents/{document_id}/versions", status_code=201)
async def create_version(
    document_id: str,
    body: VersionCreateRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    store = _store(request)
    document = await store.get_document(user_id, document_id)
    if document is None:
        raise _not_found()

    now = _now_iso()
    version = {
        "id": uuid4().hex,
        "documentId": document_id,
        "label": body.label,
        "title": document["title"],
        "blocks": document.get("blocks", []),
        "metadata": {**(document.get("metadata") or {}), **body.metadata},
        "createdAt": now,
    }
    await store.add_version(user_id, document_id, version)
    return ok(version, status_code=201)


@router.get("/documents/{document_id}/versions")
async def list_versions(
    document_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    store = _store(request)
    if await store.get_document(user_id, document_id) is None:
        raise _not_found()
    return ok(await store.list_versions(user_id, document_id))


@router.post("/documents/{document_id}/versions/{version_id}/restore")
async def restore_version(
    document_id: str,
    version_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    store = _store(request)
    document = await store.get_document(user_id, document_id)
    if document is None:
        raise _not_found()

    version = await store.get_version(user_id, document_id, version_id)
    if version is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "DOCUMENT_VERSION_NOT_FOUND", "message": "文档版本不存在"},
        )

    document["title"] = version["title"]
    document["blocks"] = version.get("blocks", [])
    document["metadata"] = version.get("metadata", {})
    document["updatedAt"] = _now_iso()
    await store.save_document(user_id, document)
    return ok(document)
