import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")

from rag.graph import build_demo_graph
from rag.retriever import GraphRAGRetriever


class FakeEmbedder:
    def encode(self, texts, normalize_embeddings: bool = True):
        single = isinstance(texts, str)
        if isinstance(texts, str):
            texts = [texts]
        vectors = []
        for text in texts:
            text = text.lower()
            if "transformer" in text or "功耗" in text:
                vectors.append([1.0, 0.0, 0.0, 0.0])
            elif "gcn" in text or "图" in text:
                vectors.append([0.0, 1.0, 0.0, 0.0])
            elif "压缩" in text or "量化" in text:
                vectors.append([0.0, 0.0, 1.0, 0.0])
            else:
                vectors.append([0.1, 0.1, 0.1, 0.1])
        return vectors[0] if single else vectors


class GraphRAGRetrieverTest(unittest.TestCase):
    def setUp(self) -> None:
        self.retriever = GraphRAGRetriever(build_demo_graph(FakeEmbedder()), FakeEmbedder())

    def test_retrieve_literature_returns_ranked_papers_without_embeddings(self) -> None:
        papers = self.retriever.retrieve_literature("基于 Transformer 的芯片功耗预测", top_k=5)

        self.assertGreaterEqual(len(papers), 3)
        self.assertIn("title", papers[0])
        self.assertNotIn("embedding", papers[0])

    def test_discover_research_gaps_boosts_unaddressed_gap(self) -> None:
        gaps = self.retriever.discover_research_gaps("集成电路", "芯片功耗预测", top_k=5)

        self.assertGreaterEqual(len(gaps), 1)
        self.assertIn("addressed_by", gaps[0])
        self.assertIn(gaps[0]["severity"], {"high", "medium", "low"})

    def test_trace_method_lineage_returns_year_sorted_papers(self) -> None:
        lineage = self.retriever.trace_method_lineage("Transformer")

        self.assertGreaterEqual(len(lineage), 1)
        years = [item["year"] for item in lineage]
        self.assertEqual(years, sorted(years))


class DemoGraphBuilderTest(unittest.TestCase):
    def test_build_demo_graph_uses_embed_model_environment_override(self) -> None:
        class FakeSentenceTransformer:
            model_names: list[str] = []

            def __init__(self, model_name: str):
                self.model_names.append(model_name)

            def encode(self, text: str, normalize_embeddings: bool = True):
                return [0.1, 0.2, 0.3, 0.4]

        fake_module = SimpleNamespace(SentenceTransformer=FakeSentenceTransformer)
        original_module = sys.modules.get("sentence_transformers")
        sys.modules["sentence_transformers"] = fake_module
        try:
            with patch.dict(os.environ, {"EMBED_MODEL": "/tmp/modelscope-bge"}):
                build_demo_graph()
        finally:
            if original_module is None:
                sys.modules.pop("sentence_transformers", None)
            else:
                sys.modules["sentence_transformers"] = original_module

        self.assertEqual(FakeSentenceTransformer.model_names, ["/tmp/modelscope-bge"])
