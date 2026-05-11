# Plan 860-b — Measurement-system change protocol (design-b)

Spec: [spec.md](spec.md) · Design: [design-b.md](design-b.md)

## Rationale

Pairs with `design-b.md`. A sibling `plan-a.md` would pair with `design-a.md`.
The approver selects which design variant to implement; this plan becomes
live only if design-b is chosen.

## Approach

Land the protocol in `coordination-protocol.md` as one new
§ Measurement-system changes section (the eight repair moves with one-sentence
definitions and falsifier-set kinds sourced from the spec's evidence pointers;
the redefinition file shape; the no-silent-redefinition rule; the
detection grep); add a one-paragraph link from `KATA.md` § Metrics; register
`approvals_recorded_per_run` in `kata-release-merge` (one row in
`references/metrics.md`, recording instructions in `SKILL.md`); add the
`Redefinition:` link slot to the Headlines bullet template in
`storyboard-template.md`. The wiki-side change (canonical enumeration update
and denominator increment in `wiki/storyboard-2026-M05.md`) ships through
the separate wiki checkout in the implementation run. The implementation PR
itself files no redefinition (design § Migration boundary); the first row of
`approvals_recorded_per_run` is appended only when `kata-release-merge`
actually runs its new Step 9.5.

Libraries used: none.

## Step 1 — `coordination-protocol.md` § Measurement-system changes

Add a new H2 section between `## Approval signal` (line 34) and
`## Decision questions` (line 62). **Modified:**
`.claude/agents/references/coordination-protocol.md`.

The section carries six parts in this order. The plan authors the eight
repair-move row contents directly here (design-b § Repair-move typology lists
only the move names; the spec's Notes § Repair-move corpus pins each move to
specific evidence; this plan converts that evidence into one definition row
per move):

1. **Lead paragraph** (≤4 lines) — names the typology, the redefinition file
   artifact, the no-silent-redefinition rule, and the detection grep as the
   four components.
2. **Eight repair-move table** with columns `Move | Definition | Falsifier-set kind | Existing precedent`:

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

   One sentence below the table states the list is closed; "extensions land
   via the spec/design/plan/implement chain."

3. **Redefinition shape** — a fenced YAML code block exactly matching design-b
   § Redefinition shape. One sentence below states `verdict_horizon ≤ cohort_readout`
   and the `denominator_effect` enum semantics.
