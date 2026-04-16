#!/usr/bin/env bash
# Enforce instruction layer line limits (KATA.md § Instruction length).
# Called by `bun run check` and `just check-instructions`.

set -euo pipefail

status=0

check() {
  local file="$1" max="$2"
  [ -f "$file" ] || return 0
  lines=$(wc -l < "$file" | tr -d ' ')
  if [ "$lines" -gt "$max" ]; then
    echo "error: $file has $lines lines (max $max)" >&2
    status=1
  fi
}

# Layer 2 — project identity
check CLAUDE.md 192

# Layer 3 — contribution standards
check CONTRIBUTING.md 256

# Layer 5 — agent profiles
for f in .claude/agents/*.md; do
  check "$f" 64
done

# Layer 6 — skills
for f in .claude/skills/*/SKILL.md; do
  check "$f" 192
done

exit $status
