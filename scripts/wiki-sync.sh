#!/usr/bin/env bash
# Sync the wiki (GitHub wiki — agent shared memory).
# Usage: wiki-sync.sh pull   — fetch latest from remote
#        wiki-sync.sh push   — commit local changes and push
set -euo pipefail

MODE="${1:-pull}"
WIKI_DIR="wiki"
WIKI_URL="https://github.com/forwardimpact/monorepo.wiki.git"

# ── Init: clone if missing ──
# CI workflows pre-checkout the wiki with an authenticated token; skip the
# clone when the wiki directory is already a git repo (handles both a
# plain .git dir and a gitdir pointer file from an earlier submodule
# checkout). For local dev without network, anonymous clone failure is
# non-fatal — bootstrap continues without a wiki.
if ! git -C "$WIKI_DIR" rev-parse --git-dir >/dev/null 2>&1; then
    if ! git clone "$WIKI_URL" "$WIKI_DIR"; then
        echo "wiki-sync: could not clone wiki, skipping" >&2
        exit 0
    fi
fi

cd "$WIKI_DIR"

# ── Configure identity from parent repo ──
git config user.name  "$(cd .. && git config user.name)"
git config user.email "$(cd .. && git config user.email)"

# ── Fetch latest ──
git fetch origin master

# ── Pull mode: rebase onto remote ──
if [ "$MODE" = "pull" ]; then
    if ! git rebase origin/master; then
        git rebase --abort || true
        git reset --hard origin/master
    fi
    exit 0
fi

# ── Push mode: commit local changes, rebase, push ──
git add -A
if git diff --cached --quiet; then
    exit 0
fi
git commit -m "wiki: update from session"

if ! git rebase origin/master; then
    git rebase --abort || true
    git merge origin/master -X ours --no-edit
fi
git push origin master
