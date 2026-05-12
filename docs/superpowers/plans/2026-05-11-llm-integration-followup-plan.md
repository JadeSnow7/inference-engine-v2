# LLM Integration Follow-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining LLM-integration work after the ModelScope embedding fix: make the environment reproducible, wire RQ2 `--with-llm` safely, and preserve clear thesis/audit boundaries.

**Architecture:** Keep production chat paths distinct: `/api/chat` normal mode uses `main_loop`, `/api/chat` with `mode=norms` uses 百炼应用, and RQ2 uses the script-local `NormGraphRAG` harness. Local embedding models must load from a local ModelScope cache through `EMBED_MODEL`; RQ2 LLM generation must be opt-in through `--with-llm` and must never be used in default no-LLM collection.

**Tech Stack:** Python 3.12, `unittest`, FastAPI TestClient, DashScope OpenAI-compatible `call_model_once`, 百炼 Application API, ModelScope-downloaded `BAAI/bge-small-zh-v1.5`, JSON/JSONL.

---

## Current Baseline

- Backend venv: `/root/.venvs/inference-engine-backend`
- Local embedding model: `/root/.cache/modelscope/BAAI/bge-small-zh-v1.5`
- Required local-RAG env:

```bash
EMBED_MODEL=/root/.cache/modelscope/BAAI/bge-small-zh-v1.5
HF_HUB_OFFLINE=1
TRANSFORMERS_OFFLINE=1
```

- Verified backend command:

```bash
PYTHONPATH=/app/inference-engine/backend \
EMBED_MODEL=/root/.cache/modelscope/BAAI/bge-small-zh-v1.5 \
HF_HUB_OFFLINE=1 \
TRANSFORMERS_OFFLINE=1 \
/root/.venvs/inference-engine-backend/bin/python -B -m unittest discover -s /app/inference-engine/backend/tests -p 'test_*.py'
```

Expected: `Ran 52 tests ... OK`

- Verified script command:

```bash
python3 -B -m unittest discover -s /app/inference-engine/scripts/tests -p 'test_*.py'
```

Expected: `Ran 20 tests ... OK`

## Files

- Modify: `backend/rag/graph.py`
  - Keep `build_demo_graph(encoder=None)` and `EMBED_MODEL` support.
- Modify: `backend/tests/test_retriever.py`
  - Keep fake embedder injection and `EMBED_MODEL` override regression.
- Create: `backend/requirements-test.txt`
  - Record backend test-only packages not in production requirements.
- Create: `scripts/download_modelscope_embedding.py`
  - Deterministic ModelScope download helper for `BAAI/bge-small-zh-v1.5`.
- Modify: `scripts/run_rq2_real.py`
  - Add a small injectable LLM generation path for `--with-llm`.
- Modify: `scripts/tests/test_run_rq2_real.py`
  - Add tests for real LLM generation routing using a fake generator.
- Modify: `data/rq2_traceability/README.md`
  - Document no-LLM vs LLM-enabled RQ2 runs.

---

### Task 1: Commit Current ModelScope And Boundary-Test Work

**Files:**
- Stage existing changes:
  - `backend/rag/graph.py`
  - `backend/tests/test_retriever.py`
  - `backend/tests/test_chat_api.py`
  - `backend/tests/test_bailian_app.py`
  - `backend/tests/test_norms_loop.py`
  - `scripts/run_rq2_real.py`
  - `scripts/tests/test_run_rq2_real.py`

- [ ] **Step 1: Run backend tests with local ModelScope embedding**

```bash
PYTHONPATH=/app/inference-engine/backend \
EMBED_MODEL=/root/.cache/modelscope/BAAI/bge-small-zh-v1.5 \
HF_HUB_OFFLINE=1 \
TRANSFORMERS_OFFLINE=1 \
/root/.venvs/inference-engine-backend/bin/python -B -m unittest discover -s /app/inference-engine/backend/tests -p 'test_*.py'
```

