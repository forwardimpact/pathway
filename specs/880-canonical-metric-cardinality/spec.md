# Spec 880 — Canonical-metric cardinality for system-health metrics

**Persona / job:** Teams Using Agents — *Run an autonomous, continuously
improving development team that plans, ships, studies its own traces, and acts
on findings* ([CLAUDE.md § Primary Products](../../CLAUDE.md#primary-products)).
The autonomous loop reads `KATA.md` § Metrics to govern what each end-to-end
skill records; the rule there must stay load-bearing as the canonical-metric
set grows.

## Problem

`KATA.md` § Metrics § cardinality rule today reads "Each such skill records
exactly one metric: the count of units of work the process produced this run."
Spec 860's plan-b
([`specs/860-measurement-system-change-protocol/plan-b.md`](../860-measurement-system-change-protocol/plan-b.md),
PR [#851](https://github.com/forwardimpact/monorepo/pull/851), merged on
`main` 2026-05-11 commit `d62f004e`) § Step 2 Edit 2a directs the next
`kata-implement` run to replace that wording with:

> Each such skill records one or more metrics, each a count of units of work
> the process produced this run … Multiple metrics from one producer land as
> multiple rows in `wiki/metrics/{skill}/{YYYY}.csv`.

That post-Edit-2a wording is the rule this spec is written against. It admits
the second metric (`approvals_recorded_per_run`, produced by
`kata-release-merge` alongside its existing `prs_merged`) and resolves the
immediate cardinality conflict — but it does not name a **class boundary**.
The second-and-subsequent metric a producer records is implicitly any
flow-shaped count, with no semantic distinction from the process-throughput
metric the rule was originally specified for.

Obstacle #572 (umbrella; further pointers in § Notes) identifies a recurring
shape: metrics that read **binding constraints on the loop itself**. Approval
throughput is the first member. The natural producer for each such metric is a
skill that already reads the relevant state for its existing process-throughput
work. Without a named class boundary, every future binding-constraint metric
re-traverses the cardinality question spec 860 has already settled, and the
XmR-driven rationale paragraph that follows the rule is re-asked metric by
metric — because binding-constraint metrics differ from process-throughput
metrics on the very question that rationale answers.

The shape the rule must resolve is a class, not a singleton — and § Metrics
today is silent on which class a new metric belongs to.

## Goal

After this spec's implementation lands, a reader of `KATA.md` § Metrics §
cardinality rule can determine, by static inspection of that section alone,
which metric class a new entry belongs to and whether it co-locates with an
existing producer skill. Adding the next binding-constraint metric does not
require re-amending § Metrics.

## Scope (in)

- **`KATA.md` § Metrics § cardinality rule.** Amended so it is internally
  consistent with the producer surface spec 860 introduces *and* names the
  class boundary that distinguishes binding-constraint metrics from
  process-throughput metrics. Design picks the wording shape.
- **`KATA.md` § Metrics rationale paragraph.** Remains consistent with the
  amended rule for both metric classes.
- **Spec/design guidance pointer.** A short pointer (location chosen by
  design) telling future spec authors when a new metric co-locates with an
  existing producer versus needs a new dedicated one.
- **Skill `references/metrics.md` conformance.** The on-disk metric count in
  each end-to-end skill's `.claude/skills/kata-*/references/metrics.md` is
  consistent with the amended rule by static inspection.

## Scope (out)

- **Spec 860 implementation (plan-b PR #851).** Plan-b is approved on `main`
  and runs as written. This spec's chain (spec → design → plan → implement)
  **runs after** spec 860's implementation lands; it amends the post-Edit-2a
  rule, it does not replace the Edit 2a work.
- **The `approvals_recorded_per_run` metric itself.** Defined and produced by
  spec 860. This spec only governs the rule under which a producer records its
  second-and-subsequent metrics.
- **Future binding-constraint metric definitions.** Members beyond
  `approvals_recorded_per_run` (referenced in § Notes) are tracked by separate
  obstacles and specs. This spec governs only *where they land structurally*.
- **`fit-xmr` semantics.** Rule semantics, URL math, control-limit computation
  are unchanged.
- **Retroactive CSV rewrite or backfill.** No historical row in
  `wiki/metrics/*.csv` is changed.
- **`agent-react` routing changes** (out of spec 860; out of this).
- **Branch-protection installation** (#564 governance gap, separate
  workstream).

## Success criteria

| # | Claim | Verification |
| --- | --- | --- |
| 1 | `KATA.md` § Metrics § cardinality rule names two metric classes and the criterion that determines which class a given metric belongs to. | `rg -n 'process[- ]throughput' KATA.md` and the corresponding second-class name each return ≥1 hit inside § Metrics, with a one-sentence membership criterion present. |
| 2 | The amended rule is class-aware: adding a future class member does not require re-amending § Metrics. | Static inspection of the rule wording: the membership criterion is stated in general terms, not by enumerating specific metric names. |
| 3 | A spec/design guidance pointer reachable in one link hop from § Metrics names when a new metric co-locates with an existing producer skill versus needs a new one. | `rg` in `KATA.md` § Metrics returns one markdown link; the linked location's body contains the co-location vs new-skill criterion. |
| 4 | The XmR-driven rationale paragraph following § Metrics § cardinality rule supports the amended rule for both metric classes. | Static inspection: rationale text either applies to both classes or explicitly scopes itself to one and points to a sibling rationale for the other. |
| 5 | Every end-to-end skill's `references/metrics.md` is consistent with the amended rule. | `rg -c '^\| \w' .claude/skills/kata-*/references/metrics.md` matches the cardinality the rule predicts for each producer. |

## Resolution shape (deferred to design)

Two shapes resolve the goal — admit a named system-health class alongside
process-throughput, or hold the one-skill-per-process-throughput-metric
invariant and constrain producer selection for binding-constraint metrics
elsewhere. Design picks.

## Notes — evidence pointers (for design)

- Post-Edit-2a wording for `KATA.md` § Metrics § cardinality rule:
  [`specs/860-measurement-system-change-protocol/plan-b.md`](../860-measurement-system-change-protocol/plan-b.md)
  § Step 2 Edit 2a.
- Producer surface for the first binding-constraint metric:
  `kata-release-merge` records `approvals_recorded_per_run` per plan-b Step 3.
- Class boundary already named at spec level for 860: spec 860 § Goal
  distinguishes XmR throughput metrics from binding-constraint metrics on the
  loop itself; this spec elevates that distinction into `KATA.md` § Metrics.
- Producer co-location precedent: design-b for spec 860 § Decision #3 selected
  `kata-release-merge` because the skill already reads `<phase>:approved` label
  state. Future class members are plausibly co-locatable on the same
  reasoning.
- Existing metric registry pattern: `.claude/skills/kata-*/references/metrics.md`
  (one file per producer skill).
- Class-breadth obstacle/issue references: #572 (umbrella), #565, #567, #571,
  #813. The class is plausibly larger than one; members are tracked separately
  and not pre-enumerated as scope of this spec.

## Sequencing

This spec's chain (spec → design → plan → implement) runs **after** spec 860's
plan-b implementation lands on `main`. The author opens spec 880 now — rather
than after spec-860 implementation — so the class-boundary question is on the
record and the design phase can begin in parallel with the spec-860
implementation run. The `kata-implement` step for this spec waits on the
spec-860 Edit 2a wording being live in `KATA.md`.
