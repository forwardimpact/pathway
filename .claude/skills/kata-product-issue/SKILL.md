---
name: kata-product-issue
description: >
  Triage open GitHub issues against the product vision. Classify each as
  trivial fix, product-aligned spec, or out-of-scope, and produce a report
  the agent acts on. Operates on issues only — PR mergeability is
  kata-release-merge.
---

# Product Issue Triage

Triage open GitHub issues against the product vision and decide the appropriate
action for each — but do not take it. The triage produces a report; the agent
then uses follow-up skills (`kata-spec` for features, direct git operations for
trivial fixes) to execute on the recommendations.

This is the Study half of the product feedback loop. The Act half lives in the
agent's workflow, calling `kata-spec` or making fix PRs directly based on the
triage decisions captured here.

## When to Use

- A scheduled run finds open issues awaiting triage
- A specific issue needs an on-demand product-alignment decision
- Never for PRs — use [`kata-release-merge`](../kata-release-merge/SKILL.md)

## Checklists

<read_do_checklist goal="Hold the triage boundary before classifying issues">

- [ ] This skill stops at the triage report — do not implement fixes or write
      specs from within triage.
- [ ] Classify against the product vision (CLAUDE.md § Products), not personal
      judgement about usefulness.
- [ ] Skip issues already labeled `triaged` or `wontfix`.
- [ ] Record reasoning for each classification — future runs audit decisions.

</read_do_checklist>

## Prerequisites

All comment templates are in `references/templates.md`.

## Classification

| Category                 | Criteria                                                   | Recommended action                                                                                                  |
| ------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Trivial fix/bug**      | Clear bug or small fix with obvious resolution             | Fix PR (direct git ops, no spec)                                                                                    |
| **Product-aligned**      | Feature/improvement serving the product vision             | Write spec via the `kata-spec` skill                                                                                |
| **Cross-product policy** | Cross-cutting question that needs decision before any spec | Open Discussion (per [coordination-protocol.md](../../agents/references/coordination-protocol.md)); label `triaged` |
| **Out of scope**         | Not aligned, unclear, duplicate, or already addressed      | Comment + label `triaged`/`wontfix`                                                                                 |

## Product Vision Alignment

Read the project's CLAUDE.md § Users and § Products for product definitions and
personas. If a JTBD.md exists, use it to determine which persona and job the
issue serves. An issue is product-aligned if it describes a job one of the
project's products should fulfil for its personas.

## Process

### Step 0: Read Memory

Read memory per the agent profile (your summary, the current week's log, and
teammates' summaries). Extract issues previously processed and recurring themes
from prior `product-manager` entries.

### Step 1: List Open Issues

```sh
gh issue list --state open --limit 50 \
  --search "-label:experiment -label:obstacle" \
  --json number,title,body,author,labels,createdAt,updatedAt \
  --jq '.[] | {number, title, author: .author.login, labels: [.labels[].name], created: .createdAt}'
```

Skip issues with `triaged` or `wontfix` labels.

### Step 2: Read and Classify Each Issue

```sh
gh issue view <number> --json title,body,comments,labels,author
```

Classify against the table above. Record reasoning briefly so a future run can
audit the decision.

### Step 3: Produce the Triage Report

For each issue, record: number, title, category, recommended action, and a
one-line rationale. The report is the deliverable of this skill.

### Step 4: Hand Off

The triage report is consumed by the calling agent, which then takes action:

- **Trivial fix/bug** → make the fix on a `fix/<short-name>` branch from `main`,
  run `bun run check` and `bun run test`, open a PR. Templates in
  `references/templates.md` § Fix PRs. Label the issue `triaged`.
- **Product-aligned** → invoke the `kata-spec` skill to draft a spec,
  referencing the issue. Label the issue `triaged` and `needs-spec`.
- **Cross-product policy** → open a Discussion citing the issue; do not write a
  spec until the policy question resolves. Label the issue `triaged`.
- **Out of scope** → comment with explanation per `references/templates.md` §
  Issue Comments and apply the appropriate label.

The READ-DO checklist defines this phase boundary.

## Memory: what to record

Append to the current week's log (see agent profile for the file path):

- **Issue triage table** — Each issue with category, action, and rationale
- **Recurring themes** — Patterns across issues, with frequency and alignment
- **Hand-offs** — Which follow-up skills were invoked for which issues
- **Metrics** — Record at least one measurement to
  `wiki/metrics/{skill}/` per the
  [`kata-metrics`](../kata-metrics/SKILL.md) protocol. If no CSV exists, create
  it with the header row. These feed XmR analysis in the storyboard meeting.

## Coordination Channels

This skill produces these non-wiki outputs (per
[coordination-protocol.md](../../agents/references/coordination-protocol.md)):

- **Issue comment** — Triage classification, clarification requests, "not now"
  closures with rationale.
- **Discussion** — Cross-product policy questions surfaced from triage.

If an inbound issue comment addressed to this agent is ambiguous, follow
[coordination-protocol.md § Inbound: unclear addressed comments](../../agents/references/coordination-protocol.md#inbound-unclear-addressed-comments).