Expected: `Ran 52 tests ... OK`

- [ ] **Step 2: Run script tests**

```bash
python3 -B -m unittest discover -s /app/inference-engine/scripts/tests -p 'test_*.py'
```

Expected: `Ran 20 tests ... OK`

- [ ] **Step 3: Inspect diff**

```bash
git -C /app/inference-engine diff --stat
git -C /app/inference-engine diff -- backend/rag/graph.py backend/tests/test_retriever.py scripts/run_rq2_real.py
```

Expected: only intended LLM/ModelScope/test-boundary changes.

- [ ] **Step 4: Commit**

```bash
git -C /app/inference-engine add \
  backend/rag/graph.py \
  backend/tests/test_retriever.py \
  backend/tests/test_chat_api.py \
  backend/tests/test_bailian_app.py \
  backend/tests/test_norms_loop.py \
  scripts/run_rq2_real.py \
  scripts/tests/test_run_rq2_real.py

git -C /app/inference-engine commit -m "Add LLM integration boundary tests"
```

---

### Task 2: Make ModelScope Setup Reproducible

**Files:**
- Create: `backend/requirements-test.txt`
- Create: `scripts/download_modelscope_embedding.py`
- Modify: `data/rq2_traceability/README.md`

- [ ] **Step 1: Create test requirements file**

Create `backend/requirements-test.txt`:

```text
pytest>=9.0.0
pytest-asyncio>=1.3.0
modelscope>=1.36.0
```

- [ ] **Step 2: Create ModelScope download helper**

Create `scripts/download_modelscope_embedding.py`:

```python
#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

from modelscope.hub.snapshot_download import snapshot_download


DEFAULT_MODEL_ID = "BAAI/bge-small-zh-v1.5"
DEFAULT_CACHE_DIR = Path.home() / ".cache" / "modelscope"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download the local embedding model from ModelScope.")
    parser.add_argument("--model-id", default=DEFAULT_MODEL_ID)
    parser.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE_DIR)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    path = snapshot_download(args.model_id, cache_dir=str(args.cache_dir))
    print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 3: Add README setup note**

Append to `data/rq2_traceability/README.md`:

```markdown
## Local Embedding Model Setup

Local GraphRAG tests should use a ModelScope-downloaded BGE embedding model instead of downloading from Hugging Face at runtime.

```bash
/root/.venvs/inference-engine-backend/bin/python scripts/download_modelscope_embedding.py
export EMBED_MODEL=/root/.cache/modelscope/BAAI/bge-small-zh-v1.5
export HF_HUB_OFFLINE=1
export TRANSFORMERS_OFFLINE=1
```

The RQ2 no-LLM harness does not require this embedding model; it uses script-local Jaccard retrieval over `norm_nodes.json`.
```

- [ ] **Step 4: Verify helper**

```bash
/root/.venvs/inference-engine-backend/bin/python /app/inference-engine/scripts/download_modelscope_embedding.py
```

Expected: prints a local ModelScope path such as `/root/.cache/modelscope/BAAI/bge-small-zh-v1___5`.

- [ ] **Step 5: Commit**

```bash
git -C /app/inference-engine add backend/requirements-test.txt scripts/download_modelscope_embedding.py data/rq2_traceability/README.md
git -C /app/inference-engine commit -m "Document ModelScope embedding setup"
```

---

### Task 3: Add Test-First RQ2 LLM Generation Hook

**Files:**
- Modify: `scripts/run_rq2_real.py`
- Modify: `scripts/tests/test_run_rq2_real.py`

- [ ] **Step 1: Add failing fake-generator test**

Add to `scripts/tests/test_run_rq2_real.py`:

```python
def test_build_real_row_with_llm_uses_injected_generator(self):
    query = {"query_id": "Q001", "text": "citation evidence", "expected_ref_nodes": ["A"]}

    class FakeRAG:
        def retrieve(self, text, *, top_k, graph_expand):
            return [{"node_id": "A", "node_type": "规范条款", "dimension": "引用格式", "text": "citation evidence", "score": 0.8}]

    calls = []

    def fake_generator(*, query, method, retrieved_nodes):
        calls.append((query["query_id"], method, [node["node_id"] for node in retrieved_nodes]))
        return "评价维度：规范溯源。\n问题定位：citation evidence\n规范依据：[REF:A]\n修改建议：revise citation."

    row = real.build_real_row(
        query,
        "full_graphrag",
        FakeRAG(),
        theta=0.6,
        with_llm=True,
        llm_generator=fake_generator,
    )

    self.assertEqual(calls, [("Q001", "full_graphrag", ["A"])])
    self.assertEqual(row["run_type"], "real_system_llm")
    self.assertEqual(row["generated_refs"], ["A"])
    self.assertTrue(row["validation_results"]["A"]["pass"])
