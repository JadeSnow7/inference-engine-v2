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
            rows = retriever.retrieve("prior studies cite original source citation format", top_k=2)
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
            rows = retriever.retrieve("prior studies cite original source citation format", top_k=1)
            context = retriever.format_context(rows)

            self.assertIn("Relevant norm nodes", context)
            self.assertIn("[REF:NRM-CIT-001]", context)
            self.assertIn("type=规范条款", context)
            self.assertIn("dimension=引用格式", context)

    def test_default_corpus_path_resolves_to_existing_raw_corpus(self):
        from rag import norm_retriever

        self.assertTrue((norm_retriever.RQ2_DIR / "norm_nodes.json").exists())


if __name__ == "__main__":
    unittest.main()
