#!/bin/bash
# Spider v2.3 — Build Script
# Usage: ./build.sh [typecheck|build|all|test]

set -e
cd "$(dirname "$0")"

case "${1:-all}" in
  typecheck)
    echo "Type checking..."
    npx tsc --noEmit
    ;;
  build)
    echo "Building..."
    npm install
    bun build src/index.ts --outdir dist --target bun --format esm --bundle
    echo "Bundle: $(wc -c < dist/index.js) bytes"
    ;;
  test)
    echo "Running tests..."
    npx vitest run
    ;;
  all|*)
    echo "Type checking..."
    npx tsc --noEmit
    echo "Building..."
    npm install
    bun build src/index.ts --outdir dist --target bun --format esm --bundle
    echo "Bundle: $(wc -c < dist/index.js) bytes"
    echo "Running tests..."
    npx vitest run
    ;;
esac
