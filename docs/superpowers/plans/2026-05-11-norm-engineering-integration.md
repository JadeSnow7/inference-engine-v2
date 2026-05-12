# Norm Engineering Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add semantic norm-node retrieval, inject norm-node context into `/api/chat mode=norms`, and register `/v1/writing/analyze` without breaking the existing Bailian production path.

**Architecture:** Add a dedicated `NormNodeRetriever` for the 107-node writing-norm corpus. It loads embedded nodes when available, falls back to the raw corpus for Jaccard retrieval, and never exposes embeddings through public APIs. The existing Bailian norms path remains the generator; local retrieval only enriches the prompt and powers the analysis endpoint.

**Tech Stack:** Python 3.12, FastAPI, Pydantic, NumPy, OpenAI-compatible DashScope client, unittest, FastAPI TestClient.

---

## File Map

- Create `backend/rag/norm_retriever.py`: corpus loading, cosine/Jaccard retrieval, `related` expansion, validation, context formatting.
- Create `backend/rag/embed_adapter.py`: DashScope `text-embedding-v3` adapter with `.embed(text)`.
- Create `backend/api/writing.py`: authenticated `POST /v1/writing/analyze`.
- Create `scripts/build_norm_node_embeddings.py`: reproducible embedding-cache builder.
- Modify `backend/main.py`: initialize `app.state.norm_retriever`, register writing router.
- Modify `backend/api/chat.py`: pass `app.state.norm_retriever` to `norms_loop`.
- Modify `backend/core/norms.py`: build/inject norm context while preserving Bailian streaming.
- Add/modify tests in `backend/tests/` and `scripts/tests/`.

## Test Commands

Backend unit tests:

```bash
PYTHONPATH=/app/inference-engine/backend \
EMBED_MODEL=/root/.cache/modelscope/BAAI/bge-small-zh-v1.5 \
HF_HUB_OFFLINE=1 \
TRANSFORMERS_OFFLINE=1 \
/root/.venvs/inference-engine-backend/bin/python -B -m unittest discover -s /app/inference-engine/backend/tests -p 'test_*.py'
```

Script unit tests:

```bash
python3 -B -m unittest discover -s /app/inference-engine/scripts/tests -p 'test_*.py'
```

Evaluation data validation:

```bash
python3 scripts/validate_eval_data.py --root /app/inference-engine --scope full
```

---

### Task 1: Implement `NormNodeRetriever`

**Files:**
- Create: `backend/rag/norm_retriever.py`
- Create: `backend/tests/test_norm_retriever.py`

- [ ] **Step 1: Write failing retriever tests**

Create `backend/tests/test_norm_retriever.py`:

