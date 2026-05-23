#!/usr/bin/env python3
"""Compute RQ2 groundedness metrics and paper tables from real-system outputs."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from statistics import median
from typing import Any


RQ2_DIR = Path("data/rq2_traceability")
METHODS = ["baseline_a", "baseline_b", "ablation_no_expand", "full_graphrag"]
PAPER_RUN_TYPES = {"real", "real_system", "real_system_llm"}


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def rate(numerator: int | float, denominator: int | float) -> float | None:
    if denominator == 0:
        return None
    return round(float(numerator) / float(denominator), 4)


def percentile(values: list[float], pct: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    if len(ordered) == 1:
        return round(ordered[0], 3)
    position = (len(ordered) - 1) * pct
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return round(ordered[int(position)], 3)
    weight = position - lower
    return round(ordered[lower] * (1 - weight) + ordered[upper] * weight, 3)


def normalize_query(row: dict[str, Any]) -> dict[str, Any]:
    expected_refs = row.get("expected_refs")
    if expected_refs is None:
        expected_refs = row.get("expected_ref_nodes", [])
    expected_issue_types = row.get("expected_issue_types")
    if expected_issue_types is None:
        expected_issue_types = row.get("ground_truth_issues", [])
    return {
        **row,
        "expected_refs": list(expected_refs or []),
        "expected_issue_types": list(expected_issue_types or []),
        "is_control": bool(row.get("is_control", not bool(row.get("has_known_issue", False)))),
    }


def validate_rows_for_paper_results(method: str, rows: list[dict[str, Any]]) -> None:
    for idx, row in enumerate(rows, start=1):
        run_type = str(row.get("run_type", ""))
        if run_type not in PAPER_RUN_TYPES:
            raise ValueError(
                f"{method} row {idx} query_id={row.get('query_id')} has run_type={run_type!r}; "
                "paper metrics require real outputs, not offline stubs or dry runs"
            )


def has_corrective_feedback(row: dict[str, Any]) -> bool:
    if row.get("generated_refs") or row.get("validation_results"):
        return True
    text = str(row.get("raw_feedback") or "").lower()
    corrective_markers = (
        "问题定位",
        "修改建议",
        "should",
        "needs",
        "revise",
        "missing",
        "incorrect",
        "不应",
        "缺少",
        "建议",
    )
    benign_markers = ("no corrective issue", "no issue", "无需修改", "未发现明显问题")
    if any(marker in text for marker in benign_markers):
        return False
    return any(marker.lower() in text for marker in corrective_markers)


def summarize_method(method: str, rows: list[dict[str, Any]], queries: dict[str, dict[str, Any]]) -> dict[str, Any]:
    validate_rows_for_paper_results(method, rows)

    expected_total = expected_retrieved_hits = expected_generated_hits = 0
    issue_queries = issue_queries_with_expected_retrieved = 0
    retrieved_total = irrelevant_retrieved = 0
    generated_total = exists_total = valid_total = hallucinated_total = 0
    low_conf_total = complete_total = failure_total = schema_valid_total = 0
    control_total = control_false_alarm_total = 0
    missing_issue_total = expected_issue_total = 0
    latencies: list[float] = []
    total_tokens = 0

    for row in rows:
        query = queries[row["query_id"]]
        expected_refs = set(query.get("expected_refs", []))
        expected_issues = set(query.get("expected_issue_types", []))
        retrieved_ids = {str(node.get("node_id")) for node in row.get("retrieved_nodes", []) if node.get("node_id")}
        generated_refs = {str(ref) for ref in row.get("generated_refs", [])}

        schema_valid_total += int(all(key in row for key in (
            "method",
            "query_id",
            "retrieved_nodes",
            "generated_refs",
            "validation_results",
            "low_confidence_refs",
            "feedback_structure_complete",
        )))
        failure_total += int(bool(row.get("error")))
        complete_total += int(bool(row.get("feedback_structure_complete")))
        retrieved_total += len(retrieved_ids)
        irrelevant_retrieved += len(retrieved_ids - expected_refs) if expected_refs else len(retrieved_ids)
        generated_total += len(generated_refs)
        low_conf_total += len(row.get("low_confidence_refs", []))

        if query.get("has_known_issue", bool(expected_refs or expected_issues)):
            issue_queries += 1
            expected_total += len(expected_refs)
            expected_retrieved_hits += len(retrieved_ids & expected_refs)
            expected_generated_hits += len(generated_refs & expected_refs)
            if retrieved_ids & expected_refs:
                issue_queries_with_expected_retrieved += 1
            expected_issue_total += len(expected_issues)
            if expected_issues and not has_corrective_feedback(row):
                missing_issue_total += len(expected_issues)

        if query.get("is_control", False):
            control_total += 1
            control_false_alarm_total += int(has_corrective_feedback(row))

        validation = row.get("validation_results", {})
        for ref in generated_refs:
            result = validation.get(ref, {})
            exists = bool(result.get("exists"))
            passed = bool(result.get("pass"))
            exists_total += int(exists)
            valid_total += int(passed)
            hallucinated_total += int(not exists)

        latency = row.get("latency_ms")
        if isinstance(latency, (int, float)):
            latencies.append(float(latency))
        token_usage = row.get("token_usage")
        if isinstance(token_usage, dict):
            total = token_usage.get("total_tokens")
            if isinstance(total, (int, float)):
                total_tokens += int(total)

    row_count = len(rows)
    p50 = percentile(latencies, 0.50)
    p95 = percentile(latencies, 0.95)
    return {
        "method": method,
        "rows": row_count,
        "retrieved_node_count": retrieved_total,
        "irrelevant_node_count": irrelevant_retrieved,
        "generated_ref_count": generated_total,
        "hallucinated_ref_count": hallucinated_total,
        "valid_generated_ref_count": valid_total,
        "low_confidence_ref_count": low_conf_total,
        "control_false_alarm_count": control_false_alarm_total,
        "missing_issue_count": missing_issue_total,
        "schema_compliance_rate": rate(schema_valid_total, row_count),
        "failure_rate": rate(failure_total, row_count),
        "expected_ref_recall": rate(expected_retrieved_hits, expected_total),
        "retrieved_node_coverage": rate(issue_queries_with_expected_retrieved, issue_queries),
        "generated_expected_coverage": rate(expected_generated_hits, expected_total),
        "irrelevant_node_rate": rate(irrelevant_retrieved, retrieved_total),
        "grounded_ref_precision": rate(valid_total, generated_total),
        "hallucinated_ref_rate": rate(hallucinated_total, generated_total),
        "generated_ref_existence_rate": rate(exists_total, generated_total),
        "generated_ref_validity_rate": rate(valid_total, generated_total),
        "low_confidence_ref_rate": rate(low_conf_total, generated_total),
        "threshold_pass_rate": rate(valid_total, generated_total),
        "structure_complete_rate": rate(complete_total, row_count),
        "control_false_alarm_rate": rate(control_false_alarm_total, control_total),
        "false_positive_rate": rate(control_false_alarm_total, control_total),
        "missing_issue_rate": rate(missing_issue_total, expected_issue_total),
        "p50_latency_ms": p50,
        "p95_latency_ms": p95,
        "total_tokens": total_tokens,
        "avg_tokens": round(total_tokens / row_count, 3) if row_count else None,
        "run_types": sorted({str(row.get("run_type", "")) for row in rows}),
    }


def load_queries(root: Path) -> dict[str, dict[str, Any]]:
    path = root / RQ2_DIR / "query_set_v2.json"
    if not path.exists():
        path = root / RQ2_DIR / "query_set.json"
    return {row["query_id"]: normalize_query(row) for row in read_json(path)}


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# RQ2 Groundedness Metrics",
        "",
        f"- Run ID: `{report['run_manifest'].get('run_id', 'unknown')}`",
        f"- Run Type: `{report['run_manifest'].get('run_type', 'unknown')}`",
        f"- Query Set Hash: `{report['run_manifest'].get('query_set_hash', 'unknown')}`",
        "",
        "| Method | Expected Ref Recall | Grounded Ref Precision | Hallucinated Ref Rate | Threshold Pass Rate | Low Confidence Rate | False Positive Rate |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    for row in report["methods"]:
        lines.append(
            "| {method} | {expected_ref_recall} | {grounded_ref_precision} | {hallucinated_ref_rate} | "
            "{threshold_pass_rate} | {low_confidence_ref_rate} | {false_positive_rate} |".format(
                **{key: ("N/A" if value is None else value) for key, value in row.items()}
            )
        )
    return "\n".join(lines) + "\n"


def tex_value(value: Any) -> str:
    if value is None:
        return "--"
    if isinstance(value, float):
        return f"{value:.3f}"
    return str(value)


def render_main_results_tex(methods: list[dict[str, Any]]) -> str:
    lines = [
        "\\begin{tabular}{lrrrrrr}",
        "\\toprule",
        "Method & Ref Recall & Grounded Prec. & Halluc. Rate & Pass Rate & Low Conf. & FPR \\\\",
        "\\midrule",
    ]
    for row in methods:
        lines.append(
            "{method} & {ref} & {prec} & {hall} & {passed} & {low} & {fpr} \\\\".format(
                method=row["method"].replace("_", "\\_"),
                ref=tex_value(row["expected_ref_recall"]),
                prec=tex_value(row["grounded_ref_precision"]),
                hall=tex_value(row["hallucinated_ref_rate"]),
                passed=tex_value(row["threshold_pass_rate"]),
                low=tex_value(row["low_confidence_ref_rate"]),
                fpr=tex_value(row["false_positive_rate"]),
            )
        )
    lines.extend(["\\bottomrule", "\\end{tabular}", ""])
    return "\n".join(lines)


def render_ablation_tex(report: dict[str, Any]) -> str:
    by_method = {row["method"]: row for row in report["methods"]}
    lines = [
        "\\begin{tabular}{lrrr}",
        "\\toprule",
        "Comparison & Metric & Left & Right \\\\",
        "\\midrule",
        "Full GraphRAG vs No Expand & Expected ref recall & {full} & {abl} \\\\".format(
            full=tex_value(by_method["full_graphrag"]["expected_ref_recall"]),
            abl=tex_value(by_method["ablation_no_expand"]["expected_ref_recall"]),
        ),
        "Graph expansion gain & Recall delta & {gain} & -- \\\\".format(
            gain=tex_value(report["ablation"]["graph_expansion_gain"]),
        ),
        "\\bottomrule",
        "\\end{tabular}",
        "",
    ]
    return "\n".join(lines)


def render_error_taxonomy_tex(root: Path, methods: list[dict[str, Any]]) -> str:
    taxonomy_path = root / RQ2_DIR / "error_taxonomy.json"
    taxonomy = read_json(taxonomy_path) if taxonomy_path.exists() else []
    full = next((row for row in methods if row["method"] == "full_graphrag"), methods[-1])
    counts = {
        "hallucinated_citation": full["hallucinated_ref_count"],
        "invalid_node_reference": full["low_confidence_ref_count"],
        "missing_expected_issue": full["missing_issue_count"],
        "overcorrection": full["control_false_alarm_count"],
        "irrelevant_retrieved_node": full["irrelevant_node_count"],
    }
    lines = [
        "\\begin{tabular}{lrl}",
        "\\toprule",
        "Error Type & Auto Count & Review Required \\\\",
        "\\midrule",
    ]
    for item in taxonomy:
        error_type = item["error_type"]
        lines.append(
            "{etype} & {count} & {review} \\\\".format(
                etype=error_type.replace("_", "\\_"),
                count=counts.get(error_type, "--"),
                review="yes" if item.get("requires_human_review") else "no",
            )
        )
    lines.extend(["\\bottomrule", "\\end{tabular}", ""])
    return "\n".join(lines)


def load_theta_sensitivity(root: Path) -> dict[str, Any]:
    path = root / RQ2_DIR / "theta_sweep.jsonl"
    if not path.exists():
        return {"rows": [], "summary": []}
    rows = read_jsonl(path)
    buckets: dict[float, list[float]] = {}
    for row in rows:
        if row.get("run_type") not in PAPER_RUN_TYPES:
            raise ValueError("theta_sweep contains non-real run_type")
        for item in row.get("theta_sweep", []):
            theta = round(float(item["theta"]), 2)
            buckets.setdefault(theta, []).append(float(item.get("pass_rate", 0.0)))
    summary = [
        {"theta": theta, "avg_pass_rate": round(sum(values) / len(values), 4) if values else 0.0}
        for theta, values in sorted(buckets.items())
    ]
    return {"rows": rows, "summary": summary}


def render_theta_markdown(theta_report: dict[str, Any]) -> str:
    lines = [
        "# RQ2 Theta Sensitivity",
        "",
        "| Theta | Average Pass Rate |",
        "|---:|---:|",
    ]
    for row in theta_report["summary"]:
        lines.append(f"| {row['theta']:.2f} | {row['avg_pass_rate']:.4f} |")
    return "\n".join(lines) + "\n"


def compute_and_write(root: Path) -> dict[str, Any]:
    queries = load_queries(root)
    manifest_path = root / RQ2_DIR / "run_manifest.json"
    manifest = read_json(manifest_path) if manifest_path.exists() else {"run_id": "unknown", "run_type": "real"}
    if manifest.get("offline_stub_allowed") is True or manifest.get("run_type") not in {"real", "real_system", "real_system_llm"}:
        raise ValueError("run_manifest must describe real paper-result outputs with offline_stub_allowed=false")

    output_dir = root / RQ2_DIR / "system_outputs"
    method_summaries = [
        summarize_method(method, read_jsonl(output_dir / f"{method}.jsonl"), queries)
        for method in METHODS
    ]
    method_by_name = {row["method"]: row for row in method_summaries}
    graph_expansion_gain = None
    if method_by_name["full_graphrag"]["expected_ref_recall"] is not None and method_by_name["ablation_no_expand"]["expected_ref_recall"] is not None:
        graph_expansion_gain = round(
            method_by_name["full_graphrag"]["expected_ref_recall"]
            - method_by_name["ablation_no_expand"]["expected_ref_recall"],
            4,
        )
    report = {
        "run_manifest": manifest,
        "query_count": len(queries),
        "methods": method_summaries,
        "ablation": {"graph_expansion_gain": graph_expansion_gain},
    }
    theta_report = load_theta_sensitivity(root)

    outputs_dir = root / "outputs"
    paper_dir = root / "paper_tables"
    write_json(outputs_dir / "rq2_metrics.json", report)
    write_json(outputs_dir / "theta_sensitivity.json", theta_report)
    (outputs_dir / "rq2_metrics.md").write_text(render_markdown(report), encoding="utf-8")
    (outputs_dir / "theta_sensitivity.md").write_text(render_theta_markdown(theta_report), encoding="utf-8")
    paper_dir.mkdir(parents=True, exist_ok=True)
    (paper_dir / "rq2_main_results.tex").write_text(render_main_results_tex(method_summaries), encoding="utf-8")
    (paper_dir / "rq2_ablation.tex").write_text(render_ablation_tex(report), encoding="utf-8")
    (paper_dir / "rq2_error_taxonomy.tex").write_text(render_error_taxonomy_tex(root, method_summaries), encoding="utf-8")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    report = compute_and_write(args.root.resolve())
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
