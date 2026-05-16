from __future__ import annotations

import re

from editing.models import EvidenceReference


class CitationVerifier:
    def __init__(self, norm_retriever=None, rag=None):
        self.norm_retriever = norm_retriever
        self.rag = rag

    def verify(self, text: str, top_k: int = 3) -> list[EvidenceReference]:
        references: list[EvidenceReference] = []

        if self.norm_retriever is not None:
            try:
                nodes = self.norm_retriever.retrieve(text, top_k=top_k, theta=0.0)
                for idx, node in enumerate(nodes, start=1):
                    references.append(EvidenceReference(
                        id=str(node.get("node_id") or node.get("id") or f"norm-{idx}"),
                        title=str(node.get("dimension") or node.get("label") or "写作规范节点"),
                        source="ScholarScript Norm Corpus",
                        score=_score(node.get("score")),
                        excerpt=str(node.get("text") or node.get("excerpt") or ""),
                        status="resolved",
                    ))
            except Exception:
                references.append(_unresolved_reference("norm-retriever-unavailable", "本地规范检索暂不可用"))

        if not references and self.rag is not None and hasattr(self.rag, "retrieve_literature"):
            try:
                papers = self.rag.retrieve_literature(text, top_k=top_k)
                for idx, paper in enumerate(papers, start=1):
                    references.append(EvidenceReference(
                        id=str(paper.get("id") or f"rag-paper-{idx}"),
                        title=str(paper.get("title") or "知识库材料"),
                        source=str(paper.get("source") or paper.get("venue") or "Local RAG"),
                        year=_int_or_none(paper.get("year")),
                        score=_score(paper.get("score")),
                        excerpt=str(paper.get("excerpt") or paper.get("snippet") or ""),
                        status="resolved",
                    ))
            except Exception:
                references.append(_unresolved_reference("rag-unavailable", "RAG 检索暂不可用"))

        if not references:
            references.append(_unresolved_reference("citation-unresolved", "未找到可核验 DOI 或本地证据来源"))

        for doi in sorted(set(re.findall(r"10\.\d{4,9}/[-._;()/:A-Z0-9]+", text, flags=re.I))):
            references.append(EvidenceReference(
                id=f"doi:{doi.lower()}",
                title=f"待外部解析 DOI {doi}",
                source="Crossref shell",
                excerpt="V1 仅定义 Crossref 接口壳，未执行外部元数据查询。",
                status="unresolved",
            ))

        return references


class MetadataResolver:
    def resolve(self, identifier: str) -> EvidenceReference:
        return EvidenceReference(
            id=f"metadata:{identifier}",
            title=f"待解析元数据 {identifier}",
            source="Metadata resolver shell",
            excerpt="V1 未接入外部元数据服务。",
            status="unresolved",
        )


class StyleRenderer:
    def render(self, reference: EvidenceReference, style: str = "GB/T 7714") -> str:
        _ = style
        if reference.status == "unresolved":
            return f"[unresolved] {reference.title}"
        year = f" ({reference.year})" if reference.year else ""
        return f"{reference.title}{year}. {reference.source}."


def _score(value) -> float | None:
    try:
        return max(0.0, min(1.0, round(float(value), 2)))
    except Exception:
        return None


def _int_or_none(value) -> int | None:
    try:
        return int(value)
    except Exception:
        return None


def _unresolved_reference(reference_id: str, title: str) -> EvidenceReference:
    return EvidenceReference(
        id=reference_id,
        title=title,
        source="ScholarScript Evidence Shell",
        excerpt="证据接口已预留；查不到证据时必须标记 unresolved，不得伪造引用。",
        status="unresolved",
    )
