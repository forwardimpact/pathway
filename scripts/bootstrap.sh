#!/usr/bin/env bash
set -euo pipefail

if ! command -v just &>/dev/null; then
  bun install -g rust-just
fi

just install
