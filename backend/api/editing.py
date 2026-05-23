from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from api.auth import get_current_user_id
from api.responses import ok
from editing.deepseek import HeuristicEditingProvider
from editing.models import EditingJobCreate
from editing.pipeline import EditingPipeline

router = APIRouter()


def _pipeline(request: Request) -> EditingPipeline:
    jobs = getattr(request.app.state, "editing_jobs", None)
    if jobs is None:
        jobs = {}
        request.app.state.editing_jobs = jobs

    pipeline = getattr(request.app.state, "editing_pipeline", None)
    if pipeline is None:
        provider = getattr(request.app.state, "editing_provider", None) or HeuristicEditingProvider()
        pipeline = EditingPipeline(
            provider=provider,
            norm_retriever=getattr(request.app.state, "norm_retriever", None),
            rag=getattr(request.app.state, "rag", None),
        )
        pipeline._jobs = jobs
        request.app.state.editing_pipeline = pipeline

    return pipeline


@router.post("/editing/jobs")
async def create_editing_job(
    req: EditingJobCreate,
    request: Request,
    _user_id: str = Depends(get_current_user_id),
):
    job = await _pipeline(request).create_job(req)
    return ok(job.model_dump())


@router.get("/editing/jobs/{job_id}")
async def get_editing_job(
    job_id: str,
    request: Request,
    _user_id: str = Depends(get_current_user_id),
):
    pipeline = _pipeline(request)
    try:
        job = pipeline.get_job(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "编辑任务不存在"}) from exc
    return ok(job.model_dump())


@router.post("/editing/jobs/{job_id}/run")
async def run_editing_job(
    job_id: str,
    request: Request,
    _user_id: str = Depends(get_current_user_id),
):
    pipeline = _pipeline(request)
    try:
        pipeline.get_job(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "编辑任务不存在"}) from exc

    return StreamingResponse(
        pipeline.run_job(job_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )
