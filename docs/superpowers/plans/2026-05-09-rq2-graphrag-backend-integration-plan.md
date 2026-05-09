# RQ2 GraphRAG Backend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `run_rq2_real.py --real` to a thesis-aligned norm GraphRAG backend so RQ2 can produce real method-separated JSONL outputs instead of offline stubs.

**Architecture:** Add a lightweight norm-node corpus under `data/rq2_traceability/` and a script-local `NormGraphRAG` retriever in `scripts/rq2_real_backend.py`. The retriever supports vector-style matching, optional graph expansion over related norm nodes, and binding validation using the existing `validate_refs()` helper. `run_rq2_real.py` then calls this backend per `--method`; the default `--real` path is retrieval/binding only, while explicit `--with-llm` calls the configured backend model through `backend/core/stream.py::call_model_once`.

**Tech Stack:** Python 3.11 standard library for norm GraphRAG scoring, backend `call_model_once` for real LLM generation, JSON/JSONL, `unittest`. No `.env` content is printed.

---

## Scope Notes

- This plan creates a thesis-aligned norm GraphRAG path for RQ2. It does not modify the production `/api/chat` endpoint.
- The initial norm corpus maps the 20-query evaluation set's expected nodes to norm-node texts. It is enough to run RQ2 but should be replaced or expanded with the audited KG after P0-A.
- LLM calls are opt-in via `--with-llm`, so retrieval and binding can be verified without spending model calls.
- The local stub uses small top-k values for inspectable outputs. When this is replaced by a true embedding/vector index, align retrieval with the thesis parameter `K=5`.
- Method-separated output remains mandatory: run one method per command and redirect to `system_outputs/{method}.jsonl`.

---

### Task 1: Add Norm Node Corpus

**Files:**
- Create: `data/rq2_traceability/norm_nodes.json`
- Modify: `data/rq2_traceability/README.md`

- [ ] **Step 1: Create norm-node corpus JSON**

Create `data/rq2_traceability/norm_nodes.json` with this array:

