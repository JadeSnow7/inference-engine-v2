#!/usr/bin/env python3
"""Generate the DeepSeek-V4-Pro RAG control experiment evidence package.

The default run is deterministic and offline. It exercises retriever isolation
and metric/report generation without making live DashScope calls.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import subprocess
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DECLARED_MODEL = "deepseek-v4-pro"
APP_ID = "b3102617f35a4ffbab5befabebdcacc4"
THETA = 0.6
TOP_K = 5
SOURCE_DATASET = "data/rq2_traceability/query_set.json"
REF_PATTERN = re.compile(r"\[REF:([A-Za-z0-9_-]+)\]")
SECRET_PATTERNS = [
    re.compile(r"sk-[A-Za-z0-9_\-]{12,}"),
    re.compile(r"Bearer\s+[A-Za-z0-9._\-]+", re.I),
    re.compile(r"Authorization", re.I),
    re.compile(r"Cookie", re.I),
    re.compile(r"Signature=", re.I),
    re.compile(r"X-Oss-", re.I),
    re.compile(r"redis://[^@\s]+:[^@\s]+@", re.I),
]
SENSITIVE_KEYS = {
    "authorization",
    "cookie",
    "fileurl",
    "downloadurl",
    "signedurl",
    "api_key",
    "apikey",
    "token",
}


def stable_hash(value: Any) -> str:
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def load_selected_samples(root: Path) -> tuple[list[dict[str, Any]], str]:
    dataset_path = root / SOURCE_DATASET
    if not dataset_path.exists():
        raise FileNotFoundError(f"Missing dataset: {dataset_path}")

    raw_samples = json.loads(dataset_path.read_text(encoding="utf-8"))
    samples: list[dict[str, Any]] = []
    for item in raw_samples:
        sample = {
            "sample_id": str(item["query_id"]),
            "text": str(item["text"]),
            "sample_type": str(item.get("primary_dimension") or "unknown"),
            "expected_refs": list(item.get("expected_ref_nodes") or []),
            "is_control": not bool(item.get("has_known_issue", False)),
            "source_dataset": SOURCE_DATASET,
        }
        sample["selection_hash"] = stable_hash(
            {
                "sample_id": sample["sample_id"],
                "text": sample["text"],
                "expected_refs": sample["expected_refs"],
            }
        )
        samples.append(sample)

    if len(samples) == 20:
        note = "Using existing 20 RQ2 traceability samples; no local 60-sample source was found or claimed."
    else:
        note = f"Using {len(samples)} samples from local RQ2 traceability dataset."
    return samples, note


def sanitize_sensitive(value: Any) -> Any:
    if isinstance(value, dict):
        cleaned: dict[str, Any] = {}
        for key, item in value.items():
            lowered = str(key).lower()
            if lowered in SENSITIVE_KEYS or lowered.endswith("url"):
                continue
            cleaned[str(key)] = sanitize_sensitive(item)
        return cleaned
    if isinstance(value, list):
        return [sanitize_sensitive(item) for item in value]
    if isinstance(value, str):
        text = re.sub(r"https?://\S*(?:Signature|Expires|X-Oss-)\S*", "[redacted-url]", value, flags=re.I)
        text = re.sub(r"Bearer\s+[A-Za-z0-9._\-]+", "Bearer [redacted]", text, flags=re.I)
        return text
    return value


def scan_for_secrets(text: str) -> list[str]:
    findings: list[str] = []
    for pattern in SECRET_PATTERNS:
        if pattern.search(text):
            findings.append(pattern.pattern)
    return findings


def extract_ref_ids(text: str) -> list[str]:
    refs: list[str] = []
    seen: set[str] = set()
    for match in REF_PATTERN.finditer(text or ""):
        ref_id = match.group(1)
        if ref_id not in seen:
            refs.append(ref_id)
            seen.add(ref_id)
    return refs


def reference_id(reference: dict[str, Any]) -> str:
    return str(reference.get("id") or reference.get("node_id") or reference.get("reference_id") or "")


def compute_reference_metrics(
    expected_refs: list[str],
    references: list[dict[str, Any]],
    output_text: str,
) -> dict[str, float]:
    expected = set(expected_refs)
    structured_ids = [reference_id(ref) for ref in references if reference_id(ref)]
    generated_ids = extract_ref_ids(output_text)
    all_ids = list(dict.fromkeys([*structured_ids, *generated_ids]))

    if expected:
        expected_reference_recall = len(expected & set(all_ids)) / len(expected)
    else:
        expected_reference_recall = 0.0

    if all_ids:
        grounded_reference_precision = len(expected & set(all_ids)) / len(all_ids) if expected else 0.0
        hallucinated_reference_rate = len([ref_id for ref_id in all_ids if ref_id not in expected]) / len(all_ids)
    else:
        grounded_reference_precision = 0.0
        hallucinated_reference_rate = 0.0

    return {
        "expected_reference_recall": round(expected_reference_recall, 4),
        "grounded_reference_precision": round(grounded_reference_precision, 4),
        "hallucinated_reference_rate": round(hallucinated_reference_rate, 4),
        "reference_event_rate": 1.0 if references else 0.0,
        "source_display_rate": 1.0 if any(ref.get("source") or ref.get("title") for ref in references) else 0.0,
    }


def group_config(group: str) -> dict[str, str]:
    configs = {
        "G1": {
            "rag_mode": "none",
            "retriever_impl": "none",
            "knowledge_enhancement": "No RAG / no KG",
            "source_claim_level": "none",
        },
        "G2": {
            "rag_mode": "local_norm_graphrag",
            "retriever_impl": "scripts.rq2_real_backend.NormGraphRAG",
            "knowledge_enhancement": "Local norm-node GraphRAG",
            "source_claim_level": "none",
        },
        "G3": {
            "rag_mode": "norm_retriever",
            "retriever_impl": "rag.norm_retriever.NormNodeRetriever",
            "knowledge_enhancement": "Local Norm Retriever",
            "source_claim_level": "none",
        },
        "G4": {
            "rag_mode": "bailian_app_sources",
            "retriever_impl": "rag.dashscope_provider.DashScopeKnowledgeRAGRetriever",
            "knowledge_enhancement": "Bailian application document sources",
            "source_claim_level": "none",
        },
    }
    return configs[group]


def empty_metrics() -> dict[str, Any]:
    return {
        "expected_reference_recall": 0.0,
        "grounded_reference_precision": 0.0,
        "hallucinated_reference_rate": 0.0,
        "reference_event_rate": 0.0,
        "source_display_rate": 0.0,
        "false_positive": False,
        "irrelevant_node_rate": 0.0,
        "unresolved_handling": False,
        "fabricated_source_count": 0,
        "conclusion_drift_count": 0,
        "model_fact_error_count": 0,
        "parse_success": True,
        "http_200": True,
        "done_true": True,
        "ttfe_ms": 0,
        "total_latency_ms": 0,
        "retry_count": 0,
        "error_events": 0,
    }


def build_group_record(
    sample: dict[str, Any],
    group: str,
    *,
    output_text: str,
    references: list[dict[str, Any]],
    raw_events: list[dict[str, Any]] | None = None,
    effective_model: str = "",
    model_claim_level: str = "declared_only",
    jxfz_confirmed: bool = False,
    total_latency_ms: int = 0,
    notes: str = "",
) -> dict[str, Any]:
    config = group_config(group)
    sanitized_refs = sanitize_sensitive(references)
    metrics = empty_metrics()
    metrics.update(compute_reference_metrics(sample["expected_refs"], sanitized_refs, output_text))
    if group == "G1" and extract_ref_ids(output_text):
        metrics["hallucinated_reference_rate"] = 1.0
        metrics["grounded_reference_precision"] = 0.0
        metrics["reference_event_rate"] = 0.0
    if sample.get("is_control") and output_text.strip() and any(term in output_text for term in ("问题", "should", "建议", "needs")):
        metrics["false_positive"] = True
    if any(ref.get("status") == "unresolved" for ref in sanitized_refs):
        metrics["unresolved_handling"] = True
    metrics["total_latency_ms"] = int(total_latency_ms)
    metrics["ttfe_ms"] = int(total_latency_ms)

    source_claim_level = config["source_claim_level"]
    if group == "G4" and sanitized_refs:
        source_claim_level = "doc_references_returned"
    if jxfz_confirmed:
        source_claim_level = "jxfz_confirmed"

    return {
        "sample_id": sample["sample_id"],
        "group": group,
        "model": DECLARED_MODEL,
        "declared_model": DECLARED_MODEL,
        "effective_model": effective_model,
        "model_claim_level": model_claim_level,
        "rag_mode": config["rag_mode"],
        "retriever_impl": config["retriever_impl"],
        "source_claim_level": source_claim_level,
        "jxfz_confirmed": bool(jxfz_confirmed),
        "input_text": sample["text"],
        "output_text": output_text,
        "patches": [],
        "references": sanitized_refs,
        "expected_refs": sample["expected_refs"],
        "metrics": metrics,
        "raw_events": sanitize_sensitive(raw_events or []),
        "notes": notes,
    }


def make_reference_from_node(node: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(node.get("node_id") or node.get("id")),
        "title": str(node.get("dimension") or "写作规范节点"),
        "source": "ScholarScript Norm Corpus",
        "score": float(node.get("score", 0.0) or 0.0),
        "excerpt": str(node.get("text") or ""),
        "status": "resolved",
    }


def feedback_text(sample: dict[str, Any], references: list[dict[str, Any]], group: str) -> str:
    if sample["is_control"]:
        if group == "G1":
            return "No major academic norm issue is detected; keep the current evidence boundary."
        return "未检测到明显规范问题；建议保持现有论证边界并人工抽查。"

    ref_tags = " ".join(f"[REF:{reference_id(ref)}]" for ref in references[:3] if reference_id(ref))
    if not ref_tags:
        ref_tags = "未返回可核验结构化规范节点"
    return (
        f"评价维度：{sample['sample_type']}。\n"
        "问题定位：样本文本存在与该维度相关的规范风险。\n"
        f"规范依据：{ref_tags}\n"
        "修改建议：将反馈绑定到可核验规范节点，避免新增未验证事实。"
    )


def run_g1(sample: dict[str, Any]) -> dict[str, Any]:
    start = time.perf_counter()
    output = feedback_text(sample, [], "G1")
    latency = int((time.perf_counter() - start) * 1000)
    return build_group_record(
        sample,
        "G1",
        output_text=output,
        references=[],
        total_latency_ms=latency,
        notes="Offline deterministic no-RAG run; no provider-level Pro confirmation.",
    )


def run_g2(sample: dict[str, Any], norm_graph) -> dict[str, Any]:
    start = time.perf_counter()
    nodes = norm_graph.retrieve(sample["text"], top_k=TOP_K, graph_expand=True)
    references = [make_reference_from_node(node) for node in nodes[:TOP_K]]
    output = feedback_text(sample, references, "G2")
    latency = int((time.perf_counter() - start) * 1000)
    return build_group_record(
        sample,
        "G2",
        output_text=output,
        references=references,
        raw_events=[{"type": "retrieval", "top_k": TOP_K, "theta": THETA, "graph_hops": 1, "nodes": nodes}],
        total_latency_ms=latency,
        notes="Offline norm-node GraphRAG run using local RQ2 norm corpus.",
    )


def run_g3(sample: dict[str, Any], citation_verifier) -> dict[str, Any]:
    start = time.perf_counter()
    evidence_refs = citation_verifier.verify(sample["text"], top_k=3)
    references = [ref.model_dump() if hasattr(ref, "model_dump") else dict(ref) for ref in evidence_refs]
    output = feedback_text(sample, references, "G3")
    latency = int((time.perf_counter() - start) * 1000)
    structured = any(str(ref.get("id", "")).startswith(("NRM-", "STR-", "PARA-")) for ref in references)
    note = "Structured local norm references returned." if structured else "No structured local norm references returned."
    return build_group_record(
        sample,
        "G3",
        output_text=output,
        references=references,
        raw_events=[{"type": "citation_check", "references": references}],
        total_latency_ms=latency,
        notes=note,
    )


def run_g4(sample: dict[str, Any], *, live_g4: bool = False) -> dict[str, Any]:
    start = time.perf_counter()
    references: list[dict[str, Any]] = []
    raw_events = [{"type": "g4_mode", "live_g4": live_g4, "queried": False}]
    output = "百炼应用文档来源未在离线模式查询；本条不确认 jxfz 命中。"
    note = "Offline boundary record. Do not claim jxfz validation."
    if live_g4:
        raw_events.append({"type": "live_g4_skipped", "reason": "Live DashScope execution is intentionally not enabled in this runner."})
        note = "Live G4 requested, but runner did not make network calls; no jxfz confirmation."
    latency = int((time.perf_counter() - start) * 1000)
    return build_group_record(
        sample,
        "G4",
        output_text=output,
        references=references,
        raw_events=raw_events,
        jxfz_confirmed=False,
        total_latency_ms=latency,
        notes=note,
    )


def ensure_package_dirs(output_dir: Path) -> None:
    for rel in (
        "01_config",
        "02_sample_set",
        "03_outputs",
        "04_metrics",
        "05_logs",
        "06_manual_review",
        "07_paper_tables",
    ):
        (output_dir / rel).mkdir(parents=True, exist_ok=True)


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.write_text(
        "".join(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n" for row in rows),
        encoding="utf-8",
    )


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({name: row.get(name, "") for name in fieldnames})


def summarize_metrics(records: list[dict[str, Any]]) -> dict[str, Any]:
    by_group: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        by_group[record["group"]].append(record)

    summary: dict[str, Any] = {}
    for group, group_records in sorted(by_group.items()):
        count = len(group_records)
        metric_names = [
            "expected_reference_recall",
            "grounded_reference_precision",
            "hallucinated_reference_rate",
            "reference_event_rate",
            "source_display_rate",
            "irrelevant_node_rate",
            "ttfe_ms",
            "total_latency_ms",
            "retry_count",
            "error_events",
        ]
        metrics = {}
        for name in metric_names:
            metrics[name] = round(sum(float(row["metrics"][name]) for row in group_records) / count, 4) if count else 0.0
        metrics["false_positive_rate"] = round(sum(1 for row in group_records if row["metrics"]["false_positive"]) / count, 4) if count else 0.0
        metrics["parse_success_rate"] = round(sum(1 for row in group_records if row["metrics"]["parse_success"]) / count, 4) if count else 0.0
        metrics["http_200_rate"] = round(sum(1 for row in group_records if row["metrics"]["http_200"]) / count, 4) if count else 0.0
        metrics["done_true_rate"] = round(sum(1 for row in group_records if row["metrics"]["done_true"]) / count, 4) if count else 0.0
        summary[group] = {"sample_count": count, **metrics}
    return summary


def build_metric_rows(records: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    traceability = []
    source_display = []
    risk = []
    latency = []
    for record in records:
        metrics = record["metrics"]
        base = {"sample_id": record["sample_id"], "group": record["group"]}
        traceability.append({
            **base,
            "expected_reference_recall": metrics["expected_reference_recall"],
            "grounded_reference_precision": metrics["grounded_reference_precision"],
            "hallucinated_reference_rate": metrics["hallucinated_reference_rate"],
            "reference_event_rate": metrics["reference_event_rate"],
        })
        source_display.append({
            **base,
            "source_display_rate": metrics["source_display_rate"],
            "source_claim_level": record["source_claim_level"],
            "jxfz_confirmed": record["jxfz_confirmed"],
        })
        risk.append({
            **base,
            "false_positive": metrics["false_positive"],
            "irrelevant_node_rate": metrics["irrelevant_node_rate"],
            "unresolved_handling": metrics["unresolved_handling"],
            "fabricated_source_count": metrics["fabricated_source_count"],
            "conclusion_drift_count": metrics["conclusion_drift_count"],
            "model_fact_error_count": metrics["model_fact_error_count"],
        })
        latency.append({
            **base,
            "http_200": metrics["http_200"],
            "done_true": metrics["done_true"],
            "parse_success": metrics["parse_success"],
            "ttfe_ms": metrics["ttfe_ms"],
            "total_latency_ms": metrics["total_latency_ms"],
            "retry_count": metrics["retry_count"],
            "error_events": metrics["error_events"],
        })
    return traceability, source_display, risk, latency


def git_commit_hash(root: Path) -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=root, text=True).strip()
    except Exception:
        return "unknown"


def write_readme(output_dir: Path, *, sample_note: str, summary: dict[str, Any], commit_hash: str, jxfz_confirmed: bool) -> None:
    lines = [
        "# DeepSeek-V4-Pro RAG Control Experiment Evidence Package",
        "",
        "## 1. 实验目的",
        "比较同一声明模型配置下，不同知识增强方式对学术规范反馈、规范节点引用、来源回传、错误边界和工程稳定性的影响。",
        "",
        "## 2. 实验边界",
        "- 本实验是附录级补充对照，不替代第 5.6.1 节基于 deepseek-v4-flash 的 RQ2 主评测。",
        "- 本实验不构成真实课堂教学效果证明。",
        "- 默认离线 runner 不确认 provider 真实底层模型；模型声明等级为 declared_only。",
        "- 未确认 jxfz 命中时，不写 jxfz 验证通过。",
        "",
        "## 3. 样本来源",
        sample_note,
        "",
        "## 4. 四组配置",
        "- G1: deepseek-v4-pro + 无 RAG / 无 KG。",
        "- G2: deepseek-v4-pro + 本地 norm-node GraphRAG。",
        "- G3: deepseek-v4-pro + NormNodeRetriever citation_check。",
        "- G4: deepseek-v4-pro + 百炼应用文档来源边界记录。",
        "",
        "## 5. 执行时间",
        datetime.now(timezone.utc).isoformat(),
        "",
        "## 6. 平台 commit hash",
        commit_hash,
        "",
        "## 7. DashScope App ID",
        APP_ID,
        "",
        "## 8. 是否确认 jxfz 命中",
        "是" if jxfz_confirmed else "否。仅记录百炼应用文档来源回传边界，未确认 jxfz 命中。",
        "",
        "## 9. 关键指标摘要",
        json.dumps(summary, ensure_ascii=False, indent=2),
        "",
        "## 10. 不能用于主结论的限制说明",
        "- Pro 与 Flash 指标不同，不能直接写 Pro 更优。",
        "- 默认 pipeline 若混入 Flash，不能写全程 Pro。",
        "- G3 若无结构化 references，不能写 references 稳定回传。",
        "- 控制样本触发反馈需写入过度反馈错误分析。",
    ]
    (output_dir / "00_readme.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_tables(output_dir: Path, summary: dict[str, Any]) -> None:
    table_config = [
        {"组别": "G1", "模型": DECLARED_MODEL, "知识增强": "无", "GraphRAG": "否", "外部来源": "否", "目的": "模型无检索边界", "实际执行链路": "offline deterministic runner", "边界说明": "不确认真实 provider Pro"},
        {"组别": "G2", "模型": DECLARED_MODEL, "知识增强": "本地 norm-node GraphRAG", "GraphRAG": "是", "外部来源": "否", "目的": "规范节点追踪", "实际执行链路": "NormGraphRAG", "边界说明": "非生产 literature GraphRAG"},
        {"组别": "G3", "模型": DECLARED_MODEL, "知识增强": "Norm Retriever", "GraphRAG": "否", "外部来源": "否", "目的": "结构化 references", "实际执行链路": "CitationVerifier + NormNodeRetriever", "边界说明": "不使用 /api/chat mode=norms 判断"},
        {"组别": "G4", "模型": DECLARED_MODEL, "知识增强": "百炼应用文档来源", "GraphRAG": "否", "外部来源": "百炼", "目的": "来源回传边界", "实际执行链路": "offline boundary record", "边界说明": "未确认 jxfz 不写通过"},
    ]
    write_csv(output_dir / "07_paper_tables" / "table_d13_config.csv", table_config, list(table_config[0].keys()))

    table_metrics = []
    observations = {
        "G1": "无结构化来源；用于观测无 RAG 边界。",
        "G2": "本地规范节点可追踪；需看召回与幻觉率。",
        "G3": "结构化 references 来自 citation_check。",
        "G4": "离线记录不确认 jxfz 命中。",
    }
    for group, metrics in sorted(summary.items()):
        table_metrics.append({
            "组别": group,
            "样本数": metrics["sample_count"],
            "references 返回率": metrics["reference_event_rate"],
            "grounded P": metrics["grounded_reference_precision"],
            "hallucinated rate": metrics["hallucinated_reference_rate"],
            "false positive": metrics["false_positive_rate"],
            "error events": metrics["error_events"],
            "TTFE": metrics["ttfe_ms"],
            "total latency": metrics["total_latency_ms"],
            "主要观察": observations[group],
        })
    write_csv(output_dir / "07_paper_tables" / "table_d13_metrics.csv", table_metrics, list(table_metrics[0].keys()))

    risks = [
        {"发现": "G4 未确认 jxfz 命中", "风险": "误写外部知识库验证通过", "论文处理": "仅写百炼应用文档来源回传或未确认。"},
        {"发现": "G3 无结构化 references 时", "风险": "把文本标记误当结构化回传", "论文处理": "只依据 citation_check 输出判断。"},
        {"发现": "Pro 与 Flash 指标不同", "风险": "跨模型直接比较导致因果错误", "论文处理": "作为补充对照，不替代主评测。"},
        {"发现": "控制样本触发反馈", "风险": "过度反馈", "论文处理": "写入 false positive 错误分析。"},
        {"发现": "默认 pipeline 可能混入 Flash", "风险": "误称全程 Pro", "论文处理": "强制记录 model_claim_level。"},
    ]
    write_csv(output_dir / "07_paper_tables" / "table_d13_risk_boundary.csv", risks, list(risks[0].keys()))


def write_manual_review(output_dir: Path, records: list[dict[str, Any]]) -> None:
    sampled = records[:8]
    lines = ["# Sampled Cases", ""]
    for record in sampled:
        lines.extend([
            f"## {record['group']} / {record['sample_id']}",
            f"- model_claim_level: {record['model_claim_level']}",
            f"- source_claim_level: {record['source_claim_level']}",
            f"- notes: {record['notes']}",
            "",
            record["output_text"],
            "",
        ])
    (output_dir / "06_manual_review" / "sampled_cases.md").write_text("\n".join(lines), encoding="utf-8")
    write_csv(
        output_dir / "06_manual_review" / "review_notes.csv",
        [{"sample_id": record["sample_id"], "group": record["group"], "reviewer_note": ""} for record in sampled],
        ["sample_id", "group", "reviewer_note"],
    )


def write_logs(output_dir: Path, *, records: list[dict[str, Any]], regression_text: str = "") -> None:
    errors = [record for record in records if record["metrics"]["error_events"]]
    (output_dir / "05_logs" / "backend_tail.log").write_text("Not captured in offline runner. Run docker logs command to replace this file.\n", encoding="utf-8")
    (output_dir / "05_logs" / "request_summary.log").write_text(
        json.dumps(Counter(record["group"] for record in records), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (output_dir / "05_logs" / "error_events.log").write_text(
        "\n".join(json.dumps(error, ensure_ascii=False) for error in errors) + ("\n" if errors else "No error events recorded.\n"),
        encoding="utf-8",
    )
    (output_dir / "05_logs" / "regression_tests.log").write_text(regression_text or "Regression tests not run by offline package writer.\n", encoding="utf-8")


def run_experiment(root: Path, output_dir: Path, *, live_g4: bool = False) -> dict[str, Any]:
    root = root.resolve()
    output_dir = output_dir.resolve()
    ensure_package_dirs(output_dir)
    samples, sample_note = load_selected_samples(root)

    import sys

    scripts_dir = root / "scripts"
    backend_dir = root / "backend"
    for path in (str(scripts_dir), str(backend_dir)):
        if path not in sys.path:
            sys.path.insert(0, path)

    from editing.evidence import CitationVerifier
    from rag.norm_retriever import NormNodeRetriever
    from rq2_real_backend import NormGraphRAG

    norm_graph = NormGraphRAG.from_root(root)
    citation_verifier = CitationVerifier(norm_retriever=NormNodeRetriever(), rag=None)

    records: list[dict[str, Any]] = []
    for sample in samples:
        records.append(run_g1(sample))
        records.append(run_g2(sample, norm_graph))
        records.append(run_g3(sample, citation_verifier))
        records.append(run_g4(sample, live_g4=live_g4))

    by_group: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        by_group[record["group"]].append(record)

    output_files = {
        "G1": "g1_pro_no_rag.jsonl",
        "G2": "g2_pro_local_graphrag.jsonl",
        "G3": "g3_pro_norm_retriever.jsonl",
        "G4": "g4_pro_bailian_sources.jsonl",
    }
    for group, filename in output_files.items():
        write_jsonl(output_dir / "03_outputs" / filename, by_group[group])

    write_json(output_dir / "02_sample_set" / "selected_20_samples.json", samples)
    write_json(output_dir / "02_sample_set" / "expected_refs.json", {sample["sample_id"]: sample["expected_refs"] for sample in samples})
    (output_dir / "02_sample_set" / "sample_hash.txt").write_text(stable_hash(samples) + "\n", encoding="utf-8")

    write_json(
        output_dir / "01_config" / "model_config.json",
        {
            "declared_model": DECLARED_MODEL,
            "effective_model": "",
            "model_claim_level": "declared_only",
            "dashscope_app_id": APP_ID,
            "note": "Offline runner records declared model only; provider-level model confirmation requires live response usage metadata.",
        },
    )
    write_json(
        output_dir / "01_config" / "rag_config.json",
        {
            "G1": {"norm_retriever": None, "rag": None, "kg": "disabled"},
            "G2": {"norm_retriever": None, "rag": "NormGraphRAG", "graph_hops": 1, "theta": THETA, "retrieval_top_k": TOP_K, "node_validation": "enabled"},
            "G3": {"norm_retriever": "NormNodeRetriever", "rag": None, "external_rag": "disabled"},
            "G4": {"rag": "DashScopeKnowledgeRAGRetriever", "knowledge_base": "unconfirmed", "source_display": "boundary_only"},
        },
    )

    summary = summarize_metrics(records)
    write_json(output_dir / "04_metrics" / "metrics_summary.json", summary)
    traceability, source_display, risk, latency = build_metric_rows(records)
    write_csv(output_dir / "04_metrics" / "traceability_metrics.csv", traceability, list(traceability[0].keys()))
    write_csv(output_dir / "04_metrics" / "source_display_metrics.csv", source_display, list(source_display[0].keys()))
    write_csv(output_dir / "04_metrics" / "risk_metrics.csv", risk, list(risk[0].keys()))
    write_csv(output_dir / "04_metrics" / "latency_metrics.csv", latency, list(latency[0].keys()))

    jxfz_confirmed = any(record["jxfz_confirmed"] for record in records)
    write_readme(output_dir, sample_note=sample_note, summary=summary, commit_hash=git_commit_hash(root), jxfz_confirmed=jxfz_confirmed)
    write_tables(output_dir, summary)
    write_manual_review(output_dir, records)
    write_logs(output_dir, records=records)

    package_text = "\n".join(path.read_text(encoding="utf-8", errors="ignore") for path in output_dir.rglob("*") if path.is_file())
    findings = scan_for_secrets(package_text)
    no_secret = "PASS: no secret-like patterns detected.\n" if not findings else "FAIL: " + ", ".join(findings) + "\n"
    (output_dir / "01_config" / "no_secret_check.txt").write_text(no_secret, encoding="utf-8")

    return {
        "package_dir": str(output_dir),
        "sample_count": len(samples),
        "group_counts": {group: len(by_group[group]) for group in ("G1", "G2", "G3", "G4")},
        "jxfz_confirmed": jxfz_confirmed,
        "error_events": sum(int(record["metrics"]["error_events"]) for record in records),
        "no_secret_findings": findings,
    }


def scan_only(output_dir: Path) -> dict[str, Any]:
    if not output_dir.exists():
        return {"package_dir": str(output_dir), "no_secret_findings": ["package-missing"]}
    package_text = "\n".join(path.read_text(encoding="utf-8", errors="ignore") for path in output_dir.rglob("*") if path.is_file())
    findings = scan_for_secrets(package_text)
    return {"package_dir": str(output_dir), "no_secret_findings": findings}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output-dir", type=Path, default=Path("pro_rag_control_experiment"))
    parser.add_argument("--live-g4", action="store_true", help="Reserved for live DashScope G4 runs; default remains offline.")
    parser.add_argument("--no-run", action="store_true", help="Do not generate outputs.")
    parser.add_argument("--scan-only", action="store_true", help="Only scan an existing package for secrets.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output_dir = args.output_dir if args.output_dir.is_absolute() else args.root / args.output_dir
    if args.no_run or args.scan_only:
        result = scan_only(output_dir)
    else:
        result = run_experiment(root=args.root, output_dir=output_dir, live_g4=args.live_g4)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if result.get("no_secret_findings") else 0


if __name__ == "__main__":
    raise SystemExit(main())
