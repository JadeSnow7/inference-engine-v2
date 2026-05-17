# Pro RAG Control Experiment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and run a reproducible evidence-package generator for the DeepSeek-V4-Pro RAG control experiment.

**Architecture:** A single focused script loads the existing RQ2 traceability dataset, runs four explicitly isolated experiment groups, computes traceability/risk/latency metrics, and writes the required archive structure. Unit tests cover package shape, metric behavior, no-secret scanning, and conservative model/source claim boundaries.

**Tech Stack:** Python 3.12, `unittest`, existing backend modules `editing.evidence`, `rag.norm_retriever`, and `scripts.rq2_real_backend`.

---

### Task 1: Add Failing Tests For Experiment Runner

**Files:**
- Create: `scripts/tests/test_pro_rag_control_experiment.py`
- Create later: `scripts/pro_rag_control_experiment.py`

- [ ] **Step 1: Write tests covering sample mapping, output package, metrics, and source/model boundaries**

```python
import json
import tempfile
import unittest
from pathlib import Path


class ProRagControlExperimentTest(unittest.TestCase):
    def test_select_samples_uses_existing_twenty_without_claiming_sixty_draw(self):
        from scripts.pro_rag_control_experiment import load_selected_samples

        root = Path(__file__).resolve().parents[2]
        samples, note = load_selected_samples(root)

        self.assertEqual(len(samples), 20)
        self.assertIn("existing 20", note)
        self.assertEqual(samples[0]["sample_id"], "Q001")
        self.assertIn("selection_hash", samples[0])
        self.assertEqual(samples[0]["source_dataset"], "data/rq2_traceability/query_set.json")

    def test_run_experiment_writes_required_files_and_group_counts(self):
        from scripts.pro_rag_control_experiment import run_experiment

        root = Path(__file__).resolve().parents[2]
        with tempfile.TemporaryDirectory() as tmp:
            package_dir = Path(tmp) / "pro_rag_control_experiment"
            summary = run_experiment(root=root, output_dir=package_dir, live_g4=False)

            self.assertEqual(summary["sample_count"], 20)
            self.assertEqual(summary["group_counts"], {"G1": 20, "G2": 20, "G3": 20, "G4": 20})
            self.assertFalse(summary["jxfz_confirmed"])
            self.assertTrue((package_dir / "00_readme.md").exists())
            self.assertTrue((package_dir / "01_config" / "model_config.json").exists())
            self.assertTrue((package_dir / "04_metrics" / "metrics_summary.json").exists())
            self.assertTrue((package_dir / "07_paper_tables" / "table_d13_risk_boundary.csv").exists())

    def test_g1_has_no_retriever_and_flags_reference_markers_as_hallucinated(self):
        from scripts.pro_rag_control_experiment import build_group_record

        sample = {
            "sample_id": "S1",
            "text": "A paragraph without evidence.",
            "sample_type": "引用格式",
            "expected_refs": ["NRM-APA-001"],
            "is_control": False,
            "source_dataset": "x",
            "selection_hash": "h",
        }
        record = build_group_record(sample, "G1", output_text="Advice [REF:NRM-APA-001]", references=[])

        self.assertEqual(record["rag_mode"], "none")
        self.assertEqual(record["retriever_impl"], "none")
        self.assertEqual(record["metrics"]["hallucinated_reference_rate"], 1.0)
        self.assertEqual(record["model_claim_level"], "declared_only")

    def test_g2_metrics_count_grounded_expected_refs(self):
        from scripts.pro_rag_control_experiment import compute_reference_metrics

        metrics = compute_reference_metrics(
            expected_refs=["NRM-APA-001", "NRM-APA-002"],
            references=[
                {"id": "NRM-APA-001", "status": "resolved"},
                {"id": "NRM-OTHER-001", "status": "resolved"},
            ],
            output_text="[REF:NRM-APA-001] [REF:NRM-OTHER-001]",
        )

        self.assertEqual(metrics["expected_reference_recall"], 0.5)
        self.assertEqual(metrics["grounded_reference_precision"], 0.5)
        self.assertEqual(metrics["hallucinated_reference_rate"], 0.5)
        self.assertEqual(metrics["reference_event_rate"], 1.0)

    def test_no_secret_scan_redacts_signed_urls_and_tokens(self):
        from scripts.pro_rag_control_experiment import sanitize_sensitive, scan_for_secrets

        value = {
            "fileUrl": "https://example.com/doc?Expires=1&Signature=abc",
            "Authorization": "Bearer secret",
            "title": "safe",
        }
        sanitized = sanitize_sensitive(value)
        findings = scan_for_secrets(json.dumps(sanitized, ensure_ascii=False))

        self.assertEqual(sanitized, {"title": "safe"})
        self.assertEqual(findings, [])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail because the module does not exist**

Run:

```bash
PYTHONPATH=backend:. /root/.venvs/inference-engine-backend/bin/python -B -m unittest scripts.tests.test_pro_rag_control_experiment
```

Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.pro_rag_control_experiment'`.

