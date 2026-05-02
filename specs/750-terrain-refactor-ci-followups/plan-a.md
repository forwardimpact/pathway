# Plan — Spec 750 (terrain refactor CI follow-ups)

## Approach

Sweep every `bunx fit-terrain` invocation in the spec's named surface
(`justfile`, root `package.json`, `.github/workflows/**`) onto the post-refactor
verb surface using the intent → verb assignment from `design-a.md`; drop
`LOG_LEVEL=error` on `data:prose` only; remove the `kata-release-merge` Step 5
carve-out outright; add a one-file static gate that fails CI if any
`bunx fit-terrain` in the named surface lacks a verb (R1 mitigation); update the
two contributor docs that name the retired `synthetic-no-prose` recipe. All
edits are mechanical and independently verifiable; sequencing is steps 1–6 in
order, then steps 7–8 (gate + docs) in parallel.

## Steps

### S1 — Update `justfile` synthetic recipes

Map `synthetic` → `build`, `synthetic-update` → `generate`; delete
`synthetic-no-prose`.

- **Modified:** `justfile` (lines ~57–69).
- **Deleted:** `justfile` recipe `synthetic-no-prose` and its comment.
- **Change:**

  ```diff
   synthetic:
  -    bunx fit-terrain
  +    bunx fit-terrain build
       bunx fit-map generate-index

   synthetic-update:
  -    bunx fit-terrain --generate
  +    bunx fit-terrain generate
       bunx fit-terrain build
       bunx fit-map generate-index

  -# Generate synthetic data (structural only, no prose)
  -synthetic-no-prose:
  -    bunx fit-terrain --no-prose
  -    bunx fit-map generate-index
  ```

  (`synthetic-update` gains an explicit `build` line because `generate` fills
  the cache; emitting content is the recipe's documented purpose. This matches
  design's "Fill cache via LLM, then materialize `data/pathway/`" intent.)

- **Verify:** `just synthetic --dry-run` lists `bunx fit-terrain build` only;
  `just --list | grep synthetic-no-prose` returns nothing.

### S2 — Update root `package.json` scripts

Map `generate` → `fit-terrain build`; drop `LOG_LEVEL=error` on `data:prose`.

- **Modified:** `package.json` (`scripts.generate`, `scripts.data:prose`).
- **Change:**
  ```diff
  -    "generate": "fit-terrain",
  +    "generate": "fit-terrain build",
  -    "data:prose": "LOG_LEVEL=error bunx fit-terrain check",
  +    "data:prose": "bunx fit-terrain check",
  ```
  (`data:schema` keeps its `LOG_LEVEL=error` prefix per design K3 — out of spec
  scope.)
- **Verify:** `bun run data:prose` exits 0 on a populated cache and prints the
  cache report at default log level (no error-threshold suppression).

### S3 — Update CI workflows

Map every no-verb `bunx fit-terrain` to `bunx fit-terrain build`.

- **Modified:**
  - `.github/workflows/check-test.yml` (line 18, `test` job).
  - `.github/workflows/interview-landmark-setup.yml` (line 57).
  - `.github/workflows/interview-map-setup.yml` (line 55).
  - `.github/workflows/interview-summit-setup.yml` (line 57).
- **Change (each):** `bunx fit-terrain` → `bunx fit-terrain build`.
- **Verify:** `grep -rn 'bunx fit-terrain\b' .github/workflows/` returns only
  occurrences followed by a verb (`build` / `check` / `validate` / `generate` /
  `inspect`) — no bare invocation.

### S4 — Remove `kata-release-merge` Step 5 carve-out

- **Modified:** `.claude/skills/kata-release-merge/SKILL.md` (Step 5, the
  paragraph beginning "After rebase, run `bun run check:fix`…").
- **Change:**
  ```diff
  -After rebase, run `bun run check:fix` then `bun run check`. If checks still fail
  -(excluding expected validation failures from missing `data/pathway/`), mark
  -**blocked** with the failures and skip to Step 9.
  +After rebase, run `bun run check:fix` then `bun run check`. If checks still
  +fail, mark **blocked** with the failures and skip to Step 9.
  ```
- **Verify:**
  `grep -n 'data/pathway' .claude/skills/kata-release-merge/SKILL.md` returns no
  matches.

### S5 — Add static "no bare `bunx fit-terrain`" gate

R1 mitigation. New script enumerates the spec's named surface and fails on any
`bunx fit-terrain` without a verb from the accepted set.

- **Created:** `scripts/check-terrain-callers.mjs` (Node ESM,
  `#!/usr/bin/env node`).
- **Modified:** `package.json` (add to `scripts.context`), `justfile` (parallel
  recipe).
- **Behaviour:**
  - Targets: `justfile`, `package.json`, every file under `.github/workflows/`.
  - Pattern: regex
    `\bbunx fit-terrain\b(?!\s+(check|validate|build|generate|inspect)\b)` on
    each target; treats `LOG_LEVEL=… bunx fit-terrain …` the same.
  - On match: print `<file>:<line>: bare `bunx
    fit-terrain` — add a verb (build|check|validate|generate|inspect)` and
    exit 1.
  - No match: exit 0 silently.
- **Wiring:** `package.json` →
  `"context:terrain": "node scripts/check-terrain-callers.mjs"`, appended to the
  `context` chain (`bun run check` already runs `context`). `justfile` → recipe
  `check-terrain-callers` calling the same script.
- **Verify:** introduce a temporary `bunx fit-terrain` (no verb) somewhere in
  the named surface; `bun run context:terrain` exits 1 with the line cite.
  Revert; `bun run check` passes.

### S6 — Update contributor docs

Drop `synthetic-no-prose` from the two docs that name it. CONTRIBUTING.md
already documents the canonical sequence (`bun install && just quickstart`) per
design K5; no edit needed there.

- **Modified:**
  - `websites/fit/docs/getting-started/contributors/index.md` (lines 46–49 in
    the "Other generation modes" block — remove the `synthetic-no-prose`
    bullet).
  - `websites/fit/docs/internals/operations/index.md` (lines 102–109 — remove
    the `synthetic-no-prose` line in the code block and the "no-prose mode"
    sentence in the prose).
- **Verify:** `grep -rn 'synthetic-no-prose' websites/ .claude/ CONTRIBUTING.md`
  returns no hits.

### S7 — Verify: green `Test (e2e)` and `Data (prose)`

- **Action:** push all of S1–S6 on the implementation branch; let the `Test` and
  `Data` workflows run.
- **Verify:**
  - `gh run list --workflow=Test --branch <impl-branch> --limit 1` shows the
    `e2e` job `success`.
  - `gh run list --workflow=Data --branch <impl-branch> --limit 1` shows the
    `prose` job `success`.

### S8 — Clean-checkout replay (success criterion 6)

- **Action:** in a fresh clone (or `git clean -dfx && bun install` on a
  throwaway worktree), run `just quickstart`, then `bun start`.
- **Verify:** `quickstart` completes without error; `bun start` clears
  `prestart` (no `ENOENT` on `data/pathway/`); `serve` binds and the home page
  responds 200.

## Libraries used

`Libraries used: none.` (Plan-introduced script uses Node built-ins only.)

## Risks

| Id  | Risk                                                                                                                                           | Why not visible from the plan                                                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | A second `bunx fit-terrain` caller exists outside the named surface (e.g., `scripts/`, a sub-package) and silently breaks once the gate ships. | The implementer must `grep -rn 'bunx fit-terrain' .` once before commit and either widen the gate or fix the caller.                                                            |
| P2  | The `Test (e2e)` `synthetic-cache` is hit on the impl branch (key includes `data/synthetic/**` only), masking the miss-path fix.               | The cache is per-key, not per-branch. To force a clean miss, edit any file under `data/synthetic/**` on the impl branch (a no-op edit suffices) before pushing.                 |
| P3  | `bunx fit-terrain build` aborts on a clean checkout because the prose cache file is regenerated by SCRATCHPAD-3 and incomplete.                | Design assumption R2: `build` warns on misses, not aborts. If the implementer observes a non-zero exit on a clean checkout, the design returns to draft (verb mapping changes). |
| P4  | The static gate's regex flags a legitimate verb invocation that wraps the call (e.g., shell quoting / heredoc).                                | Test the gate against the existing 4 workflow files plus the post-S1/S2/S3 state — exit 0 is the contract; iterate the regex if it false-positives.                             |

## Execution

Sequential agent: **`staff-engineer`** for all eight steps. Parallelism is not
warranted — the change set is small (≤10 files), and S7/S8 are verifications
that depend on the prior six steps having merged.

Step ordering:

1. **S1 → S2 → S3 → S4 → S5 → S6** in one PR. The static gate (S5) lands in the
   same PR so the gate validates the post-sweep state.
2. **S7** runs on PR push (CI green is the merge gate).
3. **S8** runs once on a fresh worktree as a manual replay before applying the
   approval signal.

Optional split: if S5 (the static gate) needs separate review, land S1–S4, S6 in
a first impl PR and S5 in a follow-up; the gate is defensive, not a blocker for
restoring green `main`.