```

- [ ] **Step 2: Run the single test and confirm failure**

```bash
python3 -B -m unittest discover -s /app/inference-engine/scripts/tests -p 'test_run_rq2_real.py'
```

Expected failure: `build_real_row() got an unexpected keyword argument 'llm_generator'`.

- [ ] **Step 3: Implement injectable generator**

Modify `scripts/run_rq2_real.py`:

```python
from collections.abc import Callable
```

Change signature:

```python
def build_real_row(
    query: dict[str, Any],
    method: str,
    rag: NormGraphRAG,
    *,
    theta: float,
    with_llm: bool,
    llm_generator: Callable[..., str] | None = None,
) -> dict[str, Any]:
```

Replace the current `with_llm` block with:

```python
    if with_llm and llm_generator is None:
        raise RuntimeError("LLM generation is not wired yet; provide llm_generator or run without --with-llm")
```

Set generated text:

```python
    if with_llm:
        generated_text = llm_generator(query=query, method=method, retrieved_nodes=retrieved_nodes)
        row = build_retrieval_row(
            query=query,
            method=method,
            retrieved_nodes=retrieved_nodes,
            generated_text=generated_text,
            theta=theta,
            binding=bool(config["binding"]),
        )
        row["run_type"] = "real_system_llm"
        return row
```

Keep no-LLM behavior unchanged.

- [ ] **Step 4: Run script tests**

```bash
python3 -B -m unittest discover -s /app/inference-engine/scripts/tests -p 'test_*.py'
```

Expected: all script tests pass.

- [ ] **Step 5: Commit**

```bash
git -C /app/inference-engine add scripts/run_rq2_real.py scripts/tests/test_run_rq2_real.py
git -C /app/inference-engine commit -m "Add injectable RQ2 LLM generation hook"
```

---

### Task 4: Wire Real RQ2 LLM Generation Behind `--with-llm`

**Files:**
- Modify: `scripts/run_rq2_real.py`
- Modify: `scripts/tests/test_run_rq2_real.py`

- [ ] **Step 1: Add prompt-builder test**

Add to `scripts/tests/test_run_rq2_real.py`:

```python
def test_build_llm_prompt_contains_query_nodes_and_ref_instruction(self):
    query = {"query_id": "Q001", "text": "citation evidence"}
    nodes = [{"node_id": "A", "node_type": "规范条款", "dimension": "引用格式", "text": "Every claim needs a source.", "score": 0.8}]

    messages = real.build_llm_messages(query=query, method="full_graphrag", retrieved_nodes=nodes)

    joined = "\n".join(message["content"] for message in messages)
    self.assertIn("Q001", joined)
    self.assertIn("citation evidence", joined)
    self.assertIn("A", joined)
    self.assertIn("[REF:A]", joined)
