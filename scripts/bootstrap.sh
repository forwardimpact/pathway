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
  # Don't rebase feature branches automatically — rebasing is a deliberate
  # action the user should request. Just report how far behind main we are.
  ahead_behind=$(git rev-list --left-right --count main..."$current_branch" 2>/dev/null || echo "0 0")
  behind=$(echo "$ahead_behind" | awk '{print $1}')
  if [ "$behind" -gt 0 ]; then
    echo "Branch '$current_branch' is $behind commit(s) behind main. Rebase when ready."
  fi
fi

# ── Install tooling ──────────────────────────────────────────────
if ! command -v just &>/dev/null; then
  bun install -g rust-just
fi

just install
