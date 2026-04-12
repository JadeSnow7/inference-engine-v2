from dataclasses import asdict
from pathlib import Path

import networkx as nx
import numpy as np

from rag.nodes import ConceptNode, DomainNode, MethodNode, NodeType, PaperNode, ResearchGapNode


class KnowledgeGraph:
    def __init__(self):
        self.g = nx.DiGraph()

    def _add_node(self, node, node_type: NodeType):
        attrs = asdict(node)
        attrs["type"] = node_type.value
        self.g.add_node(node.id, **attrs)

    def add_paper(self, node: PaperNode):
        self._add_node(node, NodeType.PAPER)

    def add_concept(self, node: ConceptNode):
        self._add_node(node, NodeType.CONCEPT)

    def add_gap(self, node: ResearchGapNode):
        self._add_node(node, NodeType.GAP)

    def add_method(self, node: MethodNode):
        self._add_node(node, NodeType.METHOD)

    def add_domain(self, node: DomainNode):
        self._add_node(node, NodeType.DOMAIN)

    def add_edge(self, src: str, dst: str, rel: str, **attrs):
        self.g.add_edge(src, dst, rel=rel, **attrs)

    def save(self, path: str):
        nx.write_gpickle(self.g, path)

    def load(self, path: str):
        if not Path(path).exists():
            return
        self.g = nx.read_gpickle(path)

    def get_graph(self) -> nx.DiGraph:
        return self.g


def build_demo_graph() -> KnowledgeGraph:
    kg = KnowledgeGraph()

    power_vec = np.array([1.0, 0.0, 0.0, 0.0])
    graph_vec = np.array([0.0, 1.0, 0.0, 0.0])
    compress_vec = np.array([0.0, 0.0, 1.0, 0.0])
    mixed_vec = np.array([0.7, 0.2, 0.1, 0.0])

    kg.add_domain(DomainNode(id="dom_ic", name="集成电路", field="微电子"))
    kg.add_domain(DomainNode(id="dom_ai", name="人工智能芯片", field="电子信息"))

    kg.add_concept(ConceptNode(id="concept_power", name="芯片功耗预测", domain="集成电路", embedding=power_vec, frequency=12))
    kg.add_concept(ConceptNode(id="concept_transformer", name="Transformer 建模", domain="人工智能芯片", embedding=mixed_vec, frequency=18))
    kg.add_concept(ConceptNode(id="concept_gnn", name="图神经网络布图分析", domain="集成电路", embedding=graph_vec, frequency=9))

    kg.add_method(MethodNode(id="method_transformer", name="Transformer", category="sequence modeling", first_year=2017, embedding=power_vec))
    kg.add_method(MethodNode(id="method_gcn", name="GCN", category="graph learning", first_year=2017, embedding=graph_vec))
    kg.add_method(MethodNode(id="method_quant", name="量化感知训练", category="compression", first_year=2018, embedding=compress_vec))

    kg.add_gap(ResearchGapNode(id="gap_transfer", description="面向跨工艺节点迁移的功耗预测模型泛化不足", severity="high", embedding=power_vec, year_identified=2024))
    kg.add_gap(ResearchGapNode(id="gap_irdrop", description="联合 IR-drop 与时序约束的多目标芯片功耗预测研究不足", severity="high", embedding=mixed_vec, year_identified=2025))

    papers = [
        PaperNode("paper_vit", "Vision Transformer for Accurate Power Modeling in AI Accelerators", 2021, "Transformer-based accelerator power estimation.", power_vec),
        PaperNode("paper_hyper", "HyperGraph Neural Networks for Chip Power Estimation", 2022, "Graph learning for physical design power modeling.", graph_vec),
        PaperNode("paper_cross", "Cross-Node Power Prediction for Advanced Process Nodes", 2023, "Cross-process prediction with domain adaptation.", power_vec),
        PaperNode("paper_llm_eda", "Large Sequence Models for EDA Timing and Power Co-Optimization", 2024, "Sequence models for timing and power trade-offs.", mixed_vec),
        PaperNode("paper_quant", "Quantization-Aware Transformer Compression for Edge Silicon Models", 2023, "Compressed transformer models for silicon-aware workloads.", compress_vec),
        PaperNode("paper_survey", "Survey of Machine Learning for Chip Power and Thermal Modeling", 2020, "Survey of ML in chip power modeling.", mixed_vec),
    ]
    for paper in papers:
        kg.add_paper(paper)

    kg.add_edge("dom_ic", "concept_power", "contains")
    kg.add_edge("dom_ic", "concept_gnn", "contains")
    kg.add_edge("dom_ai", "concept_transformer", "contains")
    kg.add_edge("concept_power", "paper_vit", "tagged_in", relevance=0.95)
    kg.add_edge("concept_power", "paper_cross", "tagged_in", relevance=0.91)
    kg.add_edge("concept_power", "paper_survey", "tagged_in", relevance=0.82)
    kg.add_edge("concept_transformer", "paper_vit", "tagged_in", relevance=0.92)
    kg.add_edge("concept_transformer", "paper_llm_eda", "tagged_in", relevance=0.89)
    kg.add_edge("concept_transformer", "paper_quant", "tagged_in", relevance=0.76)
    kg.add_edge("concept_gnn", "paper_hyper", "tagged_in", relevance=0.94)
    kg.add_edge("paper_vit", "method_transformer", "uses", year=2021)
    kg.add_edge("paper_llm_eda", "method_transformer", "uses", year=2024)
    kg.add_edge("paper_quant", "method_transformer", "uses", year=2023)
    kg.add_edge("paper_hyper", "method_gcn", "uses", year=2022)
    kg.add_edge("paper_quant", "method_quant", "uses", year=2023)
    kg.add_edge("paper_cross", "gap_transfer", "addresses", effectiveness=0.66)
    kg.add_edge("paper_vit", "gap_transfer", "addresses", effectiveness=0.48)
    kg.add_edge("concept_power", "gap_transfer", "has_gap", severity="high")
    kg.add_edge("concept_transformer", "gap_irdrop", "has_gap", severity="high")
    kg.add_edge("method_transformer", "gap_irdrop", "addresses")
    kg.add_edge("paper_survey", "paper_vit", "cites", year=2021)
    kg.add_edge("paper_vit", "paper_cross", "cites", year=2023)
    kg.add_edge("paper_cross", "paper_llm_eda", "cites", year=2024)
    kg.add_edge("paper_hyper", "paper_llm_eda", "cites", year=2024)

    return kg