```

- [ ] **Step 2: Implement prompt builder**

Add to `scripts/run_rq2_real.py`:

```python
def build_llm_messages(*, query: dict[str, Any], method: str, retrieved_nodes: list[dict[str, Any]]) -> list[dict[str, str]]:
    refs = " ".join(f"[REF:{node['node_id']}]" for node in retrieved_nodes[:3])
    node_lines = "\n".join(
        f"- {node['node_id']} ({node['node_type']}, {node['dimension']}): {node['text']}"
        for node in retrieved_nodes
    )
    return [
        {
            "role": "system",
            "content": (
                "You generate concise academic writing feedback. "
                "Use the four Chinese labels: 评价维度, 问题定位, 规范依据, 修改建议. "
                "When citing norm nodes, use exact reference tags such as [REF:node_id]."
            ),
        },
        {
            "role": "user",
            "content": (
                f"query_id: {query['query_id']}\n"
                f"method: {method}\n"
                f"writing snippet:\n{query['text']}\n\n"
                f"retrieved norm nodes:\n{node_lines}\n\n"
                f"Use these reference tags when relevant: {refs}"
            ),
        },
    ]
```

- [ ] **Step 3: Add DashScope generator wrapper**

Add to `scripts/run_rq2_real.py`:

```python
def build_dashscope_llm_generator(root: Path) -> Callable[..., str]:
    backend_dir = root / "backend"
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    from core.stream import call_model_once
    import asyncio

    def generate(*, query: dict[str, Any], method: str, retrieved_nodes: list[dict[str, Any]]) -> str:
        messages = build_llm_messages(query=query, method=method, retrieved_nodes=retrieved_nodes)
        return asyncio.run(call_model_once(messages, temperature=0.2, thinking=False, max_tokens=800))

    return generate
```

- [ ] **Step 4: Use wrapper in CLI only when requested**

Modify `main()` in `scripts/run_rq2_real.py`:

```python
        llm_generator = build_dashscope_llm_generator(root) if args.with_llm else None
        try:
            for query in queries:
                print(json.dumps(build_real_row(
                    query,
                    args.method,
                    rag,
                    theta=args.theta,
                    with_llm=args.with_llm,
                    llm_generator=llm_generator,
                ), ensure_ascii=False))
```

- [ ] **Step 5: Run no-LLM regression**

```bash
python3 /app/inference-engine/scripts/run_rq2_real.py --root /app/inference-engine --method full_graphrag --limit 1 --real
```

Expected: one JSON row, `run_type` remains `real_system`.

- [ ] **Step 6: Run tests**

```bash
python3 -B -m unittest discover -s /app/inference-engine/scripts/tests -p 'test_*.py'
```

Expected: all script tests pass.

- [ ] **Step 7: Commit**

```bash
git -C /app/inference-engine add scripts/run_rq2_real.py scripts/tests/test_run_rq2_real.py
git -C /app/inference-engine commit -m "Wire optional RQ2 LLM generation"
```

---

### Task 5: Real LLM Smoke Test Gate

**Files:**
- No code changes required unless test reveals a real bug.

- [ ] **Step 1: Confirm no secrets are printed**

Run with environment already configured externally. Do not read `.env`.

```bash
python3 /app/inference-engine/scripts/run_rq2_real.py \
  --root /app/inference-engine \
  --method full_graphrag \
  --limit 1 \
  --real \
  --with-llm
