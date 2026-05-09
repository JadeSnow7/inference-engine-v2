# RQ2 Offline Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic offline RQ2 experiment runner that fills the four method JSONL files and theta sweep file with schema-valid, clearly marked dry-run outputs.

**Architecture:** Add small pure functions for reference parsing, validation, and theta recalculation in `scripts/rq2_traceability_lib.py`, then use them from `scripts/run_rq2_offline.py`. The runner must not call production APIs or LLM providers; it produces deterministic `run_type: "offline_stub"` outputs so the data pipeline, metrics schema, and validator can be exercised before real system collection.

**Tech Stack:** Python 3 standard library, JSON/JSONL, `unittest`. No new dependencies.

---

### Task 1: Reference Parser And Binding Functions

**Files:**
- Create: `scripts/rq2_traceability_lib.py`
- Create: `scripts/tests/test_rq2_traceability_lib.py`

- [ ] **Step 1: Write failing tests**

Create `scripts/tests/test_rq2_traceability_lib.py`:

```python
import importlib.util
import sys
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "rq2_traceability_lib.py"
spec = importlib.util.spec_from_file_location("rq2_traceability_lib", SCRIPT_PATH)
rq2 = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules["rq2_traceability_lib"] = rq2
spec.loader.exec_module(rq2)


class RQ2TraceabilityLibTest(unittest.TestCase):
    def test_extract_refs_preserves_first_seen_order_and_deduplicates(self):
        text = "Fix citation [REF:NRM-APA-001], then structure [REF:STR-ABS-001] and again [REF:NRM-APA-001]."

        refs = rq2.extract_refs(text)

        self.assertEqual(refs, ["NRM-APA-001", "STR-ABS-001"])

    def test_validate_refs_marks_existence_and_threshold(self):
        node_scores = {"NRM-APA-001": 0.78, "STR-ABS-001": 0.55}

        results = rq2.validate_refs(["NRM-APA-001", "STR-ABS-001", "MISSING-001"], node_scores, theta=0.6)

        self.assertEqual(results["NRM-APA-001"], {"exists": True, "cosine": 0.78, "pass": True})
        self.assertEqual(results["STR-ABS-001"], {"exists": True, "cosine": 0.55, "pass": False})
        self.assertEqual(results["MISSING-001"], {"exists": False, "cosine": 0.0, "pass": False})

    def test_theta_sweep_recalculates_pass_rate_without_changing_existence(self):
        validation_results = {
            "A": {"exists": True, "cosine": 0.72, "pass": True},
            "B": {"exists": True, "cosine": 0.58, "pass": False},
            "C": {"exists": False, "cosine": 0.0, "pass": False},
        }

        sweep = rq2.build_theta_sweep(validation_results, theta_values=[0.5, 0.6, 0.7])

        self.assertEqual(sweep[0], {"theta": 0.5, "pass_rate": 2 / 3, "node_exist_rate": 2 / 3})
        self.assertEqual(sweep[1], {"theta": 0.6, "pass_rate": 1 / 3, "node_exist_rate": 2 / 3})
        self.assertEqual(sweep[2], {"theta": 0.7, "pass_rate": 1 / 3, "node_exist_rate": 2 / 3})


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
python3 /app/inference-engine/scripts/tests/test_rq2_traceability_lib.py
```

Expected: fails because `scripts/rq2_traceability_lib.py` does not exist.

- [ ] **Step 3: Implement pure functions**

Create `scripts/rq2_traceability_lib.py`:

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
python3 /app/inference-engine/scripts/tests/test_rq2_traceability_lib.py
```

Expected: `Ran 3 tests ... OK`.

- [ ] **Step 5: Commit**

Run:

```bash
git -C /app/inference-engine add scripts/rq2_traceability_lib.py scripts/tests/test_rq2_traceability_lib.py
git -C /app/inference-engine commit -m "Add RQ2 traceability helper functions"
```

### Task 2: Deterministic Offline Output Runner

**Files:**
- Create: `scripts/run_rq2_offline.py`
- Create: `scripts/tests/test_run_rq2_offline.py`
- Modify: `data/rq2_traceability/README.md`

- [ ] **Step 1: Write failing runner tests**

Create `scripts/tests/test_run_rq2_offline.py`:

```python
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "run_rq2_offline.py"
spec = importlib.util.spec_from_file_location("run_rq2_offline", SCRIPT_PATH)
runner = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules["run_rq2_offline"] = runner
spec.loader.exec_module(runner)


