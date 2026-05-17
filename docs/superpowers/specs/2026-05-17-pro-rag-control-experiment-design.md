# DeepSeek V4 Pro RAG Control Experiment Design

## Purpose

Build a reproducible appendix-level evidence package for comparing academic-writing feedback under four knowledge configurations while keeping model claims, retrieval injection, references, and external source provenance explicit.

The experiment is supplementary only. It does not replace the existing RQ2 evaluation and does not prove classroom teaching effectiveness.

## Current Constraints

- The default editing pipeline mixes `deepseek-v4-pro` and `deepseek-v4-flash`; a run cannot claim "all Pro" unless every generation stage is forced to Pro or the report limits the claim to Pro-owned stages.
- The DashScope App-compatible path currently sends the intended model in prompt metadata, not as a guaranteed provider-level model selector. The runner must record `declared_model`, `effective_model`, and `model_claim_level`.
- The local dataset contains 20 RQ2 traceability samples, not 60. If no 60-sample source is found, the evidence package must describe the run as using the existing 20-sample traceability set.
- Production `GraphRAGRetriever` is a literature graph retriever. Norm-node GraphRAG for this experiment must use the RQ2 norm-node graph helper so G2 can be evaluated against `NRM-*` and other norm-node ids.
- G3 structured references must be collected from editing citation verification, not `/api/chat mode=norms`.
- G4 can only confirm `jxfz` if a response, source field, reference, or log proves that source. Otherwise it must report "Bailian application document source returned" at most.

## Architecture

Create a focused experiment runner under `scripts/pro_rag_control_experiment.py`. The runner directly constructs each group's retrieval/provider behavior and writes the requested evidence package under `pro_rag_control_experiment/`.

The runner has three layers:

1. Dataset preparation: load `data/rq2_traceability/query_set.json`, map fields into the requested sample schema, compute stable selection hashes, and write sample metadata.
2. Group execution: run G1/G2/G3/G4 with explicit retriever injection and a deterministic offline feedback generator by default. Optional live provider support may be added later, but offline evidence must still expose the same schema.
3. Evidence reporting: emit JSONL outputs, metric CSV/JSON summaries, logs, manual review templates, appendix tables, and a no-secret scan result.

## Group Definitions

G1 is Pro plus no RAG. It uses no norm retriever and no external RAG. Any reference-like markers in output are counted as hallucinated.

G2 is Pro plus local norm GraphRAG. It uses RQ2 norm-node graph retrieval with `graph_hops=1`, `theta=0.6`, `retrieval_top_k=5`, and validation against expected reference nodes.

G3 is Pro plus `NormNodeRetriever`. It uses `CitationVerifier(norm_retriever=NormNodeRetriever(...), rag=None)` and records whether structured `EvidenceReference` items contain real norm ids.

G4 is Pro plus Bailian/DashScope document sources. In offline mode it records that the live source was not queried. In live mode it may use DashScope App-compatible Responses or the app SDK, but it must sanitize URLs and only set `jxfz_confirmed=true` when the returned metadata proves that source.

## Output Package

The runner writes:

- `00_readme.md`
- `01_config/model_config.json`
- `01_config/rag_config.json`
- `01_config/no_secret_check.txt`
- `02_sample_set/selected_20_samples.json`
- `02_sample_set/expected_refs.json`
- `02_sample_set/sample_hash.txt`
- four JSONL files under `03_outputs/`
- five metric files under `04_metrics/`
- four log files under `05_logs/`
- two manual review files under `06_manual_review/`
- three paper appendix tables under `07_paper_tables/`

All JSONL records include model claim fields, source claim fields, metrics, raw events, and notes.

## Testing

Add unit tests for:

- sample mapping and hash stability
- group output counts and explicit retriever isolation
- G1 no-RAG hallucinated reference accounting
- G2 expected-reference recall and precision calculations
- G3 structured norm reference extraction
- G4 source claim boundary and secret sanitization
- evidence package file creation

Run targeted regression tests after implementation:

```bash
PYTHONPATH=backend /root/.venvs/inference-engine-backend/bin/python -B -m unittest \
  scripts.tests.test_pro_rag_control_experiment \
  backend.tests.test_config \
  backend.tests.test_stream_client_lifecycle \
  backend.tests.test_editing_pipeline \
  backend.tests.test_editing_api \
  backend.tests.test_dashscope_provider
```

Run Docker verification and capture outputs into the evidence package when the experiment is executed.

## Acceptance Criteria

- The evidence package is generated without secrets.
- Output records for all four groups use `declared_model=deepseek-v4-pro`.
- The report does not claim confirmed Pro unless `effective_model` evidence is present.
- The report does not claim `jxfz` unless `jxfz_confirmed=true`.
- The report identifies the actual sample source and does not claim a 60-to-20 sample draw unless that source exists.
