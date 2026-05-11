# Plan 860-b — Measurement-system change protocol (design-b)

Spec: [spec.md](spec.md) · Design: [design-b.md](design-b.md)

## Rationale

Pairs with `design-b.md`. A sibling `plan-a.md` would pair with `design-a.md`.
The approver selects which design variant to implement; this plan becomes
live only if design-b is chosen.

## Approach

Land the protocol in `coordination-protocol.md` as one new
§ Measurement-system changes section; amend `KATA.md` § Metrics so the
"exactly one metric" rule admits one binding-constraint metric alongside the
throughput metric (the design's decision #4 closed the count-vs-duration
question but not the cardinality one — this plan closes the cardinality gap
with the minimum constitutional delta) and link to the new protocol section;
register `approvals_recorded_per_run` in `kata-release-merge`
(`references/metrics.md` row + Step 9 extension that collects the metric
*before* the classification report); add the `Redefinition:` link slot to the
Headlines bullet template in `storyboard-template.md`. The eight repair-move
rows are authored from the spec's Notes § Repair-move corpus evidence
(design-b leaves the definitions and falsifier-set kinds implicit; this plan
materialises them). The wiki-side change (canonical enumeration update,
denominator increment, and one observed first-row CSV entry) ships through
the separate wiki checkout in the implementation run.

Libraries used: none.

## Step 1 — `coordination-protocol.md` § Measurement-system changes

Add a new H2 section between `## Approval signal` (line 34) and
`## Decision questions` (line 62). **Modified:**
`.claude/agents/references/coordination-protocol.md`.

Section body, in order:

1. **Lead paragraph** (≤4 lines) — one sentence introducing the section.
2. **Eight repair-move table** with columns `Move | Definition | Falsifier-set kind | Existing precedent`. The "Existing precedent" column is plan-level enrichment — one issue/PR link per row makes the move discoverable from a `git blame` against the corpus:

   | Move | Definition (one sentence) | Falsifier-set kind | Existing precedent |
   |---|---|---|---|
   | `producer-rehoming` | Reassign a metric's producing skill when the original is removed/split/renamed; record a continuity tag on the first row under the new producer. | "structural-zero rows present after rehoming run" | #788, RFC #804 |
   | `mode-restriction` | Narrow recording to one activation mode of a multi-mode skill so the series is unimodal. | "post-restriction series remains bimodal under XmR" | #772, PR #773 |
   | `historical-phasing` | Annotate a series with a Phase boundary; XmR analysis windows on Phase 1; no CSV backfill. | "Phase 1 cannot reach `predictable` after horizon" | #809, PR #811 |
   | `sidecar-pre-flight` | Record a candidate metric to a sibling CSV while the canonical metric continues; no denominator change until ratification. | "sidecar diverges from canonical at horizon" | #787 |
   | `stock-vs-flow-recast` | Replace a flow-rate metric with a stock metric on the same axis when burst architecture trips XmR by construction. | "stock series fires `xRule1` or `mrRule1` post-recast" | #768, #770 |
   | `event-driven-recast` | Replace per-day cadence with per-activation ("no row, no event"). | "per-activation series remains `insufficient_data` at horizon" | #810 |
   | `rule-semantics-rfc` | Challenge an XmR rule's blocking effect on `predictable` via Discussion RFC; quorum required. | "RFC quorum not reached by horizon" | #814 |
   | `habit-to-policy` | Promote an undocumented defensive habit into a `SKILL.md` check after a defect surfaces. | "post-promotion defect of the same shape recurs" | #817, PR #655 |

   One sentence below the table: "The list is closed; extensions land via the spec/design/plan/implement chain."