```python
import json
import os
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")


RAW_NODES = [
    {
        "node_id": "NRM-CIT-001",
        "node_type": "规范条款",
        "dimension": "引用格式",
        "text": "Claims about prior studies must cite the original source in a clear citation format.",
        "related": ["SUG-CIT-001"],
    },
    {
        "node_id": "SUG-CIT-001",
        "node_type": "修改建议",
        "dimension": "引用格式",
        "text": "Add a source immediately after each empirical claim and keep citation style consistent.",
        "related": ["NRM-CIT-001"],
    },
    {
        "node_id": "NRM-STR-001",
        "node_type": "规范条款",
        "dimension": "章节结构",
        "text": "The method section should describe data, procedure, configuration, and metrics reproducibly.",
        "related": [],
    },
]


class FakeEmbedder:
    def __init__(self, vectors):
        self.vectors = vectors
        self.calls = []

    def embed(self, text):
        self.calls.append(text)
        return self.vectors[text]


class FailingEmbedder:
    def embed(self, text):
        raise RuntimeError("provider failed with sensitive details")


class NormNodeRetrieverTest(unittest.TestCase):
    def test_falls_back_to_raw_corpus_when_embedding_cache_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            raw_path = root / "norm_nodes.json"
            embedded_path = root / "norm_nodes_with_embeddings.json"
            raw_path.write_text(json.dumps(RAW_NODES, ensure_ascii=False), encoding="utf-8")

            from rag.norm_retriever import NormNodeRetriever

            retriever = NormNodeRetriever(corpus_path=embedded_path, raw_corpus_path=raw_path)

            self.assertEqual(len(retriever), 3)
            rows = retriever.retrieve("empirical claim citation source", top_k=2)
            self.assertEqual(rows[0]["node_id"], "NRM-CIT-001")
            self.assertNotIn("embedding", rows[0])

    def test_cosine_retrieval_uses_fake_embedder_and_omits_embeddings(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "norm_nodes_with_embeddings.json"
            embedded = [
                {**RAW_NODES[0], "embedding": [1.0, 0.0]},
                {**RAW_NODES[1], "embedding": [0.8, 0.2]},
                {**RAW_NODES[2], "embedding": [0.0, 1.0]},
            ]
            path.write_text(json.dumps(embedded, ensure_ascii=False), encoding="utf-8")

            from rag.norm_retriever import NormNodeRetriever

            retriever = NormNodeRetriever(corpus_path=path, embedder=FakeEmbedder({"citation query": [1.0, 0.0]}))
            rows = retriever.retrieve("citation query", top_k=2, theta=0.5)

            self.assertEqual([row["node_id"] for row in rows], ["NRM-CIT-001", "SUG-CIT-001"])
            self.assertTrue(all("embedding" not in row for row in rows))

    def test_expand_follows_related_edges_dedupes_and_omits_seed_nodes(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw_path = Path(tmp) / "norm_nodes.json"
            raw_path.write_text(json.dumps(RAW_NODES, ensure_ascii=False), encoding="utf-8")

            from rag.norm_retriever import NormNodeRetriever

            retriever = NormNodeRetriever(corpus_path=Path(tmp) / "missing.json", raw_corpus_path=raw_path)
            expanded = retriever.expand(["NRM-CIT-001"], hops=2)

            self.assertEqual([row["node_id"] for row in expanded], ["SUG-CIT-001"])
            self.assertTrue(expanded[0]["via_expand"])
            self.assertNotIn("embedding", expanded[0])

    def test_validate_ref_unknown_returns_false_and_embedder_failure_uses_jaccard(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw_path = Path(tmp) / "norm_nodes.json"
            raw_path.write_text(json.dumps(RAW_NODES, ensure_ascii=False), encoding="utf-8")

            from rag.norm_retriever import NormNodeRetriever

            retriever = NormNodeRetriever(
                corpus_path=Path(tmp) / "missing.json",
                raw_corpus_path=raw_path,
                embedder=FailingEmbedder(),
            )

            self.assertEqual(retriever.validate_ref("UNKNOWN", "citation", theta=0.1), (False, 0.0))
            passed, score = retriever.validate_ref("NRM-CIT-001", "source citation claim", theta=0.05)
            self.assertTrue(passed)
            self.assertGreater(score, 0.0)

    def test_format_context_uses_stable_ref_template(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw_path = Path(tmp) / "norm_nodes.json"
            raw_path.write_text(json.dumps(RAW_NODES, ensure_ascii=False), encoding="utf-8")

            from rag.norm_retriever import NormNodeRetriever

            retriever = NormNodeRetriever(corpus_path=Path(tmp) / "missing.json", raw_corpus_path=raw_path)
            rows = retriever.retrieve("citation source", top_k=1)
            context = retriever.format_context(rows)

            self.assertIn("Relevant norm nodes", context)
            self.assertIn("[REF:NRM-CIT-001]", context)
            self.assertIn("type=规范条款", context)
            self.assertIn("dimension=引用格式", context)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run retriever tests and confirm failure**

```bash
PYTHONPATH=/app/inference-engine/backend /root/.venvs/inference-engine-backend/bin/python -B -m unittest /app/inference-engine/backend/tests/test_norm_retriever.py
```

Expected: `ModuleNotFoundError: No module named 'rag.norm_retriever'`.

- [ ] **Step 3: Implement `backend/rag/norm_retriever.py`**

```python
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import numpy as np


RQ2_DIR = Path(__file__).resolve().parents[2] / "data" / "rq2_traceability"
DEFAULT_EMBEDDED_CORPUS = RQ2_DIR / "norm_nodes_with_embeddings.json"
DEFAULT_RAW_CORPUS = RQ2_DIR / "norm_nodes.json"


