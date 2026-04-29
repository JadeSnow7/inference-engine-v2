"""
tests/test_paragraph_pipeline.py
=================================
Unit tests for pipelines/paragraph.py

Uses a FakeRAG to avoid real embedding/network calls.
Verifies:
  1. PAPERS SSE event is emitted when literature is found
  2. STAGE events are emitted in order
  3. Oral-word hint is appended when text contains banned words
  4. Weak-point personalised tip is appended when profile has weak_points
  5. No PAPERS event when RAG returns empty

All LLM calls are replaced by a trivial async generator.
"""

import os
import pytest

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")

import json
from unittest.mock import AsyncMock, patch


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class FakeRAG:
    def __init__(self, papers: list[dict]):
        self._papers = papers

    def retrieve_literature(self, query: str, top_k: int) -> list[dict]:
        return self._papers[:top_k]


def _collect_events(raw_events: list[str]) -> list[dict]:
    """Parse SSE 'data: {...}' lines into dicts."""
    events = []
    for line in raw_events:
        line = line.strip()
        if line.startswith("data: "):
            events.append(json.loads(line[6:]))
    return events


async def _run_paragraph(user_message: str, profile: dict, papers: list[dict], generated_text: str) -> list[dict]:
    """Run _stream_paragraph with a fake RAG and a patched stream_model."""
    from pipelines.paragraph import _stream_paragraph

    async def fake_stream(*args, **kwargs):
        for ch in generated_text:
            yield ch

    rag = FakeRAG(papers)

    with patch("pipelines.paragraph.stream_model", side_effect=fake_stream):
        raw = []
        async for chunk in _stream_paragraph(user_message, [], profile, rag):
            raw.append(chunk)

    return _collect_events(raw)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_papers_event_emitted():
    papers = [
        {"id": "p1", "title": "Paper A", "year": 2023, "score": 0.9},
        {"id": "p2", "title": "Paper B", "year": 2024, "score": 0.8},
    ]
    events = await _run_paragraph("写一段关于功耗预测的段落", {}, papers, "This is output.")
    types = [e["type"] for e in events]
    assert "papers" in types, "Should emit a papers event"
    papers_event = next(e for e in events if e["type"] == "papers")
    assert len(papers_event["data"]) == 2


@pytest.mark.asyncio
async def test_no_papers_event_when_empty():
    events = await _run_paragraph("写一段关于功耗预测的段落", {}, [], "Some output.")
    types = [e["type"] for e in events]
    assert "papers" not in types


@pytest.mark.asyncio
async def test_stage_events_order():
    events = await _run_paragraph("写一段", {}, [], "clean text output")
    stage_events = [e for e in events if e["type"] == "stage"]
    stage_labels = [e.get("stage", "") for e in stage_events]
    assert "文献支撑检索" in stage_labels
    assert "段落生成" in stage_labels
    # 文献支撑检索 should come before 段落生成
    assert stage_labels.index("文献支撑检索") < stage_labels.index("段落生成")


@pytest.mark.asyncio
async def test_oral_word_hint_appended():
    """Text containing '就是' should trigger the 语态检查 hint."""
    events = await _run_paragraph("写段落", {}, [], "这就是一个很好的方法，其实还可以改进。")
    token_texts = "".join(e.get("content", "") for e in events if e["type"] == "token")
    assert "语态检查" in token_texts
    assert "就是" in token_texts


@pytest.mark.asyncio
async def test_no_oral_hint_for_clean_text():
    events = await _run_paragraph("写段落", {}, [], "学术性很强的严谨段落。")
    token_texts = "".join(e.get("content", "") for e in events if e["type"] == "token")
    assert "语态检查" not in token_texts


@pytest.mark.asyncio
async def test_weak_points_tip_appended():
    profile = {"weak_points": {"研究空白": 3, "文献综述": 2, "引用格式": 1}}
    events = await _run_paragraph("写段落", profile, [], "Clean academic output.")
    token_texts = "".join(e.get("content", "") for e in events if e["type"] == "token")
    assert "个性化提示" in token_texts
    assert "研究空白" in token_texts   # top-1 weak point should appear


@pytest.mark.asyncio
async def test_no_weak_points_tip_when_empty_profile():
    events = await _run_paragraph("写段落", {}, [], "Clean text.")
    token_texts = "".join(e.get("content", "") for e in events if e["type"] == "token")
    assert "个性化提示" not in token_texts