class RQ2OfflineRunnerTest(unittest.TestCase):
    def test_build_method_output_contains_required_schema(self):
        query = {
            "query_id": "Q001",
            "ground_truth_issues": ["引用格式-APA"],
            "expected_ref_nodes": ["NRM-APA-001", "NRM-APA-002"],
            "has_known_issue": True,
        }

        row = runner.build_method_output(query, "full_graphrag", theta=0.6)

        self.assertEqual(row["method"], "full_graphrag")
        self.assertEqual(row["query_id"], "Q001")
        self.assertEqual(row["run_type"], "offline_stub")
        self.assertTrue(row["feedback_structure_complete"])
        self.assertEqual(row["theta_used"], 0.6)
        self.assertIn("generated_refs", row)
        self.assertIn("validation_results", row)
        self.assertIn("retrieved_nodes", row)

    def test_write_outputs_creates_one_row_per_query_per_method(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data_dir = root / "data" / "rq2_traceability"
            outputs_dir = data_dir / "system_outputs"
            outputs_dir.mkdir(parents=True)
            (data_dir / "query_set.json").write_text(json.dumps([
                {
                    "query_id": "Q001",
                    "text": "Synthetic text.",
                    "ground_truth_issues": ["引用格式-APA"],
                    "expected_ref_nodes": ["NRM-APA-001"],
                    "has_known_issue": True,
                },
                {
                    "query_id": "Q002",
                    "text": "Synthetic control text.",
                    "ground_truth_issues": [],
                    "expected_ref_nodes": [],
                    "has_known_issue": False,
                },
            ]), encoding="utf-8")

            runner.write_outputs(root, theta=0.6)

            full_rows = [
                json.loads(line)
                for line in (outputs_dir / "full_graphrag.jsonl").read_text(encoding="utf-8").splitlines()
                if line.strip()
            ]
            baseline_rows = [
                json.loads(line)
                for line in (outputs_dir / "baseline_a.jsonl").read_text(encoding="utf-8").splitlines()
                if line.strip()
            ]
            self.assertEqual(len(full_rows), 2)
            self.assertEqual(len(baseline_rows), 2)
            self.assertEqual(full_rows[0]["generated_refs"], ["NRM-APA-001"])
            self.assertEqual(baseline_rows[0]["generated_refs"], [])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
python3 /app/inference-engine/scripts/tests/test_run_rq2_offline.py
```

Expected: fails because `scripts/run_rq2_offline.py` does not exist.

- [ ] **Step 3: Implement deterministic runner**

Create `scripts/run_rq2_offline.py`:

```python
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
```

- [ ] **Step 4: Update README**

Append to `data/rq2_traceability/README.md`:

```markdown
## Offline Stub Runner

Use this command to fill all output files with deterministic schema-valid dry-run data:

```bash
python3 scripts/run_rq2_offline.py
python3 scripts/validate_eval_data.py --scope full
```

Rows created by this command contain `"run_type": "offline_stub"` and must not be reported as real LLM or GraphRAG experiment results. They exist to verify the data pipeline before real collection.
```

- [ ] **Step 5: Run tests and runner**

Run:

```bash
python3 /app/inference-engine/scripts/tests/test_run_rq2_offline.py
python3 /app/inference-engine/scripts/run_rq2_offline.py --root /app/inference-engine
python3 /app/inference-engine/scripts/validate_eval_data.py --root /app/inference-engine --scope full
```

Expected: runner tests pass, offline outputs are written, full validation passes.

- [ ] **Step 6: Commit**

Run:

```bash
git -C /app/inference-engine add data/rq2_traceability scripts/run_rq2_offline.py scripts/tests/test_run_rq2_offline.py
git -C /app/inference-engine commit -m "Add RQ2 offline output runner"
```

### Task 3: Strict Full-Gate Validation For Output Rows

**Files:**
- Modify: `scripts/validate_eval_data.py`
- Modify: `scripts/tests/test_validate_eval_data.py`

- [ ] **Step 1: Add validator tests for output row shape**

Append to `ValidateEvalDataTest` in `scripts/tests/test_validate_eval_data.py`:

```python
    def test_full_gate_reports_bad_theta_sweep(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir = tmp_path / "data" / "rq2_traceability"
            outputs_dir = data_dir / "system_outputs"
            outputs_dir.mkdir(parents=True)
            query = {
                "query_id": "Q001",
                "text": " ".join(["This synthetic paragraph discusses academic writing structure."] * 25),
                "ground_truth_issues": ["引用格式-APA"],
                "expected_ref_nodes": ["NRM-APA-001"],
                "has_known_issue": True,
            }
            (data_dir / "query_set.json").write_text(json.dumps([query]), encoding="utf-8")
            row = {
                "method": "full_graphrag",
                "query_id": "Q001",
                "retrieved_nodes": [],
                "generated_refs": [],
                "validation_results": {},
                "feedback_structure_complete": True,
            }
            for method, filename in validate_eval_data.TRACEABILITY_METHOD_FILES.items():
                method_row = dict(row)
                method_row["method"] = method
                (outputs_dir / filename).write_text(json.dumps(method_row) + "\n", encoding="utf-8")
            (data_dir / "theta_sweep.jsonl").write_text(
                json.dumps({"query_id": "Q001", "theta_sweep": [{"theta": 0.6}], "downgrade_trigger_count": 0}) + "\n",
                encoding="utf-8",
            )

            query_issues = validate_eval_data.validate_query_set(
                tmp_path,
                min_queries=1,
                min_controls=0,
                min_dimension_coverage=0,
                word_min=20,
                word_max=300,
            )
            self.assertEqual(query_issues, [])
            issues = validate_eval_data.validate_theta_sweep(tmp_path, {"Q001"})

            self.assertTrue(any("theta values" in issue for issue in issues))
```

- [ ] **Step 2: Run test to verify it passes or exposes current behavior**

Run:

```bash
python3 /app/inference-engine/scripts/tests/test_validate_eval_data.py
```

Expected: tests pass because theta value checking already exists.

- [ ] **Step 3: Tighten output row validation**

In `validate_system_outputs`, require these fields in each row:

```python
required_fields = (
    "method",
    "query_id",
    "retrieved_nodes",
    "generated_refs",
    "validation_results",
    "low_confidence_refs",
    "feedback_structure_complete",
    "theta_used",
)
```

Then add type checks:

```python
if not isinstance(row.get("retrieved_nodes"), list):
    issues.append(f"{filename}:{row_id} retrieved_nodes must be a list")
if not isinstance(row.get("generated_refs"), list):
    issues.append(f"{filename}:{row_id} generated_refs must be a list")
if not isinstance(row.get("validation_results"), dict):
    issues.append(f"{filename}:{row_id} validation_results must be an object")
if not isinstance(row.get("feedback_structure_complete"), bool):
    issues.append(f"{filename}:{row_id} feedback_structure_complete must be boolean")
```

- [ ] **Step 4: Run all validation tests and full gate**

Run:

```bash
python3 /app/inference-engine/scripts/tests/test_validate_eval_data.py
python3 /app/inference-engine/scripts/tests/test_rq2_traceability_lib.py
python3 /app/inference-engine/scripts/tests/test_run_rq2_offline.py
python3 /app/inference-engine/scripts/validate_eval_data.py --root /app/inference-engine --scope full
```

Expected: all tests pass and full validation passes.

- [ ] **Step 5: Commit**

Run:

```bash
git -C /app/inference-engine add scripts/validate_eval_data.py scripts/tests/test_validate_eval_data.py
git -C /app/inference-engine commit -m "Tighten RQ2 output validation"
```

### Task 4: Documentation And Final Verification

**Files:**
- Modify: `data/rq2_traceability/README.md`

- [ ] **Step 1: Add real-collection warning and next command block**

Append:

```markdown
## Replacing Offline Stub Data With Real Runs

The offline runner is only a dry run. For thesis tables, replace the JSONL rows
with real outputs from the deployed system or backend experiment harness. Keep
the same schema and preserve raw logs separately if they contain no secrets or PII.

Before using data in the thesis, run:

```bash
python3 scripts/validate_eval_data.py --scope full
```

Then summarize metrics in a separate analysis file instead of editing raw JSONL
by hand.
```

- [ ] **Step 2: Final verification**

Run:

```bash
python3 /app/inference-engine/scripts/tests/test_validate_eval_data.py
python3 /app/inference-engine/scripts/tests/test_rq2_traceability_lib.py
python3 /app/inference-engine/scripts/tests/test_run_rq2_offline.py
python3 /app/inference-engine/scripts/validate_eval_data.py --root /app/inference-engine --scope full
git -C /app/inference-engine status --short --branch
```

Expected: all tests pass, full gate passes, and the working tree only contains the documentation change before commit.

- [ ] **Step 3: Commit**

Run:

```bash
git -C /app/inference-engine add data/rq2_traceability/README.md
git -C /app/inference-engine commit -m "Document RQ2 offline runner limitations"
```

---

## Self-Review

- Spec coverage: The plan covers reference parsing, binding validation, deterministic four-method JSONL generation, theta sweep generation, full-gate validation, and documentation of offline-stub limitations.
- Placeholder scan: No `TBD`, `TODO`, or undefined future implementation steps remain. The runner is explicitly a deterministic dry run, not real experiment data.
- Type consistency: Method names match existing filenames: `baseline_a`, `baseline_b`, `ablation_no_expand`, and `full_graphrag`. Shared theta values match the validator: `0.50, 0.55, 0.60, 0.65, 0.70`.