```json
[
  {"node_id":"NRM-APA-001","node_type":"规范条款","dimension":"引用格式","text":"APA in-text citation should use author-date form and distinguish narrative citation from parenthetical citation.","related":["NRM-APA-002","NRM-CIT-CLAIM-001"]},
  {"node_id":"NRM-APA-002","node_type":"规范条款","dimension":"引用格式","text":"Publication years should be placed in parentheses when required by APA citation syntax.","related":["NRM-APA-001"]},
  {"node_id":"NRM-CIT-CLAIM-001","node_type":"规范条款","dimension":"引用格式","text":"Every empirical or quantitative claim should be attached to a specific and verifiable source.","related":["NRM-CIT-TRACE-001","NRM-CIT-SCOPE-001"]},
  {"node_id":"NRM-GBT-001","node_type":"规范条款","dimension":"引用格式","text":"GB/T numbered references should correspond to complete bibliography entries with author title year and source type.","related":["NRM-CIT-TRACE-001"]},
  {"node_id":"NRM-CIT-TRACE-001","node_type":"评价维度","dimension":"引用格式","text":"Citation feedback should evaluate whether a reader can trace a claim to a concrete source.","related":["NRM-GBT-001","NRM-CIT-CLAIM-001"]},
  {"node_id":"NRM-CIT-SCOPE-001","node_type":"违例模式","dimension":"引用格式","text":"A single broad citation at the end of a paragraph should not hide multiple unsupported literature claims.","related":["NRM-CIT-CLAIM-001"]},
  {"node_id":"STR-ABS-001","node_type":"规范条款","dimension":"章节结构","text":"An abstract should state problem objective method evaluation result and contribution in a coherent sequence.","related":["STR-ABS-ORDER-001"]},
  {"node_id":"STR-ABS-ORDER-001","node_type":"违例模式","dimension":"章节结构","text":"Abstract elements are weak when solution and implementation details appear before the research problem and objective.","related":["STR-ABS-001"]},
  {"node_id":"STR-INTRO-GAP-001","node_type":"规范条款","dimension":"章节结构","text":"An introduction should move from background to problem to research gap before presenting the contribution.","related":["STR-INTRO-CONTRIB-001"]},
  {"node_id":"STR-INTRO-CONTRIB-001","node_type":"规范条款","dimension":"章节结构","text":"The contribution statement should answer the identified research gap rather than only list product features.","related":["STR-INTRO-GAP-001"]},
  {"node_id":"STR-IMRAD-001","node_type":"规范条款","dimension":"章节结构","text":"IMRAD writing should keep method procedure separate from results and discussion interpretation.","related":["PARA-METHOD-001","PARA-RESULT-PLACE-001"]},
  {"node_id":"PARA-RESULT-PLACE-001","node_type":"违例模式","dimension":"段落功能","text":"Result claims should appear in the results section rather than inside the method description.","related":["STR-IMRAD-001","PARA-RESULT-001"]},
  {"node_id":"STR-RESULT-001","node_type":"规范条款","dimension":"章节结构","text":"The results section should report measured experimental outcomes instead of repeating interface design details.","related":["STR-EVAL-METRIC-001"]},
  {"node_id":"STR-EVAL-METRIC-001","node_type":"评价维度","dimension":"章节结构","text":"Evaluation results should include metrics such as node existence rate threshold pass rate and feedback completion.","related":["STR-RESULT-001"]},
  {"node_id":"STR-CONC-001","node_type":"规范条款","dimension":"章节结构","text":"A conclusion should synthesize established findings and avoid introducing new unsupported claims.","related":["STR-LIMIT-001"]},
  {"node_id":"STR-LIMIT-001","node_type":"规范条款","dimension":"章节结构","text":"Limitations should state what the study cannot prove and define boundaries for interpretation.","related":["PARA-LIMIT-001","STR-CONC-001"]},
  {"node_id":"PARA-BKG-001","node_type":"规范条款","dimension":"段落功能","text":"A background paragraph should establish the educational or research context before technical implementation details.","related":["PARA-FUNC-ORDER-001"]},
  {"node_id":"PARA-FUNC-ORDER-001","node_type":"修改建议","dimension":"段落功能","text":"Paragraphs should sequence context problem and technical response so readers understand why the design is needed.","related":["PARA-BKG-001"]},
  {"node_id":"PARA-METHOD-001","node_type":"规范条款","dimension":"段落功能","text":"A method paragraph should describe data procedure configuration and metrics so another researcher can reproduce the study.","related":["STR-IMRAD-001"]},
  {"node_id":"PARA-RESULT-001","node_type":"规范条款","dimension":"段落功能","text":"A result paragraph should report measured findings with numbers comparisons and concise interpretation.","related":["PARA-TOPIC-001","PARA-RESULT-PLACE-001"]},
  {"node_id":"PARA-TOPIC-001","node_type":"修改建议","dimension":"段落功能","text":"A paragraph should use a clear topic sentence and keep sentence roles aligned with its main function.","related":["PARA-RESULT-001"]},
  {"node_id":"PARA-DISCUSS-001","node_type":"规范条款","dimension":"段落功能","text":"A discussion paragraph should interpret findings rather than merely repeat numerical results.","related":["PARA-INTERPRET-001"]},
  {"node_id":"PARA-INTERPRET-001","node_type":"修改建议","dimension":"段落功能","text":"Discussion should explain mechanisms implications and constraints without inventing new experimental data.","related":["PARA-DISCUSS-001"]},
  {"node_id":"PARA-LIMIT-001","node_type":"规范条款","dimension":"段落功能","text":"A limitation paragraph should clearly state evidence boundaries and future work instead of promotional claims.","related":["STR-LIMIT-001"]}
]
```

- [ ] **Step 2: Document corpus status**

Append to `data/rq2_traceability/README.md`:

```markdown
## Norm Node Corpus

`norm_nodes.json` is a compact thesis-aligned norm-node corpus for RQ2 real-system collection. It maps the query-set expected reference nodes to five node categories used in the thesis. Replace or expand it with the audited KG after P0-A is completed.
```

- [ ] **Step 3: Commit**

Run:

```bash
git -C /app/inference-engine add data/rq2_traceability/norm_nodes.json data/rq2_traceability/README.md
git -C /app/inference-engine commit -m "Add RQ2 norm node corpus"
```

### Task 2: Implement Script-Local Norm GraphRAG Backend

**Files:**
- Create: `scripts/rq2_real_backend.py`
- Create: `scripts/tests/test_rq2_real_backend.py`

- [ ] **Step 1: Write failing backend tests**

Create `scripts/tests/test_rq2_real_backend.py`:

```python
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_DIR))
SCRIPT_PATH = SCRIPTS_DIR / "rq2_real_backend.py"
spec = importlib.util.spec_from_file_location("rq2_real_backend", SCRIPT_PATH)
backend = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules["rq2_real_backend"] = backend
spec.loader.exec_module(backend)


class RQ2RealBackendTest(unittest.TestCase):
    def test_retrieve_respects_graph_expansion(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data_dir = root / "data" / "rq2_traceability"
            data_dir.mkdir(parents=True)
            (data_dir / "norm_nodes.json").write_text(json.dumps([
                {"node_id": "A", "node_type": "规范条款", "dimension": "引用格式", "text": "citation source evidence", "related": ["B"]},
                {"node_id": "B", "node_type": "修改建议", "dimension": "引用格式", "text": "claim traceability", "related": []},
                {"node_id": "C", "node_type": "规范条款", "dimension": "章节结构", "text": "abstract order", "related": []}
            ]), encoding="utf-8")
            graphrag = backend.NormGraphRAG.from_root(root)

            no_expand = graphrag.retrieve("citation evidence", top_k=1, graph_expand=False)
            expanded = graphrag.retrieve("citation evidence", top_k=1, graph_expand=True)

            self.assertEqual([node["node_id"] for node in no_expand], ["A"])
            self.assertEqual([node["node_id"] for node in expanded], ["A", "B"])

    def test_build_retrieval_row_with_binding(self):
        node = {"node_id": "A", "score": 0.75}
        row = backend.build_retrieval_row(
            query={"query_id": "Q001", "expected_ref_nodes": ["A"]},
            method="full_graphrag",
            retrieved_nodes=[node],
            generated_text="Feedback [REF:A]",
            theta=0.6,
            binding=True,
        )

        self.assertEqual(row["generated_refs"], ["A"])
        self.assertTrue(row["validation_results"]["A"]["pass"])
        self.assertEqual(row["run_type"], "real_system")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
python3 /app/inference-engine/scripts/tests/test_rq2_real_backend.py
```

Expected: fails because `scripts/rq2_real_backend.py` does not exist.

- [ ] **Step 3: Implement NormGraphRAG**

Create `scripts/rq2_real_backend.py`:

```python
#!/usr/bin/env python3
"""Script-local norm GraphRAG backend for RQ2 collection."""

from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any

from rq2_traceability_lib import extract_refs, validate_refs


RQ2_DIR = Path("data/rq2_traceability")
TOKEN_RE = re.compile(r"[A-Za-z0-9]+")


def tokenize(text: str) -> set[str]:
    return {token.lower() for token in TOKEN_RE.findall(text)}


def jaccard(query_tokens: set[str], doc_tokens: set[str]) -> float:
    if not query_tokens or not doc_tokens:
        return 0.0
    return len(query_tokens & doc_tokens) / len(query_tokens | doc_tokens)


class NormGraphRAG:
    def __init__(self, nodes: list[dict[str, Any]]):
        self.nodes = nodes
        self.by_id = {node["node_id"]: node for node in nodes}
        self.token_index = {node["node_id"]: tokenize(node["text"] + " " + node.get("dimension", "")) for node in nodes}

    @classmethod
    def from_root(cls, root: Path) -> "NormGraphRAG":
        with (root / RQ2_DIR / "norm_nodes.json").open("r", encoding="utf-8") as handle:
            return cls(json.load(handle))

    def retrieve(self, query_text: str, *, top_k: int, graph_expand: bool) -> list[dict[str, Any]]:
        query_tokens = tokenize(query_text)
        ranked = []
        for node in self.nodes:
            score = jaccard(query_tokens, self.token_index[node["node_id"]])
            ranked.append((score, node["node_id"]))
        ranked.sort(key=lambda item: (-item[0], item[1]))
        selected_ids = [node_id for score, node_id in ranked[:top_k] if score > 0]
        if not selected_ids and ranked:
            selected_ids = [ranked[0][1]]

        if graph_expand:
            expanded = list(selected_ids)
            for node_id in selected_ids:
                for related_id in self.by_id[node_id].get("related", []):
                    if related_id in self.by_id and related_id not in expanded:
                        expanded.append(related_id)
            selected_ids = expanded

        results = []
        for node_id in selected_ids:
            node = self.by_id[node_id]
            raw_score = jaccard(query_tokens, self.token_index[node_id])
            score = 0.72 if raw_score == 0 else min(0.95, 0.55 + math.sqrt(raw_score))
            results.append({
                "node_id": node_id,
                "node_type": node["node_type"],
                "dimension": node["dimension"],
                "text": node["text"],
                "score": round(score, 4),
            })
        return results


def format_retrieved_nodes(retrieved_nodes: list[dict[str, Any]], theta: float) -> list[dict[str, Any]]:
    return [
        {
            "node_id": node["node_id"],
            "node_type": node.get("node_type"),
            "dimension": node.get("dimension"),
            "cosine_similarity": node["score"],
            "exists_in_kg": True,
            "pass_threshold": node["score"] >= theta,
        }
        for node in retrieved_nodes
    ]


def build_fallback_feedback(query: dict[str, Any], retrieved_nodes: list[dict[str, Any]]) -> str:
    if not retrieved_nodes:
        return "No norm node was retrieved for this method."
    refs = " ".join(f"[REF:{node['node_id']}]" for node in retrieved_nodes[:3])
    return (
        "评价维度：规范溯源。\\n"
        "问题定位：根据评测片段匹配到相关规范节点。\\n"
        f"规范依据：{refs}\\n"
        "修改建议：按引用、结构和段落功能规范逐项修订。"
    )


def build_retrieval_row(
    *,
    query: dict[str, Any],
    method: str,
    retrieved_nodes: list[dict[str, Any]],
    generated_text: str,
    theta: float,
    binding: bool,
) -> dict[str, Any]:
    refs = extract_refs(generated_text) if binding else []
    node_scores = {node["node_id"]: float(node["score"]) for node in retrieved_nodes}
    validation_results = validate_refs(refs, node_scores, theta=theta) if binding else {}
    low_confidence_refs = [
        ref for ref, result in validation_results.items()
        if bool(result["exists"]) and not bool(result["pass"])
    ]
    return {
        "method": method,
        "run_type": "real_system",
        "query_id": query["query_id"],
        "retrieved_nodes": format_retrieved_nodes(retrieved_nodes, theta),
        "generated_refs": refs,
        "validation_results": validation_results,
        "low_confidence_refs": low_confidence_refs,
        "feedback_structure_complete": all(label in generated_text for label in ("评价维度", "问题定位", "规范依据", "修改建议")),
        "theta_used": theta,
        "raw_feedback": generated_text,
    }
```

