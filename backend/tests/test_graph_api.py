import asyncio
import json
import os
from types import SimpleNamespace
import unittest

import networkx as nx

os.environ.setdefault("DASHSCOPE_API_KEY", "test-key")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")

from api.graph import get_workspace_graph


class FakeKnowledgeGraph:
    def __init__(self, graph):
        self.graph = graph

    def get_graph(self):
        return self.graph


def response_data(response):
    return json.loads(response.body)["data"]


def make_request(graph=None):
    return SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(kg=FakeKnowledgeGraph(graph) if graph is not None else None)))


class GraphApiTest(unittest.TestCase):
    def run_async(self, coro):
        return asyncio.run(coro)

    def test_serializes_current_rag_graph_without_embeddings(self):
        graph = nx.DiGraph()
        graph.add_node(
            "concept_llm",
            type="concept",
            name="Large Language Models",
            domain="Education",
            embedding=[0.1, 0.2],
            frequency=12,
        )
        graph.add_node(
            "paper_feedback",
            type="paper",
            title="AI Feedback in Higher Education",
            abstract="Evidence about formative feedback.",
            year=2026,
            embedding=[0.3, 0.4],
        )
        graph.add_edge("concept_llm", "paper_feedback", rel="tagged_in", relevance=0.92)

        response = self.run_async(get_workspace_graph(make_request(graph), user_id="alice@hust.edu.cn"))

        data = response_data(response)
        self.assertEqual(len(data["nodes"]), 2)
        self.assertEqual(len(data["edges"]), 1)
        node = next(item for item in data["nodes"] if item["id"] == "concept_llm")
        self.assertEqual(node["label"], "Large Language Models")
        self.assertEqual(node["type"], "concept")
        self.assertNotIn("embedding", json.dumps(data))
        self.assertEqual(data["edges"][0]["label"], "tagged_in")

    def test_returns_empty_graph_when_runtime_graph_is_unavailable(self):
        response = self.run_async(get_workspace_graph(make_request(), user_id="alice@hust.edu.cn"))

        data = response_data(response)
        self.assertEqual(data, {"nodes": [], "edges": []})


if __name__ == "__main__":
    unittest.main()
