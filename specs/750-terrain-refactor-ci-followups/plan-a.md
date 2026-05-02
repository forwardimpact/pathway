---
spec: 750
title: Terrain refactor CI follow-ups
status: plan draft
---

## Approach

Land spec 750 in **two PRs in strict order** because of a load-bearing
phase-ordering invariant (below). PR A ports every `bunx fit-terrain` caller to
a verb (`justfile`, root `package.json`, four workflows), drops
`LOG_LEVEL=error` from `data:prose`, deletes `just synthetic-no-prose` (per
design K2), updates contributor docs, and adds an automated invariant gate (per
design R1) so a verb-less invocation can never reland silently. PR B removes the
`kata-release-merge` Step-5 carve-out (per design K4). The canonical
[design (PR #680)](https://github.com/forwardimpact/monorepo/pull/680) captures
K1–K6; this plan owns per-file edits and the merge-ordering mechanism the design
defers to it.

## Phase-ordering invariant (load-bearing)

> **PR B (carve-out removal) opens only after PR A is merged to `main` and the
> `e2e` and `prose` jobs on the resulting `main` SHA report `success`.**

The carve-out is the only artefact letting CI-red trusted-author PRs merge while
the verb-mapping fix lands. PR A's own implementation commits include some that
are CI-red (e.g. between Step 2 fixing the `justfile` and Step 3 fixing the
workflows that call it); the carve-out covers them. Removing the carve-out
before PR A is merged-and-green would deadlock PR A against its own fix. After
PR A is green, the carve-out has no live use case, so PR B removes it. Source
artefacts:

- Release-engineer sign-off (this constraint, full-removal endorsement, and the
  "no implementation-PR exception" decision):
  [PR #681 close-comment](https://github.com/forwardimpact/monorepo/pull/681#issuecomment-4363411338)
  and PR #681 review thread (RE comment
  [#4363398042](https://github.com/forwardimpact/monorepo/pull/681#issuecomment-4363398042)).
- Weekly log: `wiki/staff-engineer-2026-W18.md` § "Planner handoff
  (parallel-design caveat)".

The implementer must not bundle PR A and PR B into a single PR or stack them
without an intervening `main` merge.

# Part A — Verb-mapping fix (PR A)

PR title:
`feat(ci): port fit-terrain callers to verb surface and remove LOG_LEVEL=error mask (#673)`.

## Step A1 — Add the verb-mapping invariant gate

**Intent.** Add an automated check that every `bunx fit-terrain` (or
`npx fit-terrain`, or `fit-terrain` bare in npm scripts) invocation in the
in-scope surface (`justfile`, root `package.json`, `.github/workflows/**`) ends
in one of the five accepted verbs (`check`, `validate`, `build`, `generate`,
`inspect`).

**Files:**

- created: `scripts/check-fit-terrain.mjs`

**Changes:** New ESM script following the `scripts/check-instructions.mjs`
pattern. Reads the three surfaces with `node:fs`, regex-extracts every
`fit-terrain` invocation, and asserts each token after the binary name is in the
accepted set or is one of the documented global flags (`--story`, `--cache`)
followed eventually by a verb. On mismatch, prints the offending file:line and
the offending token, then `process.exit(1)`. On success, prints
`✓ N invocations checked`.

The script's accepted-verb list is hardcoded as a constant `KNOWN_VERBS` —
mirroring `libraries/libterrain/bin/fit-terrain.js`. A unit-style smoke
assertion is sufficient; no separate test file.

**Verification:** `node scripts/check-fit-terrain.mjs` exits 0 on the
post-Step-A4 tree; exits 1 if any file in the surface has a verb-less
invocation. Manual: temporarily revert one verb in `justfile` and confirm the
script flags it.

## Step A2 — Wire the gate into `bun run context`

**Intent.** Make the gate run on every PR via the existing `Context` workflow.

**Files:**

- modified: `package.json`
- modified: `.github/workflows/check-context.yml`

**Changes:**

1. In `package.json scripts`, add
   `"context:terrain": "bun scripts/check-fit-terrain.mjs"` and extend the
   `context` script chain to include it:
   `"context": "bun run context:instructions && bun run context:metadata && bun run context:catalog && bun run context:terrain"`.
2. In `.github/workflows/check-context.yml`, append a fourth job mirroring the
   existing three:

   ```yaml
   terrain:
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6
       - uses: ./.github/actions/bootstrap
       - run: bun run context:terrain
   ```

**Depends on:** Step A1.

**Verification:** `bun run context` exits 0 locally on the post-Step-A4 tree.
The new `terrain` check shows up in `gh pr checks <pr-number>` after push.

## Step A3 — Port `justfile` and root `package.json`

**Intent.** Apply the verb mapping for the two top-of-tree callers and delete
the `synthetic-no-prose` recipe per design K2.

**Files:**

- modified: `justfile`
- modified: `package.json`

**Changes:**

1. `justfile` (current lines 56–69):

   ```diff
   -# Generate synthetic data (cached prose)
   -synthetic:
   -    bunx fit-terrain
   -    bunx fit-map generate-index
   -
   -# Generate synthetic data with LLM and update prose cache
   -synthetic-update:
   -    bunx fit-terrain --generate
   -    bunx fit-map generate-index
   -
   -# Generate synthetic data (structural only, no prose)
   -synthetic-no-prose:
   -    bunx fit-terrain --no-prose
   -    bunx fit-map generate-index
   +# Generate synthetic data (cached prose, no LLM)
   +synthetic:
   +    bunx fit-terrain build
   +    bunx fit-map generate-index
   +
   +# Generate synthetic data with LLM and update prose cache
   +synthetic-update:
   +    bunx fit-terrain generate
   +    bunx fit-map generate-index
   ```

2. `package.json scripts`:

   ```diff
   -    "generate": "fit-terrain",
   +    "generate": "fit-terrain generate",
   -    "data:prose": "LOG_LEVEL=error bunx fit-terrain check",
   +    "data:prose": "bunx fit-terrain check",
   ```

   `data:schema` is left unchanged (out of spec scope per design K3).

**Depends on:** Step A1 (gate exists; the diff produces a tree the gate
accepts).

**Verification:** `bun run context:terrain` exits 0; `just --list` no longer
shows `synthetic-no-prose`.

## Step A4 — Port the workflow callers

**Intent.** Apply the verb mapping for the four workflows that invoke
`bunx fit-terrain` directly.

**Files:**

- modified: `.github/workflows/check-test.yml`
- modified: `.github/workflows/interview-landmark-setup.yml`
- modified: `.github/workflows/interview-map-setup.yml`
- modified: `.github/workflows/interview-summit-setup.yml`

**Changes:** in each file, the literal `bunx fit-terrain` step becomes
`bunx fit-terrain build`. Specific lines today:

| File                           | Line | Today              | Post-step                |
| ------------------------------ | ---- | ------------------ | ------------------------ |
| `check-test.yml`               | 18   | `bunx fit-terrain` | `bunx fit-terrain build` |
| `interview-landmark-setup.yml` | 57   | `bunx fit-terrain` | `bunx fit-terrain build` |
| `interview-map-setup.yml`      | 55   | `bunx fit-terrain` | `bunx fit-terrain build` |
| `interview-summit-setup.yml`   | 57   | `bunx fit-terrain` | `bunx fit-terrain build` |

`interview-guide-setup.yml` is **not** modified (does not invoke `fit-terrain`).
The `e2e` job's `if: cache-hit != 'true'` step calls `just synthetic` and is
fixed transitively by Step A3.

**Depends on:** Step A1 (gate accepts the post-step tree), Step A3 (the
`just synthetic` change is what the `e2e` cache-miss branch consumes).

**Verification:** `bun run context:terrain` exits 0; CI on PR A reports
`success` for `e2e`, `prose`, and `terrain`.

## Step A5 — Update contributor docs

**Intent.** Reflect the deleted recipe (K2) and the corrected verb names in the
two onboarding pages that mention them.

**Files:**

- modified: `websites/fit/docs/getting-started/contributors/index.md`
- modified: `websites/fit/docs/internals/operations/index.md`

**Changes:**

1. `contributors/index.md` lines 46–49 (the "Other generation modes" code
   block): drop the `just synthetic-no-prose` line entirely; leave
   `synthetic-update` with the description "Regenerate prose via LLM and update
   the cache". After Step A5, the page names exactly the canonical sequence
   `bun install && just quickstart && bun start` (criterion 6).
2. `operations/index.md` lines 102–109 (the "### Generation" block): drop the
   `synthetic-no-prose` row from the code block; update the surrounding prose to
   remove the "no-prose mode produces …" sentence.

No other doc page references `synthetic-no-prose` (verified via repo-wide grep
at plan-write time).

**Depends on:** Step A3.

**Verification:**
`grep -RnE 'synthetic-no-prose' websites/ CONTRIBUTING.md README.md` returns no
matches.

## Step A6 — Verify Part A

**Intent.** Confirm the success criteria PR A targets (1–4 + 6) before opening
PR B.

**Files:** none.

**Commands (run sequentially):**

1. `bun run check && bun run context` — gate green on the new tree (criteria 3,
   4 by static inspection).
2. `bun test` — full suite passes; no test references the deleted
   `synthetic-no-prose` recipe.
3. After PR A is merged to `main`: confirm the post-merge `Test` run reports
   `e2e: success` (criterion 1) and the post-merge `Data` run reports
   `prose: success` (criterion 2). The same `e2e` run satisfies criterion 6
   transitively (it executes the contributor sequence from a clean cache-miss
   state).

This is the gate that releases Part B.

# Part B — Carve-out removal (PR B)

PR title: `fix(kata-release-merge): remove data/pathway carve-out (#673)`.
**Opens after Part A's merged-and-green verification in Step A6.**

## Step B1 — Remove the parenthetical from `kata-release-merge` Step 5

**Intent.** Apply design K4 — full removal, not narrowing.

**Files:**

- modified: `.claude/skills/kata-release-merge/SKILL.md`

**Changes:** in Step 5, change the sentence (current line ~123) from

```
After rebase, run `bun run check:fix` then `bun run check`. If checks still
fail (excluding expected validation failures from missing `data/pathway/`),
mark **blocked** with the failures and skip to Step 9.
```

to

```
After rebase, run `bun run check:fix` then `bun run check`. If checks still
fail, mark **blocked** with the failures and skip to Step 9.
```

No other text in Step 5 changes. No other carve-outs are touched (out of spec
scope).

**Verification:**
`grep -nE 'expected validation failures from missing' .claude/skills/kata-release-merge/SKILL.md`
returns no match (criterion 5).

## Step B2 — Verify Part B

**Intent.** Confirm criterion 5 by static inspection.

**Files:** none.

**Commands:**

1. `bun run check && bun run context` — quality gate stays green.
2. `grep -nE 'data/pathway' .claude/skills/kata-release-merge/SKILL.md` returns
   no match (the carve-out's only `data/pathway` reference was the one removed;
   no other prose mentions `data/pathway/` in this file).

## Libraries used

`none` (the new gate uses only `node:fs` and `node:path`).

## Risks

- **The new gate's regex must permit global flags before the verb.**
  `bunx fit-terrain --story=path build` is valid (the global `--story` flag
  precedes the verb). The implementer cannot see this from Step A1's prose
  without reading `libraries/libterrain/bin/fit-terrain.js` — the global flags
  are `story`, `cache`, `help`, `version`, `json`, all defined in the CLI's
  `globalOptions` block. The gate must accept any of these (or their
  `--flag=value` form) before the verb token; otherwise it will false-flag
  legitimate invocations the spec does not target.
- **`fit-terrain build` on the CI cache-miss path may exit non-zero if
  `data/synthetic/prose-cache.json` has misses.** Spec premise (R2 in the
  design) is that `build` is the cache-only mode. If cache misses surface in CI
  after Step A4, that is a real prose-cache regression — not a verb- mapping
  issue — and the implementer must escalate rather than work around it.
  (Mitigation: spec criterion 1 / 2 verification on the post-merge `main`
  surfaces this within minutes.)
- **PR B's branch must base on the post-PR-A `main`.** If PR B branches off
  pre-PR-A `main` and is then rebased forward, no harm. But if PR B is opened in
  parallel with PR A on a long-lived branch and rebased late, the SKILL.md edit
  may merge before PR A's CI is verified green. The phase-ordering invariant
  above is the contract; the implementer must enforce by waiting on Step A6's
  post-merge verification.

## Execution recommendation

One agent, two PRs, sequential. Route both parts to `staff-engineer` — each part
is small (~10 file edits in PR A, 1 edit in PR B) and the design context is
shared. Part B opens **after** Part A's Step A6 post-merge verification passes,
never before. No parallelism is appropriate at this size; the parallelism axis
(different parts on different agents) would violate the phase-ordering
invariant.

— Staff Engineer 🛠️
