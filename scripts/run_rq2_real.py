#!/usr/bin/env python3
"""Collect real-system RQ2 outputs.

Default mode is dry-run. Real collection is intentionally blocked until backend
retrieval/generation bindings are wired in this script.
"""

from __future__ import annotations

import argparse
import json
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


def build_real_row(query: dict[str, Any], method: str, rag: NormGraphRAG, *, theta: float, with_llm: bool) -> dict[str, Any]:
    if with_llm:
        raise RuntimeError("LLM generation is not wired yet; run without --with-llm for retrieval/binding collection")
    config = METHOD_CONFIGS[method]
    retrieved_nodes = []
    if config["retrieval"]:
        retrieved_nodes = rag.retrieve(
            query["text"],
            top_k=1 if not config["graph_expand"] else 2,
            graph_expand=config["graph_expand"],
        )
    generated_text = build_fallback_feedback(query, retrieved_nodes)
    return build_retrieval_row(
        query=query,
        method=method,
        retrieved_nodes=retrieved_nodes,
        generated_text=generated_text,
        theta=theta,
        binding=bool(config["binding"]),
    )


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
        for query in queries:
            print(json.dumps(build_real_row(query, args.method, rag, theta=args.theta, with_llm=args.with_llm), ensure_ascii=False))
        return 0
    for query in queries:
        print(json.dumps(build_dry_run_row(query, args.method, theta=args.theta), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
