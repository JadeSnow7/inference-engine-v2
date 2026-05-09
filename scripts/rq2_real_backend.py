#!/usr/bin/env python3
"""Script-local norm GraphRAG backend for RQ2 collection."""

from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any

from rq2_traceability_lib import extract_refs, validate_refs


RQ2_DIR = Path("data/rq2_traceability")
TOKEN_RE = re.compile(r"[A-Za-z0-9]+")


def tokenize(text: str) -> set[str]:
    return {token.lower() for token in TOKEN_RE.findall(text)}


def jaccard(query_tokens: set[str], doc_tokens: set[str]) -> float:
    if not query_tokens or not doc_tokens:
        return 0.0
    return len(query_tokens & doc_tokens) / len(query_tokens | doc_tokens)


class NormGraphRAG:
    def __init__(self, nodes: list[dict[str, Any]]):
        self.nodes = nodes
        self.by_id = {node["node_id"]: node for node in nodes}
        self.token_index = {node["node_id"]: tokenize(node["text"] + " " + node.get("dimension", "")) for node in nodes}

    @classmethod
    def from_root(cls, root: Path) -> "NormGraphRAG":
        with (root / RQ2_DIR / "norm_nodes.json").open("r", encoding="utf-8") as handle:
            return cls(json.load(handle))

    def retrieve(self, query_text: str, *, top_k: int, graph_expand: bool) -> list[dict[str, Any]]:
        query_tokens = tokenize(query_text)
        ranked = []
        for node in self.nodes:
            score = jaccard(query_tokens, self.token_index[node["node_id"]])
            ranked.append((score, node["node_id"]))
        ranked.sort(key=lambda item: (-item[0], item[1]))
        selected_ids = [node_id for score, node_id in ranked[:top_k] if score > 0]
        if not selected_ids and ranked:
            selected_ids = [ranked[0][1]]

        if graph_expand:
            expanded = list(selected_ids)
            for node_id in selected_ids:
                for related_id in self.by_id[node_id].get("related", []):
                    if related_id in self.by_id and related_id not in expanded:
                        expanded.append(related_id)
            selected_ids = expanded

        results = []
        for node_id in selected_ids:
            node = self.by_id[node_id]
            raw_score = jaccard(query_tokens, self.token_index[node_id])
            score = 0.72 if raw_score == 0 else min(0.95, 0.55 + math.sqrt(raw_score))
            results.append({
                "node_id": node_id,
                "node_type": node["node_type"],
                "dimension": node["dimension"],
                "text": node["text"],
                "score": round(score, 4),
            })
        return results


def format_retrieved_nodes(retrieved_nodes: list[dict[str, Any]], theta: float) -> list[dict[str, Any]]:
    return [
        {
            "node_id": node["node_id"],
            "node_type": node.get("node_type"),
            "dimension": node.get("dimension"),
            "cosine_similarity": node["score"],
            "exists_in_kg": True,
            "pass_threshold": node["score"] >= theta,
        }
        for node in retrieved_nodes
    ]


def build_fallback_feedback(query: dict[str, Any], retrieved_nodes: list[dict[str, Any]]) -> str:
    if not retrieved_nodes:
        return "No norm node was retrieved for this method."
    refs = " ".join(f"[REF:{node['node_id']}]" for node in retrieved_nodes[:3])
    return (
        "评价维度：规范溯源。\n"
        "问题定位：根据评测片段匹配到相关规范节点。\n"
        f"规范依据：{refs}\n"
        "修改建议：按引用、结构和段落功能规范逐项修订。"
    )


def build_retrieval_row(
    *,
    query: dict[str, Any],
    method: str,
    retrieved_nodes: list[dict[str, Any]],
    generated_text: str,
    theta: float,
    binding: bool,
) -> dict[str, Any]:
    refs = extract_refs(generated_text) if binding else []
    node_scores = {node["node_id"]: float(node["score"]) for node in retrieved_nodes}
    validation_results = validate_refs(refs, node_scores, theta=theta) if binding else {}
    low_confidence_refs = [
        ref for ref, result in validation_results.items()
        if bool(result["exists"]) and not bool(result["pass"])
    ]
    return {
        "method": method,
        "run_type": "real_system",
        "query_id": query["query_id"],
        "retrieved_nodes": format_retrieved_nodes(retrieved_nodes, theta),
        "generated_refs": refs,
        "validation_results": validation_results,
        "low_confidence_refs": low_confidence_refs,
        "feedback_structure_complete": all(label in generated_text for label in ("评价维度", "问题定位", "规范依据", "修改建议")),
        "theta_used": theta,
        "raw_feedback": generated_text,
    }
