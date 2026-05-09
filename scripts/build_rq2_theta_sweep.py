#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from rq2_traceability_lib import build_theta_sweep


RQ2_DIR = Path("data/rq2_traceability")
THETA_VALUES = [0.50, 0.55, 0.60, 0.65, 0.70]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    root = args.root.resolve()
    rows = [
        json.loads(line)
        for line in (root / RQ2_DIR / "system_outputs/full_graphrag.jsonl").read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    output = []
    for row in rows:
        output.append({
            "query_id": row["query_id"],
            "run_type": row.get("run_type", "real_system"),
            "theta_sweep": build_theta_sweep(row["validation_results"], theta_values=THETA_VALUES),
            "downgrade_trigger_count": len(row.get("low_confidence_refs", [])),
        })
    (root / RQ2_DIR / "theta_sweep.jsonl").write_text(
        "".join(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n" for row in output),
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