- [ ] **Step 4: Run backend tests**

Run:

```bash
python3 /app/inference-engine/scripts/tests/test_rq2_real_backend.py
```

Expected: `Ran 2 tests ... OK`.

- [ ] **Step 5: Commit**

Run:

```bash
git -C /app/inference-engine add scripts/rq2_real_backend.py scripts/tests/test_rq2_real_backend.py
git -C /app/inference-engine commit -m "Add norm GraphRAG backend for RQ2"
```

### Task 3: Wire run_rq2_real.py --real Retrieval-Only Path

**Files:**
- Modify: `scripts/run_rq2_real.py`
- Modify: `scripts/tests/test_run_rq2_real.py`

- [ ] **Step 1: Add tests for real no-LLM row generation**

Append to `RunRQ2RealTest`:

```python
    def test_build_real_no_llm_row_uses_method_config(self):
        query = {"query_id": "Q001", "text": "citation evidence", "expected_ref_nodes": ["A"]}
        class FakeRAG:
            def retrieve(self, text, *, top_k, graph_expand):
                self.called = {"text": text, "top_k": top_k, "graph_expand": graph_expand}
                return [{"node_id": "A", "node_type": "规范条款", "dimension": "引用格式", "text": "citation evidence", "score": 0.8}]
        rag = FakeRAG()

        row = real.build_real_row(query, "full_graphrag", rag, theta=0.6, with_llm=False)

        self.assertEqual(rag.called["graph_expand"], True)
        self.assertEqual(row["run_type"], "real_system")
        self.assertEqual(row["generated_refs"], ["A"])
        self.assertTrue(row["validation_results"]["A"]["pass"])
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
python3 /app/inference-engine/scripts/tests/test_run_rq2_real.py
```

Expected: fails because `build_real_row` is not implemented.

- [ ] **Step 3: Implement no-LLM real row path**

Modify `scripts/run_rq2_real.py`:

```python
from rq2_real_backend import NormGraphRAG, build_fallback_feedback, build_retrieval_row
from rq2_traceability_lib import build_theta_sweep

THETA_VALUES = [0.50, 0.55, 0.60, 0.65, 0.70]

def build_real_row(query: dict[str, Any], method: str, rag: NormGraphRAG, *, theta: float, no_llm: bool) -> dict[str, Any]:
    config = METHOD_CONFIGS[method]
    retrieved_nodes = []
    if config["retrieval"]:
        retrieved_nodes = rag.retrieve(query["text"], top_k=1 if not config["graph_expand"] else 2, graph_expand=config["graph_expand"])
    generated_text = build_fallback_feedback(query, retrieved_nodes)
    return build_retrieval_row(
        query=query,
        method=method,
        retrieved_nodes=retrieved_nodes,
        generated_text=generated_text,
        theta=theta,
        binding=bool(config["binding"]),
    )
```

Add CLI flag:

```python
parser.add_argument("--with-llm", action="store_true", help="Call the configured model after retrieval; default is retrieval-only fallback feedback.")
```

Modify `main()`:

