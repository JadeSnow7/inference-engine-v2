#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
IMAGE="${FRONTEND_TEST_IMAGE:-inference-engine-frontend-build:verify}"

DEFAULT_TESTS=(
  "src/api/__tests__/editing.test.ts"
  "src/api/__tests__/connectSSE.test.ts"
  "src/store/__tests__/workspace.test.ts"
)

if [ "$#" -gt 0 ]; then
  TESTS=()
  for test_path in "$@"; do
    TESTS+=("${test_path#frontend/}")
  done
else
  TESTS=("${DEFAULT_TESTS[@]}")
fi

docker run --rm \
  --mount "type=bind,source=${FRONTEND_DIR},target=/workspace/frontend,readonly" \
  --workdir /workspace/frontend \
  "$IMAGE" \
  sh -eu -c '
    if [ ! -d /app/node_modules ]; then
      echo "Expected /app/node_modules in the frontend test image." >&2
      exit 1
    fi

    tmp_dir="$(mktemp -d)"
    trap "rm -rf \"$tmp_dir\"" EXIT

    tar --exclude="./node_modules" --exclude="./dist" -cf - -C /workspace/frontend . \
      | tar -xf - -C "$tmp_dir"
    ln -s /app/node_modules "$tmp_dir/node_modules"

    cd "$tmp_dir"
    npm run test -- --run "$@"
  ' sh "${TESTS[@]}"
