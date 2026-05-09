# RQ2 Real System Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current offline-stub RQ2 outputs with a real-system collection harness that records real LLM calls, embedding similarities, GraphRAG-style retrieval/binding decisions, and theta sensitivity data.

**Architecture:** Keep the existing offline stub as a dry-run path, and add a separate `scripts/run_rq2_real.py` harness. The real harness reads `query_set.json`, runs exactly one method per invocation via `--method`, writes/prints rows compatible with `system_outputs/{method}.jsonl`, saves raw generated feedback separately, and reuses `rq2_traceability_lib.py` for `[REF:...]` parsing and theta sweep calculation. Because the public `/api/chat` endpoint does not expose the four ablation methods, the harness should run inside the repo and call backend components or deterministic retrieval utilities directly, while using the configured model provider only for generation.

**Tech Stack:** Python 3.11, backend modules, DashScope/OpenAI-compatible model wrapper already configured in the project, JSON/JSONL, standard-library `unittest`. No `.env` contents are printed.

---

## Scope Notes

- P0-A KG five-class node count requires manual audit output. This plan only adds a small input template and a validator; it cannot invent audited counts.
- P0-B real RQ2 output is the main executable target.
- The first implementation pass should support `--method`, `--dry-run`, and `--limit` so one method and one query can be tested before running all 20.
- Generated JSONL rows with `"run_type": "real_system"` are intended to replace offline-stub rows only after validation passes.

---

### Task 1: Add Real-Run Schema Tests And Shared Summarizer

**Files:**
- Create: `scripts/summarize_rq2_results.py`
- Create: `scripts/tests/test_summarize_rq2_results.py`
- Modify: `data/rq2_traceability/README.md`

- [ ] **Step 1: Write failing summarizer tests**

Create `scripts/tests/test_summarize_rq2_results.py`:

```python
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "summarize_rq2_results.py"
spec = importlib.util.spec_from_file_location("summarize_rq2_results", SCRIPT_PATH)
summary = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules["summarize_rq2_results"] = summary
spec.loader.exec_module(summary)


class SummarizeRQ2ResultsTest(unittest.TestCase):
    def test_summarizes_method_metrics(self):
        rows = [
            {
                "query_id": "Q001",
                "retrieved_nodes": [{"node_id": "A"}],
                "generated_refs": ["A"],
                "validation_results": {"A": {"exists": True, "cosine": 0.72, "pass": True}},
                "low_confidence_refs": [],
                "feedback_structure_complete": True,
            },
            {
                "query_id": "Q002",
                "retrieved_nodes": [],
                "generated_refs": [],
                "validation_results": {},
                "low_confidence_refs": [],
                "feedback_structure_complete": True,
            },
        ]
        queries = {
            "Q001": {"expected_ref_nodes": ["A"], "has_known_issue": True},
            "Q002": {"expected_ref_nodes": [], "has_known_issue": False},
        }

        result = summary.summarize_method("full_graphrag", rows, queries)

        self.assertEqual(result["method"], "full_graphrag")
        self.assertEqual(result["rows"], 2)
        self.assertEqual(result["avg_retrieved_nodes"], 0.5)
        self.assertEqual(result["avg_generated_refs"], 0.5)
        self.assertEqual(result["node_exist_rate"], 1.0)
        self.assertEqual(result["threshold_pass_rate"], 1.0)
        self.assertEqual(result["generated_expected_coverage"], 1.0)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
python3 /app/inference-engine/scripts/tests/test_summarize_rq2_results.py
```

Expected: fails because `scripts/summarize_rq2_results.py` does not exist.

- [ ] **Step 3: Implement summarizer**

Create `scripts/summarize_rq2_results.py`:

```python
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
```

- [ ] **Step 4: Run tests and summarize current outputs**

Run:

```bash
python3 /app/inference-engine/scripts/tests/test_summarize_rq2_results.py
python3 /app/inference-engine/scripts/summarize_rq2_results.py --root /app/inference-engine
```

Expected: test passes and prints four JSON summary rows.

- [ ] **Step 5: Commit**

Run:

```bash
git -C /app/inference-engine add scripts/summarize_rq2_results.py scripts/tests/test_summarize_rq2_results.py
git -C /app/inference-engine commit -m "Add RQ2 result summarizer"
```

### Task 2: Add KG Audit Count Input Template For P0-A

**Files:**
- Create: `data/rq1_kg_quality/kg_node_counts.csv`
- Modify: `scripts/validate_eval_data.py`
- Modify: `scripts/tests/test_validate_eval_data.py`

- [ ] **Step 1: Add placeholder-free CSV template**

Create `data/rq1_kg_quality/kg_node_counts.csv`:

```csv
node_type,count,audit_status,notes
规范条款,0,pending,Replace count after manual audit.
示例片段,0,pending,Replace count after manual audit.
违例模式,0,pending,Replace count after manual audit.
修改建议,0,pending,Replace count after manual audit.
评价维度,0,pending,Replace count after manual audit.
```

- [ ] **Step 2: Add validator test**

Add a test that writes a valid five-row CSV and calls `validate_kg_node_counts(tmp_path, require_completed=False)`, expecting no errors.

- [ ] **Step 3: Implement CSV validator**

In `scripts/validate_eval_data.py`, add:

```python
import csv

REQUIRED_KG_NODE_TYPES = ("规范条款", "示例片段", "违例模式", "修改建议", "评价维度")

def validate_kg_node_counts(root: Path, *, require_completed: bool = False) -> list[str]:
    path = root / "data/rq1_kg_quality/kg_node_counts.csv"
    if not path.exists():
        return [f"missing file: {path}"]
    with path.open("r", encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    issues = []
    seen = {row.get("node_type", "") for row in rows}
    for node_type in REQUIRED_KG_NODE_TYPES:
        if node_type not in seen:
            issues.append(f"kg_node_counts missing node_type: {node_type}")
    for row in rows:
        node_type = row.get("node_type", "")
        try:
            count = int(row.get("count", ""))
        except ValueError:
            issues.append(f"kg_node_counts:{node_type} count must be integer")
            continue
        if count < 0:
            issues.append(f"kg_node_counts:{node_type} count must be non-negative")
        if require_completed and row.get("audit_status") != "completed":
            issues.append(f"kg_node_counts:{node_type} audit_status must be completed")
    return issues
```

Wire it into CLI as `--scope kg-counts`.

- [ ] **Step 4: Run validation**

Run:

```bash
python3 /app/inference-engine/scripts/tests/test_validate_eval_data.py
python3 /app/inference-engine/scripts/validate_eval_data.py --root /app/inference-engine --scope kg-counts
```

Expected: tests pass and `kg-counts` scope passes with pending counts. It must not claim P0-A is complete.

- [ ] **Step 5: Commit**

Run:

```bash
git -C /app/inference-engine add data/rq1_kg_quality/kg_node_counts.csv scripts/validate_eval_data.py scripts/tests/test_validate_eval_data.py
git -C /app/inference-engine commit -m "Add KG node count audit template"
```

### Task 3: Add Real RQ2 Harness Skeleton

**Files:**
- Create: `scripts/run_rq2_real.py`
- Create: `scripts/tests/test_run_rq2_real.py`
- Modify: `data/rq2_traceability/README.md`

- [ ] **Step 1: Write tests for safe command construction**

Create `scripts/tests/test_run_rq2_real.py`:

```python
import importlib.util
import sys
import unittest
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_DIR))
SCRIPT_PATH = SCRIPTS_DIR / "run_rq2_real.py"
spec = importlib.util.spec_from_file_location("run_rq2_real", SCRIPT_PATH)
real = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules["run_rq2_real"] = real
spec.loader.exec_module(real)


class RunRQ2RealTest(unittest.TestCase):
    def test_method_config_declares_four_methods(self):
        self.assertEqual(sorted(real.METHOD_CONFIGS), ["ablation_no_expand", "baseline_a", "baseline_b", "full_graphrag"])
        self.assertFalse(real.METHOD_CONFIGS["baseline_a"]["retrieval"])
        self.assertTrue(real.METHOD_CONFIGS["full_graphrag"]["graph_expand"])
        self.assertTrue(real.METHOD_CONFIGS["full_graphrag"]["binding"])

    def test_parse_method_allows_single_method_selection(self):
        args = real.parse_args(["--method", "baseline_b", "--limit", "2"])

        self.assertEqual(args.method, "baseline_b")
        self.assertEqual(args.limit, 2)

    def test_dry_run_row_uses_real_system_dry_run_type(self):
        query = {"query_id": "Q001", "text": "sample", "expected_ref_nodes": ["A"]}
        row = real.build_dry_run_row(query, "full_graphrag", theta=0.6)

        self.assertEqual(row["run_type"], "real_system_dry_run")
        self.assertEqual(row["method"], "full_graphrag")
        self.assertEqual(row["theta_used"], 0.6)
        self.assertEqual(row["generated_refs"], [])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
python3 /app/inference-engine/scripts/tests/test_run_rq2_real.py
```

Expected: fails because `scripts/run_rq2_real.py` does not exist.

- [ ] **Step 3: Implement safe skeleton**

Create `scripts/run_rq2_real.py`:

```python
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
```

- [ ] **Step 4: Document harness skeleton**

Append to `data/rq2_traceability/README.md`:

```markdown
## Real System Harness

`scripts/run_rq2_real.py` currently provides method definitions and dry-run rows
only. It is intentionally blocked for `--real` until backend retrieval,
generation, and binding functions are wired. Run it once per method and redirect
stdout to the matching `system_outputs/{method}.jsonl` file. Use it to verify
method naming and CLI shape, not to collect thesis results yet.
```

- [ ] **Step 5: Run tests**

Run:

```bash
python3 /app/inference-engine/scripts/tests/test_run_rq2_real.py
python3 /app/inference-engine/scripts/run_rq2_real.py --root /app/inference-engine --method full_graphrag --limit 1
```

Expected: tests pass and command prints one dry-run JSON row for Q001/full_graphrag.

- [ ] **Step 6: Commit**

Run:

```bash
git -C /app/inference-engine add scripts/run_rq2_real.py scripts/tests/test_run_rq2_real.py data/rq2_traceability/README.md
git -C /app/inference-engine commit -m "Add real RQ2 harness skeleton"
```

### Task 4: Final Verification And Status Report

**Files:**
- No new files.

- [ ] **Step 1: Run all RQ2/RQ1 data tests**

Run:

```bash
python3 /app/inference-engine/scripts/tests/test_validate_eval_data.py
python3 /app/inference-engine/scripts/tests/test_rq2_traceability_lib.py
python3 /app/inference-engine/scripts/tests/test_run_rq2_offline.py
python3 /app/inference-engine/scripts/tests/test_summarize_rq2_results.py
python3 /app/inference-engine/scripts/tests/test_run_rq2_real.py
python3 /app/inference-engine/scripts/validate_eval_data.py --root /app/inference-engine --scope full
python3 /app/inference-engine/scripts/validate_eval_data.py --root /app/inference-engine --scope kg-counts
```

Expected: all tests pass; `full` passes for current offline-stub data; `kg-counts` passes only as pending-count template validation.

- [ ] **Step 2: Print summaries for user**

Run:

```bash
python3 /app/inference-engine/scripts/summarize_rq2_results.py --root /app/inference-engine
python3 /app/inference-engine/scripts/run_rq2_real.py --root /app/inference-engine --method full_graphrag --limit 1
git -C /app/inference-engine log --oneline --decorate -10
git -C /app/inference-engine status --short --branch
```

Expected: summaries print, real harness dry-run prints one row for the selected method, log shows new commits, working tree is clean.

---

## Self-Review

- Spec coverage: P0-B receives a concrete real-system harness skeleton and summarizer; P0-A receives a CSV audit template and validator. The plan does not pretend to complete real LLM/GraphRAG output before backend bindings are implemented.
- Placeholder scan: The CSV contains `pending` because the counts are external manual audit inputs. That is intentional and validated as pending, not as completed KG statistics.
- Type consistency: Method names match existing files and thesis table names: `baseline_a`, `baseline_b`, `ablation_no_expand`, `full_graphrag`.
