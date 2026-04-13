#!/usr/bin/env bash
set -euo pipefail

# ── Sync with origin/main ────────────────────────────────────────
git fetch origin main

current_branch=$(git branch --show-current)

if [ "$current_branch" = "main" ]; then
  git merge --ff-only origin/main
else
  # Update local main ref without checkout
  git branch -f main origin/main
  # Rebase feature branch onto updated main; reset to main on conflict
  git rebase main || {
    git rebase --abort
    git reset --hard main
  }
fi

# ── Install tooling ──────────────────────────────────────────────
if ! command -v just &>/dev/null; then
  bun install -g rust-just
fi

just install
