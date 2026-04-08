#!/usr/bin/env bash
set -euo pipefail

if ! command -v just &>/dev/null; then
  bun install -g rust-just
fi

just install

# Stage memory files to a writable location (Claude SDK blocks writes to .claude/)
MEMORY_STAGING="/tmp/agent-memory"
mkdir -p "$MEMORY_STAGING"
cp -a .claude/memory/*.md "$MEMORY_STAGING/" 2>/dev/null || true
echo "Memory staged to $MEMORY_STAGING"
