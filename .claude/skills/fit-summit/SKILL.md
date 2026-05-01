---
name: fit-summit
description: >
  Staff teams to succeed by modeling capability as a system. Use when
  building or restructuring a team, evaluating a hire, transfer, or
  promotion, analyzing coverage heatmaps, detecting structural risks like
  single points of failure, simulating staffing changes with what-if
  scenarios, aligning individual growth with team gaps, comparing teams, or
  tracking capability trajectory over time.
---

# Summit

Team capability planning tool. Summit aggregates individual skill matrices into
team-level views — coverage heatmaps, structural risks, and what-if scenarios.
It treats a team as a system, not a collection of individuals: it measures what
a team _can_ do, not how well it is doing it.

## When to Use

**Coverage and risk analysis:**

- Viewing per-skill headcount depth across a team
- Detecting single points of failure, critical gaps, and concentration risks
- Overlaying evidence from Map's activity layer (`--evidenced`)

**Staffing scenarios:**

- Building or restructuring a team to ensure structural coverage
- Evaluating whether a hire, transfer, or promotion strengthens the team
- Simulating the effect of adding, removing, moving, or promoting a team member
- Comparing capability before and after a proposed change
- Evaluating project-specific allocation and coverage

**Growth and trajectory:**

- Identifying growth opportunities aligned with team gaps
- Weighting recommendations by GetDX driver scores (`--outcomes`)
- Tracking quarterly capability evolution from git history

**Team comparison:**

- Diffing coverage and risks between two teams
- Reviewing roster composition and validation

---

## How It Works

### Coverage

For each team member, Summit derives a skill matrix from their job (discipline,
level, track) using the Map standard data. Skills at "working" proficiency or
above count toward coverage depth. The result is a per-skill headcount showing
how many people can meaningfully contribute to each skill area.

### Structural Risks

Three risk types are detected from coverage data:

1. **Single points of failure** — skills with exactly one working+ holder.
   Severity depends on allocation: part-time holders are higher risk.
2. **Critical gaps** — skills expected by the team's disciplines and tracks that
   have zero working+ holders.
3. **Concentration risks** — clusters of 3+ people at the same level,
   capability, and proficiency, indicating lack of seniority distribution.

### What-If Scenarios

Scenarios clone the roster, apply mutations (add/remove/move/promote), and diff
coverage and risks against the original. The input is never modified — all
simulation is pure.

### Growth Alignment

Growth recommendations rank team members by their potential to fill team gaps.
Each skill gap is classified by impact: `critical` > `spof-reduction` >
`coverage-strengthening`. Candidates are ranked by current proficiency (lower is
better — more room to grow) and level. When `--outcomes` is provided,
recommendations within the same impact tier are re-sorted by worst GetDX driver
score.

### Evidence Decorator

The optional `--evidenced` flag loads evidence from Map's activity schema and
overlays practiced capability onto derived coverage. This can escalate risks — a
skill with derived depth but no evidence becomes a more urgent concern.

### Trajectory

Trajectory reads the git history of the roster file, buckets commits by calendar
quarter, and computes coverage at each point. Per-skill trends are classified as
improving, declining, stable, or persistent_gap.

### Audience Model

Each view applies privacy rules based on the audience:

- **Engineer** — sees team aggregates and their own growth recommendations
- **Manager** — sees individual-level detail within their team
- **Director** — sees aggregated data with individual identity stripped

---

## CLI Reference

See [`references/cli.md`](references/cli.md) for full command listings.

---

## Roster Format

See [`references/roster.md`](references/roster.md) for YAML format and examples.

---

## Common Workflows

See [`references/workflows.md`](references/workflows.md) for worked examples.

---

## Prerequisites

- Map standard data (from `npx fit-map init`)
- A `summit.yaml` roster file (copy from the starter example)
- Git repository (required for `trajectory` command)
- Map activity layer (optional, for `--evidenced` and Map-sourced rosters)
- GetDX integration (optional, for `--outcomes`)

## Verification

```sh
npx fit-summit validate                   # Roster validates against agent-aligned engineering standard
npx fit-summit roster                     # Roster displays correctly
npx fit-summit coverage <team>            # Coverage heatmap renders
npx fit-summit risks <team>               # Risks detected as expected
```

## Documentation

For deeper context beyond this skill's scope:

- [Team Capability Guide](https://www.forwardimpact.team/docs/products/team-capability/index.md)
  — Task-oriented guide to coverage heatmaps, structural risks, and what-if
  scenarios
- [Summit Overview](https://www.forwardimpact.team/summit/index.md) — Product
  overview, design principles, and audience model
- [CLI Reference](https://www.forwardimpact.team/docs/reference/cli/index.md) —
  Complete command reference for all Forward Impact CLI tools
