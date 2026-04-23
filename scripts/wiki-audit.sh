#!/usr/bin/env bash
# Audit agent memory against the wiki contract (spec 590).
# Usage: wiki-audit.sh   — exits non-zero if any check fails.
set -euo pipefail
shopt -s nullglob

WIKI_DIR="wiki"
fail_count=0

# ── Permitted H2 headings in summary files ──
# Any H2 NOT in this list is an agent-specific state section —
# permitted but must appear before "Open Blockers".
permitted_summary_h2s=(
  "Open Blockers"
  "Observations for Teammates"
)

# ── Excluded-content H2 patterns (warn only) ──
excluded_h2_patterns=(
  '^## Previously Tracked'
  '^## Evaluation History'
  '^## Recently Closed'
  '^## Storyboard Commitments'
  '^## W[0-9]+ Day'
  '^## .*Outcomes \(20'
)

# ── Helpers ──

fail() { echo "FAIL $1"; ((fail_count++)) || true; }
warn() { echo "WARN $1"; }

is_summary_file() {
  local f="$1"
  # Must live directly under wiki/, end in .md
  [[ "$f" == "$WIKI_DIR"/*.md ]] || return 1
  [[ "$f" != */*/*.md ]] || return 1
  # Exclude known non-summary files
  local base
  base="$(basename "$f")"
  case "$base" in
    MEMORY.md|Home.md|storyboard-*|downstream-*) return 1 ;;
  esac
  # Exclude weekly logs (pattern: *-YYYY-Www.md)
  [[ ! "$base" =~ -[0-9]{4}-W[0-9]{2}\.md$ ]] || return 1
  # First non-blank line must match "# ... — Summary"
  local first_line
  first_line="$(grep -m1 '.' "$f" 2>/dev/null || true)"
  [[ "$first_line" =~ ^#\ .*\ —\ Summary$ ]] || return 1
  return 0
}

is_in_permitted() {
  local heading="$1"
  for p in "${permitted_summary_h2s[@]}"; do
    [[ "$heading" == "$p" ]] && return 0
  done
  return 1
}

# ── 1a. Summary contract — line budget ──

check_summary_budget() {
  for f in "$WIKI_DIR"/*.md; do
    is_summary_file "$f" || continue
    local lines
    lines="$(wc -l < "$f" | tr -d ' ')"
    if (( lines > 80 )); then
      fail "budget: $f has $lines lines (limit 80)"
    fi
  done
}

# ── 1b. Summary contract — permitted sections and order ──

check_summary_sections() {
  for f in "$WIKI_DIR"/*.md; do
    is_summary_file "$f" || continue

    # First non-blank line must be H1 "# ... — Summary"
    local first_line
    first_line="$(grep -m1 '.' "$f" 2>/dev/null || true)"
    if [[ ! "$first_line" =~ ^#\ [A-Z].*\ —\ Summary$ ]]; then
      fail "sections: $f missing H1 '# ... — Summary'"
    fi

    # Must contain **Last run**:
    if ! grep -q '^\*\*Last run\*\*:' "$f"; then
      fail "sections: $f missing '**Last run**:' line"
    fi

    # Enumerate H2s in document order
    local -a h2s=()
    local -a h2_lines=()
    while IFS=: read -r lineno heading; do
      local text="${heading#\#\# }"
      h2s+=("$text")
      h2_lines+=("$lineno")
    done < <(grep -n '^## ' "$f" || true)

    # Check order: state H2s must come before Open Blockers
    local seen_open_blockers=0
    for h in "${h2s[@]}"; do
      if [[ "$h" == "Open Blockers" ]]; then
        seen_open_blockers=1
      elif [[ "$h" == "Observations for Teammates" ]]; then
        : # always valid after Open Blockers
      elif (( seen_open_blockers == 1 )); then
        fail "sections: $f sections out of order ('$h' after 'Open Blockers')"
      fi
    done

    # If both present, Open Blockers must precede Observations for Teammates
    local ob_idx=-1 ot_idx=-1
    for i in "${!h2s[@]}"; do
      [[ "${h2s[$i]}" == "Open Blockers" ]] && ob_idx=$i
      [[ "${h2s[$i]}" == "Observations for Teammates" ]] && ot_idx=$i
    done
    if (( ob_idx >= 0 && ot_idx >= 0 && ob_idx > ot_idx )); then
      fail "sections: $f sections out of order ('Open Blockers' after 'Observations for Teammates')"
    fi
  done
}

# ── 1c. Summary contract — excluded content (informational) ──

check_summary_excluded() {
  for f in "$WIKI_DIR"/*.md; do
    is_summary_file "$f" || continue
    for pattern in "${excluded_h2_patterns[@]}"; do
      while IFS=: read -r lineno match; do
        warn "excluded: $f:$lineno contains $match (belongs in weekly log)"
      done < <(grep -n -E "$pattern" "$f" || true)
    done
  done
}

# ── 1d. Weekly log contract — filename and heading ──

check_weekly_logs() {
  for f in "$WIKI_DIR"/*-[0-9][0-9][0-9][0-9]-W[0-9][0-9].md; do
    local base
    base="$(basename "$f")"
    # Filename must match strict pattern
    if [[ ! "$base" =~ ^[a-z-]+-20[0-9][0-9]-W[0-9][0-9]\.md$ ]]; then
      fail "weekly-log: $f invalid filename pattern"
    fi
    # First non-blank line must match "# ... — 20YY-Www"
    local first_line
    first_line="$(grep -m1 '.' "$f" 2>/dev/null || true)"
    if [[ ! "$first_line" =~ ^#\ .*\ —\ 20[0-9][0-9]-W[0-9][0-9]$ ]]; then
      fail "weekly-log: $f missing valid H1 heading"
    fi
  done
}

# ── 1e. Priority index schema ──

check_priority_index() {
  local memfile="$WIKI_DIR/MEMORY.md"
  if [[ ! -f "$memfile" ]]; then
    fail "memory: $memfile not found"
    return
  fi

  # Must contain exact H2
  if ! grep -q '^## Cross-Cutting Priorities$' "$memfile"; then
    fail "memory: missing '## Cross-Cutting Priorities' heading"
  fi

  # Must contain header row (allow padding)
  if ! grep -qE '^\|[[:space:]]*Item[[:space:]]*\|[[:space:]]*Agents[[:space:]]*\|[[:space:]]*Owner[[:space:]]*\|[[:space:]]*Status[[:space:]]*\|[[:space:]]*Added[[:space:]]*\|' "$memfile"; then
    fail "memory: missing priority table header row"
  fi

  # Must have at least one data row (after separator)
  local data_rows
  data_rows="$(awk '
    /^\| *Item *\|/ { header=1; next }
    header && /^\| *---/ { sep=1; next }
    sep && /^\|/ { count++ }
    /^$/ && sep { exit }
    /^#/ && sep { exit }
    END { print count+0 }
  ' "$memfile")"
  if (( data_rows < 1 )); then
    fail "memory: priority table has no data rows (need at least empty-state row)"
  fi

  # Active rows must not exceed 10
  local active_rows
  active_rows="$(awk '
    /^\| *Item *\|/ { header=1; next }
    header && /^\| *---/ { sep=1; next }
    sep && /^\|/ && /active/ { count++ }
    /^$/ && sep { exit }
    /^#/ && sep { exit }
    END { print count+0 }
  ' "$memfile")"
  if (( active_rows > 10 )); then
    fail "memory: $active_rows active priority rows (limit 10)"
  fi
}

# ── Run all checks ──

check_summary_budget
check_summary_sections
check_summary_excluded
check_weekly_logs
check_priority_index

# ── 1f. Aggregate verdict ──

if (( fail_count > 0 )); then
  echo "RESULT: fail ($fail_count checks failed)"
  exit 1
else
  echo "RESULT: pass"
  exit 0
fi
