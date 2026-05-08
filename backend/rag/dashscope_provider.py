from __future__ import annotations

import json
import re
from typing import Any

from openai import OpenAI


class DashScopeKnowledgeRAGRetriever:
    provider_name = "dashscope"

    def __init__(
        self,
        api_key: str,
        base_url: str,
        knowledge_base_id: str,
        model: str,
    ) -> None:
        self.knowledge_base_id = knowledge_base_id
        self.model = model
        self._client = OpenAI(api_key=api_key, base_url=base_url)

    def health(self) -> dict:
        return {
            "provider": self.provider_name,
            "configured": bool(self.knowledge_base_id),
            "model": self.model,
        }

    def retrieve_literature(self, query, top_k=10) -> list[dict]:
        if not self.knowledge_base_id:
            return []

        response = self._client.responses.create(
            model=self.model,
            input=[
                {
                    "role": "system",
                    "content": (
                        "你是学术资料检索助手。只能基于绑定知识库检索到的内容回答。"
                        "请输出 JSON 数组，不要 markdown，不要额外解释。"
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"检索主题：{query}\n"
                        f"最多返回 {top_k} 条最相关材料。每条字段："
                        "id,title,year,score,source,snippet,url。"
                        "score 使用 0 到 1 的相关度估计；缺失字段用空字符串或 0。"
                    ),
                },
            ],
            tools=[
                {
                    "type": "file_search",
                    "vector_store_ids": [self.knowledge_base_id],
                }
            ],
        )

        text = _response_text(response)
        items = _parse_items(text)
        normalized: list[dict] = []
        for idx, item in enumerate(items[:top_k], start=1):
            normalized.append(_normalize_item(item, idx))
        return normalized

    def discover_research_gaps(self, domain, query, top_k=5) -> list[dict]:
        return []

    def trace_method_lineage(self, method_name) -> list[dict]:
        return []

    def iterative_gap_discovery(
        self,
        query: str,
        domain: str,
        max_rounds: int = 3,
        new_node_threshold: int = 2,
        top_papers: int = 8,
        top_gaps: int = 5,
    ):
        yield (1, self.retrieve_literature(query, top_papers), [])


def _response_text(response: Any) -> str:
    output_text = getattr(response, "output_text", None)
    if output_text:
        return str(output_text)

    parts: list[str] = []
    for item in getattr(response, "output", []) or []:
        for content in getattr(item, "content", []) or []:
            text = getattr(content, "text", None)
            if text:
                parts.append(str(text))
    return "\n".join(parts)


def _parse_items(text: str) -> list[dict]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()

    try:
        data = json.loads(cleaned)
    except Exception:
        match = re.search(r"\[[\s\S]*\]", cleaned)
        if not match:
            return [{"title": "百炼知识库检索结果", "snippet": cleaned}]
        try:
            data = json.loads(match.group(0))
        except Exception:
            return [{"title": "百炼知识库检索结果", "snippet": cleaned}]

    if isinstance(data, dict):
        data = data.get("items") or data.get("results") or [data]
    if not isinstance(data, list):
        return []
    return [item for item in data if isinstance(item, dict)]


def _normalize_item(item: dict, idx: int) -> dict:
    raw_score = item.get("score", 0)
    try:
        score = float(raw_score)
    except (TypeError, ValueError):
        score = 0.0

    raw_year = item.get("year", 0)
    try:
        year = int(raw_year) if raw_year else 0
    except (TypeError, ValueError):
        year = 0

    title = str(item.get("title") or item.get("source") or f"知识库材料 {idx}").strip()
    snippet = str(item.get("snippet") or item.get("content") or item.get("text") or "").strip()
    source = str(item.get("source") or title).strip()
    url = str(item.get("url") or "").strip()

    return {
        "id": str(item.get("id") or f"dashscope-{idx}"),
        "title": title,
        "year": year,
        "score": max(0.0, min(score, 1.0)),
        "source": source,
        "snippet": snippet,
        "url": url,
    }