3. **Redefinition shape** — a fenced YAML code block exactly matching design-b § Redefinition shape (file artifact). One sentence below states `verdict_horizon ≤ cohort_readout` and the `denominator_effect` enum semantics.
4. **No-silent-redefinition rule** — blockquote verbatim from design-b § No-silent-redefinition rule (the blockquote already contains the "KATA.md § Metrics links to it; no other file restates it." sentence — do not duplicate it).
5. **Worked example** (spec Success #2) — heading `### Worked example — SE Exp 33 (#787) sidecar pre-flight`. Inline YAML front-matter populated for the SE Exp 33 case (`move: sidecar-pre-flight`, `affected_metrics: [{skill: kata-trace, metric: findings_count}]`, falsifier `sidecar diverges from canonical at horizon`, `verdict_horizon: 2026-05-19`, `cohort_readout: 2026-05-26`, `denominator_effect: sidecar`, `links.experiment_issue: "#787"`, `links.obstacle_issue: "#788"`). The example is **inline only**; no on-disk founding redefinition file is created (design § Migration boundary grandfathers the spec 860 implementation PR).
6. **Detection** — heading `### Detection`. The fenced `sh` block from design-b verbatim. One sentence above states the rule ("any commit touching a canonical-11 metric edge must, in the same commit, add or modify a `wiki/redefinitions/*.md` file"); one sentence below names the edges (`wiki/storyboard-*.md`, `.claude/skills/*/references/metrics.md`, `coordination-protocol.md` § Measurement-system changes) and acknowledges per design § Detection that cross-repo enforcement (between this monorepo and the wiki repo) is the follow-on CI workstream.

Verify: `rg '^## Measurement-system changes$' .claude/agents/references/coordination-protocol.md` returns one hit;
`rg -c '^\| \`(producer-rehoming|mode-restriction|historical-phasing|sidecar-pre-flight|stock-vs-flow-recast|event-driven-recast|rule-semantics-rfc|habit-to-policy)\`' .claude/agents/references/coordination-protocol.md` returns 8 (note: brittle on table-cell whitespace — re-run after `bun run format:fix`);
`rg '^### Worked example' .claude/agents/references/coordination-protocol.md` returns one hit;
`rg '^### Detection' .claude/agents/references/coordination-protocol.md` returns one hit.

## Step 2 — `KATA.md` § Metrics: cardinality amendment + linking paragraph

Two edits to § Metrics (currently lines 257–274). **Modified:** `KATA.md`.

**Edit 2a — cardinality amendment.** Line 261 currently reads:

> Each such skill records exactly one metric: the **count of units of work the process produced this run** (issues triaged, PRs merged, findings filed, and so on).

Replace with:

> Each such skill records exactly one **throughput** metric — the count of units of work the process produced this run (issues triaged, PRs merged, findings filed, and so on) — and may additionally record one **binding-constraint** metric per the protocol in § Measurement-system changes.

Design-b decision #4 commits the new metric to remain count-shaped ("count of units of work" is preserved); the design did not address the cardinality rule on the same sentence. This edit is the minimum delta that lets `kata-release-merge` record `approvals_recorded_per_run` alongside `prs_merged` without violating KATA.md.

**Edit 2b — linking paragraph.** Insert one paragraph before the blank line that separates § Metrics from § Authentication (after line 274):

```markdown
Changes to the canonical-11 set — additions, removals, conditional or
unconditional redefinitions — follow the protocol in
[`coordination-protocol.md` § Measurement-system changes](.claude/agents/references/coordination-protocol.md#measurement-system-changes):
each change ships in the same PR as a `wiki/redefinitions/{YYYY-MM-DD}-{slug}.md`
file naming the repair move, the affected metric(s), the falsifier set, the
verdict horizon, and the cohort read-out date. The no-silent-redefinition rule
lives there; this section does not restate it.
```

Verify: `rg -n 'one \*\*throughput\*\* metric' KATA.md` returns one hit in § Metrics; `rg -n 'Measurement-system changes' KATA.md` returns one match; `git diff KATA.md` shows exactly two hunks (one replace on line 261, one append after line 274).

## Step 3 — `kata-release-merge` `references/metrics.md` new row

Add the new metric alongside `prs_merged`. **Modified:**
`.claude/skills/kata-release-merge/references/metrics.md`.

Replace the single-row table with two rows:

```markdown
| Metric                       | Unit  | Description                                                                                                  | Data source                                  |
| ---------------------------- | ----- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| prs_merged                   | count | PRs merged this run                                                                                          | Run actions                                  |
| approvals_recorded_per_run   | count | `<phase>:approved` label-add events + APPROVED review events observed in `[prev_run_start, current_run_start)` | `gh pr view <n> --json timelineItems,reviews` |
```

Append below the existing "Backlog … is queried, not recorded." line:

```markdown
`prev_run_start` is the `startedAt` of the previous completed `agent-team`
workflow run, fetched with `gh run list --workflow=agent-team.yml`. Cohort:
all open phase PRs surveyed in SKILL.md Step 1 plus any phase PR merged
within the window (Step 8). `plan:implemented` is a state label, excluded.
See [`coordination-protocol.md` § Measurement-system changes](../../../agents/references/coordination-protocol.md#measurement-system-changes).
```

The data-source column is `gh pr view --json timelineItems,reviews` to
match design-b § Approval-throughput metric ("No new GitHub-API surface
beyond the existing `gh pr view --json labels,timelineItems`"). Step 4
spells out the field shape.

Verify: `rg -n 'approvals_recorded_per_run' .claude/skills/kata-release-merge/references/metrics.md` returns ≥1 hit; the table renders as two data rows under one header.

## Step 4 — `kata-release-merge` SKILL.md recording instructions

Two edits to wire the metric. **Modified:**
`.claude/skills/kata-release-merge/SKILL.md`.

**Edit 4a — Step 0 captures window timestamps.** Append to the end of the
`### Step 0: Read Memory` body:

```markdown
Capture this run's start timestamp once at the top of the run:
`current_run_start=$(date -u +%FT%TZ)`. For the approval-throughput metric
(Step 9), also derive the previous run's start:

\`\`\`sh
prev_run_start=$(gh run list --workflow=agent-team.yml --status=completed \
  --limit 2 --json startedAt --jq '.[1].startedAt // empty')
# First-ever recording falls back to current_run_start - 8h
# (matches the median schedule gap of the 03:00/12:00/20:00 UTC cadence).
[ -z "$prev_run_start" ] && prev_run_start=$(date -u -d "$current_run_start - 8 hours" +%FT%TZ)
\`\`\`

The window for approval-throughput counting is `[prev_run_start, current_run_start)`.
GNU `date -d` is used here; the agent runs on Linux GitHub-hosted runners. A
macOS/BSD invocation needs the BSD `-v` form instead.
```

**Edit 4b — extend Step 9 to collect the metric *before* the classification report.** The existing Step 9 produces the classification report; the new collection happens first so the report can include the count.

Replace the body of `### Step 9: Produce the Classification Report` (currently the entire body of that step) with a two-part body:

```markdown
### Step 9: Produce the Classification Report

**9a — Collect `approvals_recorded_per_run`.** Cohort: every PR seen in
Step 1 (open phase PRs) **plus** every phase PR merged during this run
(Step 8) — together this covers every phase PR with window-relevant
activity. For each cohort PR:

\`\`\`sh
gh pr view <number> --json timelineItems,reviews \
  --jq '
    (.timelineItems[]? | select(.__typename=="LabeledEvent" and (.label.name|test("^(spec|design|plan):approved$"))) | {ts: .createdAt, kind: "label", label: .label.name}),
    (.reviews[]? | select(.state=="APPROVED") | {ts: .submittedAt, kind: "review"})
  '
\`\`\`

Filter events to `ts ∈ [prev_run_start, current_run_start)` (half-open;
matches design-b § Approval-throughput metric). Sum the filtered events
to `approvals_recorded_per_run` — no per-event de-dup; the design
specifies a raw count. Append one row to
`wiki/metrics/kata-release-merge/{YYYY}.csv`:
`<YYYY-MM-DD>,approvals_recorded_per_run,<count>,count,<run_id>,"window=[<prev>,<curr>)"`.
Zero is recorded as `0` (matches every count metric).

If `gh pr view ... --json timelineItems` fails for any cohort PR (rate
limit, scope issue), skip that PR, record the failure in the row note as
`api_errors=N`, and proceed — partial counts are recorded honestly. A
blanket-failure case (every call errored) records `0` with a non-empty
`api_errors=` so the next storyboard meeting can see producer health.

**9b — Classification report.** [existing Step 9 body — per-PR records,
counts, verdicts — verbatim, ending with the existing `prs_merged` row
append per Step 9's current body.] The report now includes
`approvals_recorded_per_run` as one of the run's recorded metrics.
```

Verify: `rg -n 'approvals_recorded_per_run|prev_run_start|current_run_start' .claude/skills/kata-release-merge/SKILL.md` returns ≥4 hits; `### Step 9.5` does not appear (replaced by 9a/9b within Step 9); `rg -n '^### Step 9: Produce' .claude/skills/kata-release-merge/SKILL.md` returns one hit.

## Step 5 — `storyboard-template.md` Redefinition link slot

Add the `Redefinition:` field to the Headlines bullet template only. The
canonical-12 enumeration lives in `wiki/storyboard-*.md` per design
§ Components, not in the main-repo template. **Modified:**
`.claude/skills/kata-session/references/storyboard-template.md`.

Replace line 33 (currently
`- \`{agent}\` / \`{metric}\` — {value} {trend/badge} — {one-line reason}`) with:

```markdown
- `{agent}` / `{metric}` — {value} {trend/badge} — {one-line reason} — Redefinition: {`wiki/redefinitions/...md` or `—`}
```

Verify: `rg -n 'Redefinition:' .claude/skills/kata-session/references/storyboard-template.md` returns one hit; `git diff` shows one changed line and no inserts elsewhere.

## Step 6 — `team-storyboard.md` worked-example refresh

The Q3-obstacle-routing worked example (lines 102–105) is historical
(dated 2026-05-02, before this protocol exists). Design § Migration
boundary retains "canonical-11" historically — the worked example's
`canonical-11` reference stays. **Modified:**
`.claude/skills/kata-session/references/team-storyboard.md`.

Append one sentence to the existing worked example (no rename of
"canonical-11"): "Under this protocol, each headline bullet would carry
a `Redefinition:` slot — `—` when no canonical change was filed and a
`wiki/redefinitions/{YYYY-MM-DD}-{slug}.md` path when one was."

This satisfies spec Success #5's "worked example references a
redefinition by its issue or section anchor" via the explicit link to
the section anchor (the protocol's home) without inventing a redefinition
file that does not exist.

Verify: `rg -n 'Redefinition:' .claude/skills/kata-session/references/team-storyboard.md` returns one new hit on the worked-example sentence; the historical "canonical-11" reference at line 103 is unchanged.

## Step 7 — Wiki: `storyboard-2026-M05.md` enumeration update + one observed CSV row

Wiki-side changes committed through the separate `wiki/` checkout during
the implementation run; pushed via the Stop hook (`just wiki-push`).
**Modified:** `wiki/storyboard-2026-M05.md`, `wiki/metrics/kata-release-merge/2026.csv`.

The implementor reads `wiki/storyboard-2026-M05.md` first; let `N` be the
current canonical-set cardinality (the count of `{producer}/{metric}` items
named in the May storyboard's "N canonical metrics" prose). Edits:

1. **Replace inline "N canonical metrics" prose** under § Target Condition
   with a bulleted enumeration: one bullet per metric mapping
   `{producer skill} / {metric name}`. The new metric joins as
   `kata-release-merge / approvals_recorded_per_run`. The implementor
   reads each producer's `.claude/skills/kata-*/references/metrics.md` to
   pull the exact metric name. Bullet count = `N + 1`.
2. **Increment the denominator** anywhere the May storyboard literally
   writes `≥M of N` → `≥M of (N+1)`. Pre-edit enumeration:
   `rg -n '≥[0-9]+ of [0-9]+' wiki/storyboard-2026-M05.md`. The post-edit
   `rg` returns the same number of lines, each with the incremented
   denominator.
3. **Add a `Redefinition:` slot to every existing Headlines bullet** with
   value `—` (no canonical change was filed for any current headline).
4. **Append one observed first row** to
   `wiki/metrics/kata-release-merge/2026.csv` by invoking the new Step 9a
   logic once locally during the implementation run against the actual
   open phase-PR set at that moment. Date is the run's date; value is
   whatever the live survey returns (zero is a valid value); the `note`
   carries the actual `window=[<prev>,<curr>)`. This is the spec Success
   #4(c) "one example row written under the producer skill's CSV path
   during the implementation run" — the row is *measured*, not seeded.

Verify (in the wiki checkout):
- Pre-edit and post-edit counts of `≥[0-9]+ of [0-9]+` matches in
  `wiki/storyboard-2026-M05.md` are equal; every post-edit match has the
  incremented denominator.
- `rg -c 'approvals_recorded_per_run' wiki/storyboard-2026-M05.md` returns ≥1.
- `rg -c '^- \`' wiki/storyboard-2026-M05.md` in the new enumeration block returns `N + 1`.
- Every Headlines bullet contains the substring `Redefinition:`.
- `rg '^[0-9]{4}-[0-9]{2}-[0-9]{2},approvals_recorded_per_run,' wiki/metrics/kata-release-merge/2026.csv` returns ≥1 row whose `window=` field is non-empty.

## Step 8 — Quality gates

Run from repo root in order: `bun run format:fix`, `bun run check`, `bun run test`. Format first so `check` sees formatted output (matches the CONTRIBUTING.md convention). The change set is documentation-only on the main-repo side; no codegen or build steps are involved.

Verify locally before push: `bun run check` exits 0. PR title carries the spec id (e.g., `feat(kata): measurement-system change protocol (#860)`).

## Risks

1. **`gh pr view --json timelineItems` field stability.** The
   `timelineItems` JSON field exposes a GitHub GraphQL union; the
   `__typename=="LabeledEvent"` test in Step 4b assumes the current
   shape. A future `gh` release could rename or restructure the field;
   the producer would silently emit `0`s until the jq filter is
   updated. The blanket-failure branch (`api_errors=` non-empty) does
   not cover this case because the call succeeds with an empty result
   rather than failing. The storyboard XmR analyzer detects sustained
   zeros via `xRule3` (eight consecutive zeros); the producer-rehoming
   move (Step 1 table row 1) is the protocol response.
2. **Wiki-vs-main-repo PR boundary on Success #6.** Design-b § Detection
   states cross-repo CI enforcement is the natural follow-on, out of
   scope for this spec. The detection grep works **within the wiki
   checkout**. For main-repo edges (`coordination-protocol.md`,
   `.claude/skills/*/references/metrics.md`), Success #6 holds only when
   those edges are accompanied by a wiki commit that adds a redefinition
   file — a coupling the follow-on CI must verify across the two repos.
3. **GitHub timeline fan-out.** Step 9a calls `gh pr view --json
   timelineItems,reviews` once per cohort PR per run. With ~15 open
   phase PRs the call count is fine; past ~30 the run risks secondary
   rate limits during the 03:00/12:00/20:00 windows. A future
   optimisation short-circuits on PRs whose `updatedAt` precedes
   `prev_run_start`. The blanket-failure branch records `0` with a
   non-empty `api_errors=` note so producer health is visible on the
   chart.
4. **`gh run list` window-source workflow-name binding.** Step 4a's
   `--workflow=agent-team.yml` is operational: if `kata-release-merge`
   is ever moved to a separate workflow file, this argument must move
   with it. Not visible from the SKILL.md body alone.
5. **Constitutional amendment scope (Step 2 Edit 2a).** The
   one-sentence edit to KATA.md line 261 (admitting one
   binding-constraint metric alongside the throughput metric) closes a
   gap design-b decision #4 did not see. Reviewers should weigh whether
   this delta belongs in this spec's implementation PR or in a
   companion governance amendment; the plan ships the edit in this PR
   because it is the minimum unblocker for the new metric — without
   it, the new row violates KATA.md line 261 on landing.

## Execution recommendation

Single staff-engineer executor, sequential. Steps 1–6 (main-repo edits)
run in order: Step 2 cites Step 1's anchor; Step 4 cites Step 3's metric
definition; Step 6 cites Step 5's bullet template format. Step 7 runs
after the main-repo edits — the wiki edits cite anchors Step 1 and Step 2
establish, and Step 7.4's "one observed CSV row" runs the Step 9a logic
that Step 4 lands. Step 8 closes. No parallelism; no decomposition into
parts. Route entirely to the engineering agent — every edit is a
code/doc change with no prose audience that warrants `technical-writer`.
