#!/usr/bin/env python3
"""Collect real-system RQ2 outputs.

Default mode is dry-run. Real collection is intentionally blocked until backend
retrieval/generation bindings are wired in this script.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

from rq2_real_backend import NormGraphRAG, build_fallback_feedback, build_retrieval_row


RQ2_DIR = Path("data/rq2_traceability")
METHOD_CONFIGS = {
    "baseline_a": {"retrieval": False, "graph_expand": False, "binding": False},
    "baseline_b": {"retrieval": True, "graph_expand": False, "binding": False},
    "ablation_no_expand": {"retrieval": True, "graph_expand": False, "binding": True},
    "full_graphrag": {"retrieval": True, "graph_expand": True, "binding": True},
}
THETA_VALUES = [0.50, 0.55, 0.60, 0.65, 0.70]


def read_queries(root: Path, limit: int | None) -> list[dict[str, Any]]:
    with (root / RQ2_DIR / "query_set.json").open("r", encoding="utf-8") as handle:
        queries = json.load(handle)
    return queries if limit is None else queries[:limit]


def build_dry_run_row(query: dict[str, Any], method: str, *, theta: float) -> dict[str, Any]:
    return {
        "method": method,
        "run_type": "real_system_dry_run",
        "query_id": query["query_id"],
        "retrieved_nodes": [],
        "generated_refs": [],
        "validation_results": {},
        "low_confidence_refs": [],
        "feedback_structure_complete": False,
        "theta_used": theta,
        "notes": "Dry-run row only. Real collection wiring is not enabled in this script yet.",
    }


def build_llm_messages(*, query: dict[str, Any], method: str, retrieved_nodes: list[dict[str, Any]]) -> list[dict[str, str]]:
    refs = " ".join(f"[REF:{node['node_id']}]" for node in retrieved_nodes[:3])
    node_lines = "\n".join(
        f"- {node['node_id']} ({node['node_type']}, {node['dimension']}): {node['text']}"
        for node in retrieved_nodes
    )
    return [
        {
            "role": "system",
            "content": (
                "You generate concise academic writing feedback. "
                "Use the four Chinese labels: 评价维度, 问题定位, 规范依据, 修改建议. "
                "When citing norm nodes, use exact reference tags such as [REF:node_id]."
            ),
        },
        {
            "role": "user",
            "content": (
                f"query_id: {query['query_id']}\n"
                f"method: {method}\n"
                f"writing snippet:\n{query['text']}\n\n"
                f"retrieved norm nodes:\n{node_lines}\n\n"
                f"Use these reference tags when relevant: {refs}"
            ),
        },
    ]


def build_dashscope_llm_generator(root: Path) -> Callable[..., str]:
    backend_dir = root / "backend"
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    import asyncio

    try:
        from core.stream import call_model_once
    except Exception as exc:
        raise RuntimeError(f"LLM generation dependency or config unavailable: {exc}") from exc

    def generate(*, query: dict[str, Any], method: str, retrieved_nodes: list[dict[str, Any]]) -> str:
        messages = build_llm_messages(query=query, method=method, retrieved_nodes=retrieved_nodes)
        return asyncio.run(call_model_once(messages, temperature=0.2, thinking=False, max_tokens=800))

    return generate


def build_real_row(
    query: dict[str, Any],
    method: str,
    rag: NormGraphRAG,
    *,
    theta: float,
    with_llm: bool,
    llm_generator: Callable[..., str] | None = None,
) -> dict[str, Any]:
    if with_llm and llm_generator is None:
        raise RuntimeError("LLM generation is not wired yet; provide llm_generator or run without --with-llm")
    config = METHOD_CONFIGS[method]
    retrieved_nodes = []
    if config["retrieval"]:
        retrieved_nodes = rag.retrieve(
            query["text"],
            top_k=1 if not config["graph_expand"] else 2,
            graph_expand=config["graph_expand"],
        )
    generated_text = (
        llm_generator(query=query, method=method, retrieved_nodes=retrieved_nodes)
        if with_llm
        else build_fallback_feedback(query, retrieved_nodes)
    )
    row = build_retrieval_row(
        query=query,
        method=method,
        retrieved_nodes=retrieved_nodes,
        generated_text=generated_text,
        theta=theta,
        binding=bool(config["binding"]),
    )
    if with_llm:
        row["run_type"] = "real_system_llm"
    return row


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--theta", type=float, default=0.6)
    parser.add_argument("--method", choices=sorted(METHOD_CONFIGS), required=True)
    parser.add_argument("--limit", type=int, default=1)
    parser.add_argument("--dry-run", action="store_true", default=True)
    parser.add_argument("--real", action="store_true", help="Attempt real collection after backend bindings are implemented.")
    parser.add_argument("--with-llm", action="store_true", help="Call the configured model after retrieval; default is retrieval-only fallback feedback.")
    return parser.parse_args(argv)


def main() -> int:
    args = parse_args()
    root = args.root.resolve()
    queries = read_queries(root, args.limit)
    if args.real:
        rag = NormGraphRAG.from_root(root)
        try:
            llm_generator = build_dashscope_llm_generator(root) if args.with_llm else None
            for query in queries:
                print(json.dumps(
                    build_real_row(
                        query,
                        args.method,
                        rag,
                        theta=args.theta,
                        with_llm=args.with_llm,
                        llm_generator=llm_generator,
                    ),
                    ensure_ascii=False,
                ))
        except RuntimeError as exc:
            print(str(exc), file=sys.stderr)
            return 2
        return 0
    for query in queries:
        print(json.dumps(build_dry_run_row(query, args.method, theta=args.theta), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