4. **No-silent-redefinition rule** — blockquote verbatim from design-b § No-silent-redefinition rule, followed by the sentence "KATA.md § Metrics links to it; no other file restates it."
5. **Worked example** (spec Success #2) — heading `### Worked example — SE Exp 33 (#787) sidecar pre-flight`. Inline YAML front-matter populated for the SE Exp 33 case (`move: sidecar-pre-flight`, `affected_metrics: [{skill: kata-trace, metric: findings_count}]`, falsifier `sidecar diverges from canonical at horizon`, `verdict_horizon: 2026-05-19`, `cohort_readout: 2026-05-26`, `denominator_effect: sidecar`, `links.experiment_issue: #787`, `links.obstacle_issue: #788`). The example is **inline only**; no on-disk founding redefinition file is created (design § Migration boundary explicitly grandfathers the spec 860 implementation PR — it does not file a redefinition).
6. **Detection** — heading `### Detection`. The fenced `sh` block from design-b verbatim. One sentence above states the rule ("any commit touching a canonical-11 metric edge must, in the same commit, add or modify a `wiki/redefinitions/*.md` file"); one sentence below names the edges (`wiki/storyboard-*.md`, `.claude/skills/*/references/metrics.md`, `coordination-protocol.md` § Measurement-system changes) and acknowledges per design § Detection that cross-repo enforcement (between this monorepo and the wiki repo) is the follow-on CI workstream.

Verify: `rg '^## Measurement-system changes$' .claude/agents/references/coordination-protocol.md` returns one hit;
`rg -c '^\| \`(producer-rehoming|mode-restriction|historical-phasing|sidecar-pre-flight|stock-vs-flow-recast|event-driven-recast|rule-semantics-rfc|habit-to-policy)\`' .claude/agents/references/coordination-protocol.md` returns 8;
`rg '^### Worked example' .claude/agents/references/coordination-protocol.md` returns one hit;
`rg '^### Detection' .claude/agents/references/coordination-protocol.md` returns one hit.

## Step 2 — `KATA.md` § Metrics linking paragraph

Append one paragraph at the end of § Metrics (currently lines 257–274,
last line `control limits and signals — numbers, not narratives.`).
**Modified:** `KATA.md`.

Insert before the blank line that separates § Metrics from § Authentication
(after line 274):

```markdown
Changes to the canonical-11 set — additions, removals, conditional or
unconditional redefinitions — follow the protocol in
[`coordination-protocol.md` § Measurement-system changes](.claude/agents/references/coordination-protocol.md#measurement-system-changes):
each change ships in the same PR as a `wiki/redefinitions/{YYYY-MM-DD}-{slug}.md`
file naming the repair move, the affected metric(s), the falsifier set, the
verdict horizon, and the cohort read-out date. The no-silent-redefinition rule
lives there; this section does not restate it.
```

The "count of units of work" sentence on line 261 is unchanged — design-b
preserves it. The "exactly one metric" rule on line 261 is **not preserved**
by adding `approvals_recorded_per_run` to `kata-release-merge`; this
constitutional tension is the substance of Risk 1.

Verify: `rg -n 'Measurement-system changes' KATA.md` returns one match in
§ Metrics; `git diff KATA.md` shows one inserted paragraph and no other hunks.

## Step 3 — `kata-release-merge` `references/metrics.md` new row

Add the new metric alongside `prs_merged`. **Modified:**
`.claude/skills/kata-release-merge/references/metrics.md`.

Replace the single-row table with two rows:

```markdown
| Metric                       | Unit  | Description                                                                                                  | Data source                                                          |
| ---------------------------- | ----- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| prs_merged                   | count | PRs merged this run                                                                                          | Run actions                                                          |
| approvals_recorded_per_run   | count | `<phase>:approved` label-add events + APPROVED review events observed in `[prev_run_start, current_run_start)` | `gh api repos/.../issues/{n}/timeline` + `.../pulls/{n}/reviews`     |
```

Append below the existing "Backlog … is queried, not recorded." line:

```markdown
`prev_run_start` is the `startedAt` of the previous completed `agent-team`
workflow run, fetched with `gh run list --workflow=agent-team.yml`. Cohort:
all open phase PRs surveyed in SKILL.md Step 1 plus any phase PR that was
merged within the window. `plan:implemented` is a state label, excluded.
See [`coordination-protocol.md` § Measurement-system changes](../../../agents/references/coordination-protocol.md#measurement-system-changes).
```

Verify: `rg -n 'approvals_recorded_per_run' .claude/skills/kata-release-merge/references/metrics.md` returns ≥1 hit; the table renders as two data rows under one header.

## Step 4 — `kata-release-merge` SKILL.md recording instructions

Two edits to wire the metric. **Modified:**
`.claude/skills/kata-release-merge/SKILL.md`.

**Edit 4a** — Step 0 captures both window timestamps. Append to the end of
the `### Step 0: Read Memory` body:

```markdown
Capture this run's start timestamp once at the top of the run:
`current_run_start=$(date -u +%FT%TZ)`. For the approval-throughput metric
(Step 9.5), also derive the previous run's start:

\`\`\`sh
prev_run_start=$(gh run list --workflow=agent-team.yml --status=completed \
  --limit 2 --json startedAt --jq '.[1].startedAt // empty')
# First-ever recording falls back to current_run_start - 8h.
[ -z "$prev_run_start" ] && prev_run_start=$(date -u -d "$current_run_start - 8 hours" +%FT%TZ)
\`\`\`

The window for approval-throughput counting is `[prev_run_start, current_run_start)`.
```

**Edit 4b** — Append a new `### Step 9.5` between the existing
`### Step 9: Produce the Classification Report` (currently the last `### Step`)
and the `## Memory: what to record` H2. The existing Step 9 keeps its number;
9.5 is sub-ordinal placement, not a renumber. Body:

```markdown
### Step 9.5: Record approval-throughput metric

Cohort: every PR seen in Step 1 (open phase PRs) **plus** every phase PR
merged during this run (Step 8) — together this covers every phase PR with
window-relevant activity. For each cohort PR, fetch label-add events:

\`\`\`sh
gh api repos/{owner}/{repo}/issues/<number>/timeline --paginate \
  --jq '.[] | select(.event=="labeled" and (.label.name|test("^(spec|design|plan):approved$"))) | {ts: .created_at, label: .label.name}'
\`\`\`

And APPROVED reviews:

\`\`\`sh
gh api repos/{owner}/{repo}/pulls/<number>/reviews --paginate \
  --jq '.[] | select(.state=="APPROVED") | {ts: .submitted_at}'
\`\`\`

Filter to events whose `ts` is in `[prev_run_start, current_run_start)`
(half-open, matches design-b § Approval-throughput metric). De-dupe label
events by `(pr_number, label_name, second_truncated_timestamp)` so a
double-click on the GitHub UI counts once. Sum to
`approvals_recorded_per_run`. Append one row to
`wiki/metrics/kata-release-merge/{YYYY}.csv`:
`<date>,approvals_recorded_per_run,<count>,count,<run_id>,"window=[<prev>,<curr>)"`.
Zero is recorded as `0` (matches every count metric; the structural-zero
risk applies only when the producer is missing). The existing `prs_merged`
row continues to be appended per Step 9.

If `gh api .../timeline` fails for any PR (rate limit, scope issue), skip
that PR, log the failure to the classification report (Step 9), and
proceed — partial counts are recorded honestly. A blanket-failure case
(no PRs counted because every call errored) records `0` with
`note="window=[<prev>,<curr>);api_errors=N"` so the next storyboard
meeting can see the producer health on the chart.
```

Verify: `rg -n 'approvals_recorded_per_run|prev_run_start|current_run_start' .claude/skills/kata-release-merge/SKILL.md` returns ≥4 hits; `### Step 9.5:` exists between `### Step 9:` and `## Memory: what to record`.

## Step 5 — `storyboard-template.md` Redefinition link slot

Add the `Redefinition:` field to the Headlines bullet template only. **Do not**
hard-code a canonical-12 enumeration in this template — the canonical enumeration
lives in `wiki/storyboard-*.md` per design § Components, not in the
main-repo template. **Modified:**
`.claude/skills/kata-session/references/storyboard-template.md`.

Replace line 33 (currently
`- \`{agent}\` / \`{metric}\` — {value} {trend/badge} — {one-line reason}`) with:

```markdown
- `{agent}` / `{metric}` — {value} {trend/badge} — {one-line reason} — Redefinition: {`wiki/redefinitions/...md` or `—`}
```

The `Redefinition:` slot is the structural form spec Success #5 requires:
every canonical-11 change item on a headline line names its redefinition
file or `—` when none applies. No other edits to this file.

Verify: `rg -n 'Redefinition:' .claude/skills/kata-session/references/storyboard-template.md` returns one hit; `git diff` shows one changed line, no inserts.

## Step 6 — `team-storyboard.md` worked-example refresh

The Q3-obstacle-routing worked example (lines 102–105) currently names
four canonical-11 metrics. Two changes. **Modified:**
`.claude/skills/kata-session/references/team-storyboard.md`.

1. Replace "canonical-11 metric" with "canonical-12 metric" on line 103.
2. Append two sentences to the worked example so spec Success #5's
   "worked example references a redefinition by its issue or section anchor"
   is satisfied. Example: append "Each of the four headline bullets carries
   a `Redefinition: —` slot for this date (no canonical-12 change items
   were filed). A hypothetical canonical-12 change to `prs_actioned` would
   carry `Redefinition: wiki/redefinitions/2026-05-02-prs-actioned-stock-vs-flow.md`
   on its headline line."

Verify: `rg -n 'canonical-12|Redefinition:' .claude/skills/kata-session/references/team-storyboard.md` returns ≥2 hits; `rg -n 'canonical-11' .claude/skills/kata-session/references/team-storyboard.md` returns 0 hits.

## Step 7 — Wiki: `storyboard-2026-M05.md` enumeration update

Wiki-side change committed through the separate `wiki/` checkout during
the implementation run; pushed via the Stop hook (`just wiki-push`).
**Modified:** `wiki/storyboard-2026-M05.md`.

The implementor reads the file's current state first (the wiki is the
source of truth for the canonical set). Three edits, applied
mechanically:

