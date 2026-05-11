#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

from modelscope.hub.snapshot_download import snapshot_download


DEFAULT_MODEL_ID = "BAAI/bge-small-zh-v1.5"
DEFAULT_CACHE_DIR = Path.home() / ".cache" / "modelscope"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download the local embedding model from ModelScope.")
    parser.add_argument("--model-id", default=DEFAULT_MODEL_ID)
    parser.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE_DIR)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    path = snapshot_download(args.model_id, cache_dir=str(args.cache_dir))
    print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
