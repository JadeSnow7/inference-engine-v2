from dataclasses import asdict
import os
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


def build_demo_graph(encoder=None) -> KnowledgeGraph:
    """Build a demonstration knowledge graph for the IC power prediction domain.

    Uses real sentence-transformer embeddings so cosine-similarity retrieval
    works meaningfully during live demos.

    Graph guarantees (required by demo spec):
      ≥ 3  ConceptNodes with embeddings
      ≥ 5  PaperNodes  with embeddings
      ≥ 2  ResearchGapNodes, with ≥ 1 having addressed_by = 0
    """
    if encoder is None:
        from sentence_transformers import SentenceTransformer  # local import — only needed at graph build time

        encoder = SentenceTransformer(os.getenv("EMBED_MODEL", "BAAI/bge-small-zh-v1.5"))

    def emb(text: str) -> np.ndarray:
        v = encoder.encode(text, normalize_embeddings=True)
        return np.asarray(v, dtype=float)

    kg = KnowledgeGraph()

    # ── Domains ────────────────────────────────────────────────────
    kg.add_domain(DomainNode(id="dom_ic",  name="集成电路",    field="微电子"))
    kg.add_domain(DomainNode(id="dom_ai",  name="人工智能芯片", field="电子信息"))
    kg.add_domain(DomainNode(id="dom_eda", name="EDA 工具",    field="集成电路设计"))

    # ── Concepts (≥ 3 with embeddings) ────────────────────────────
    concepts = [
        ConceptNode("concept_power",       "芯片功耗预测与建模",        "集成电路", emb("芯片功耗预测 深度学习 模型"), frequency=15),
        ConceptNode("concept_transformer", "Transformer 序列建模",      "人工智能芯片", emb("Transformer 注意力机制 序列建模"), frequency=22),
        ConceptNode("concept_gnn",         "图神经网络芯片布图分析",     "集成电路", emb("图神经网络 布图规划 物理设计"), frequency=11),
        ConceptNode("concept_irdrop",      "IR-drop 电源完整性分析",    "集成电路", emb("IR drop 电源完整性 电压降"), frequency=8),
        ConceptNode("concept_quant",       "模型量化与边缘端部署",       "人工智能芯片", emb("模型量化 推理加速 边缘计算"), frequency=10),
    ]
    for c in concepts:
        kg.add_concept(c)

    # ── Methods ───────────────────────────────────────────────────
    methods = [
        MethodNode("method_transformer", "Transformer",       "sequence modeling", 2017, emb("Transformer 注意力机制")),
        MethodNode("method_gcn",         "图卷积网络 GCN",    "graph learning",    2017, emb("图卷积神经网络")),
        MethodNode("method_qat",         "量化感知训练 QAT",  "model compression", 2018, emb("量化感知训练 INT8")),
        MethodNode("method_dml",         "差分机器学习",       "optimization",      2020, emb("差分优化 工艺参数")),
    ]
    for m in methods:
        kg.add_method(m)

    # ── Papers (≥ 5 with real embeddings) ─────────────────────────
    papers_data = [
        ("paper_vit",      "Vision Transformer 芯片功耗精确建模方法",
         "基于自注意力机制的 Transformer 用于 AI 加速器功耗估算。",
         "Transformer 芯片功耗估算 注意力机制", 2021),
        ("paper_hyper",    "异构图神经网络芯片布图功耗分析",
         "面向物理设计阶段的图学习功耗建模，引入异构图神经网络。",
         "图神经网络 布图 功耗 物理设计", 2022),
        ("paper_cross",    "先进工艺节点跨节点功耗预测方法",
         "域自适应方法解决跨工艺节点功耗预测的泛化问题。",
         "跨工艺节点 功耗预测 域自适应", 2023),
        ("paper_llm_eda",  "大规模序列模型驱动的 EDA 时序功耗协同优化",
         "大语言模型用于时序与功耗权衡的 EDA 流程优化。",
         "EDA 时序优化 功耗 序列模型", 2024),
        ("paper_quant",    "量化感知 Transformer 压缩的边缘芯片模型",
         "压缩 Transformer 模型以适配边缘芯片工作负载。",
         "Transformer 量化 边缘推理 芯片", 2023),
        ("paper_survey",   "面向芯片功耗与热分析的机器学习综述",
         "系统综述机器学习在芯片功耗与热建模领域的研究进展。",
         "机器学习 芯片功耗 热建模 综述", 2020),
        ("paper_irdrop",   "基于 Transformer 的芯片 IR-drop 预测方法",
         "自注意力模型预测功耗图中的电压降分布。",
         "IR drop 电压降 Transformer 功耗图", 2023),
        ("paper_timing",   "时序驱动的功耗感知布线优化方法",
         "引入时序约束的功耗感知布线算法，适用于 7nm 技术节点。",
         "布线 时序约束 功耗优化 先进工艺", 2024),
    ]
    papers = []
    for pid, title, abstract, query, year in papers_data:
        node = PaperNode(pid, title, year, abstract, emb(query))
        papers.append(node)
        kg.add_paper(node)

    # ── Research Gaps (≥ 2, ≥ 1 with addressed_by = 0) ──────────
    # gap_transfer: 有 paper_cross 和 paper_vit 指向 → addressed_by = 2 (已有研究)
    # gap_irdrop:   只有 method 指向，没有 PAPER → addressed_by = 0 → 红色「未填补」高亮
    # gap_joint:    完全没有前驱 → addressed_by = 0 → 红色高亮
    gaps_data = [
        ("gap_transfer",
         "跨工艺节点功耗预测模型的泛化能力不足，难以在 5nm→3nm 节点间迁移",
         "high",
         "跨工艺节点迁移 功耗预测 泛化", 2024),
        ("gap_irdrop",
         "联合 IR-drop 约束与时序约束的多目标功耗预测研究尚为空白",
         "high",
         "IR drop 时序约束 多目标功耗预测", 2025),
        ("gap_joint",
         "芯片设计前期（RTL 级）快速功耗估算与物理仿真协同验证路径缺失",
         "medium",
         "RTL 功耗估算 物理仿真 协同验证", 2024),
    ]
    for gid, desc, sev, query, year in gaps_data:
        kg.add_gap(ResearchGapNode(gid, desc, sev, emb(query), year))

    # ── Edges ─────────────────────────────────────────────────────
    # Domain → Concept
    kg.add_edge("dom_ic",  "concept_power",       "contains")
    kg.add_edge("dom_ic",  "concept_gnn",         "contains")
    kg.add_edge("dom_ic",  "concept_irdrop",      "contains")
    kg.add_edge("dom_ai",  "concept_transformer", "contains")
    kg.add_edge("dom_ai",  "concept_quant",       "contains")
    kg.add_edge("dom_eda", "concept_gnn",         "contains")

    # Concept → Paper (tagged_in)
    for pid, rel in [("paper_vit", 0.95), ("paper_cross", 0.91), ("paper_survey", 0.82)]:
        kg.add_edge("concept_power", pid, "tagged_in", relevance=rel)
    for pid, rel in [("paper_vit", 0.92), ("paper_llm_eda", 0.89), ("paper_quant", 0.76)]:
        kg.add_edge("concept_transformer", pid, "tagged_in", relevance=rel)
    for pid, rel in [("paper_hyper", 0.94), ("paper_llm_eda", 0.72)]:
        kg.add_edge("concept_gnn", pid, "tagged_in", relevance=rel)
    for pid, rel in [("paper_irdrop", 0.97), ("paper_timing", 0.81)]:
        kg.add_edge("concept_irdrop", pid, "tagged_in", relevance=rel)
    for pid, rel in [("paper_quant", 0.93), ("paper_llm_eda", 0.77)]:
        kg.add_edge("concept_quant", pid, "tagged_in", relevance=rel)

    # Paper → Method (uses)
    kg.add_edge("paper_vit",     "method_transformer", "uses", year=2021)
    kg.add_edge("paper_llm_eda", "method_transformer", "uses", year=2024)
    kg.add_edge("paper_quant",   "method_transformer", "uses", year=2023)
    kg.add_edge("paper_irdrop",  "method_transformer", "uses", year=2023)
    kg.add_edge("paper_hyper",   "method_gcn",         "uses", year=2022)
    kg.add_edge("paper_quant",   "method_qat",         "uses", year=2023)
    kg.add_edge("paper_cross",   "method_dml",         "uses", year=2023)

    # Paper → Gap (addresses) — gap_transfer 有文献 → addressed_by > 0
    kg.add_edge("paper_cross",  "gap_transfer", "addresses", effectiveness=0.66)
    kg.add_edge("paper_vit",    "gap_transfer", "addresses", effectiveness=0.48)
    # gap_irdrop 和 gap_joint 只有 Method/无前驱 → addressed_by = 0 (红色高亮)
    kg.add_edge("method_transformer", "gap_irdrop", "addresses")

    # Concept → Gap (has_gap)
    kg.add_edge("concept_power",       "gap_transfer", "has_gap", severity="high")
    kg.add_edge("concept_irdrop",      "gap_irdrop",   "has_gap", severity="high")
    kg.add_edge("concept_power",       "gap_joint",    "has_gap", severity="medium")

    # Paper citation network
    kg.add_edge("paper_survey",  "paper_vit",      "cites", year=2021)
    kg.add_edge("paper_vit",     "paper_cross",    "cites", year=2023)
    kg.add_edge("paper_cross",   "paper_llm_eda",  "cites", year=2024)
    kg.add_edge("paper_hyper",   "paper_llm_eda",  "cites", year=2024)
    kg.add_edge("paper_irdrop",  "paper_timing",   "cites", year=2024)
    kg.add_edge("paper_timing",  "paper_llm_eda",  "cites", year=2024)

    return kg
