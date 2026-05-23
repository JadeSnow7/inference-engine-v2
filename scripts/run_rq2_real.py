#!/usr/bin/env python3
"""Collect real-system RQ2 outputs.

Default mode is dry-run. Real collection is intentionally blocked until backend
retrieval/generation bindings are wired in this script.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from datetime import datetime, timezone
from collections.abc import Callable
from pathlib import Path
from typing import Any

from rq2_real_backend import NormGraphRAG, build_fallback_feedback, build_retrieval_row


RQ2_DIR = Path("data/rq2_traceability")
METHOD_CONFIGS = {
    "baseline_a": {"retrieval": False, "graph_expand": False, "binding": False},
    "baseline_b": {"retrieval": True, "graph_expand": False, "binding": False},
    "ablation_no_expand": {"retrieval": True, "graph_expand": False, "binding": True},
    "full_graphrag": {"retrieval": True, "graph_expand": True, "binding": True},
}
THETA_VALUES = [0.50, 0.55, 0.60, 0.65, 0.70]


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_queries(root: Path, limit: int | None, query_set: str = "query_set.json") -> list[dict[str, Any]]:
    with (root / RQ2_DIR / query_set).open("r", encoding="utf-8") as handle:
        queries = json.load(handle)
    return queries if limit is None else queries[:limit]


def build_dry_run_row(query: dict[str, Any], method: str, *, theta: float) -> dict[str, Any]:
    return {
        "method": method,
        "run_type": "real_system_dry_run",
        "query_id": query["query_id"],
        "retrieved_nodes": [],
        "generated_refs": [],
        "validation_results": {},
        "low_confidence_refs": [],
        "feedback_structure_complete": False,
        "theta_used": theta,
        "notes": "Dry-run row only. Real collection wiring is not enabled in this script yet.",
    }


def build_llm_messages(*, query: dict[str, Any], method: str, retrieved_nodes: list[dict[str, Any]]) -> list[dict[str, str]]:
    refs = " ".join(f"[REF:{node['node_id']}]" for node in retrieved_nodes[:3])
    node_lines = "\n".join(
        f"- {node['node_id']} ({node['node_type']}, {node['dimension']}): {node['text']}"
        for node in retrieved_nodes
    )
    return [
        {
            "role": "system",
            "content": (
                "You generate concise academic writing feedback. "
                "Use the four Chinese labels: 评价维度, 问题定位, 规范依据, 修改建议. "
                "When citing norm nodes, use exact reference tags such as [REF:node_id]."
            ),
        },
        {
            "role": "user",
            "content": (
                f"query_id: {query['query_id']}\n"
                f"method: {method}\n"
                f"writing snippet:\n{query['text']}\n\n"
                f"retrieved norm nodes:\n{node_lines}\n\n"
                f"Use these reference tags when relevant: {refs}"
            ),
        },
    ]


def build_dashscope_llm_generator(root: Path) -> Callable[..., str]:
    backend_dir = root / "backend"
    if not backend_dir.exists():
        raise RuntimeError(f"LLM generation dependency or config unavailable: backend directory not found at {backend_dir}")
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    import asyncio

    try:
        from core.stream import call_model_once
    except Exception as exc:
        raise RuntimeError(f"LLM generation dependency or config unavailable: {exc}") from exc

    def generate(*, query: dict[str, Any], method: str, retrieved_nodes: list[dict[str, Any]]) -> str:
        messages = build_llm_messages(query=query, method=method, retrieved_nodes=retrieved_nodes)
        return asyncio.run(call_model_once(messages, temperature=0.2, thinking=False, max_tokens=800))

    return generate


def call_llm_with_retries(
    llm_generator: Callable[..., str],
    *,
    query: dict[str, Any],
    method: str,
    retrieved_nodes: list[dict[str, Any]],
    max_attempts: int = 3,
    retry_delay_seconds: float = 2.0,
) -> str:
    last_exc: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            return llm_generator(query=query, method=method, retrieved_nodes=retrieved_nodes)
        except Exception as exc:  # pragma: no cover - concrete SDK exception types vary by provider.
            last_exc = exc
            if attempt >= max_attempts:
                break
            print(
                f"LLM call failed for {query.get('query_id')} {method} "
                f"(attempt {attempt}/{max_attempts}): {type(exc).__name__}: {exc}",
                file=sys.stderr,
            )
            if retry_delay_seconds > 0:
                time.sleep(retry_delay_seconds)
    assert last_exc is not None
    raise last_exc


def build_real_row(
    query: dict[str, Any],
    method: str,
    rag: NormGraphRAG,
    *,
    theta: float,
    with_llm: bool,
    llm_generator: Callable[..., str] | None = None,
    llm_max_attempts: int = 3,
    llm_retry_delay_seconds: float = 2.0,
) -> dict[str, Any]:
    if with_llm and llm_generator is None:
        raise RuntimeError("LLM generation is not wired yet; provide llm_generator or run without --with-llm")
    config = METHOD_CONFIGS[method]
    retrieved_nodes = []
    if config["retrieval"]:
        retrieved_nodes = rag.retrieve(
            query["text"],
            top_k=1 if not config["graph_expand"] else 2,
            graph_expand=config["graph_expand"],
        )
    generated_text = build_fallback_feedback(query, retrieved_nodes)
    if with_llm:
        generated_text = call_llm_with_retries(
            llm_generator,
            query=query,
            method=method,
            retrieved_nodes=retrieved_nodes,
            max_attempts=llm_max_attempts,
            retry_delay_seconds=llm_retry_delay_seconds,
        )
    row = build_retrieval_row(
        query=query,
        method=method,
        retrieved_nodes=retrieved_nodes,
        generated_text=generated_text,
        theta=theta,
        binding=bool(config["binding"]),
    )
    if with_llm:
        row["run_type"] = "real_system_llm"
    return row


def git_commit(root: Path) -> str:
    try:
        import subprocess

        proc = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=root,
            text=True,
            capture_output=True,
            check=False,
        )
        return proc.stdout.strip() if proc.returncode == 0 else "unknown"
    except Exception:
        return "unknown"


def git_dirty(root: Path) -> bool:
    try:
        import subprocess

        proc = subprocess.run(
            ["git", "status", "--short"],
            cwd=root,
            text=True,
            capture_output=True,
            check=False,
        )
        return bool(proc.stdout.strip()) if proc.returncode == 0 else True
    except Exception:
        return True


def build_run_manifest(
    *,
    root: Path,
    run_id: str,
    query_set_hash: str,
    norm_nodes_hash: str,
    run_type: str,
    model: str,
    random_seed: int,
) -> dict[str, Any]:
    return {
        "run_id": run_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "run_type": run_type,
        "model": model,
        "model_version": model,
        "embedding_model": "script-local-token-jaccard",
        "kg_version": norm_nodes_hash[:12],
        "query_set_hash": query_set_hash,
        "norm_nodes_hash": norm_nodes_hash,
        "theta_values": THETA_VALUES,
        "retriever_config": {"type": "NormGraphRAG", "top_k_no_expand": 1, "top_k_full": 2},
        "graph_expand_hops": 1,
        "validator_version": "rq2_traceability_lib.validate_refs@v2",
        "prompt_template_hash": hashlib.sha256(json.dumps(METHOD_CONFIGS, sort_keys=True).encode("utf-8")).hexdigest(),
        "random_seed": random_seed,
        "method_configs": METHOD_CONFIGS,
        "git_commit": git_commit(root),
        "dirty_flag": git_dirty(root),
        "environment": "local",
        "operator": "codex",
        "offline_stub_allowed": False,
    }


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "".join(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n" for row in rows),
        encoding="utf-8",
    )


def append_jsonl_row(path: Path, row: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")


def read_resumable_live_rows(path: Path, *, method: str, queries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    if len(rows) > len(queries):
        return []
    for index, row in enumerate(rows):
        if row.get("method") != method:
            return []
        if row.get("run_type") != "real_system_llm":
            return []
        if row.get("query_id") != queries[index].get("query_id"):
            return []
    return rows


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--theta", type=float, default=0.6)
    parser.add_argument("--method", choices=sorted(METHOD_CONFIGS) + ["all"], required=True)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--query-set", default="query_set.json")
    parser.add_argument("--write-outputs", action="store_true", help="Write JSONL outputs and run_manifest.json under data/rq2_traceability.")
    parser.add_argument("--run-id", default="")
    parser.add_argument("--random-seed", type=int, default=42)
    parser.add_argument("--llm-max-attempts", type=int, default=3)
    parser.add_argument("--llm-retry-delay-seconds", type=float, default=2.0)
    parser.add_argument("--dry-run", action="store_true", default=True)
    parser.add_argument("--real", action="store_true", help="Attempt real collection after backend bindings are implemented.")
    parser.add_argument("--with-llm", action="store_true", help="Call the configured model after retrieval; default is retrieval-only fallback feedback.")
    return parser.parse_args(argv)


def main() -> int:
    args = parse_args()
    root = args.root.resolve()
    methods = sorted(METHOD_CONFIGS) if args.method == "all" else [args.method]
    if args.real:
        try:
            llm_generator = build_dashscope_llm_generator(root) if args.with_llm else None
            queries = read_queries(root, args.limit, args.query_set)
            rag = NormGraphRAG.from_root(root)
            rows_by_method = {}
            for method in methods:
                output_path = root / RQ2_DIR / "system_outputs" / f"{method}.jsonl"
                rows_by_method[method] = []
                if args.write_outputs and args.with_llm:
                    rows_by_method[method] = read_resumable_live_rows(output_path, method=method, queries=queries)
                    if rows_by_method[method]:
                        print(
                            f"Resuming {method}: {len(rows_by_method[method])}/{len(queries)} live rows already present.",
                            file=sys.stderr,
                        )
                if args.write_outputs and not rows_by_method[method]:
                    output_path.parent.mkdir(parents=True, exist_ok=True)
                    output_path.write_text("", encoding="utf-8")
                for query in queries[len(rows_by_method[method]) :]:
                    row = build_real_row(
                        query,
                        method,
                        rag,
                        theta=args.theta,
                        with_llm=args.with_llm,
                        llm_generator=llm_generator,
                        llm_max_attempts=args.llm_max_attempts,
                        llm_retry_delay_seconds=args.llm_retry_delay_seconds,
                    )
                    rows_by_method[method].append(row)
                    if args.write_outputs:
                        append_jsonl_row(output_path, row)
                    else:
                        print(json.dumps(row, ensure_ascii=False))
            if args.write_outputs:
                query_set_path = root / RQ2_DIR / args.query_set
                norm_nodes_path = root / RQ2_DIR / "norm_nodes.json"
                manifest = build_run_manifest(
                    root=root,
                    run_id=args.run_id or f"rq2-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
                    query_set_hash=file_sha256(query_set_path),
                    norm_nodes_hash=file_sha256(norm_nodes_path),
                    run_type="real",
                    model="dashscope" if args.with_llm else "fallback_feedback",
                    random_seed=args.random_seed,
                )
                (root / RQ2_DIR / "run_manifest.json").write_text(
                    json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
                    encoding="utf-8",
                )
        except RuntimeError as exc:
            print(str(exc), file=sys.stderr)
            return 2
        return 0
    queries = read_queries(root, args.limit, args.query_set)
    for query in queries:
        for method in methods:
            print(json.dumps(build_dry_run_row(query, method, theta=args.theta), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
