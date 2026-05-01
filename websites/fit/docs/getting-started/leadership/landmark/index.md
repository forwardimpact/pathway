---
title: "Getting Started: Landmark for Leadership"
description: "Analyze engineering signals — marker evidence, snapshot trends, practice patterns, team health, and engineer voice."
---

Landmark is the analysis layer for engineering-system signals. It reads Map's
activity layer — organization roster, GitHub artifact evidence, GetDX snapshot
outcomes, and engineer voice comments — to produce deterministic analysis views.
All computation runs locally with no LLM calls.

Landmark requires Map's activity layer (Supabase). If you haven't set it up, see
[Getting Started: Map for Leadership](/docs/getting-started/leadership/map/)
first. To explore with synthetic data, see
[Trying the activity layer with synthetic data](/docs/getting-started/leadership/map/#trying-the-activity-layer-with-synthetic-data)
in the Map guide.

## Prerequisites

- Node.js 18+
- npm
- Map's activity layer running and populated

## Install

```sh
npm install @forwardimpact/landmark
```

## View the organization

See who is in the organization and how teams are structured:

```sh
npx fit-landmark org show
npx fit-landmark org team --manager alice@example.com
```

`org show` prints the full organization directory — names, roles, and reporting
lines. `org team` walks the hierarchy under a specific manager, which is the
scope most other commands operate on.

## Browse marker definitions

Look up the observable indicators defined for any skill in your agent-aligned
engineering standard:

```sh
npx fit-landmark marker task_completion
npx fit-landmark marker task_completion --level working
```

This is a reference view — it reads directly from your standard YAML and does
not require Supabase. Use it to review what markers exist before checking
evidence against them.

## View practice patterns

See aggregate marker evidence across a team scope:

```sh
npx fit-landmark practice --manager alice@example.com
npx fit-landmark practice --skill system_design --manager alice@example.com
```

Practice patterns show where your team has strong evidence of skill practice and
where evidence is thin — helping you identify coaching opportunities before they
become gaps.

## Browse evidence

Drill into the evidence rows linked to agent-aligned engineering standard
markers:

```sh
npx fit-landmark evidence --email bob@example.com
npx fit-landmark evidence --skill system_design --email bob@example.com
```

Each row shows the artifact, the marker it was matched to, the skill and
proficiency level, and Guide's rationale for the match. Filter by `--skill` to
focus on a specific area or omit it to see everything.

## Track snapshot trends

GetDX snapshots capture quarterly survey results. Landmark reads them from the
activity layer:

```sh
npx fit-landmark snapshot list
npx fit-landmark snapshot show --snapshot MjUyNbaY
npx fit-landmark snapshot show --snapshot MjUyNbaY --manager alice@example.com
```

`snapshot list` shows available snapshots. `snapshot show` displays factor and
driver scores — add `--manager` to scope to a single team.

Track a specific driver or factor over time:

```sh
npx fit-landmark snapshot trend --item MTQ2 --manager alice@example.com
```

Compare a snapshot against organizational benchmarks:

```sh
npx fit-landmark snapshot compare --snapshot MjUyNbaY --manager alice@example.com
```

## Check promotion readiness

See which next-level markers an engineer has already evidenced and which are
still outstanding — a checklist for promotion conversations:

```sh
npx fit-landmark readiness --email bob@example.com
npx fit-landmark readiness --email bob@example.com --target J060
```

Without `--target`, readiness uses the next level above the engineer's current
level. With `--target`, you can check against any specific level.

## View individual timelines

Track how an engineer's evidence has accumulated over time, aggregated by
quarter:

```sh
npx fit-landmark timeline --email bob@example.com
npx fit-landmark timeline --email bob@example.com --skill system_design
```

Timelines help you see whether growth is accelerating, stalling, or concentrated
in one area. Add `--skill` to focus on a specific capability.

## View evidence coverage

See how complete an individual's evidence coverage is across their expected
skills:

```sh
npx fit-landmark coverage --email bob@example.com
```

Coverage shows evidenced artifacts versus total expected markers — a quick gauge
of how well the evidence record reflects what the engineer actually does.

## Compare evidenced vs derived capability

See where real practice diverges from what the agent-aligned engineering
standard predicts:

```sh
npx fit-landmark practiced --manager alice@example.com
```

This compares the capability the team should have (based on their job profiles)
against what marker evidence actually shows. Skills with high derived capability
but low evidence may indicate either a data gap or a coaching opportunity.

## View team health

The health view is Landmark's centerpiece — it joins driver scores, contributing
skill evidence, engineer voice comments, and (when Summit is installed) growth
recommendations into a single picture:

```sh
npx fit-landmark health --manager alice@example.com
```

For each driver Landmark shows the GetDX score with percentile comparisons, the
skills that contribute to that driver, the evidence count for each skill, any
engineer comments related to the driver, and growth recommendations from Summit.

## Surface engineer voice

Landmark surfaces GetDX snapshot comments so you can hear what engineers are
saying:

```sh
npx fit-landmark voice --manager alice@example.com
npx fit-landmark voice --email bob@example.com
```

In manager mode, comments are bucketed by theme (estimation, incident, planning,
etc.) and aligned to low-scoring drivers — showing where engineer sentiment
matches the data. In individual mode, comments appear as a timeline alongside
evidence context.

## Track initiatives

See how organizational initiatives correlate with driver score changes:

```sh
npx fit-landmark initiative list --manager alice@example.com
npx fit-landmark initiative impact --manager alice@example.com
```

`initiative list` shows active initiatives with their IDs. To drill into a
specific initiative, pass the ID from the list output:

```sh
npx fit-landmark initiative show --id <id>
```

`initiative impact` joins initiative completion dates to snapshot score deltas,
showing whether a completed initiative moved the needle on its target drivers.

## Output formats

All Landmark commands support `--format text|json|markdown`. The default is
`text` (formatted for the terminal). Use `json` for programmatic consumption or
`markdown` for sharing in documents and pull requests.

---

## Next steps

- [Landmark product page](/landmark/) — audience model and architecture overview
- [Landmark quickstart](/docs/products/landmark-quickstart/) — step-by-step
  guide from install to a working health view
- [Team capability](/docs/products/team-capability/) — deep dive into Summit
  coverage, risks, and scenario planning
