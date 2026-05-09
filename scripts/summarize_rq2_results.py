#!/usr/bin/env python3
"""Summarize RQ2 JSONL outputs into thesis-table metrics."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


RQ2_DIR = Path("data/rq2_traceability")
METHODS = ["baseline_a", "baseline_b", "ablation_no_expand", "full_graphrag"]


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def safe_rate(numerator: int, denominator: int) -> float | None:
    if denominator == 0:
        return None
    return round(numerator / denominator, 3)


def summarize_method(method: str, rows: list[dict[str, Any]], queries: dict[str, dict[str, Any]]) -> dict[str, Any]:
    validation_total = exists_total = pass_total = 0
    generated_total = retrieved_total = low_conf_total = complete_total = 0
    retrieved_expected_hits = generated_expected_hits = expected_total = 0
    run_types = sorted({row.get("run_type", "") for row in rows})
    for row in rows:
        query = queries[row["query_id"]]
        expected = set(query["expected_ref_nodes"])
        if query["has_known_issue"]:
            expected_total += len(expected)
        retrieved = {node["node_id"] for node in row["retrieved_nodes"]}
        generated = set(row["generated_refs"])
        retrieved_expected_hits += len(retrieved & expected)
        generated_expected_hits += len(generated & expected)
        retrieved_total += len(row["retrieved_nodes"])
        generated_total += len(row["generated_refs"])
        low_conf_total += len(row.get("low_confidence_refs", []))
        complete_total += int(bool(row["feedback_structure_complete"]))
        for result in row["validation_results"].values():
            validation_total += 1
            exists_total += int(bool(result["exists"]))
            pass_total += int(bool(result["pass"]))
    row_count = len(rows)
    return {
        "method": method,
        "rows": row_count,
        "run_types": run_types,
        "avg_retrieved_nodes": round(retrieved_total / row_count, 3) if row_count else 0.0,
        "avg_generated_refs": round(generated_total / row_count, 3) if row_count else 0.0,
        "feedback_structure_complete_rate": safe_rate(complete_total, row_count),
        "validation_ref_count": validation_total,
        "node_exist_rate": safe_rate(exists_total, validation_total),
        "threshold_pass_rate": safe_rate(pass_total, validation_total),
        "retrieved_expected_coverage": safe_rate(retrieved_expected_hits, expected_total),
        "generated_expected_coverage": safe_rate(generated_expected_hits, expected_total),
        "low_confidence_ref_count": low_conf_total,
    }


def summarize(root: Path) -> list[dict[str, Any]]:
    queries = {query["query_id"]: query for query in read_json(root / RQ2_DIR / "query_set.json")}
    output_dir = root / RQ2_DIR / "system_outputs"
    return [
        summarize_method(method, read_jsonl(output_dir / f"{method}.jsonl"), queries)
        for method in METHODS
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    for row in summarize(args.root.resolve()):
        print(json.dumps(row, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
