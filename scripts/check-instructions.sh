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
check CLAUDE.md 200

# Layer 3 — contribution standards
check CONTRIBUTING.md 300

# Layer 5 — agent profiles
for f in .claude/agents/*.md; do
  check "$f" 100
done

# Layer 6 — skills (fit-* published skills get 300; all others 200)
for f in .claude/skills/*/SKILL.md; do
  case "$f" in
    .claude/skills/fit-*) check "$f" 300 ;;
    *)                    check "$f" 200 ;;
  esac
done

exit $status
