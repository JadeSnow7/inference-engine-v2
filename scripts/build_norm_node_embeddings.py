#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path

try:
    from openai import OpenAI
except ModuleNotFoundError:  # pragma: no cover - exercised when dependency is unavailable
    OpenAI = None


DEFAULT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = DEFAULT_ROOT / "data" / "rq2_traceability" / "norm_nodes.json"
DEFAULT_OUTPUT = DEFAULT_ROOT / "data" / "rq2_traceability" / "norm_nodes_with_embeddings.json"
API_BASE = "https://dashscope.aliyuncs.com/compatible-mode/v1"
EMBED_MODEL = "text-embedding-v3"


def build_embeddings(
    source: Path,
    output: Path,
    *,
    api_key: str,
    batch_size: int = 25,
    sleep_seconds: float = 0.3,
) -> tuple[int, int]:
    if OpenAI is None:
        raise RuntimeError("openai package is required to build norm-node embeddings")
    client = OpenAI(api_key=api_key, base_url=API_BASE)
    nodes = json.loads(source.read_text(encoding="utf-8"))
    results = []
    dimension = None
    for index in range(0, len(nodes), batch_size):
        batch = nodes[index : index + batch_size]
        response = client.embeddings.create(
            model=EMBED_MODEL,
            input=[node["text"] for node in batch],
            encoding_format="float",
        )
        for node, item in zip(batch, response.data):
            embedding = list(item.embedding)
            if dimension is None:
                dimension = len(embedding)
            if len(embedding) != dimension:
                raise RuntimeError("Embedding dimensions are inconsistent")
            results.append({**node, "embedding": embedding})
        print(f"embedded {min(index + len(batch), len(nodes))}/{len(nodes)}")
        if sleep_seconds:
            time.sleep(sleep_seconds)
    output.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    return len(results), int(dimension or 0)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build norm-node embeddings with DashScope text-embedding-v3.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--batch-size", type=int, default=25)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    api_key = os.environ["DASHSCOPE_API_KEY"]
    count, dimension = build_embeddings(args.input, args.output, api_key=api_key, batch_size=args.batch_size)
    print(f"Done. Saved {count} nodes to {args.output}")
    print(f"Embedding dimension: {dimension}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
