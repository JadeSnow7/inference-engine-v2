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


RQ2_DIR = Path("data/rq2_traceability")
METHOD_CONFIGS = {
    "baseline_a": {"retrieval": False, "graph_expand": False, "binding": False},
    "baseline_b": {"retrieval": True, "graph_expand": False, "binding": False},
    "ablation_no_expand": {"retrieval": True, "graph_expand": False, "binding": True},
    "full_graphrag": {"retrieval": True, "graph_expand": True, "binding": True},
}


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


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--theta", type=float, default=0.6)
    parser.add_argument("--method", choices=sorted(METHOD_CONFIGS), required=True)
    parser.add_argument("--limit", type=int, default=1)
    parser.add_argument("--dry-run", action="store_true", default=True)
    parser.add_argument("--real", action="store_true", help="Attempt real collection after backend bindings are implemented.")
    return parser.parse_args(argv)


def main() -> int:
    args = parse_args()
    if args.real:
        raise SystemExit("real collection is not wired yet; implement backend bindings before using --real")
    root = args.root.resolve()
    queries = read_queries(root, args.limit)
    for query in queries:
        print(json.dumps(build_dry_run_row(query, args.method, theta=args.theta), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