class NormNodeRetriever:
    def __init__(
        self,
        corpus_path: Path = DEFAULT_EMBEDDED_CORPUS,
        *,
        raw_corpus_path: Path = DEFAULT_RAW_CORPUS,
        embedder: Any | None = None,
    ) -> None:
        self._nodes: dict[str, dict[str, Any]] = {}
        self._embedder = embedder
        self._load(corpus_path, raw_corpus_path)

    def _load(self, corpus_path: Path, raw_corpus_path: Path) -> None:
        path = corpus_path if corpus_path.exists() else raw_corpus_path
        if not path.exists():
            return
        raw = json.loads(path.read_text(encoding="utf-8"))
        for node in raw:
            emb = node.get("embedding")
            self._nodes[node["node_id"]] = {
                **node,
                "embedding": np.asarray(emb, dtype=float) if emb else None,
            }

    def _public_node(self, node: dict[str, Any], *, score: float | None = None, via_expand: bool = False) -> dict[str, Any]:
        public = {
            "node_id": node["node_id"],
            "node_type": node["node_type"],
            "dimension": node["dimension"],
            "text": node["text"],
            "related": list(node.get("related", [])),
        }
        if score is not None:
            public["score"] = round(float(score), 4)
        if via_expand:
            public["via_expand"] = True
        return public

    def _cosine(self, a: np.ndarray | None, b: np.ndarray | None) -> float:
        if a is None or b is None:
            return 0.0
        denom = float(np.linalg.norm(a) * np.linalg.norm(b))
        return 0.0 if math.isclose(denom, 0.0) else float(np.dot(a, b) / denom)

    def _jaccard(self, query: str, text: str) -> float:
        a = set(query.lower().split())
        b = set(text.lower().split())
        return len(a & b) / len(a | b) if a or b else 0.0

    def _embed_query(self, query: str) -> np.ndarray | None:
        if self._embedder is None:
            return None
        try:
            return np.asarray(self._embedder.embed(query), dtype=float)
        except Exception:
            print("[norm_retriever] query embedding unavailable; using Jaccard fallback")
            return None

    def _score(self, query_emb: np.ndarray | None, query: str, node: dict[str, Any]) -> float:
        if query_emb is not None and node.get("embedding") is not None:
            return self._cosine(query_emb, node["embedding"])
        return self._jaccard(query, node.get("text", ""))

    def retrieve(self, query: str, top_k: int = 5, theta: float = 0.0) -> list[dict[str, Any]]:
        query_emb = self._embed_query(query)
        scored = [(self._score(query_emb, query, node), node) for node in self._nodes.values()]
        scored.sort(key=lambda item: item[0], reverse=True)
        return [self._public_node(node, score=score) for score, node in scored[:top_k] if score >= theta]

    def expand(self, node_ids: list[str], hops: int = 1) -> list[dict[str, Any]]:
        seeds = set(node_ids)
        seen = set(node_ids)
        frontier = list(node_ids)
        expanded: list[dict[str, Any]] = []
        for _ in range(max(0, hops)):
            next_frontier: list[str] = []
            for node_id in frontier:
                node = self._nodes.get(node_id)
                if node is None:
                    continue
                for related_id in node.get("related", []):
                    if related_id in seen or related_id in seeds or related_id not in self._nodes:
                        continue
                    seen.add(related_id)
                    next_frontier.append(related_id)
                    expanded.append(self._public_node(self._nodes[related_id], score=0.72, via_expand=True))
            frontier = next_frontier
        return expanded

    def validate_ref(self, node_id: str, query: str, theta: float = 0.6) -> tuple[bool, float]:
        node = self._nodes.get(node_id)
        if node is None:
            return False, 0.0
        query_emb = self._embed_query(query)
        score = self._score(query_emb, query, node)
        return score >= theta, round(float(score), 4)

    def get(self, node_id: str) -> dict[str, Any] | None:
        node = self._nodes.get(node_id)
        return self._public_node(node) if node is not None else None

    def format_context(self, nodes: list[dict[str, Any]]) -> str:
        if not nodes:
            return ""
        lines = ["Relevant norm nodes. Cite them as [REF:node_id]."]
        for node in nodes:
            lines.append(
                f"- [REF:{node['node_id']}] type={node['node_type']} "
                f"dimension={node['dimension']} text={node['text']}"
            )
        return "\n".join(lines)

    def __len__(self) -> int:
        return len(self._nodes)
```

- [ ] **Step 4: Run retriever tests and commit**

```bash
PYTHONPATH=/app/inference-engine/backend /root/.venvs/inference-engine-backend/bin/python -B -m unittest /app/inference-engine/backend/tests/test_norm_retriever.py
git add backend/rag/norm_retriever.py backend/tests/test_norm_retriever.py
git commit -m "Add norm node retriever"
```

Expected: `Ran 5 tests ... OK`.

---

### Task 2: Add Embedding Cache Builder And DashScope Embedder

**Files:**
- Create: `backend/rag/embed_adapter.py`
- Create: `backend/tests/test_embed_adapter.py`
- Create: `scripts/build_norm_node_embeddings.py`
- Create: `scripts/tests/test_build_norm_node_embeddings.py`

- [ ] **Step 1: Write adapter and script tests**

Create `backend/tests/test_embed_adapter.py`:

```python
import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")


