#!/usr/bin/env python3
"""Validate thesis evaluation data files.

The initial gate validates RQ2 query-set quality. The full gate also validates
system-output JSONL files and theta-sweep coverage after experiment runs.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


RQ2_DIR = Path("data/rq2_traceability")
REQUIRED_QUERY_FIELDS = {
    "query_id",
    "text",
    "ground_truth_issues",
    "expected_ref_nodes",
    "has_known_issue",
}
TRACEABILITY_METHOD_FILES = {
    "baseline_a": "baseline_a.jsonl",
    "baseline_b": "baseline_b.jsonl",
    "ablation_no_expand": "ablation_no_expand.jsonl",
    "full_graphrag": "full_graphrag.jsonl",
}
THETA_VALUES = [0.50, 0.55, 0.60, 0.65, 0.70]
DIMENSIONS = ("引用格式", "章节结构", "段落功能")


@dataclass(frozen=True)
class PIIMatch:
    kind: str
    value: str


PII_PATTERNS = {
    "email": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
    "phone": re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)"),
    "student_id": re.compile(r"\b(?:U|M|D)?\d{8,12}\b", re.IGNORECASE),
    "cn_id": re.compile(r"\b\d{17}[\dXx]\b"),
}


def find_pii(text: str) -> list[PIIMatch]:
    matches: list[PIIMatch] = []
    for kind, pattern in PII_PATTERNS.items():
        for match in pattern.findall(text):
            matches.append(PIIMatch(kind=kind, value=match))
    return matches


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            stripped = line.strip()
            if not stripped:
                continue
            try:
                row = json.loads(stripped)
            except json.JSONDecodeError as exc:
                raise ValueError(f"{path}:{line_number} is not valid JSON: {exc}") from exc
            if not isinstance(row, dict):
                raise ValueError(f"{path}:{line_number} must be a JSON object")
            rows.append(row)
    return rows


def count_words(text: str) -> int:
    return len(re.findall(r"[A-Za-z]+(?:[-'][A-Za-z]+)?", text))


def validate_query_set(
    root: Path,
    *,
    min_queries: int = 20,
    min_controls: int = 5,
    min_dimension_coverage: int = 5,
    word_min: int = 150,
    word_max: int = 300,
) -> list[str]:
    issues: list[str] = []
    path = root / RQ2_DIR / "query_set.json"
    if not path.exists():
        return [f"missing file: {path}"]

    try:
        queries = read_json(path)
    except json.JSONDecodeError as exc:
        return [f"{path} is not valid JSON: {exc}"]

    if not isinstance(queries, list):
        return [f"{path} must contain a JSON array"]

    if len(queries) < min_queries:
        issues.append(f"query_set has {len(queries)} records, expected at least {min_queries}")

    seen_ids: set[str] = set()
    control_count = 0
    dimension_counts = {dimension: 0 for dimension in DIMENSIONS}

    for index, query in enumerate(queries, start=1):
        if not isinstance(query, dict):
            issues.append(f"query #{index} must be a JSON object")
            continue

        query_id = query.get("query_id", f"#{index}")
        missing = sorted(REQUIRED_QUERY_FIELDS - set(query))
        if missing:
            issues.append(f"{query_id} missing required fields: {', '.join(missing)}")
            continue

        if query_id in seen_ids:
            issues.append(f"duplicate query_id: {query_id}")
        seen_ids.add(str(query_id))

        text = query["text"]
        if not isinstance(text, str) or not text.strip():
            issues.append(f"{query_id} text must be a non-empty string")
        else:
            word_count = count_words(text)
            if word_count < word_min or word_count > word_max:
                issues.append(f"{query_id} word_count={word_count}, expected {word_min}-{word_max}")
            pii_matches = find_pii(text)
            if pii_matches:
                pii_summary = ", ".join(f"{match.kind}:{match.value}" for match in pii_matches)
                issues.append(f"{query_id} contains possible PII: {pii_summary}")

        ground_truth = query["ground_truth_issues"]
        expected_refs = query["expected_ref_nodes"]
        has_known_issue = query["has_known_issue"]
        if not isinstance(ground_truth, list):
            issues.append(f"{query_id} ground_truth_issues must be a list")
        if not isinstance(expected_refs, list):
            issues.append(f"{query_id} expected_ref_nodes must be a list")
        if not isinstance(has_known_issue, bool):
            issues.append(f"{query_id} has_known_issue must be boolean")

        if has_known_issue:
            if isinstance(ground_truth, list) and len(ground_truth) == 0:
                issues.append(f"{query_id} has_known_issue=true but ground_truth_issues is empty")
            if isinstance(expected_refs, list) and len(expected_refs) == 0:
                issues.append(f"{query_id} has_known_issue=true but expected_ref_nodes is empty")
        else:
            control_count += 1
            if ground_truth:
                issues.append(f"{query_id} control query should have empty ground_truth_issues")
            if expected_refs:
                issues.append(f"{query_id} control query should have empty expected_ref_nodes")

        if isinstance(ground_truth, list):
            for issue in ground_truth:
                if not isinstance(issue, str):
                    issues.append(f"{query_id} ground_truth_issues entries must be strings")
                    continue
                for dimension in DIMENSIONS:
                    if issue.startswith(dimension):
                        dimension_counts[dimension] += 1

    if control_count < min_controls:
        issues.append(f"control queries={control_count}, expected at least {min_controls}")

    for dimension, count in dimension_counts.items():
        if count < min_dimension_coverage:
            issues.append(
                f"dimension '{dimension}' coverage={count}, expected at least {min_dimension_coverage}"
            )

    return issues


def validate_system_outputs(root: Path, query_ids: set[str]) -> list[str]:
    issues: list[str] = []
    outputs_dir = root / RQ2_DIR / "system_outputs"
    for method, filename in TRACEABILITY_METHOD_FILES.items():
        path = outputs_dir / filename
        if not path.exists():
            issues.append(f"missing system output for {method}: {path}")
            continue
        try:
            rows = read_jsonl(path)
        except ValueError as exc:
            issues.append(str(exc))
            continue
        if len(rows) < len(query_ids):
            issues.append(f"{filename} has {len(rows)} rows, expected at least {len(query_ids)}")
        seen = {str(row.get("query_id")) for row in rows}
        missing_queries = sorted(query_ids - seen)
        if missing_queries:
            issues.append(f"{filename} missing query outputs: {', '.join(missing_queries)}")
        for row in rows:
            row_id = row.get("query_id", "<missing>")
            if row.get("method") != method:
                issues.append(f"{filename}:{row_id} method must be '{method}'")
            for field in ("retrieved_nodes", "generated_refs", "validation_results", "feedback_structure_complete"):
                if field not in row:
                    issues.append(f"{filename}:{row_id} missing field: {field}")
    return issues


def validate_theta_sweep(root: Path, query_ids: set[str]) -> list[str]:
    issues: list[str] = []
    path = root / RQ2_DIR / "theta_sweep.jsonl"
    if not path.exists():
        return [f"missing file: {path}"]
    try:
        rows = read_jsonl(path)
    except ValueError as exc:
        return [str(exc)]
    seen = {str(row.get("query_id")) for row in rows}
    missing_queries = sorted(query_ids - seen)
    if missing_queries:
        issues.append(f"theta_sweep missing query outputs: {', '.join(missing_queries)}")
    for row in rows:
        query_id = row.get("query_id", "<missing>")
        sweep = row.get("theta_sweep")
        if not isinstance(sweep, list):
            issues.append(f"theta_sweep:{query_id} theta_sweep must be a list")
            continue
        values = sorted(round(float(item.get("theta")), 2) for item in sweep if isinstance(item, dict) and "theta" in item)
        if values != THETA_VALUES:
            issues.append(f"theta_sweep:{query_id} theta values={values}, expected {THETA_VALUES}")
        if "downgrade_trigger_count" not in row:
            issues.append(f"theta_sweep:{query_id} missing downgrade_trigger_count")
    return issues


def load_query_ids(root: Path) -> set[str]:
    queries = read_json(root / RQ2_DIR / "query_set.json")
    return {str(query["query_id"]) for query in queries if isinstance(query, dict) and "query_id" in query}


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--scope", choices=("query-set", "full"), default="query-set")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    root = args.root.resolve()

    issues = validate_query_set(root)
    if args.scope == "full" and not issues:
        query_ids = load_query_ids(root)
        issues.extend(validate_system_outputs(root, query_ids))
        issues.extend(validate_theta_sweep(root, query_ids))

    if issues:
        print("Evaluation data validation failed:")
        for issue in issues:
            print(f"- {issue}")
        return 1

    print(f"Evaluation data validation passed for scope={args.scope}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
