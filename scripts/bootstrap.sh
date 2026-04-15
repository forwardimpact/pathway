#!/usr/bin/env bash
set -euo pipefail

# ── Sync with origin/main ────────────────────────────────────────
# Shallow clones lack enough history for rebase to find a merge base.
# Unshallow first so rebase works reliably.
if [ -f .git/shallow ]; then
  git fetch --unshallow origin
fi

git fetch origin main

current_branch=$(git branch --show-current)

if [ "$current_branch" = "main" ]; then
  git merge --ff-only origin/main
else
  # Update local main ref without checkout
  git branch -f main origin/main
  # Rebase feature branch onto main; on conflict abort and warn (never reset)
  if git rebase main 2>/dev/null; then
    echo "Rebased '$current_branch' onto main."
  else
    git rebase --abort
    echo "Branch '$current_branch' has conflicts with main. Rebase manually when ready."
  fi
fi

# ── Install tooling ──────────────────────────────────────────────
if ! command -v just &>/dev/null; then
  bun install -g rust-just
fi

just install