class FakeEmbeddings:
    def __init__(self):
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(data=[SimpleNamespace(embedding=[0.1, 0.2])])


class FakeOpenAI:
    instances = []

    def __init__(self, **kwargs):
        self.kwargs = kwargs
        self.embeddings = FakeEmbeddings()
        FakeOpenAI.instances.append(self)


class EmbedAdapterTest(unittest.TestCase):
    def test_dashscope_embedder_uses_settings_and_returns_vector(self):
        from rag import embed_adapter

        FakeOpenAI.instances = []
        with patch.object(embed_adapter, "OpenAI", FakeOpenAI):
            embedder = embed_adapter.DashScopeEmbedder()
            vector = embedder.embed("citation text")

        self.assertEqual(vector, [0.1, 0.2])
        self.assertEqual(FakeOpenAI.instances[0].kwargs["api_key"], "test-key")
        self.assertIn("dashscope", FakeOpenAI.instances[0].kwargs["base_url"])
        self.assertEqual(FakeOpenAI.instances[0].embeddings.calls[0]["model"], "text-embedding-v3")
        self.assertEqual(FakeOpenAI.instances[0].embeddings.calls[0]["input"], ["citation text"])


if __name__ == "__main__":
    unittest.main()
```

Create `scripts/tests/test_build_norm_node_embeddings.py`:

```python
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
SCRIPT_PATH = SCRIPTS_DIR / "build_norm_node_embeddings.py"
spec = importlib.util.spec_from_file_location("build_norm_node_embeddings", SCRIPT_PATH)
builder = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules["build_norm_node_embeddings"] = builder
spec.loader.exec_module(builder)


class FakeEmbeddings:
    def __init__(self):
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(
            data=[
                SimpleNamespace(embedding=[1.0, 0.0]),
                SimpleNamespace(embedding=[0.0, 1.0]),
            ][: len(kwargs["input"])]
        )


class FakeOpenAI:
    def __init__(self, **kwargs):
        self.embeddings = FakeEmbeddings()


class BuildNormEmbeddingsTest(unittest.TestCase):
    def test_build_embeddings_writes_expected_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "norm_nodes.json"
            output = root / "norm_nodes_with_embeddings.json"
            source.write_text(json.dumps([
                {"node_id": "A", "node_type": "规范条款", "dimension": "引用格式", "text": "citation source", "related": []},
                {"node_id": "B", "node_type": "修改建议", "dimension": "引用格式", "text": "add citation", "related": ["A"]},
            ], ensure_ascii=False), encoding="utf-8")

            with patch.object(builder, "OpenAI", FakeOpenAI):
                count, dim = builder.build_embeddings(source, output, api_key="test-key", batch_size=2, sleep_seconds=0)

            rows = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual((count, dim), (2, 2))
            self.assertEqual(rows[0]["embedding"], [1.0, 0.0])
            self.assertEqual(rows[1]["node_id"], "B")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
PYTHONPATH=/app/inference-engine/backend /root/.venvs/inference-engine-backend/bin/python -B -m unittest /app/inference-engine/backend/tests/test_embed_adapter.py
python3 -B -m unittest /app/inference-engine/scripts/tests/test_build_norm_node_embeddings.py
```

Expected: import failures for missing files.

- [ ] **Step 3: Implement adapter**

Create `backend/rag/embed_adapter.py`:

```python
from __future__ import annotations

from openai import OpenAI

from config import settings


EMBED_MODEL = "text-embedding-v3"


class DashScopeEmbedder:
    def __init__(self) -> None:
        self._client = OpenAI(api_key=settings.DASHSCOPE_API_KEY, base_url=settings.DASHSCOPE_BASE_URL)

    def embed(self, text: str) -> list[float]:
        response = self._client.embeddings.create(
            model=EMBED_MODEL,
            input=[text],
            encoding_format="float",
        )
        return response.data[0].embedding
```

- [ ] **Step 4: Implement embedding builder**

Create `scripts/build_norm_node_embeddings.py`:

```python
#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path

from openai import OpenAI


DEFAULT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = DEFAULT_ROOT / "data" / "rq2_traceability" / "norm_nodes.json"
DEFAULT_OUTPUT = DEFAULT_ROOT / "data" / "rq2_traceability" / "norm_nodes_with_embeddings.json"
API_BASE = "https://dashscope.aliyuncs.com/compatible-mode/v1"
EMBED_MODEL = "text-embedding-v3"


