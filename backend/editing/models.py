from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


EditingMode = Literal["deep_edit", "academic_enhance", "citation_enhance", "originality_humanize"]
StageStatus = Literal["pending", "running", "completed", "failed", "skipped"]
GateStatus = Literal["pass", "warning", "fail"]
ReferenceStatus = Literal["resolved", "unresolved"]


class DocumentBlock(BaseModel):
    id: str
    type: Literal["heading", "paragraph"]
    content: str
    title: str | None = None
    headingLevel: int | None = None

    @field_validator("content")
    @classmethod
    def content_must_not_be_blank_for_paragraph(cls, value: str, info):
        block_type = info.data.get("type")
        if block_type == "paragraph" and not value.strip():
            raise ValueError("paragraph content must not be blank")
        return value


class EditingJobCreate(BaseModel):
    blocks: list[DocumentBlock] = Field(min_length=1)
    selected_block_ids: list[str] = Field(default_factory=list)
    mode: EditingMode = "deep_edit"
    objective: str = ""
    session_id: str | None = None


class EditingStage(BaseModel):
    stage_id: str
    label: str
    status: StageStatus = "pending"
    model: str = ""
    thinking: bool = False
    summary: str = ""
    error: str = ""


class EditingPatch(BaseModel):
    id: str
    stage_id: str
    block_id: str
    original_text: str
    revised_text: str
    reason: str
    risk_level: Literal["low", "medium", "high"] = "low"
    confidence: float = Field(default=0.75, ge=0.0, le=1.0)


class EvidenceReference(BaseModel):
    id: str
    title: str
    source: str = "ScholarScript Evidence Shell"
    year: int | None = None
    score: float | None = None
    excerpt: str = ""
    status: ReferenceStatus = "unresolved"
    url: str | None = None


class EditingGateReport(BaseModel):
    status: GateStatus = "warning"
    fidelity_score: float = Field(default=0.0, ge=0.0, le=1.0)
    semantic_similarity: float = Field(default=0.0, ge=0.0, le=1.0)
    citation_unresolved_count: int = 0
    messages: list[str] = Field(default_factory=list)


class EditingJobStatus(BaseModel):
    job_id: str
    mode: EditingMode
    objective: str = ""
    status: Literal["created", "running", "completed", "failed"] = "created"
    selected_block_ids: list[str] = Field(default_factory=list)
    stages: list[EditingStage]
    patches: list[EditingPatch] = Field(default_factory=list)
    references: list[EvidenceReference] = Field(default_factory=list)
    gate_report: EditingGateReport = Field(default_factory=EditingGateReport)
    checkpoint_block_ids: list[str] = Field(default_factory=list)
    error: str = ""
