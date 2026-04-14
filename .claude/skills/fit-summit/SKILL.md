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
level, track) using the Map framework data. Skills at "working" proficiency or
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

### Global Options

All commands accept these options:

| Option            | Description                               |
| ----------------- | ----------------------------------------- |
| `--roster <path>` | Path to `summit.yaml` roster file         |
| `--data <path>`   | Path to Map framework data directory      |
| `--format <type>` | Output format: `text`, `json`, `markdown` |
| `--help`          | Show command help                         |
| `--version`       | Print version                             |

### Coverage and Risks

```sh
npx fit-summit coverage <team>                  # Capability coverage heatmap
npx fit-summit coverage <team> --evidenced      # Overlay practiced capability
npx fit-summit coverage <team> --project <name> # Project-specific coverage
npx fit-summit risks <team>                     # Structural risks (SPOFs, gaps, concentration)
npx fit-summit risks <team> --evidenced         # Evidence-escalated risks
npx fit-summit risks <team> --audience director # Director-level (anonymized)
```

### What-If Scenarios

```sh
npx fit-summit what-if <team> --remove 'Alice'
npx fit-summit what-if <team> --add '{ discipline: software_engineering, level: J060, track: platform }'
npx fit-summit what-if <team> --promote 'Bob'
npx fit-summit what-if <team> --move 'Carol' --to other-team
npx fit-summit what-if <team> --remove 'Alice' --focus delivery  # Focus diff on one capability
```

The `--add` flag takes a flow-style YAML job expression with `discipline`,
`level`, and optionally `track`.

### Growth and Trajectory

```sh
npx fit-summit growth <team>                    # Growth opportunities aligned with gaps
npx fit-summit growth <team> --evidenced        # Exclude already-practiced skills
npx fit-summit growth <team> --outcomes         # Weight by GetDX driver scores
npx fit-summit trajectory <team>                # Quarterly capability evolution
npx fit-summit trajectory <team> --quarters 8   # Look back 8 quarters
```

### Roster and Validation

```sh
npx fit-summit roster                           # Display current roster
npx fit-summit validate                         # Validate roster against framework data
```

`validate` exits non-zero on errors — use it in CI or pre-commit hooks.

### Team Comparison

```sh
npx fit-summit compare <team1> <team2>          # Diff coverage and risks
npx fit-summit compare <team1> <team2> --audience director
```

---

## Roster Format

Summit reads a `summit.yaml` file with teams and optional projects:

```yaml
teams:
  platform:
    - name: Alice
      email: alice@example.com
      job:
        discipline: software_engineering
        level: J060
        track: platform
    - name: Bob
      email: bob@example.com
      job:
        discipline: software_engineering
        level: J040

projects:
  migration-q2:
    - email: alice@example.com       # References a reporting team member
      allocation: 0.6
    - name: External Consultant      # Inline job definition
      job:
        discipline: software_engineering
        level: J060
        track: platform
      allocation: 1.0
```

All disciplines, levels, and tracks referenced must exist in the Map framework
data. Use `npx fit-summit validate` to check.

Alternatively, Summit can load rosters directly from Map's activity layer
(requires `MAP_SUPABASE_URL` and `MAP_SUPABASE_SERVICE_ROLE_KEY`), grouping
`organization_people` by manager email to form reporting teams.

---

## Common Workflows

### "What happens if Alice leaves?"

```sh
npx fit-summit risks platform
npx fit-summit what-if platform --remove 'Alice'
```

Compare the risk lists before and after to see which single points of failure
emerge.

### "Should we hire a senior or a mid-level?"

```sh
npx fit-summit what-if platform --add '{ discipline: software_engineering, level: J060 }'
npx fit-summit what-if platform --add '{ discipline: software_engineering, level: J040 }'
```

Compare the coverage diff from each scenario to see which addresses more gaps.

### "Where should this engineer focus their growth?"

```sh
npx fit-summit growth platform --evidenced --outcomes
```

Returns recommendations ranked by team impact, filtered by what the engineer has
already demonstrated, and weighted by organizational driver scores.

### "How has the team changed over time?"

```sh
npx fit-summit trajectory platform --quarters 8
```

Shows quarterly coverage snapshots with per-skill trend classification and
roster changes (joins, leaves, promotions).

---

## Prerequisites

- Map framework data (from `npx fit-map init`)
- A `summit.yaml` roster file (copy from the starter example)
- Git repository (required for `trajectory` command)
- Map activity layer (optional, for `--evidenced` and Map-sourced rosters)
- GetDX integration (optional, for `--outcomes`)

## Verification

```sh
npx fit-summit validate                   # Roster validates against framework
npx fit-summit roster                     # Roster displays correctly
npx fit-summit coverage <team>            # Coverage heatmap renders
npx fit-summit risks <team>               # Risks detected as expected
```

## Documentation

For deeper context beyond this skill's scope:

- [Team Capability Guide](https://www.forwardimpact.team/docs/guides/team-capability/index.md)
  — Task-oriented guide to coverage heatmaps, structural risks, and what-if
  scenarios
- [Summit Overview](https://www.forwardimpact.team/summit/index.md) — Product
  overview, design principles, and audience model
- [CLI Reference](https://www.forwardimpact.team/docs/reference/cli/index.md) —
  Complete command reference for all Forward Impact CLI tools
