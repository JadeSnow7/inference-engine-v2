import math

import numpy as np

from rag.nodes import NodeType


class GraphRAGRetriever:
    def __init__(self, kg, embedder):
        self.g = kg.get_graph()
        self.enc = embedder

    def _embed(self, text: str) -> np.ndarray:
        vector = self.enc.encode(text, normalize_embeddings=True)
        if isinstance(vector, list):
            vector = np.asarray(vector[0] if vector and isinstance(vector[0], (list, tuple, np.ndarray)) else vector, dtype=float)
        return np.asarray(vector, dtype=float)

    def _cosine(self, a: np.ndarray, b: np.ndarray) -> float:
        if a is None or b is None:
            return 0.0
        denom = float(np.linalg.norm(a) * np.linalg.norm(b))
        if math.isclose(denom, 0.0):
            return 0.0
        return float(np.dot(a, b) / denom)

    def retrieve_literature(self, query, top_k=10) -> list[dict]:
        query_emb = self._embed(query)
        concept_scores = []
        for nid, attrs in self.g.nodes(data=True):
            if attrs.get("type") == NodeType.CONCEPT.value and attrs.get("embedding") is not None:
                concept_scores.append((self._cosine(query_emb, attrs["embedding"]), nid))
        top_concepts = [nid for _, nid in sorted(concept_scores, key=lambda item: item[0], reverse=True)[:3]]

        candidates = set()
        for concept_id in top_concepts:
            for succ in self.g.successors(concept_id):
                if self.g.nodes[succ].get("type") == NodeType.PAPER.value:
                    candidates.add(succ)
                    for pred in self.g.predecessors(succ):
                        if self.g.nodes[pred].get("type") == NodeType.PAPER.value:
                            candidates.add(pred)

        ranked = []
        for paper_id in candidates:
            paper = self.g.nodes[paper_id]
            if paper.get("embedding") is None:
                continue
            ranked.append(
                {
                    "id": paper_id,
                    "title": paper["title"],
                    "year": paper["year"],
                    "score": self._cosine(query_emb, paper["embedding"]),
                }
            )
        return sorted(ranked, key=lambda item: item["score"], reverse=True)[:top_k]

    def discover_research_gaps(self, domain, query, top_k=5) -> list[dict]:
        query_emb = self._embed(domain + " " + query)
        results = []
        for nid, attrs in self.g.nodes(data=True):
            if attrs.get("type") != NodeType.GAP.value or attrs.get("embedding") is None:
                continue
            addressing_papers = [p for p in self.g.predecessors(nid) if self.g.nodes[p].get("type") == NodeType.PAPER.value]
            boost = 1.3 if len(addressing_papers) == 0 else 1.0
            score = self._cosine(query_emb, attrs["embedding"]) * boost
            results.append(
                {
                    "id": nid,
                    "description": attrs["description"],
                    "severity": attrs["severity"],
                    "addressed_by": len(addressing_papers),
                    "score": score,
                }
            )
        return sorted(results, key=lambda item: item["score"], reverse=True)[:top_k]

    def trace_method_lineage(self, method_name) -> list[dict]:
        method_emb = self._embed(method_name)
        anchor = None
        anchor_score = -1.0
        for nid, attrs in self.g.nodes(data=True):
            if attrs.get("type") != NodeType.METHOD.value or attrs.get("embedding") is None:
                continue
            score = self._cosine(method_emb, attrs["embedding"])
            if score > anchor_score:
                anchor = nid
                anchor_score = score

        if anchor is None:
            return []

        papers = []
        for pred in self.g.predecessors(anchor):
            attrs = self.g.nodes[pred]
            if attrs.get("type") == NodeType.PAPER.value:
                papers.append({"paper_id": pred, "title": attrs["title"], "year": attrs["year"]})
        return sorted(papers, key=lambda item: item["year"])