def build_embeddings(
    source: Path,
    output: Path,
    *,
    api_key: str,
    batch_size: int = 25,
    sleep_seconds: float = 0.3,
) -> tuple[int, int]:
    client = OpenAI(api_key=api_key, base_url=API_BASE)
    nodes = json.loads(source.read_text(encoding="utf-8"))
    results = []
    dimension = None
    for index in range(0, len(nodes), batch_size):
        batch = nodes[index : index + batch_size]
        response = client.embeddings.create(
            model=EMBED_MODEL,
            input=[node["text"] for node in batch],
            encoding_format="float",
        )
        for node, item in zip(batch, response.data):
            embedding = list(item.embedding)
            if dimension is None:
                dimension = len(embedding)
            if len(embedding) != dimension:
                raise RuntimeError("Embedding dimensions are inconsistent")
            results.append({**node, "embedding": embedding})
        print(f"embedded {min(index + len(batch), len(nodes))}/{len(nodes)}")
        if sleep_seconds:
            time.sleep(sleep_seconds)
    output.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    return len(results), int(dimension or 0)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build norm-node embeddings with DashScope text-embedding-v3.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--batch-size", type=int, default=25)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    api_key = os.environ["DASHSCOPE_API_KEY"]
    count, dimension = build_embeddings(args.input, args.output, api_key=api_key, batch_size=args.batch_size)
    print(f"Done. Saved {count} nodes to {args.output}")
    print(f"Embedding dimension: {dimension}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 5: Run adapter/script tests and commit**

```bash
PYTHONPATH=/app/inference-engine/backend /root/.venvs/inference-engine-backend/bin/python -B -m unittest /app/inference-engine/backend/tests/test_embed_adapter.py
python3 -B -m unittest /app/inference-engine/scripts/tests/test_build_norm_node_embeddings.py
git add backend/rag/embed_adapter.py backend/tests/test_embed_adapter.py scripts/build_norm_node_embeddings.py scripts/tests/test_build_norm_node_embeddings.py
git commit -m "Add norm embedding builder"
```

Expected: both test files pass.

---

### Task 3: Initialize Norm Retriever At Startup

**Files:**
- Modify: `backend/main.py`
- Create: `backend/tests/test_main_norm_retriever.py`

- [ ] **Step 1: Write startup test**

Create `backend/tests/test_main_norm_retriever.py`:

```python
import os
import unittest
from unittest.mock import patch

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")


class MainNormRetrieverTest(unittest.TestCase):
    def test_build_norm_retriever_falls_back_without_raw_exception(self):
        import main

        class FailingEmbedder:
            def __init__(self):
                raise RuntimeError("provider failed with secret-like details")

        created = []

        class FakeRetriever:
            def __init__(self, embedder=None):
                created.append(embedder)

            def __len__(self):
                return 107

        with patch.object(main, "DashScopeEmbedder", FailingEmbedder), patch.object(main, "NormNodeRetriever", FakeRetriever):
            retriever = main.build_norm_retriever()

        self.assertIsInstance(retriever, FakeRetriever)
        self.assertEqual(created, [None])
```

- [ ] **Step 2: Run test and confirm failure**

```bash
PYTHONPATH=/app/inference-engine/backend /root/.venvs/inference-engine-backend/bin/python -B -m unittest /app/inference-engine/backend/tests/test_main_norm_retriever.py
```

Expected: `AttributeError` for missing `build_norm_retriever`.

- [ ] **Step 3: Modify `backend/main.py`**

Add imports near existing imports:

```python
from rag.embed_adapter import DashScopeEmbedder
from rag.norm_retriever import NormNodeRetriever
```

Add helper before `lifespan`:

```python
def build_norm_retriever() -> NormNodeRetriever:
    try:
        retriever = NormNodeRetriever(embedder=DashScopeEmbedder())
        print(f"[startup] NormNodeRetriever loaded: {len(retriever)} nodes, embedder=DashScope")
        return retriever
    except Exception:
        retriever = NormNodeRetriever()
        print(f"[startup] NormNodeRetriever loaded with Jaccard fallback: {len(retriever)} nodes")
        return retriever
```

Inside lifespan, after `app.state.rag = rag`, add:

```python
    app.state.norm_retriever = build_norm_retriever()
```

- [ ] **Step 4: Run startup test and commit**

```bash
PYTHONPATH=/app/inference-engine/backend /root/.venvs/inference-engine-backend/bin/python -B -m unittest /app/inference-engine/backend/tests/test_main_norm_retriever.py
git add backend/main.py backend/tests/test_main_norm_retriever.py
git commit -m "Initialize norm retriever at startup"
```

Expected: `Ran 1 test ... OK`.

---

### Task 4: Inject Norm Context Into `mode=norms`

**Files:**
- Modify: `backend/api/chat.py`
- Modify: `backend/core/norms.py`
- Modify: `backend/tests/test_chat_api.py`
- Modify: `backend/tests/test_norms_loop.py`

- [ ] **Step 1: Update chat and norms tests first**

In `backend/tests/test_chat_api.py`, update `_make_app()`:

```python
        app.state.norm_retriever = SimpleNamespace()
```

In `test_chat_norms_mode_routes_to_norms_loop`, after existing `calls` assertions, add:

```python
        self.assertIs(calls[0][5], client.app.state.norm_retriever)
```

In `backend/tests/test_norms_loop.py`, add:

```python
class FakeNormRetriever:
    def __len__(self):
        return 1

    def retrieve(self, query, top_k=5, theta=0.0):
        return [{
            "node_id": "NRM-CIT-001",
            "node_type": "规范条款",
            "dimension": "引用格式",
            "text": "Claims must cite sources.",
            "related": [],
            "score": 0.9,
        }]

    def expand(self, node_ids, hops=1):
        return []

    def format_context(self, nodes):
        return "Relevant norm nodes. Cite them as [REF:node_id].\n- [REF:NRM-CIT-001] type=规范条款 dimension=引用格式 text=Claims must cite sources."
```

Add test:

```python
    async def test_norms_loop_injects_norm_context_when_retriever_available(self) -> None:
        from core import norms as norms_module
        from core.bailian_app import BailianAppChunk

        prompts = []

        async def fake_stream(prompt: str, session_id: str | None = None):
            prompts.append(prompt)
            yield BailianAppChunk(text="反馈", session_id="new-app-session")

        conv = FakeConversationManager()
        original_stream = norms_module.stream_bailian_app
        norms_module.stream_bailian_app = fake_stream
        try:
            chunks = [
                parse_sse(chunk)
                async for chunk in norms_module.norms_loop(
                    "u1",
                    "sess-1",
                    "我是张三，学号S123456，请检查引用",
                    conv,
                    FakeProfileStore(),
                    norm_retriever=FakeNormRetriever(),
                )
            ]
        finally:
            norms_module.stream_bailian_app = original_stream

        self.assertEqual(chunks[-1]["type"], "done")
        self.assertIn("[REF:NRM-CIT-001]", prompts[0])
        self.assertIn("我是[姓名]，学号[学号]，请检查引用", prompts[0])
        self.assertNotIn("张三", prompts[0])
        self.assertNotIn("S123456", prompts[0])
```

Update existing `test_norms_loop_streams_references_tokens_done_and_saves_session` to call:

```python
norms_module.norms_loop("u1", "sess-1", "我是张三，学号S123456，请检查格式", conv, FakeProfileStore(), norm_retriever=None)
```

Keep its prompt assertion unchanged to prove `norm_retriever=None` preserves existing behavior.

- [ ] **Step 2: Run tests and confirm failure**

```bash
PYTHONPATH=/app/inference-engine/backend /root/.venvs/inference-engine-backend/bin/python -B -m unittest /app/inference-engine/backend/tests/test_chat_api.py /app/inference-engine/backend/tests/test_norms_loop.py
```

Expected: failure because `norms_loop()` does not accept `norm_retriever`.

- [ ] **Step 3: Modify `backend/api/chat.py`**

Change norms call to:

```python
        norms_loop(
            user_id,
            session_id,
            req.message,
            app_state.conv_manager,
            app_state.profile_store,
            getattr(app_state, "norm_retriever", None),
        )
```

- [ ] **Step 4: Modify `backend/core/norms.py`**

Change signature:

```python
async def norms_loop(
    user_id: str,
    session_id: str,
    user_message: str,
    conv: ConversationManager,
    profile_store,
    norm_retriever=None,
) -> AsyncIterator[str]:
```

Add helper above `norms_loop`:

```python
def _build_norm_prompt(safe_message: str, norm_retriever) -> str:
    if norm_retriever is None or len(norm_retriever) == 0:
        return safe_message
    candidates = norm_retriever.retrieve(safe_message, top_k=5)
    if not candidates:
        return safe_message
    expanded = norm_retriever.expand([node["node_id"] for node in candidates], hops=1)
    nodes_by_id = {node["node_id"]: node for node in candidates + expanded}
    context = norm_retriever.format_context(list(nodes_by_id.values()))
    if not context:
        return safe_message
    return f"{context}\n\nWriting snippet:\n{safe_message}"
```

Replace:

```python
        async for chunk in stream_bailian_app(safe_message, session_id=app_session_id):
```

with:

```python
        prompt = _build_norm_prompt(safe_message, norm_retriever)
        async for chunk in stream_bailian_app(prompt, session_id=app_session_id):
```

- [ ] **Step 5: Run tests and commit**

```bash
PYTHONPATH=/app/inference-engine/backend /root/.venvs/inference-engine-backend/bin/python -B -m unittest /app/inference-engine/backend/tests/test_chat_api.py /app/inference-engine/backend/tests/test_norms_loop.py
git add backend/api/chat.py backend/core/norms.py backend/tests/test_chat_api.py backend/tests/test_norms_loop.py
git commit -m "Inject norm context into norms chat path"
```

Expected: both test files pass.

---

### Task 5: Register `/v1/writing/analyze`

**Files:**
- Create: `backend/api/writing.py`
- Create: `backend/tests/test_writing_api.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write endpoint tests**

Create `backend/tests/test_writing_api.py`:

```python
import os
import unittest

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.auth import get_current_user_id
from api.responses import register_error_handlers


class FakeNormRetriever:
    def __len__(self):
        return 2

    def retrieve(self, query, top_k=5, theta=0.0):
        return [{
            "node_id": "NRM-CIT-001",
            "node_type": "规范条款",
            "dimension": "引用格式",
            "text": "Claims must cite sources.",
            "related": ["SUG-CIT-001"],
            "score": 0.91,
        }][:top_k]

    def expand(self, node_ids, hops=1):
        return [{
            "node_id": "SUG-CIT-001",
            "node_type": "修改建议",
            "dimension": "引用格式",
            "text": "Add a citation after each claim.",
            "related": ["NRM-CIT-001"],
            "score": 0.72,
            "via_expand": True,
        }]

    def validate_ref(self, node_id, query, theta=0.6):
        if node_id == "NRM-CIT-001":
            return True, 0.91
        return False, 0.0

    def get(self, node_id):
        return {"node_id": node_id} if node_id == "NRM-CIT-001" else None

    def format_context(self, nodes):
        return "Relevant norm nodes. Cite them as [REF:node_id].\n- [REF:NRM-CIT-001] type=规范条款 dimension=引用格式 text=Claims must cite sources."


class WritingApiTest(unittest.TestCase):
    def _client(self, retriever=FakeNormRetriever()):
        from api.writing import router as writing_router

        app = FastAPI()
        register_error_handlers(app)
        app.include_router(writing_router, prefix="/v1")
        app.dependency_overrides[get_current_user_id] = lambda: "u1"
        app.state.norm_retriever = retriever
        return TestClient(app)

    def test_analyze_returns_nodes_expanded_context_and_validation(self):
        client = self._client()
        response = client.post("/v1/writing/analyze", json={
            "text": "Smith (2020) reported similar findings.",
            "top_k": 5,
            "theta": 0.6,
            "refs": ["NRM-CIT-001", "INVALID-999"],
        })

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["nodes"][0]["node_id"], "NRM-CIT-001")
        self.assertEqual(data["expanded"][0]["node_id"], "SUG-CIT-001")
        self.assertIn("[REF:NRM-CIT-001]", data["context"])
        self.assertTrue(data["validation"]["NRM-CIT-001"]["exists"])
        self.assertTrue(data["validation"]["NRM-CIT-001"]["pass"])
        self.assertFalse(data["validation"]["INVALID-999"]["exists"])
        self.assertNotIn("embedding", data["nodes"][0])

    def test_analyze_returns_empty_when_retriever_missing(self):
        client = self._client(retriever=None)
        response = client.post("/v1/writing/analyze", json={"text": "sample"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"nodes": [], "expanded": [], "context": "", "validation": {}})

    def test_top_k_limit_is_enforced(self):
        client = self._client()
        response = client.post("/v1/writing/analyze", json={"text": "sample", "top_k": 21})

        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test and confirm failure**

```bash
PYTHONPATH=/app/inference-engine/backend /root/.venvs/inference-engine-backend/bin/python -B -m unittest /app/inference-engine/backend/tests/test_writing_api.py
```

Expected: `ModuleNotFoundError: No module named 'api.writing'`.

- [ ] **Step 3: Implement `backend/api/writing.py`**

```python
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from api.auth import get_current_user_id


router = APIRouter()


class AnalyzeRequest(BaseModel):
    text: str = Field(min_length=1)
    top_k: int = Field(default=5, ge=1, le=20)
    theta: float = Field(default=0.6, ge=0.0, le=1.0)
    refs: Optional[list[str]] = None


@router.post("/writing/analyze")
async def analyze_writing(
    req: AnalyzeRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    del user_id
    retriever = getattr(request.app.state, "norm_retriever", None)
    if retriever is None or len(retriever) == 0:
        return {"nodes": [], "expanded": [], "context": "", "validation": {}}

    nodes = retriever.retrieve(req.text, top_k=req.top_k, theta=0.0)
    expanded = retriever.expand([node["node_id"] for node in nodes], hops=1)
    nodes_by_id = {node["node_id"]: node for node in nodes + expanded}
    context = retriever.format_context(list(nodes_by_id.values()))

    validation = {}
    for ref_id in req.refs or []:
        passed, score = retriever.validate_ref(ref_id, req.text, theta=req.theta)
        validation[ref_id] = {
            "exists": retriever.get(ref_id) is not None,
            "score": score,
            "pass": passed,
        }

    return {
        "nodes": nodes,
        "expanded": expanded,
        "context": context,
        "validation": validation,
    }
```

