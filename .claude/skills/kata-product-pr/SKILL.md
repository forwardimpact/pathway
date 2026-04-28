---
name: kata-product-pr
description: >
  Merge gate for open pull requests. Verify contributor trust, parse PR type,
  check CI status, review spec quality, and merge PRs that pass all gates.
  Operates on PRs only — issue triage is kata-product-issue.
---

# Product PR Gate

Verify every open non-Dependabot PR against four gates (trust, type, CI, spec
quality), produce a classification report, and merge those that pass.

This skill handles **all non-Dependabot PRs** — both external contributions and
PRs created by our own CI app (`forward-impact-ci`). Because external
contributions merge here, contributor trust verification is the most critical
gate. The improvement coach audits classification traces via the
[`kata-trace`](../kata-trace/SKILL.md) skill's invariant audit to confirm trust
checks happened on every PR that advanced to merge.

## When to Use

- A scheduled run finds open PRs awaiting review
- A specific PR needs an on-demand mergeability decision
- Never for issues — use [`kata-product-issue`](../kata-product-issue/SKILL.md)

## Prerequisites

All comment templates and the report format are in `references/templates.md`.

## Checklists

<do_confirm_checklist goal="Verify all gates pass before merging a PR">

- [ ] Author is trusted — CI app identity or top-7 contributor lookup ran.
- [ ] PR type is `fix`, `bug`, or `spec` — parsed from title prefix.
- [ ] All CI checks pass.
- [ ] Spec quality approved (spec PRs only) via `kata-spec` review.

</do_confirm_checklist>

A PR that fails any gate is marked **blocked** with the reason (see Steps 2–5
for failure-handling details). A PR that passes all four gates is merged in
Step 7.

## Process

### Step 0: Read Memory

Read memory per the agent profile (your summary, the current week's log, and
teammates' summaries). From prior `product-manager` entries, extract PRs blocked
in previous runs with consecutive-block counts and contributor trust decisions
carried forward.

### Step 1: List Open PRs

```sh
gh pr list --state open --base main \
  --json number,title,headRefName,author,updatedAt,mergeable,mergeStateStatus,labels
```

Skip PRs authored by `app/dependabot` — handled by `kata-security-update`.

### Step 2: Verify Contributor Trust

Check whether the author is the CI app:

```sh
gh pr view <number> --json author --jq '.author.login'
```

If `app/forward-impact-ci`, the PR is **trusted by definition** — skip the
contributor lookup and proceed to Step 3.

For all other authors, look up the top 7 human contributors:

```sh
gh api repos/{owner}/{repo}/contributors \
  --jq '[.[] | select(.type == "User")] | .[0:7] | .[].login'
```

The PR author must appear in this list. If not, mark **blocked** and record the
decision (the `kata-trace` invariant audit checks that this lookup happened on
every classified PR).

### Step 3: Classify PR Type

Parse the title using `type(scope): subject` convention:

- `fix` or `bug` → eligible (bug treated as equivalent to fix)
- `spec` → eligible (after spec review in Step 5)
- Breaking variants with `!` retain the base type
- Any other type (`feat`, `refactor`, `chore`, etc.) → mark **blocked**

### Step 4: Check CI Status

```sh
gh pr checks <number>
```

All checks must pass. If failing, identify specific failures:

```sh
gh pr checks <number> --json name,state,conclusion \
  --jq '.[] | select(.conclusion != "SUCCESS" and .conclusion != "") | {name, conclusion}'
```

Mark **blocked** with the specific failing checks.

### Step 5: Review Spec PRs

For `spec` PRs, apply the `kata-spec` skill's review process:

1. Identify the spec directory from changed files:
   ```sh
   gh pr view <number> --json files --jq '.files[].path' | grep '^specs/'
   ```
2. Check out the spec files:
   ```sh
   git fetch origin <headRefName>
   git checkout origin/<headRefName> -- specs/<matched-directory>/
   ```
3. Evaluate against spec review criteria. Report decision and target status — do
   not update `specs/STATUS` directly.
4. If spec fails review, mark **blocked** with findings.
5. If spec passes, mark **mergeable**.

### Step 6: Produce the Classification Report

For each PR, record: number, title, type, author, trust check result, CI status,
spec review (if applicable), and final verdict — **mergeable** or **blocked**
with reason. The report drives Step 7.

### Step 7: Merge Mergeable PRs

For each PR marked **mergeable** in the report:

1. Post the merge comment from `references/templates.md` § Merge Comment.
2. Perform the merge:
   ```sh
   gh pr merge <number> --merge --delete-branch
   ```
3. Verify the new state:
   ```sh
   gh pr view <number> --json state --jq '.state'
   ```
   Confirm the state is `MERGED`.
4. If the merge fails (race condition, branch protection update, etc.), record
   the failure in the run report and move on — do **not** retry without
   re-running Steps 1–6, since the gate state may have changed.

## Memory: what to record

Append to the current week's log (see agent profile for the file path):

- **PR classification table** — Each PR with type, author, trust check, CI,
  verdict, and consecutive-block count
- **Contributor trust decisions** — Who was verified and the result (this is the
  data the `kata-trace` invariant audit checks)
- **Spec review results** — Spec PRs and their assessment
- **PRs merged this run** — number, title, and final state
- **Merge failures** — number and the reason (so the next run can revisit)
- **Metrics** — Record at least one measurement to
  `wiki/metrics/{agent}/{domain}/` per the
  [`kata-metrics`](../kata-metrics/SKILL.md) protocol. If no CSV exists, create
  it with the header row. These feed XmR analysis in the storyboard meeting.

## Coordination Channels

This skill produces these non-wiki outputs (per
[coordination-protocol.md](../../agents/references/coordination-protocol.md)):

- **PR comment** — Trust-check rationale, gate-failure explanations, merge
  decisions.
- **PR thread escalation** — Cross-agent expertise requests addressed by name
  (e.g. "Hey Security Engineer, …") when a PR needs domain coverage outside this
  skill's scope.

If an inbound PR comment addressed to this agent is ambiguous, follow
[coordination-protocol.md § Inbound: unclear addressed comments](../../agents/references/coordination-protocol.md#inbound-unclear-addressed-comments).
