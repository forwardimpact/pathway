# Spec 500 — Format Merge Gate

## Problem

Formatting regressions land on `main` every week. In W16 alone, the release
engineer fixed 22 files across three separate cleanup commits. The pattern
repeats weekly (12+ files in W15), consuming agent capacity on mechanical
repairs and inflating the team's workflow failure rate (currently 59% vs. the
85% target).

The April storyboard identified this as the **current obstacle** blocking the
team's target condition.

### Evidence

**W16 formatting commits on main:**

| Commit    | Files fixed | Source                    |
| --------- | ----------- | ------------------------- |
| 4294f372  | 11          | code + config + specs     |
| 663052fc  | 12          | spec 420/430 artifacts    |
| 822ceea3  | 2           | KATA.md, design.md        |
| **Total** | **22**      | 3 cleanup commits in 1 wk |

**Current state (2026-04-15):** 3 files on main fail `bun run format` — KATA.md
and two spec 490 artifacts (fix PR #391 pending).

### Root Cause

Investigation traced the regressions to two gaps:

1. **No required status check.** The Quality workflow's `format` job runs on
   PRs, but it is not a required status check for merge. PRs can merge while the
   format job is still pending — or even if it fails — because nothing blocks
   the merge button or the `gh pr merge` call.

2. **Agent merge skills don't verify format independently.** The
   `kata-product-classify` skill (Step 4: Check CI Status) runs
   `gh pr checks <number>` and requires all checks to pass. However, if the
   Quality workflow hasn't completed at the time the agent evaluates the PR, the
   check appears as "pending" rather than "fail," and the merge can proceed. The
   `kata-ship` skill _does_ run `bun run check:fix` before pushing, but
   `kata-product-classify` — the primary external merge gate — does not.

3. **Direct-to-main commits.** The release engineer exception (CONTRIBUTING.md §
   Pull Request Workflow) permits trivial CI fixes directly on main. When design
   or spec artifacts are committed directly to main outside this exception, they
   bypass all PR-level CI gates, including the format check.

These three gaps compound: unformatted commits land on main, the post-push
Quality workflow fails, the release engineer pushes a formatting fix commit, and
occasionally that fix commit itself introduces new formatting issues — creating
a reactive cycle.

## Scope

### What changes

- **`kata-product-classify` skill** — The PR merge gate adds explicit format
  verification before any merge is performed.
- **`kata-release-readiness` skill** — The pre-merge readiness check adds format
  verification to the rebase-and-fix cycle so PRs arrive at the merge gate
  already formatted.
- **Quality workflow status check** — The `format` job becomes a required status
  check in branch protection rules, preventing merges while format is pending or
  failing.

### What does not change

- The `kata-ship` skill (already runs `bun run check:fix`).
- The release engineer's direct-to-main exception (remains for genuine trivial
  CI fixes, but the release engineer already runs `bun run check:fix` before
  pushing).
- Prettier configuration, ignore patterns, or the format command itself.
- The Quality workflow definition (it already runs the correct check; the change
  is in branch protection configuration, not the workflow file).

## Success Criteria

1. `bun run format` passes on main after every merge for two consecutive weeks
   (zero formatting fix commits needed).
2. The `kata-product-classify` skill's do-confirm checklist includes a format
   verification item, and the skill's process includes a format check step.
3. The `format` job from the Quality workflow is a required status check on the
   `main` branch — `gh pr merge` cannot complete while the format job is pending
   or failing.
4. Formatting regressions no longer appear in the release engineer's weekly log
   as a recurring cleanup task.