- [ ] **Step 4: Register router in `backend/main.py`**

Add import:

```python
from api.writing import router as writing_router
```

Add router after chat router:

```python
app.include_router(writing_router, prefix="/v1")
```

- [ ] **Step 5: Run endpoint tests and commit**

```bash
PYTHONPATH=/app/inference-engine/backend /root/.venvs/inference-engine-backend/bin/python -B -m unittest /app/inference-engine/backend/tests/test_writing_api.py
git add backend/api/writing.py backend/main.py backend/tests/test_writing_api.py
git commit -m "Add writing analysis endpoint"
```

Expected: `Ran 3 tests ... OK`.

---

### Task 6: Full Verification And Optional Real Embedding Build

**Files:**
- Optional generated file: `data/rq2_traceability/norm_nodes_with_embeddings.json`

- [ ] **Step 1: Run full backend and script tests**

```bash
PYTHONPATH=/app/inference-engine/backend \
EMBED_MODEL=/root/.cache/modelscope/BAAI/bge-small-zh-v1.5 \
HF_HUB_OFFLINE=1 \
TRANSFORMERS_OFFLINE=1 \
/root/.venvs/inference-engine-backend/bin/python -B -m unittest discover -s /app/inference-engine/backend/tests -p 'test_*.py'

python3 -B -m unittest discover -s /app/inference-engine/scripts/tests -p 'test_*.py'
python3 scripts/validate_eval_data.py --root /app/inference-engine --scope full
```