### Task 2: Implement Experiment Runner

**Files:**
- Create: `scripts/pro_rag_control_experiment.py`

- [ ] **Step 1: Implement the runner with deterministic offline behavior**

The script must expose `load_selected_samples`, `compute_reference_metrics`, `build_group_record`, `sanitize_sensitive`, `scan_for_secrets`, and `run_experiment`.

- [ ] **Step 2: Run the new tests**

Run:

```bash
PYTHONPATH=backend:. /root/.venvs/inference-engine-backend/bin/python -B -m unittest scripts.tests.test_pro_rag_control_experiment
```

Expected: all tests pass.

### Task 3: Run Full Regression And Generate Evidence Package

**Files:**
- Generated: `pro_rag_control_experiment/**`

- [ ] **Step 1: Generate the evidence package**

Run:

```bash
PYTHONPATH=backend:. /root/.venvs/inference-engine-backend/bin/python -B scripts/pro_rag_control_experiment.py --root . --output-dir pro_rag_control_experiment
```

Expected: prints a JSON summary with `sample_count=20`, each group count equal to 20, and `jxfz_confirmed=false` unless live G4 source evidence is found.

- [ ] **Step 2: Run targeted regression tests and save output**

Run:

```bash
PYTHONPATH=backend /root/.venvs/inference-engine-backend/bin/python -B -m unittest \
  scripts.tests.test_pro_rag_control_experiment \
  backend.tests.test_config \
  backend.tests.test_stream_client_lifecycle \
  backend.tests.test_editing_pipeline \
  backend.tests.test_editing_api \
  backend.tests.test_dashscope_provider
```

Expected: all tests pass.

- [ ] **Step 3: Run Docker verification commands from the repository root**

Run:

```bash
docker compose -p inference-engine run --rm --no-deps backend python -B -m unittest tests.test_config tests.test_stream_client_lifecycle tests.test_editing_pipeline tests.test_editing_api tests.test_dashscope_provider
docker compose -p inference-engine ps
docker compose -p inference-engine logs --tail=200 backend
```

Expected: test command exits 0; service and logs are captured in the evidence package.

### Task 4: Commit And Push

**Files:**
- Commit: `docs/superpowers/specs/2026-05-17-pro-rag-control-experiment-design.md`
- Commit: `docs/superpowers/plans/2026-05-17-pro-rag-control-experiment.md`
- Commit: `scripts/pro_rag_control_experiment.py`
- Commit: `scripts/tests/test_pro_rag_control_experiment.py`
- Commit: `pro_rag_control_experiment/**`

- [ ] **Step 1: Run no-secret scan against the package**

Run:

```bash
PYTHONPATH=backend:. /root/.venvs/inference-engine-backend/bin/python -B scripts/pro_rag_control_experiment.py --root . --output-dir pro_rag_control_experiment --no-run --scan-only
```

Expected: no findings.

- [ ] **Step 2: Commit changes**

Run:

```bash
git add docs/superpowers/specs/2026-05-17-pro-rag-control-experiment-design.md docs/superpowers/plans/2026-05-17-pro-rag-control-experiment.md scripts/pro_rag_control_experiment.py scripts/tests/test_pro_rag_control_experiment.py pro_rag_control_experiment
git commit -m "chore: add pro rag control experiment evidence package"
```

- [ ] **Step 3: Push branch**

Run:

```bash
git push -u origin pro-rag-control-experiment
```

If push is blocked by network or credentials, report the exact failure and leave the branch committed locally.
