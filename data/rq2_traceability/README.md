# RQ2 Traceability Evaluation Data

This directory stores the RQ2 traceability evaluation artifacts for the thesis.

The current `query_set.json` is a synthetic, de-identified scaffold for running
pipeline tests and preparing experiment tables. It is not participant data and
must not be used as evidence for RQ3 instructional effectiveness.

## Files

- `query_set.json`: 20 English academic-writing snippets with manually assigned
  issue labels and expected KG reference nodes.
- `system_outputs/`: JSONL outputs produced by running the four comparison
  methods over every query.
- `theta_sweep.jsonl`: sensitivity-analysis results for theta values 0.50,
  0.55, 0.60, 0.65, and 0.70.

## Required System Output Files

Create these files after running the system:

- `system_outputs/baseline_a.jsonl`
- `system_outputs/baseline_b.jsonl`
- `system_outputs/ablation_no_expand.jsonl`
- `system_outputs/full_graphrag.jsonl`

Each JSONL row should include:

```json
{
  "method": "full_graphrag",
  "query_id": "Q001",
  "retrieved_nodes": [],
  "generated_refs": [],
  "validation_results": {},
  "low_confidence_refs": [],
  "feedback_structure_complete": true,
  "theta_used": 0.6
}
```

Run the lightweight query-set gate:

```bash
python3 scripts/validate_eval_data.py --scope query-set
```

Run the full gate after system outputs and theta sweep data exist:

```bash
python3 scripts/validate_eval_data.py --scope full
```

## Offline Stub Runner

Use this command to fill all output files with deterministic schema-valid dry-run data:

```bash
python3 scripts/run_rq2_offline.py
python3 scripts/validate_eval_data.py --scope full
```

Rows created by this command contain `"run_type": "offline_stub"` and must not
be reported as real LLM or GraphRAG experiment results. They exist to verify the
data pipeline before real collection.

## Replacing Offline Stub Data With Real Runs

The offline runner is only a dry run. For thesis tables, replace the JSONL rows
with real outputs from the deployed system or backend experiment harness. Keep
the same schema and preserve raw logs separately if they contain no secrets or
PII.

Before using data in the thesis, run:

```bash
python3 scripts/validate_eval_data.py --scope full
```

Then summarize metrics in a separate analysis file instead of editing raw JSONL
by hand.

## Real System Harness

`scripts/run_rq2_real.py` currently provides method definitions and dry-run rows
only. It is intentionally blocked for `--real` until backend retrieval,
generation, and binding functions are wired. Run it once per method and redirect
stdout to the matching `system_outputs/{method}.jsonl` file. Use it to verify
method naming and CLI shape, not to collect thesis results yet.

## Norm Node Corpus

`norm_nodes.json` is a compact thesis-aligned norm-node corpus for RQ2
real-system collection. It maps the query-set expected reference nodes to five
node categories used in the thesis. Replace or expand it with the audited KG
after P0-A is completed.