Expected:
- backend tests pass
- script tests pass
- evaluation data validation passes

- [ ] **Step 2: If `DASHSCOPE_API_KEY` is present, build embedding cache**

Do not read `.env`; only use the current process environment.

```bash
if [ -n "${DASHSCOPE_API_KEY:-}" ]; then
  python3 scripts/build_norm_node_embeddings.py --input data/rq2_traceability/norm_nodes.json --output data/rq2_traceability/norm_nodes_with_embeddings.json
fi
```

Expected if run:
- prints progress counts
- prints output path and embedding dimension
- does not print API key

- [ ] **Step 3: Validate generated embedding cache if present**

```bash
python3 - <<'PY'
import json
from pathlib import Path
path = Path('/app/inference-engine/data/rq2_traceability/norm_nodes_with_embeddings.json')
if path.exists():
    rows = json.loads(path.read_text(encoding='utf-8'))
    dims = {len(row['embedding']) for row in rows}
    assert len(rows) == 107, len(rows)
    assert len(dims) == 1, dims
    assert next(iter(dims)) > 0, dims
    print('embedding cache PASS', len(rows), next(iter(dims)))
else:
    print('embedding cache SKIPPED')
PY
```

- [ ] **Step 4: Optional Docker smoke if backend service is running**

```bash
docker compose -f /app/inference-engine/docker-compose.yml ps
docker compose -f /app/inference-engine/docker-compose.yml restart backend
sleep 8
curl -s http://localhost:8000/api/healthz | python3 -m json.tool
```

If there is no running Docker environment, report this as skipped rather than failing implementation.

- [ ] **Step 5: Commit embedding cache only if generated**

```bash
if [ -f data/rq2_traceability/norm_nodes_with_embeddings.json ]; then
  git add data/rq2_traceability/norm_nodes_with_embeddings.json
  git commit -m "Add norm node embedding cache"
fi
```

- [ ] **Step 6: Final status**

```bash
git status --short
git log --oneline -8
```

Expected: clean status after commits, or only intentionally uncommitted runtime artifacts.
