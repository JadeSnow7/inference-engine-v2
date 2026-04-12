import os
import unittest

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")

from rag.graph import build_demo_graph
from rag.retriever import GraphRAGRetriever


class FakeEmbedder:
    def encode(self, texts, normalize_embeddings: bool = True):
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
        return vectors


class GraphRAGRetrieverTest(unittest.TestCase):
    def setUp(self) -> None:
        self.retriever = GraphRAGRetriever(build_demo_graph(), FakeEmbedder())

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