```

Expected:
- exits `0`
- prints one JSON row
- row has `run_type="real_system_llm"`
- row has `raw_feedback`
- no API key or signed URL appears in stdout/stderr

- [ ] **Step 2: Validate one-row semantics**

```bash
python3 - <<'PY'
import json, subprocess, sys
cmd = [
    'python3', '/app/inference-engine/scripts/run_rq2_real.py',
    '--root', '/app/inference-engine',
    '--method', 'full_graphrag',
    '--limit', '1',
    '--real',
    '--with-llm',
]
result = subprocess.run(cmd, capture_output=True, text=True, check=True)
row = json.loads(result.stdout.splitlines()[0])
assert row['run_type'] == 'real_system_llm'
assert row['query_id'] == 'Q001'
assert isinstance(row['raw_feedback'], str) and row['raw_feedback']
print('LLM smoke PASS')
PY
```

Expected: `LLM smoke PASS`

---

### Task 6: Regenerate RQ2 LLM Outputs Only After Smoke Passes

**Files:**
- Modify generated outputs:
  - `data/rq2_traceability/system_outputs/baseline_a.jsonl`
  - `data/rq2_traceability/system_outputs/baseline_b.jsonl`
  - `data/rq2_traceability/system_outputs/ablation_no_expand.jsonl`
  - `data/rq2_traceability/system_outputs/full_graphrag.jsonl`
  - `data/rq2_traceability/theta_sweep.jsonl`

- [ ] **Step 1: Run all methods with LLM**

```bash
for METHOD in baseline_a baseline_b ablation_no_expand full_graphrag; do
  python3 scripts/run_rq2_real.py \
    --root /app/inference-engine \
    --method "$METHOD" \
    --limit 20 \
    --real \
    --with-llm \
    > "data/rq2_traceability/system_outputs/${METHOD}.jsonl"
  echo "Done: $METHOD"
done
```

- [ ] **Step 2: Rebuild theta sweep and summary**

```bash
python3 scripts/build_rq2_theta_sweep.py --root /app/inference-engine
python3 scripts/summarize_rq2_results.py --root /app/inference-engine
```

- [ ] **Step 3: Validate generated data**

```bash
python3 scripts/validate_eval_data.py --root /app/inference-engine --scope full
python3 -B -m unittest discover -s scripts/tests -p 'test_*.py'
```

Expected:
- validation passes
- script tests pass

- [ ] **Step 4: Commit generated LLM outputs**

```bash
git -C /app/inference-engine add \
  data/rq2_traceability/system_outputs/baseline_a.jsonl \
  data/rq2_traceability/system_outputs/baseline_b.jsonl \
  data/rq2_traceability/system_outputs/ablation_no_expand.jsonl \
  data/rq2_traceability/system_outputs/full_graphrag.jsonl \
  data/rq2_traceability/theta_sweep.jsonl

git -C /app/inference-engine commit -m "Generate RQ2 LLM-backed outputs"
```

---

### Task 7: Thesis Boundary Update Checklist

**Files:**
- Thesis repo files are outside `/app/inference-engine`; apply only after locating the actual thesis path.

- [ ] **Step 1: Update RQ2 wording based on actual state**

Use one of these exact labels:

- Before Task 6 passes: `本地检索与绑定验证实验，不包含真实 LLM 生成`
- After Task 6 passes: `真实 LLM 生成 + 本地规范节点检索/图扩展/绑定验证`

- [ ] **Step 2: Keep production path wording separate**

Use this wording:

```text
在线规范反馈路径通过 /api/chat 的 mode=norms 进入百炼应用；RQ2 实验路径通过脚本内 NormGraphRAG 执行规范节点检索、图扩展和绑定验证。
```

- [ ] **Step 3: Mention ModelScope embedding only for local GraphRAG**

Use this wording:

```text
本地 GraphRAG 演示路径使用从 ModelScope 本地缓存加载的 BAAI/bge-small-zh-v1.5 嵌入模型；默认部署配置下 ENABLE_LOCAL_RAG 为关闭状态。
```

---

## Final Verification

Run these before reporting completion:

```bash
PYTHONPATH=/app/inference-engine/backend \
EMBED_MODEL=/root/.cache/modelscope/BAAI/bge-small-zh-v1.5 \
HF_HUB_OFFLINE=1 \
TRANSFORMERS_OFFLINE=1 \
/root/.venvs/inference-engine-backend/bin/python -B -m unittest discover -s /app/inference-engine/backend/tests -p 'test_*.py'

python3 -B -m unittest discover -s /app/inference-engine/scripts/tests -p 'test_*.py'
python3 scripts/validate_eval_data.py --root /app/inference-engine --scope full
git -C /app/inference-engine status --short
```

Expected:
- backend tests pass
- script tests pass
- evaluation data validation passes
- git status contains only intended files, or is clean after commits
