#!/usr/bin/env python3
"""Shared helpers for RQ2 traceability experiment data generation."""

from __future__ import annotations

import re
from typing import Iterable


REF_PATTERN = re.compile(r"\[REF:([A-Za-z0-9_-]+)\]")


def extract_refs(text: str) -> list[str]:
    refs: list[str] = []
    seen: set[str] = set()
    for match in REF_PATTERN.finditer(text):
        ref = match.group(1)
        if ref not in seen:
            refs.append(ref)
            seen.add(ref)
    return refs


def validate_refs(refs: Iterable[str], node_scores: dict[str, float], *, theta: float) -> dict[str, dict[str, object]]:
    results: dict[str, dict[str, object]] = {}
    for ref in refs:
        exists = ref in node_scores
        cosine = round(float(node_scores.get(ref, 0.0)), 4)
        results[ref] = {
            "exists": exists,
            "cosine": cosine,
            "pass": bool(exists and cosine >= theta),
        }
    return results


def build_theta_sweep(
    validation_results: dict[str, dict[str, object]],
    *,
    theta_values: Iterable[float],
) -> list[dict[str, float]]:
    total = len(validation_results)
    if total == 0:
        return [{"theta": round(float(theta), 2), "pass_rate": 0.0, "node_exist_rate": 0.0} for theta in theta_values]
    node_exist_count = sum(1 for result in validation_results.values() if bool(result.get("exists")))
    sweep: list[dict[str, float]] = []
    for theta in theta_values:
        theta_float = round(float(theta), 2)
        pass_count = sum(
            1
            for result in validation_results.values()
            if bool(result.get("exists")) and float(result.get("cosine", 0.0)) >= theta_float
        )
        sweep.append(
            {
                "theta": theta_float,
                "pass_rate": pass_count / total,
                "node_exist_rate": node_exist_count / total,
            }
        )
    return sweep