1. **Replace the inline "11 canonical metrics" prose** under § Target
   Condition with a bulleted enumeration. One bullet per metric mapping
   `{producer skill} / {metric name}`. The new metric joins the list as
   `kata-release-merge / approvals_recorded_per_run`. The implementor
   reads each producer's `.claude/skills/kata-*/references/metrics.md`
   to pull the exact metric name (the canonical set is whichever subset
   of those files is currently named in the May storyboard's prose, plus
   the new entry). Bullet count = previous canonical set size + 1.
2. **Increment the denominator** anywhere the May storyboard literally
   writes "≥6 of 11" → "≥6 of 12" (or the corresponding pair if the
   current denominator differs). `rg '≥[0-9]+ of [0-9]+' wiki/storyboard-2026-M05.md`
   enumerates every match before edit.
3. **Add `Redefinition: —` to every existing Headlines bullet** (the
   grandfathered implementation PR does not file one; design § Migration
   boundary). Backfilling `—` to historical headlines is the
   structurally-equivalent of "no redefinition cited," not a retroactive
   filing — the slot is added, the value is the null marker.

Verify (in the wiki checkout): `rg -n '≥6 of 12' wiki/storyboard-2026-M05.md` returns ≥1 hit; `rg -n '≥6 of 11' wiki/storyboard-2026-M05.md` returns 0 hits; `rg -c 'approvals_recorded_per_run' wiki/storyboard-2026-M05.md` returns ≥1; every Headlines bullet contains `Redefinition:`.

