# RQ2 Traceability Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first evaluation-data scaffold for RQ2 traceability experiments without fabricating system-output metrics.

**Architecture:** Keep thesis evaluation artifacts under `data/rq2_traceability/` and keep reusable validation logic in `scripts/validate_eval_data.py`. The initial dataset contains synthetic, non-PII English writing snippets for query-set and pipeline debugging; generated system outputs and theta sweep results remain empty until the deployed system is run.

**Tech Stack:** Python 3 standard library, JSON/JSONL, `unittest` for validator tests.

---

### Task 1: Query Set Data

**Files:**
- Create: `data/rq2_traceability/query_set.json`
- Create: `data/rq2_traceability/README.md`
- Create: `data/rq2_traceability/system_outputs/.gitkeep`
- Create: `data/rq2_traceability/theta_sweep.jsonl`

- [ ] **Step 1: Create 20 synthetic, de-identified English writing snippets**

Use the RQ2 schema with `query_id`, `text`, `ground_truth_issues`, `expected_ref_nodes`, and `has_known_issue`. Cover five citation-format issues, five structure issues, five paragraph-function issues, and five no-issue controls.

- [ ] **Step 2: Add README guidance**

Document that these query snippets are synthetic scaffolding, not RQ3 participant data. Document the expected system-output files and the four comparison methods.

### Task 2: Validator

**Files:**
- Create: `scripts/validate_eval_data.py`
- Create: `scripts/tests/test_validate_eval_data.py`

- [ ] **Step 1: Write validator tests**

Cover PII detection, JSONL parsing, query-set coverage, and missing required fields.

- [ ] **Step 2: Implement validator**

Support `--scope query-set` for current scaffold validation and `--scope full` for later system-output and theta-sweep validation.

- [ ] **Step 3: Run tests and query-set validation**

Run:

```bash
python3 /app/inference-engine/scripts/tests/test_validate_eval_data.py
python3 /app/inference-engine/scripts/validate_eval_data.py --root /app/inference-engine --scope query-set
```

Expected: tests pass and query-set validation reports no errors.
