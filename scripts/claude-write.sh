#!/usr/bin/env bash
set -euo pipefail

# Path-gated writer for .claude/** files.
# Usage: bash scripts/claude-write.sh <target-path> <<< "content"
#   or:  <content> | bash scripts/claude-write.sh <target-path>
#
# Exit codes: 0 = written, 1 = refused (outside .claude/), 2 = usage error.

target="${1:?Usage: claude-write.sh <target-path>}"

repo_root="$(cd "$(dirname "$0")/.." && pwd -P)"
claude_dir="$repo_root/.claude"

# Make absolute relative to repo root
[[ "$target" = /* ]] || target="$repo_root/$target"

# Parent directory must exist
parent="$(dirname "$target")"
if [[ ! -d "$parent" ]]; then
  echo "claude-write: parent directory does not exist: $parent" >&2
  exit 2
fi

# Resolve parent (follows symlinks, collapses ..)
resolved="$(cd "$parent" && pwd -P)/$(basename "$target")"

# If target is an existing symlink, resolve through it
if [[ -L "$resolved" ]]; then
  link="$(readlink "$resolved")"
  [[ "$link" = /* ]] || link="$(dirname "$resolved")/$link"
  link_parent="$(dirname "$link")"
  if [[ ! -d "$link_parent" ]]; then
    echo "claude-write: symlink target directory does not exist: $link_parent" >&2
    exit 2
  fi
  resolved="$(cd "$link_parent" && pwd -P)/$(basename "$link")"
fi

# Gate: must be strictly inside .claude/
if [[ "$resolved" != "$claude_dir/"* ]]; then
  echo "claude-write: refused — resolved path is outside .claude/: $resolved" >&2
  exit 1
fi

cat > "$resolved"
