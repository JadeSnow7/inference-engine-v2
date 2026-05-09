#!/usr/bin/env python3
"""Generate deterministic offline-stub RQ2 traceability outputs.

This script exercises the experiment data pipeline only. It does not call an
LLM, GraphRAG service, or production API.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from rq2_traceability_lib import build_theta_sweep, validate_refs


RQ2_DIR = Path("data/rq2_traceability")
METHOD_FILES = {
    "baseline_a": "baseline_a.jsonl",
    "baseline_b": "baseline_b.jsonl",
    "ablation_no_expand": "ablation_no_expand.jsonl",
    "full_graphrag": "full_graphrag.jsonl",
}
THETA_VALUES = [0.50, 0.55, 0.60, 0.65, 0.70]


METHOD_PROFILES = {
    "baseline_a": {"ref_limit": 0, "base_score": 0.0, "graph_bonus": 0.0, "binding": False},
    "baseline_b": {"ref_limit": 1, "base_score": 0.56, "graph_bonus": 0.0, "binding": False},
    "ablation_no_expand": {"ref_limit": 1, "base_score": 0.62, "graph_bonus": 0.0, "binding": True},
    "full_graphrag": {"ref_limit": 3, "base_score": 0.66, "graph_bonus": 0.08, "binding": True},
}


def read_queries(root: Path) -> list[dict[str, Any]]:
    with (root / RQ2_DIR / "query_set.json").open("r", encoding="utf-8") as handle:
        return json.load(handle)


def score_for(query_id: str, index: int, method: str) -> float:
    profile = METHOD_PROFILES[method]
    deterministic_offset = ((sum(ord(ch) for ch in query_id) + index * 7) % 9) / 100
    return round(float(profile["base_score"]) + float(profile["graph_bonus"]) + deterministic_offset, 4)


def build_method_output(query: dict[str, Any], method: str, *, theta: float) -> dict[str, Any]:
    profile = METHOD_PROFILES[method]
    expected_refs = list(query.get("expected_ref_nodes", []))
    selected_refs = expected_refs[: int(profile["ref_limit"])]
    if not bool(profile["binding"]):
        validation_results: dict[str, dict[str, object]] = {}
        low_confidence_refs: list[str] = []
    else:
        node_scores = {
            ref: score_for(str(query["query_id"]), index, method)
            for index, ref in enumerate(selected_refs)
        }
        validation_results = validate_refs(selected_refs, node_scores, theta=theta)
        low_confidence_refs = [
            ref
            for ref, result in validation_results.items()
            if bool(result["exists"]) and not bool(result["pass"])
        ]

    retrieved_nodes = [
        {
            "node_id": ref,
            "cosine_similarity": validation_results.get(ref, {}).get("cosine", score_for(str(query["query_id"]), index, method)),
            "exists_in_kg": ref in expected_refs,
            "pass_threshold": bool(validation_results.get(ref, {}).get("pass", False)),
        }
        for index, ref in enumerate(selected_refs)
    ]
    generated_refs = selected_refs if bool(profile["binding"]) else []
    return {
        "method": method,
        "run_type": "offline_stub",
        "query_id": query["query_id"],
        "retrieved_nodes": retrieved_nodes,
        "generated_refs": generated_refs,
        "validation_results": validation_results,
        "low_confidence_refs": low_confidence_refs,
        "feedback_structure_complete": True,
        "theta_used": theta,
        "notes": "Deterministic offline stub for schema and pipeline validation; replace with real system outputs for thesis metrics.",
    }


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.write_text(
        "".join(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n" for row in rows),
        encoding="utf-8",
    )


def write_outputs(root: Path, *, theta: float) -> None:
    queries = read_queries(root)
    outputs_dir = root / RQ2_DIR / "system_outputs"
    outputs_dir.mkdir(parents=True, exist_ok=True)
    method_rows: dict[str, list[dict[str, Any]]] = {}
    for method, filename in METHOD_FILES.items():
        rows = [build_method_output(query, method, theta=theta) for query in queries]
        method_rows[method] = rows
        write_jsonl(outputs_dir / filename, rows)

    theta_rows = []
    for row in method_rows["full_graphrag"]:
        validation_results = row["validation_results"]
        theta_rows.append(
            {
                "query_id": row["query_id"],
                "run_type": "offline_stub",
                "theta_sweep": build_theta_sweep(validation_results, theta_values=THETA_VALUES),
                "downgrade_trigger_count": len(row["low_confidence_refs"]),
                "notes": "Theta sweep recalculated from deterministic offline-stub full_graphrag validation results.",
            }
        )
    write_jsonl(root / RQ2_DIR / "theta_sweep.jsonl", theta_rows)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--theta", type=float, default=0.6)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    write_outputs(args.root.resolve(), theta=args.theta)
    print("RQ2 offline-stub outputs written")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
