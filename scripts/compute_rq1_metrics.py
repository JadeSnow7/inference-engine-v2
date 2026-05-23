#!/usr/bin/env python3
"""Compute lightweight RQ1 KG quality inventory metrics for paper tables."""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path
from typing import Any


RQ1_DIR = Path("data/rq1_kg_quality")


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def safe_rate(numerator: int, denominator: int) -> float:
    return round(numerator / denominator, 4) if denominator else 0.0


def edge_key(edge: dict[str, Any]) -> tuple[str, str, str]:
    return (str(edge["source_id"]), str(edge["target_id"]), str(edge["relation_type"]))


def relation_prf(gold_edges: list[dict[str, Any]], predicted_edges: list[dict[str, Any]] | None = None) -> dict[str, float]:
    predicted_edges = predicted_edges if predicted_edges is not None else gold_edges
    gold = {edge_key(edge) for edge in gold_edges}
    pred = {edge_key(edge) for edge in predicted_edges}
    hit = len(gold & pred)
    precision = safe_rate(hit, len(pred))
    recall = safe_rate(hit, len(gold))
    f1 = round((2 * precision * recall / (precision + recall)), 4) if precision + recall else 0.0
    return {"precision": precision, "recall": recall, "f1": f1}


def compute(root: Path) -> dict[str, Any]:
    nodes = read_json(root / RQ1_DIR / "kg_gold_nodes.json")
    edges = read_json(root / RQ1_DIR / "kg_gold_edges.json")
    sources = read_json(root / RQ1_DIR / "source_registry.json")
    required_dimensions = {
        "citation_format",
        "section_structure",
        "paragraph_function",
        "argument_coherence",
        "evidence_integration",
        "academic_style",
    }
    dimensions = Counter(str(node["dimension"]) for node in nodes)
    node_types = Counter(str(node["node_type"]) for node in nodes)
    relation_types = Counter(str(edge["relation_type"]) for edge in edges)
    covered_dimensions = set(dimensions)
    return {
        "node_count": len(nodes),
        "edge_count": len(edges),
        "source_count": len(sources),
        "node_type_counts": dict(sorted(node_types.items())),
        "dimension_counts": dict(sorted(dimensions.items())),
        "relation_type_counts": dict(sorted(relation_types.items())),
        "dimension_coverage": safe_rate(len(covered_dimensions & required_dimensions), len(required_dimensions)),
        "relation_prf_against_gold": relation_prf(edges),
        "claim_boundary": "RQ1 reports auditable compact KG inventory and gold-schema readiness; agreement values require completed double annotation.",
    }


def render_tex(report: dict[str, Any]) -> str:
    lines = [
        "\\begin{tabular}{lrr}",
        "\\toprule",
        "Aspect & Metric & Value \\\\",
        "\\midrule",
        f"Gold KG & Nodes & {report['node_count']} \\\\",
        f"Gold KG & Edges & {report['edge_count']} \\\\",
        f"Sources & Registry entries & {report['source_count']} \\\\",
        f"Dimensions & Coverage & {report['dimension_coverage']:.3f} \\\\",
        f"Relations & Precision & {report['relation_prf_against_gold']['precision']:.3f} \\\\",
        f"Relations & Recall & {report['relation_prf_against_gold']['recall']:.3f} \\\\",
        f"Relations & F1 & {report['relation_prf_against_gold']['f1']:.3f} \\\\",
        "\\bottomrule",
        "\\end{tabular}",
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    root = args.root.resolve()
    report = compute(root)
    write_json(root / "outputs" / "rq1_kg_metrics.json", report)
    table_path = root / "paper_tables" / "rq1_kg_quality.tex"
    table_path.parent.mkdir(parents=True, exist_ok=True)
    table_path.write_text(render_tex(report), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
