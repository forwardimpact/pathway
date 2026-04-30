---
name: kata-ship
description: >
  Ship the current feature branch as-is: approve, rebase on main, run checks,
  open (or reuse) a PR, wait for checks, and squash-merge into main. Ships only
  the work already done — never creates new work to complete a phase.
---

# Ship Feature Branch

Take the current feature branch from "ready" to "merged" in one pass. Atomic
commits are preserved on the branch and collapsed into a single commit on `main`
by GitHub's squash merge — so bisect and review stay useful up to the moment of
merge.

## When to Use

- The current branch is a feature branch with committed work ready to land.
- **Not applicable on `main`** — the Step 1 guard aborts the workflow if the
  current branch is `main`.

## Scope — Ship What Was Done, Nothing More

Shipping means landing the work **as it was already completed** on the branch.
It never means creating additional work to finish an incomplete phase or
advancing to the next phase. Examples:

- **Spec branch** — contains only `spec.md`. Ship the spec. Do not write a
  design or plan.
- **Design branch** — contains `spec.md` and `design-a.md`. Ship the design. Do
  not write a plan.
- **Plan branch** — contains `spec.md`, `design-a.md`, and `plan-a.md`. Ship the
  plan. Do not start implementing.
- **Implementation branch** — contains code changes implementing an approved
  plan. Ship the implementation.
- **Non-spec branch** — contains code changes unrelated to a spec (bug fix,
  chore, docs). Ship as-is with no STATUS update.

If the work on the branch is incomplete or broken, **stop and tell the user** —
do not attempt to finish it.

## Shipping Implies Approval

Shipping a spec-tracked deliverable inherently means approving it. Step 2
applies the matching `<phase>:approved` label to the PR before the mechanical
ship process begins.

## Checklists

<do_confirm_checklist goal="Confirm the branch is safe to merge into main">

- [ ] Current branch is not `main`.
- [ ] Scope limited to work already on the branch.
- [ ] `<phase>:approved` label applied to the PR (if spec-tracked).
- [ ] Rebased cleanly on `origin/main` (no unresolved conflicts).
- [ ] `bun run check` and `bun run test` pass locally.
- [ ] PR exists and its body follows the repo's Summary / Test plan template.
- [ ] All PR checks reported green by `gh pr checks --watch`.
- [ ] Merge uses `--squash` so the feature lands as a single conventional commit
      on `main`.

</do_confirm_checklist>

## Process

Run steps back-to-back; pause only on real blockers (conflicts, failing checks,
unexpected state). Batch independent commands where possible.

### Step 1: Guard

```sh
branch=$(git branch --show-current)
if [ "$branch" = "main" ]; then
  echo "refusing to ship from main" >&2
  return 1 2>/dev/null || exit 1
fi
```

### Step 2: Approve the Work (spec-tracked branches only)

If the branch contains spec-tracked work (a spec, design, plan, or
implementation), apply the matching label to the PR before proceeding. The PR
must already exist (Step 6 handles creation when it doesn't); for first ships,
push the branch and open the PR first, then return here for the label.

| Deliverable    | Label              |
| -------------- | ------------------ |
| `spec.md`      | `spec:approved`    |
| `design-a.md`  | `design:approved`  |
| `plan-a.md`    | `plan:approved`    |
| Implementation | `plan:implemented` |

```sh
gh pr edit <number> --add-label <phase>:approved
```

Skip this step for branches with no spec association (bug fixes, chores, docs).

### Step 3: Rebase on Main

```sh
git fetch origin main
git rebase origin/main
```

Resolve conflicts in place, then `git add <files> && git rebase --continue`. If
a conflict is substantive and cannot be resolved mechanically, abort with
`git rebase --abort` and stop.

### Step 4: Run Checks

Skip if `check` and `test` already passed this session and the rebase was clean.
Otherwise:

```sh
bun run check:fix    # auto-fix format and lint
bun run check        # verify
bun run test         # unit tests
```

Do not proceed until all checks pass.

### Step 5: Push the Branch

```sh
git push --force-with-lease -u origin "$branch"
```

Keep atomic commits intact — squashing happens at merge time, not here.

### Step 6: Create or Reuse PR

Probe for an existing open PR on this branch before creating one:

```sh
pr_number=$(gh pr list --head "$branch" --state open \
  --json number --jq '.[0].number')
```

If `pr_number` is empty, create a new PR:

```sh
gh pr create --base main --head "$branch" \
  --title "<type>(<scope>): <summary>" \
  --body "$(cat <<'EOF'
## Summary

- <what changed and why>

## Test plan

- [ ] `bun run check`
- [ ] `bun run test`
EOF
)"
```

If a PR already exists, reuse it — do not open a duplicate.

### Step 7: Wait for Checks

```sh
gh pr checks "$branch" --watch
```

If any check fails, stop and comment on the PR describing the failure — do not
attempt code fixes from inside this skill. If no workflow runs against the
branch at all, abort after a reasonable wait and investigate upstream rather
than blocking forever.

### Step 8: Squash-Merge

```sh
gh pr merge "$branch" --squash --delete-branch
```

GitHub collapses the branch into a single conventional-style commit on `main`
and deletes the remote branch.
