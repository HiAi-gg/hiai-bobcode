#!/usr/bin/env bash
# DEVELOPMENT ONLY — runs from source with hot reload.
# For production, build first: cd packages/opencode && bun run build
# Backend on http://localhost:50900, Frontend on http://localhost:50901
set -euo pipefail
cd "$(dirname "$0")"

echo "=== Starting hiai-bob backend (port 50900) ==="
bun run --cwd packages/opencode --conditions=browser src/index.ts serve --port 50900 &
BACKEND_PID=$!

echo "=== Starting hiai-bob frontend (port 50901) ==="
bun run --cwd packages/app dev -- --port 50901 &
FRONTEND_PID=$!

echo ""
echo "Backend:  http://localhost:50900"
echo "Frontend: http://localhost:50901"
echo ""
echo "Press Ctrl+C to stop both."

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
