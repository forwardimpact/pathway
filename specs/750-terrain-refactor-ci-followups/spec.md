# Spec 750 — Terrain refactor CI follow-ups

## Problem

Two `main`-branch GitHub Actions jobs — `e2e` (in `Test`) and `prose` (in
`Data`) — have failed on every commit since
`f740e3e9 refactor(terrain): re-architect for goal-driven execution (SCRATCHPAD-3)`
on 2026-05-02 08:39 UTC. Ten subsequent commits, including a follow-up
`chore(scripts): align data:* with fit-terrain subcommands` (`59a51ab7`), have
not closed the regression.

| Job (workflow) | Last green | Surface symptom on `main`                                                                                                                                       |
| -------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e` (Test)   | `cd335fb6` | `[WebServer] Error: ENOENT: no such file or directory, stat '…/data/pathway'` → `prestart` exits 1 → Playwright fails to start the webserver → `test:e2e` fails |
| `prose` (Data) | `cd335fb6` | `LOG_LEVEL=error bunx fit-terrain check` exits 1, prints only its cache report; the actual error is suppressed by `LOG_LEVEL=error` so CI logs are unreadable   |

The two failures share a root cause and one CI hygiene problem:

- **Root cause (e2e and prose).** SCRATCHPAD-3 replaced `fit-terrain`'s
  flag-driven pipeline with verb subcommands (`check`, `validate`, `build`,
  `generate`, `inspect <stage>`). Two contracts that crossed that boundary
  weren't ported in lockstep:
  - `just synthetic` still calls `bunx fit-terrain` with no verb (and
    `synthetic-update` / `synthetic-no-prose` still pass the removed
    `--generate` / `--no-prose` flags). The `e2e` job's `data/pathway/` cache
    miss path runs `just synthetic`, which now fails to materialize
    `data/pathway/`, so the webserver `prestart` (`bunx fit-pathway build`)
    cannot find its input.
  - `data:prose` was rewired to `fit-terrain check` by `59a51ab7`, but the new
    `check` verb walks the cache-lookup DAG and exits non-zero on whatever
    invariant fails — and the script keeps the legacy `LOG_LEVEL=error` prefix
    that hides the failure detail.
- **CI hygiene (visibility).** `LOG_LEVEL=error` in the `data:prose` script
  filters output below the error threshold; in CI we want the failing run's
  diagnostic on the operator's screen, not muted.
- **Mask (why the regression survived ten commits).**
  [`kata-release-merge` § Step 5](../../.claude/skills/kata-release-merge/SKILL.md)
  carves out "expected validation failures from missing `data/pathway/`" so
  trusted-author PRs continue to merge even when their CI shows that signature.
  The carve-out was written for the pre-refactor world where missing
  `data/pathway/` was a transient setup gap; under the new pipeline it has
  become an indistinguishable cover for a real regression on `main` and is the
  reason ten subsequent commits did not surface as red.

## Goal

Restore green `main` on `Test (e2e)` and `Data (prose)` by completing the
SCRATCHPAD-3 boundary — every monorepo entry point that crossed the old
`fit-terrain` interface speaks the new verb surface — and prevent a recurrence
of the same shape by (a) making the underlying error visible in CI logs and (b)
tightening the merge-gate carve-out so an actual regression on `main` is no
longer indistinguishable from a transient setup gap.

## Scope (in)

- **`fit-terrain` callers in the monorepo** that crossed the old flag-driven
  surface and are now broken or dormant against the new verb surface. Known
  callers: `justfile` (`synthetic`, `synthetic-update`, `synthetic-no-prose`),
  `package.json` (`prestart`, `start`, `dev`, `data:prose`, `data:schema`,
  `generate`), and the `Test (e2e)` and `Data (prose)` GitHub Actions jobs that
  invoke them. Any other call site discovered during design that crosses the
  same boundary is in scope by the same reasoning.
- **The `data:prose` CI surface.** `LOG_LEVEL=error` must not hide the failing
  diagnostic from the CI log when `fit-terrain check` exits non-zero.
- **The `kata-release-merge` "missing `data/pathway/`" carve-out.** Its scope
  must be narrowed (or replaced) so a real regression on `main` is
  distinguishable from a transient first-time-setup state and cannot mask a red
  `main` across multiple subsequent PRs.

## Scope (out)

- The SCRATCHPAD-3 architecture itself — verbs, the goal-driven DAG, the
  `ProseCache`/`ProseGenerator` split, sink topology, cache format. The refactor
  is the spec's premise, not its target.
- Any change to `data/pathway/`, `data/knowledge/`, `data/activity/`,
  `data/personal/` content, or to the `data/synthetic/` source-of-truth inputs.
- The `Test` workflow's `test`/`schema` jobs and the `Data` workflow's `schema`
  job — those are green and out of scope.
- The merge-gate's other carve-outs and the merge-gate itself beyond the one
  carve-out named above.
- Logging / log-level policy across the rest of the codebase. Scope is limited
  to the `data:prose` invocation on the CI path.

## Success criteria

| #   | Claim                                                                                                                                                     | Verification                                                                                                                                                                                                                                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The `Test (e2e)` job passes on `main` HEAD after the change merges.                                                                                       | Most recent `Test` workflow run on `main` reports `e2e` `success`.                                                                                                                                                                                                                                         |
| 2   | The `Data (prose)` job passes on `main` HEAD after the change merges.                                                                                     | Most recent `Data` workflow run on `main` reports `prose` `success`.                                                                                                                                                                                                                                       |
| 3   | Every monorepo `fit-terrain` invocation (`justfile`, root `package.json` scripts, GitHub Actions workflows) uses the post-refactor verb surface.          | Static inspection: no `bunx fit-terrain` invocation in `justfile`, root `package.json`, or `.github/workflows/**` calls `fit-terrain` without a verb, and none passes a flag the new CLI no longer accepts (e.g., `--generate`, `--no-prose`, `--check`, `--dry-run`).                                     |
| 4   | When `data:prose` fails in CI, the failing diagnostic appears in the CI log.                                                                              | Replay test: introduce a temporary forced failure in the path `fit-terrain check` exercises (e.g., a deliberately bad input cached entity) and run the `Data` workflow; the job log includes the underlying error message, not only the cache report. Revert the forced failure before the spec closes.    |
| 5   | The `kata-release-merge` "missing `data/pathway/`" carve-out cannot mask a regression on `main` across multiple subsequent PRs.                           | The skill's Step 5 documents a narrowed (or replaced) condition such that, given the same shape of `e2e`/`prose` failure observed under issue #673, the gate would have blocked the second through tenth PRs after `f740e3e9` from merging. Verified by re-reading Step 5 against the issue #673 timeline. |
| 6   | A first-time-setup state (clean checkout, no `data/pathway/`) on a contributor machine still produces a working `bun start` after one documented command. | Onboarding doc + replay: a clean clone, followed by the documented setup command(s), yields `bun start` serving on `:3000` without `prestart` ENOENT. The exact command set is the design's choice; the criterion is that one documented sequence works end-to-end.                                        |

## Notes

### Bisect and current state (issue #673)

Bisect points at `f740e3e9`; HEAD `735fc0bc` is still red. The
`chore(scripts): align data:* with fit-terrain subcommands` follow-up
(`59a51ab7`) covered the `package.json` `data:*` scripts but not the `justfile`
synthetic recipes, the `prestart`/`start` chain, or the `LOG_LEVEL=error`
masking — partial-coverage forward-fix attempts are part of the evidence that a
single coordinated boundary sweep is needed.

### Handoff context for design

The SCRATCHPAD-3 author (staff-engineer) has the most context on which verb each
broken caller now maps to and on whether `data/pathway/` materialization should
remain a downstream side-effect of `fit-terrain` (current shape) or become an
explicit verb invocation in callers. The success criteria are agnostic to that
selection. The carve-out narrowing in criterion 5 is a release-engineer
collaboration point for design — the criterion fixes the property, not the
artefact that enforces it.
