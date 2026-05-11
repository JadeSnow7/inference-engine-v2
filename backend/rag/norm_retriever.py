from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import numpy as np


RQ2_DIR = Path(__file__).resolve().parents[2] / "data" / "rq2_traceability"
DEFAULT_EMBEDDED_CORPUS = RQ2_DIR / "norm_nodes_with_embeddings.json"
DEFAULT_RAW_CORPUS = RQ2_DIR / "norm_nodes.json"


class NormNodeRetriever:
    def __init__(
        self,
        corpus_path: Path = DEFAULT_EMBEDDED_CORPUS,
        *,
        raw_corpus_path: Path = DEFAULT_RAW_CORPUS,
        embedder: Any | None = None,
    ) -> None:
        self._nodes: dict[str, dict[str, Any]] = {}
        self._embedder = embedder
        self._load(corpus_path, raw_corpus_path)

    def _load(self, corpus_path: Path, raw_corpus_path: Path) -> None:
        path = corpus_path if corpus_path.exists() else raw_corpus_path
        if not path.exists():
            return
        raw = json.loads(path.read_text(encoding="utf-8"))
        for node in raw:
            emb = node.get("embedding")
            self._nodes[node["node_id"]] = {
                **node,
                "embedding": np.asarray(emb, dtype=float) if emb else None,
            }

    def _public_node(self, node: dict[str, Any], *, score: float | None = None, via_expand: bool = False) -> dict[str, Any]:
        public = {
            "node_id": node["node_id"],
            "node_type": node["node_type"],
            "dimension": node["dimension"],
            "text": node["text"],
            "related": list(node.get("related", [])),
        }
        if score is not None:
            public["score"] = round(float(score), 4)
        if via_expand:
            public["via_expand"] = True
        return public

    def _cosine(self, a: np.ndarray | None, b: np.ndarray | None) -> float:
        if a is None or b is None:
            return 0.0
        denom = float(np.linalg.norm(a) * np.linalg.norm(b))
        return 0.0 if math.isclose(denom, 0.0) else float(np.dot(a, b) / denom)

    def _jaccard(self, query: str, text: str) -> float:
        a = set(query.lower().split())
        b = set(text.lower().split())
        return len(a & b) / len(a | b) if a or b else 0.0

    def _embed_query(self, query: str) -> np.ndarray | None:
        if self._embedder is None:
            return None
        try:
            return np.asarray(self._embedder.embed(query), dtype=float)
        except Exception:
            print("[norm_retriever] query embedding unavailable; using Jaccard fallback")
            return None

    def _score(self, query_emb: np.ndarray | None, query: str, node: dict[str, Any]) -> float:
        if query_emb is not None and node.get("embedding") is not None:
            return self._cosine(query_emb, node["embedding"])
        return self._jaccard(query, node.get("text", ""))

    def retrieve(self, query: str, top_k: int = 5, theta: float = 0.0) -> list[dict[str, Any]]:
        query_emb = self._embed_query(query)
        scored = [(self._score(query_emb, query, node), node) for node in self._nodes.values()]
        scored.sort(key=lambda item: item[0], reverse=True)
        return [self._public_node(node, score=score) for score, node in scored[:top_k] if score >= theta]

    def expand(self, node_ids: list[str], hops: int = 1) -> list[dict[str, Any]]:
        seeds = set(node_ids)
        seen = set(node_ids)
        frontier = list(node_ids)
        expanded: list[dict[str, Any]] = []
        for _ in range(max(0, hops)):
            next_frontier: list[str] = []
            for node_id in frontier:
                node = self._nodes.get(node_id)
                if node is None:
                    continue
                for related_id in node.get("related", []):
                    if related_id in seen or related_id in seeds or related_id not in self._nodes:
                        continue
                    seen.add(related_id)
                    next_frontier.append(related_id)
                    expanded.append(self._public_node(self._nodes[related_id], score=0.72, via_expand=True))
            frontier = next_frontier
        return expanded

    def validate_ref(self, node_id: str, query: str, theta: float = 0.6) -> tuple[bool, float]:
        node = self._nodes.get(node_id)
        if node is None:
            return False, 0.0
        query_emb = self._embed_query(query)
        score = self._score(query_emb, query, node)
        return score >= theta, round(float(score), 4)

    def get(self, node_id: str) -> dict[str, Any] | None:
        node = self._nodes.get(node_id)
        return self._public_node(node) if node is not None else None

    def format_context(self, nodes: list[dict[str, Any]]) -> str:
        if not nodes:
            return ""
        lines = ["Relevant norm nodes. Cite them as [REF:node_id]."]
        for node in nodes:
            lines.append(
                f"- [REF:{node['node_id']}] type={node['node_type']} "
                f"dimension={node['dimension']} text={node['text']}"
            )
        return "\n".join(lines)

    def __len__(self) -> int:
        return len(self._nodes)
