# Plan 890-a — Kata-Skills Benchmark Family (v1, no ablation)

## Approach

Add a new top-level `benchmarks/` directory with a catalog README and a
sentinel fixture marker, then build one family at `benchmarks/kata-skills/`
that consists of three checked-in artefacts (family README, judge profile,
single v1 task) plus a regime-aware staging script that produces a valid
`fit-benchmark` family tree at build time (per spec [#870](../870-fit-benchmark-coding-tasks/design-a.md)).
The task `kata-spec/write-feature-spec/` ships an `instructions.md`, a
brief + JTBD excerpt under `specs/`, a no-op `workdir/scripts/preflight.sh`,
a templated `judge.task.md`, and a structural `scoring/run.sh` that emits
NDJSON to `$RESULTS_FD`. A new GitHub Actions workflow drives three triggers
(manual dispatch and weekly schedule stage the published pack; path-filtered
PRs stage from in-repo `.claude/`), invokes `bunx fit-benchmark run` then
`report`, writes the pass@k table to `$GITHUB_STEP_SUMMARY`, asserts the
cost envelope by summing `costUsd` across the JSONL, and uploads the JSONL
artefact. Concurrency is keyed on `github.ref` with `cancel-in-progress`.

Libraries used: `@forwardimpact/libeval` (`fit-benchmark` CLI — `run`, `report`). No new npm dependencies.

## Plan-level decisions (design left open)

| # | Decision | Rejected | Why |
|---|---|---|---|
| P1 | The agent writes its spec to `$WORKDIR/spec.md` (a single fixed path) and reads inputs from `$WORKDIR/specs/brief.md` + `$WORKDIR/specs/jtbd-excerpt.md`. | Numbered output path (e.g., `$WORKDIR/specs/890-…/spec.md`). | Design § Family layout names `specs/` as a copied input directory; reusing it for output collides with the brief and forces the agent to invent a number. A flat output path keeps grading hermetic. |
| P2 | The v1 task brief targets a specific named feature ("Spec a `--filter-tools` flag for `fit-trace`") that fits the Platform Builders / Evaluate-and-Improve-Agents JTBD. | A generic "spec something useful" prompt. | A concrete brief lets `cites-jtbd` and `specific-scope` grade objectively; a vague brief lets the agent succeed structurally by inventing arbitrary content. The chosen target is also small enough that an agent can complete it within 25 turns. |
| P3 | Structural rubric is a POSIX `/bin/sh` script using `awk`/`grep`/`sed` only — no language runtime dependency. NDJSON `{test,pass,message?}` rows go to `$RESULTS_FD`; exit code is the authoritative verdict per design Decision 12 of #870. | Node.js or Python rubric. | Bash matches the fixture-family scoring scripts shipped by `libraries/libeval/test/fixtures/benchmark-family/` and avoids interpreter availability questions in the benchmark sandbox. The fd-3 convention is already documented in `bin/fit-benchmark.js` flag help and the libeval guide. |
| P4 | Staging script writes `apm.lock.yaml` containing `apm_lock_version: 1`, `dependencies: []`, and a `benchmark:` block. The in-repo `source_identity` is `sha256:` over a deterministic manifest of staged files (sorted relative paths + per-file sha256, concatenated, hashed); the published `source_identity` is `<pack-version>@<git-sha>` from the fetched repo. | Hash the whole lockfile-less staging tree, or use git ls-tree. | The substrate hashes `apm.lock.yaml` bytes verbatim per `apm-installer.js`; varying the `benchmark:` block's `source_identity` field is the simplest way to flip `skillSetHash` when staged content changes. The manifest algorithm is portable across `sha256sum`/`shasum -a 256`. |
| P5 | The non-judge agent profiles staged into `.claude/agents/` are the full set under `monorepo/.claude/agents/*.md` (in-repo) or `<pack>/agents/*.agent.md` (published, renamed to `<name>.md`), excluding `judge.md` so the family-local checked-in profile is never overwritten. | Stage no agents (skills only). | The kata skills reference domain agent profiles (e.g., `staff-engineer`, `product-manager`) in their orchestration patterns; staging them keeps the skill behaviour intact. Excluding `judge.md` preserves the family-local profile per design Decision 4. |
| P6 | The cost-envelope assertion sums `costUsd` across `results.jsonl` and fails the workflow if it exceeds `$5`. Failure does not block the artefact upload (which uses `if: always()`). | Per-task budget check inside the harness. | Spec asserts the envelope target and the recording substrate (`costUsd`); the envelope is a workflow-level invariant per design Decision 9. The artefact must survive an overrun so investigation can begin. |

## Step 1 — Catalog scaffolding

Intent: establish the top-level `benchmarks/` directory with the catalog
README and the fixture-safety sentinel.

**Created:**
- `benchmarks/README.md`
- `benchmarks/.benchmark-fixture` (empty)

Change:

```
benchmarks/
  .benchmark-fixture                       # sentinel; empty file
  README.md                                # catalog
```

`benchmarks/README.md` carries: a one-line catalog statement, a one-paragraph
"how to add a family" guide naming the required substrate elements
(`apm.lock.yaml`, `.claude/skills/`, `.claude/agents/`, `tasks/<family>/<task>/`),
the fixture-safety mechanism (both path predicate `benchmarks/**` and
ancestor-sentinel `.benchmark-fixture`, with the exact `rg --glob`
exclusion idiom), and a link to spec [#870](../specs/870-fit-benchmark-coding-tasks/design-a.md)
for substrate-level operational notes. Lists the existing family: `kata-skills`.

Verify: `test -f benchmarks/.benchmark-fixture && test -f benchmarks/README.md`;
`rg '<job ' --glob '!benchmarks/**' JTBD.md` matches existing rows, and
`rg '<job ' benchmarks/` finds no rows.

## Step 2 — Family root + checked-in artefacts

Intent: create the family root with the family README and the family-local
judge agent profile.

**Created:**
- `benchmarks/kata-skills/README.md`
- `benchmarks/kata-skills/.claude/agents/judge.md`
- `benchmarks/kata-skills/.gitignore`

`benchmarks/kata-skills/README.md` documents: the v1 task list (one row),
the regime-aware staging contract (build-time only, never checked in apart
from `judge.md` and the task tree), the marker mechanism from Step 1
(referenced, not re-enumerated), and links to spec #870 for substrate
operational guidance (skill-pack staging, sandbox flags, agent-cwd
discipline, judge-profile-only-for-v1). Does not repeat #870's content.

`benchmarks/kata-skills/.claude/agents/judge.md` is the family-local judge
profile. Frontmatter `name: judge`, `description: Judge for the
kata-skills benchmark family.`. Body: a short prompt telling the model to
read the scoring result and the agent trace (delivered via `{{SCORING}}` and
`{{AGENT_TRACE_PATH}}` placeholders in the task's `judge.task.md`) and call
`Conclude` with `verdict="success"` iff the agent's spec.md addresses the
brief (judge-layer property — does the spec solve the stated problem, not
just clear the structural rubric).

`benchmarks/kata-skills/.gitignore` excludes the build outputs:

```
.claude/skills/
.claude/agents/*
!.claude/agents/judge.md
apm.lock.yaml
```

Verify: `test -f benchmarks/kata-skills/.claude/agents/judge.md`; the
gitignore allows `judge.md` while excluding everything else under
`.claude/`.

## Step 3 — Staging script

Intent: produce a valid `fit-benchmark` family tree at the family root,
selecting source by regime, and write a deterministic `apm.lock.yaml`.

**Created:** `benchmarks/kata-skills/scripts/stage-family.sh` (mode `0755`).

```sh
#!/bin/sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FAMILY_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MONOREPO_ROOT="$(cd "$FAMILY_ROOT/../.." && pwd)"

REGIME=""
while [ $# -gt 0 ]; do
  case "$1" in
    --regime) REGIME="$2"; shift 2 ;;
    *) echo "stage-family.sh: unknown arg: $1" >&2; exit 2 ;;
  esac
done
[ "$REGIME" = "in-repo" ] || [ "$REGIME" = "published" ] || {
  echo "stage-family.sh: --regime in-repo|published required" >&2; exit 2; }

CLAUDE="$FAMILY_ROOT/.claude"
LOCK="$FAMILY_ROOT/apm.lock.yaml"

# Preserve the checked-in judge profile across the rebuild.
JUDGE_TMP=""
if [ -f "$CLAUDE/agents/judge.md" ]; then
  JUDGE_TMP="$(mktemp -d)/judge.md"
  cp "$CLAUDE/agents/judge.md" "$JUDGE_TMP"
fi
rm -rf "$CLAUDE" "$LOCK"
mkdir -p "$CLAUDE/skills" "$CLAUDE/agents"
[ -n "$JUDGE_TMP" ] && cp "$JUDGE_TMP" "$CLAUDE/agents/judge.md"

if [ "$REGIME" = "in-repo" ]; then
  for d in "$MONOREPO_ROOT"/.claude/skills/kata-*/; do
    [ -d "$d" ] || continue
    cp -R "$d" "$CLAUDE/skills/"
  done
  for f in "$MONOREPO_ROOT"/.claude/agents/*.md; do
    [ -f "$f" ] || continue
    name="$(basename "$f")"
    [ "$name" = "judge.md" ] && continue
    cp "$f" "$CLAUDE/agents/$name"
  done
  ID="sha256:$(
    cd "$CLAUDE" && find . -type f | LC_ALL=C sort \
      | xargs sha256sum | sha256sum | cut -d' ' -f1
  )"
else
  TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
  git clone --depth=1 https://github.com/forwardimpact/kata-skills "$TMP/pack"
  SHA="$(cd "$TMP/pack" && git rev-parse HEAD)"
  VERSION="$(awk -F': ' '/^version:/{print $2; exit}' "$TMP/pack/apm.yml")"
  for d in "$TMP/pack"/skills/kata-*/; do
    [ -d "$d" ] || continue
    cp -R "$d" "$CLAUDE/skills/"
  done
  for f in "$TMP/pack"/agents/*.agent.md; do
    [ -f "$f" ] || continue
    name="$(basename "$f" .agent.md).md"
    [ "$name" = "judge.md" ] && continue
    cp "$f" "$CLAUDE/agents/$name"
  done
  ID="${VERSION}@${SHA}"
fi

cat > "$LOCK" <<EOF
apm_lock_version: 1
dependencies: []
benchmark:
  regime: ${REGIME}
  source_identity: ${ID}
EOF
```

Verify: run `./benchmarks/kata-skills/scripts/stage-family.sh --regime in-repo`
locally; assert `.claude/skills/kata-spec/SKILL.md` exists, `.claude/agents/judge.md`
is unchanged, `apm.lock.yaml` parses as YAML and carries `regime: in-repo`,
and running the script twice in succession produces byte-identical
`apm.lock.yaml` (in-repo determinism — `find … | sort | sha256sum` is stable
for identical inputs).

## Step 4 — v1 task scaffolding

Intent: ship the single v1 task with all checked-in inputs the agent needs
plus the no-op preflight.

**Created:**
- `benchmarks/kata-skills/tasks/kata-spec/write-feature-spec/instructions.md`
- `benchmarks/kata-skills/tasks/kata-spec/write-feature-spec/supervisor.task.md`
- `benchmarks/kata-skills/tasks/kata-spec/write-feature-spec/judge.task.md`
- `benchmarks/kata-skills/tasks/kata-spec/write-feature-spec/specs/brief.md`
- `benchmarks/kata-skills/tasks/kata-spec/write-feature-spec/specs/jtbd-excerpt.md`
- `benchmarks/kata-skills/tasks/kata-spec/write-feature-spec/workdir/scripts/preflight.sh` (mode `0755`)

File contents:

| File | Contents (summary) |
| --- | --- |
| `instructions.md` | One paragraph: "Read `specs/brief.md` and `specs/jtbd-excerpt.md`. Following the `kata-spec` skill (staged under `.claude/skills/kata-spec/`), write a specification at `spec.md` (at the working-directory root) that addresses the brief and cites the persona+job from the JTBD excerpt. Do not write a plan or design — spec only." |
| `supervisor.task.md` | Empty body with a comment line: `<!-- Reserved per spec #870 design Decision 14; unread in v1. -->`. Preserved for forward-compat. |
| `judge.task.md` | Templated prompt with placeholders `{{SCORING}}` and `{{AGENT_TRACE_PATH}}` (per #870 plan Step 6 contract). Body: paste the scoring result block, paste the agent-trace path, instruct the judge to read the trace and the emitted `spec.md` and call `Conclude` with `verdict="success"` iff the spec addresses the brief (not just clears the rubric). |
| `specs/brief.md` | The brief itself: "Spec a new `--filter-tools` flag for `fit-trace overview` that restricts the output to events involving a comma-separated list of tool names. Hire: Platform Builders, job: Evaluate and Improve Agents." |
| `specs/jtbd-excerpt.md` | A copy of the `<job user="Platform Builders" goal="Evaluate and Improve Agents">` block from `JTBD.md` lines 256–284 (verbatim, including the surrounding `<job>` tags). |
| `workdir/scripts/preflight.sh` | `#!/bin/sh` + `exit 0`. Mode `0755`. |

Verify: from the family root, `test -x tasks/kata-spec/write-feature-spec/workdir/scripts/preflight.sh`;
`grep -q '{{SCORING}}' tasks/kata-spec/write-feature-spec/judge.task.md`
and `grep -q '{{AGENT_TRACE_PATH}}' …/judge.task.md`;
`grep -q '<job user="Platform Builders"' tasks/kata-spec/write-feature-spec/specs/jtbd-excerpt.md`.

## Step 5 — Scoring rubric

Intent: grade the agent's emitted `$WORKDIR/spec.md` against the kata-spec
DO-CONFIRM bar using POSIX shell only.

**Created:** `benchmarks/kata-skills/tasks/kata-spec/write-feature-spec/scoring/run.sh` (mode `0755`).

```sh
#!/bin/sh
set -u
SPEC="$WORKDIR/spec.md"
JTBD="$WORKDIR/specs/jtbd-excerpt.md"
FAIL=0

emit() { printf '%s\n' "$1" >&"$RESULTS_FD"; }

# 1. File present
if [ ! -f "$SPEC" ]; then
  emit '{"test":"file-present","pass":false,"message":"spec.md missing at WORKDIR/spec.md"}'
  exit 1
fi
emit '{"test":"file-present","pass":true}'

# 2. Problem first: first level-2 heading is "Problem" (case-insensitive)
first_h2="$(awk '/^## / { sub(/^## /,""); sub(/[[:space:]]*$/,""); print; exit }' "$SPEC")"
lc_first="$(printf '%s' "$first_h2" | tr '[:upper:]' '[:lower:]')"
case "$lc_first" in
  problem*) emit '{"test":"problem-first","pass":true}' ;;
  *) emit "{\"test\":\"problem-first\",\"pass\":false,\"message\":\"first level-2 heading is '$first_h2'\"}"
     FAIL=1 ;;
esac

# 3. Specific scope: has Scope section AND an exclusion marker
HAS_SCOPE=0; HAS_EXCL=0
grep -qiE '^## (In )?Scope( |$)' "$SPEC" && HAS_SCOPE=1
grep -qiE '^### Out of scope|^## Out of scope|excluded?( from)?|not in scope' "$SPEC" && HAS_EXCL=1
if [ "$HAS_SCOPE" = 1 ] && [ "$HAS_EXCL" = 1 ]; then
  emit '{"test":"specific-scope","pass":true}'
else
  emit "{\"test\":\"specific-scope\",\"pass\":false,\"message\":\"scope=$HAS_SCOPE exclusion=$HAS_EXCL\"}"
  FAIL=1
fi

# 4. Verifiable success: "## Success Criteria" (or "## Success")
if grep -qiE '^## Success( Criteria)?( |$)' "$SPEC"; then
  emit '{"test":"verifiable-success","pass":true}'
else
  emit '{"test":"verifiable-success","pass":false,"message":"missing ## Success Criteria"}'
  FAIL=1
fi

# 5. No HOW leak: avoid file:line patterns and function-signature patterns
if grep -qE '[A-Za-z0-9_/.-]+\.(js|ts|sh|py|yml|yaml):[0-9]+|^[[:space:]]*function +[A-Za-z_]+ *\(|async +function' "$SPEC"; then
  emit '{"test":"no-how-leak","pass":false,"message":"file:line or function signature detected"}'
  FAIL=1
else
  emit '{"test":"no-how-leak","pass":true}'
fi

# 6. Cites JTBD: spec contains the persona+job string from the staged excerpt
persona_job="$(awk '
  match($0, /<job user="[^"]*" goal="[^"]*">/) {
    s = substr($0, RSTART, RLENGTH)
    match(s, /user="[^"]*"/); u = substr(s, RSTART+6, RLENGTH-7)
    match(s, /goal="[^"]*"/); g = substr(s, RSTART+6, RLENGTH-7)
    print u": "g
    exit
  }' "$JTBD")"
if [ -n "$persona_job" ] && grep -qF "$persona_job" "$SPEC"; then
  emit '{"test":"cites-jtbd","pass":true}'
else
  emit "{\"test\":\"cites-jtbd\",\"pass\":false,\"message\":\"missing '$persona_job'\"}"
  FAIL=1
fi

[ "$FAIL" = 0 ] && exit 0 || exit 1
```

Verify: from the family root, write a passing fixture `spec.md` into a
scratch `$WORKDIR` and call `WORKDIR=…  RESULTS_FD=1 sh tasks/kata-spec/write-feature-spec/scoring/run.sh`;
all six rows emit `pass:true` and the exit code is `0`. Mutate one rule
(drop the `## Problem` heading) and assert the exit code flips to `1` with
`problem-first` reporting `pass:false`.

## Step 6 — Workflow

Intent: drive the family on the three trigger signals, stage with the
correct regime, run + report + assert the cost envelope, upload the
artefact.

**Created:** `.github/workflows/benchmark-kata-skills.yml`.

```yaml
name: Benchmark — kata-skills

on:
  workflow_dispatch:
  schedule:
    - cron: "0 6 * * 1"
  pull_request:
    paths:
      - ".claude/skills/kata-*/**"
      - ".claude/agents/*.md"
      - "benchmarks/kata-skills/**"
      - ".github/workflows/benchmark-kata-skills.yml"

concurrency:
  group: benchmark-kata-skills-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  bench:
    runs-on: ubuntu-latest
    env:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6
      - uses: ./.github/actions/bootstrap
      - name: Stage family
        run: |
          if [ "${{ github.event_name }}" = "pull_request" ]; then
            ./benchmarks/kata-skills/scripts/stage-family.sh --regime in-repo
          else
            ./benchmarks/kata-skills/scripts/stage-family.sh --regime published
          fi
      - name: Run benchmark
        run: |
          bunx fit-benchmark run \
            --family ./benchmarks/kata-skills \
            --output ./bench-output \
            --runs 5 \
            --model claude-haiku-4-5-20251001 \
            --max-turns 25
      - name: Report
        run: |
          bunx fit-benchmark report \
            --input ./bench-output --format text \
            >> "$GITHUB_STEP_SUMMARY"
      - name: Assert cost envelope (≤ $5)
        run: |
          TOTAL=$(jq -s '[.[].costUsd // 0] | add' ./bench-output/results.jsonl)
          echo "Total cost: $TOTAL USD"
          awk -v t="$TOTAL" 'BEGIN { if (t+0 > 5) exit 1 }'
      - uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
        if: always()
        with:
          name: results-jsonl
          path: ./bench-output/results.jsonl
          if-no-files-found: warn
```

Verify: `actionlint .github/workflows/benchmark-kata-skills.yml` (or
`bun run check`) returns zero. The three trigger blocks are present
(`workflow_dispatch`, `schedule`, `pull_request` with paths filter).
`concurrency.group` resolves per `github.ref` and `cancel-in-progress`
is `true`. The `Stage family` step branches on `github.event_name`. The
`Assert cost envelope` step fails when the sum exceeds 5.

## Step 7 — Local verification + quality gates

Intent: prove the family loads and grades end-to-end on the developer's
machine before opening the PR; run formatting and check gates.

**Modified:** none (verification only). The catalog/family READMEs and
the new workflow file may surface in `bun run context:fix`; commit any
diff produced.

Run, from the repo root:

```sh
./benchmarks/kata-skills/scripts/stage-family.sh --regime in-repo
bunx fit-benchmark run --family ./benchmarks/kata-skills \
  --output /tmp/bench-890 --runs 1 \
  --model claude-haiku-4-5-20251001 --max-turns 25
bunx fit-benchmark report --input /tmp/bench-890 --format text
bun run check
bun run format:fix
bun run context:fix
```

Verify: the run completes; `/tmp/bench-890/results.jsonl` exists with one
JSON line whose `taskId` is `kata-spec/write-feature-spec` and whose
`skillSetHash` starts with `sha256:`; the report renders a markdown table
with `pass@1`. Quality gates exit `0`.

## Risks

The risks below are items the implementer cannot see from the plan steps.

1. **Published-regime fetch needs network.** Step 3's `published` branch
   shallow-clones `forwardimpact/kata-skills` over HTTPS. On the
   GitHub-hosted runner this is free; on an offline developer machine the
   `--regime published` invocation fails by design. Document in the family
   README that developers default to `--regime in-repo`.
2. **`apm.yml` `version:` line shape lock-in.** Step 3's published branch
   parses `version:` from the pack's `apm.yml` via `awk -F': '`. The
   publish-skills workflow currently emits a flat `version: <semver>` line
   matching that pattern; if the pack ever moves the version into a
   nested YAML structure, the parse silently sets `VERSION` empty and the
   lockfile carries `@<sha>` with no version. Mitigation: add a non-empty
   assertion on `$VERSION` before writing the lockfile in a follow-up.
3. **Haiku may not pass the rubric.** v1 pins `claude-haiku-4-5-20251001`
   for cost. The structural rubric is strict (six checks, all must pass).
   If Haiku consistently fails one check (e.g., `cites-jtbd` is sensitive
   to exact-string match), pass@5 will be 0. v1 surfaces that as the
   first signal — adjusting the rubric or the model is a follow-up spec
   per spec § Out of scope (ablation/threshold tuning).
4. **JTBD persona+job exact-string drift.** `cites-jtbd` greps `fixed-string`
   for the persona+job pair. If `JTBD.md` is regenerated with even a
   single-character change inside `<job user="…">`, the fixture excerpt
   in Step 4 drifts out of sync and the rubric flips. Mitigation: a
   pre-commit hook on `JTBD.md` could re-sync the excerpt; out of scope
   for v1 plan.
5. **`fit-benchmark` not yet on `latest` of the published pack.** Step 6's
   workflow uses `bunx fit-benchmark`, which resolves to the version in
   the monorepo's lockfile. CI's `bun install` (via the bootstrap action)
   stages local workspace packages, so the in-monorepo `fit-benchmark`
   binary is what runs — no npm fetch is required. Confirmed by spec #870
   Step 11 (bin wired into `libraries/libeval/package.json`).

## Execution recommendation

Single engineering executor, sequential. Steps 1 → 2 → 3 → 4 → 5 → 6 → 7
have a strict dependency chain: the catalog scaffolds the family root,
the family root provides the script's target, the script's regime contract
is consumed by the workflow, and verification touches every preceding
artefact. Route the prose in Steps 1 and 2 (catalog README, family
README) to `technical-writer` after Step 6 lands if pacing allows;
otherwise the same engineering agent owns the full plan in one session.
The plan is small enough that decomposition into `plan-a-NN.md` parts
would add structural overhead without parallelism benefit (no two steps
can run concurrently).

— Staff Engineer 🛠️