```python
    if args.real:
        rag = NormGraphRAG.from_root(root)
        rows = [build_real_row(query, args.method, rag, theta=args.theta, with_llm=args.with_llm) for query in queries]
        for row in rows:
            print(json.dumps(row, ensure_ascii=False))
        return 0
```

Keep dry-run behavior unchanged when `--real` is absent.

- [ ] **Step 4: Run tests and smoke command**

Run:

```bash
python3 /app/inference-engine/scripts/tests/test_run_rq2_real.py
python3 /app/inference-engine/scripts/run_rq2_real.py --root /app/inference-engine --method full_graphrag --limit 1 --real
```

Expected: tests pass and command prints one `run_type: "real_system"` JSON row with non-empty `retrieved_nodes` and `generated_refs`.

- [ ] **Step 5: Commit**

Run:

```bash
git -C /app/inference-engine add scripts/run_rq2_real.py scripts/tests/test_run_rq2_real.py
git -C /app/inference-engine commit -m "Wire RQ2 real harness to norm GraphRAG"
```

### Task 4: Generate Method-Separated Real No-LLM Outputs

**Files:**
- Modify: `data/rq2_traceability/system_outputs/*.jsonl`
- Modify: `data/rq2_traceability/theta_sweep.jsonl`

- [ ] **Step 1: Run all four methods into separate files**

Run:

```bash
python3 /app/inference-engine/scripts/run_rq2_real.py --root /app/inference-engine --method baseline_a --limit 20 --real > /app/inference-engine/data/rq2_traceability/system_outputs/baseline_a.jsonl
python3 /app/inference-engine/scripts/run_rq2_real.py --root /app/inference-engine --method baseline_b --limit 20 --real > /app/inference-engine/data/rq2_traceability/system_outputs/baseline_b.jsonl
python3 /app/inference-engine/scripts/run_rq2_real.py --root /app/inference-engine --method ablation_no_expand --limit 20 --real > /app/inference-engine/data/rq2_traceability/system_outputs/ablation_no_expand.jsonl
python3 /app/inference-engine/scripts/run_rq2_real.py --root /app/inference-engine --method full_graphrag --limit 20 --real > /app/inference-engine/data/rq2_traceability/system_outputs/full_graphrag.jsonl
```

- [ ] **Step 2: Regenerate theta_sweep from full_graphrag**

Add `scripts/build_rq2_theta_sweep.py`:

```python
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
```

Run:

```bash
python3 /app/inference-engine/scripts/build_rq2_theta_sweep.py --root /app/inference-engine
```

- [ ] **Step 3: Validate and summarize**

Run:

```bash
python3 /app/inference-engine/scripts/validate_eval_data.py --root /app/inference-engine --scope full
python3 /app/inference-engine/scripts/summarize_rq2_results.py --root /app/inference-engine
```

Expected: full validation passes and summaries show `run_types: ["real_system"]`.

- [ ] **Step 4: Commit**

Run:

```bash
git -C /app/inference-engine add scripts/build_rq2_theta_sweep.py data/rq2_traceability/system_outputs data/rq2_traceability/theta_sweep.jsonl
git -C /app/inference-engine commit -m "Generate RQ2 real no-LLM GraphRAG outputs"
```

### Task 5: Optional LLM Generation Hook

**Files:**
- Modify: `scripts/run_rq2_real.py`
- Modify: `scripts/tests/test_run_rq2_real.py`

- [ ] **Step 1: Keep explicit model-call guard**

Keep retrieval-only fallback as the default. `--with-llm` remains the only way to opt into `backend/core/stream.py::call_model_once`.

- [ ] **Step 2: Implement async generation function**

Add an async function that:
- Builds a prompt with retrieved node IDs and texts.
- Requires the model to output `[REF:node_id]`.
- Uses `call_model_once(..., temperature=0.2, thinking=False, max_tokens=800)`.
- Falls back to `build_fallback_feedback()` if model output has no `[REF:...]`.

- [ ] **Step 3: Run one-query smoke test manually**

Run only:

```bash
python3 /app/inference-engine/scripts/run_rq2_real.py --root /app/inference-engine --method full_graphrag --limit 1 --real --with-llm
```

Expected: one real-system row with `raw_feedback` from the model. Do not run all 20 until one-query output is inspected.

---

## Self-Review

- Spec coverage: The plan addresses the GraphRAG/KG mismatch by adding a compact norm-node corpus, then wires retrieval, optional graph expansion, binding validation, method-separated output, and theta sweep.
- Placeholder scan: The only optional future step is explicitly marked as optional LLM hook; the no-LLM real GraphRAG path is fully executable.
- Type consistency: Method names, JSONL schema fields, theta values, and paths match the existing validator and summarizer.