## Step 8 — Quality gates

Run from repo root in order: `bun run format:fix`, `bun run check`, `bun run test`. Format first so `check` sees formatted output; this matches the CONTRIBUTING.md convention. The change set is documentation-only on the main-repo side; no codegen or build steps are involved.

Verify locally before push: `bun run check` exits 0. PR title carries the
spec id (e.g., `feat(kata): measurement-system change protocol (#860)`).

## Risks

1. **"Exactly one metric per skill" constitutional tension.** KATA.md
   § Metrics line 261 reads "each such skill records exactly one metric."
   `kata-release-merge` already records `prs_merged`; this plan adds
   `approvals_recorded_per_run` alongside it. Design-b decision #4
   commits to preserving "count of units of work" but the design does
   not address "exactly one metric." Two ways forward, neither blocking
   the plan but both visible only at implementation time: (a) the
   approver treats KATA.md line 261 as "exactly one *throughput* metric,
   the approval-throughput entry is *binding-constraint*-shaped not
   throughput-shaped"; (b) a follow-on spec amends KATA.md to admit a
   second metric type per producer skill. The implementation PR's body
   must surface this tension explicitly so the approver picks the path.
2. **Wiki-vs-main-repo PR boundary on Success #6.** Design-b § Detection
   states cross-repo CI enforcement is the natural follow-on, out of
   scope for this spec. The detection grep works **within the wiki
   checkout** (it walks `git log` for wiki paths). For main-repo edges
   (`coordination-protocol.md`, `.claude/skills/*/references/metrics.md`),
   Success #6 ("detectable from `git diff` alone") holds only when those
   edges are accompanied by a wiki commit that adds a redefinition file
   — a coupling the follow-on CI must verify across the two repos.
   This plan ships the protocol; the cross-repo CI is the next spec.
3. **GitHub timeline API fan-out.** Step 9.5 calls
   `gh api .../timeline` once per cohort PR per run. With ~15 open
   phase PRs the call count is fine; past ~30 the run risks secondary
   rate limits during the 03:00/12:00/20:00 windows. The skill's
   blanket-failure branch records `0` with `api_errors=N` so the
   storyboard sees producer health; a future optimisation short-circuits
   on PRs whose `updated_at` precedes `prev_run_start`.
4. **`gh run list` window source assumes the producer always runs as
   part of `agent-team.yml`.** Step 4a's lookup uses the workflow name.
   A `workflow_dispatch` invocation outside the scheduled chain still
   counts (status filter is `completed`, source workflow name is
   unchanged). If `kata-release-merge` is ever moved to a separate
   workflow file, Edit 4a's workflow-name argument must move with it —
   not visible from the SKILL.md body alone because the workflow name
   is operational, not procedural.

## Execution recommendation

Single staff-engineer executor, sequential. Steps 1–6 (main-repo edits)
run in order: Step 2 cites Step 1's anchor; Step 4 cites Step 3's
metric definition; Step 6 cites Step 5's bullet template format. Step
7 runs after the main-repo edits because the wiki diff cites the
anchor Step 1 establishes. Step 8 closes. No parallelism; no
decomposition into parts. Route entirely to the engineering agent —
every edit is a code/doc change with no prose audience that warrants
`technical-writer`.
