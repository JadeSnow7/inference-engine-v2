from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from api.auth import get_current_user_id
from api.responses import ok
from store.redis_store import RedisReviewStore

router = APIRouter()

ReviewStatus = Literal["pending", "accepted", "rejected", "deferred"]
ReviewSource = Literal["chat", "document_tool", "writing_analysis", "manual"]
ReviewKind = Literal["rewrite", "expand", "logic_check", "citation", "norm", "structure"]


def _store(request: Request) -> RedisReviewStore:
    return request.app.state.review_store


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=404,
        detail={"code": "REVIEW_ITEM_NOT_FOUND", "message": "审阅项不存在"},
    )


class ReviewItemCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str | None = None
    documentId: str = Field(min_length=1)
    source: ReviewSource
    kind: ReviewKind
    status: ReviewStatus | None = None
    targetBlockIds: list[str] = Field(default_factory=list)
    beforeBlocks: list[dict[str, Any]] = Field(default_factory=list)
    afterBlocks: list[dict[str, Any]] = Field(default_factory=list)
    changes: list[dict[str, Any]] = Field(default_factory=list)
    reason: str = ""
    evidenceIds: list[str] = Field(default_factory=list)
    versionBeforeId: str | None = None
    versionAfterId: str | None = None
    createdAt: str | None = None
    updatedAt: str | None = None


class ReviewItemUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    documentId: str = Field(min_length=1)
    status: ReviewStatus | None = None
    targetBlockIds: list[str] | None = None
    beforeBlocks: list[dict[str, Any]] | None = None
    afterBlocks: list[dict[str, Any]] | None = None
    changes: list[dict[str, Any]] | None = None
    reason: str | None = None
    evidenceIds: list[str] | None = None
    versionBeforeId: str | None = None
    versionAfterId: str | None = None


@router.get("/review-items")
async def list_review_items(
    documentId: Annotated[str, Query(min_length=1)],
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    items = await _store(request).list_review_items(user_id, documentId)
    return ok({"items": items})


@router.post("/review-items", status_code=201)
async def create_review_item(
    body: ReviewItemCreateRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    item = await _store(request).create_review_item(user_id, body.model_dump())
    return ok(item, status_code=201)


@router.patch("/review-items/{review_item_id}")
async def update_review_item(
    review_item_id: str,
    body: ReviewItemUpdateRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    updates = body.model_dump(exclude_unset=True)
    document_id = updates.pop("documentId")
    item = await _store(request).update_review_item(user_id, document_id, review_item_id, updates)
    if item is None:
        raise _not_found()
    return ok(item)


async def _transition_review_item(
    review_item_id: str,
    body: ReviewItemUpdateRequest,
    request: Request,
    user_id: str,
    status: ReviewStatus,
):
    updates = body.model_dump(exclude_unset=True)
    document_id = updates.pop("documentId")
    updates["status"] = status
    item = await _store(request).update_review_item(user_id, document_id, review_item_id, updates)
    if item is None:
        raise _not_found()
    return ok(item)


@router.post("/review-items/{review_item_id}/accept")
async def accept_review_item(
    review_item_id: str,
    body: ReviewItemUpdateRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    return await _transition_review_item(review_item_id, body, request, user_id, "accepted")


@router.post("/review-items/{review_item_id}/reject")
async def reject_review_item(
    review_item_id: str,
    body: ReviewItemUpdateRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    return await _transition_review_item(review_item_id, body, request, user_id, "rejected")


@router.post("/review-items/{review_item_id}/defer")
async def defer_review_item(
    review_item_id: str,
    body: ReviewItemUpdateRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    return await _transition_review_item(review_item_id, body, request, user_id, "deferred")
