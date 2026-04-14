---
name: fit-landmark
description: >
  Measure engineering outcomes and team health without blaming individuals.
  Use when checking promotion readiness, exploring GetDX snapshot trends,
  viewing marker evidence, surfacing engineer voice, tracking initiative
  impact, assessing whether culture investments are working, or generating
  growth recommendations.
---

# Landmark

Analysis and recommendation layer on top of Map data. Landmark reads from Map's
activity schema and framework YAML to surface evidence, health, readiness,
growth timelines, initiative impact, and engineer voice. All computation is
deterministic — no LLM calls.

## When to Use

- Measuring team outcomes without blaming individuals
- Checking an engineer's promotion readiness against marker checklists
- Analyzing team health across GetDX drivers and skill evidence
- Assessing whether investments in engineering culture are improving results
- Viewing growth timelines based on Guide-interpreted evidence
- Surfacing engineer voice from GetDX snapshot comments
- Tracking initiative impact on driver scores
- Exploring snapshot trends and factor comparisons
- Comparing evidenced vs derived capability across a team

---

## How It Works

### Evidence Model

Landmark combines two data sources: **framework data** (YAML definitions from
Map with skill markers and proficiency levels) and **activity data** (GetDX
snapshots, GitHub artifacts, and Guide-interpreted evidence stored in the Map
activity schema). Evidence is linked to skills via marker definitions authored
in capability YAML files.

### Readiness Assessment

Promotion readiness compares an engineer's evidenced skill levels against the
marker checklist for their target level. Each marker is checked against
available evidence — the result is a per-skill pass/gap report showing what has
been demonstrated and what still needs demonstration.

### Health Analysis

Team health aggregates GetDX driver scores, skill evidence coverage, and growth
trajectory across a manager's reports. The health view combines quantitative
snapshot data with qualitative evidence to surface where teams are strong and
where they need support.

### Privacy Model

Each view applies privacy rules based on the audience — engineers see only their
own data, managers see their direct reports, directors see aggregated team and
initiative data.

---

## CLI Reference

### Organization and People

```sh
npx fit-landmark org show                     # Organization directory
npx fit-landmark org team                     # Team views
```

### GetDX Snapshots

```sh
npx fit-landmark snapshot list                # List available snapshots
npx fit-landmark snapshot show <id>           # Snapshot detail
npx fit-landmark snapshot trend               # Score trends over time
npx fit-landmark snapshot compare             # Factor comparison across snapshots
```

### Evidence and Markers

```sh
npx fit-landmark evidence                     # Marker-linked evidence with rationale
npx fit-landmark marker <skill>               # Marker definitions reference view
npx fit-landmark coverage --email <email>     # Evidence coverage metrics
npx fit-landmark practiced --manager <email>  # Evidenced vs derived capability
```

### Individual Growth

```sh
npx fit-landmark readiness --email <email>    # Promotion readiness checklist
npx fit-landmark timeline --email <email>     # Individual growth timeline by quarter
```

### Team Health

```sh
npx fit-landmark health                       # Team health overview
npx fit-landmark health --manager <email>     # Health for a specific manager's reports
npx fit-landmark voice --manager <email>      # Engineer voice from GetDX comments
npx fit-landmark voice --email <email>        # Individual voice
```

### Initiatives

```sh
npx fit-landmark initiative list              # List tracked initiatives
npx fit-landmark initiative show <id>         # Initiative detail
npx fit-landmark initiative impact            # Initiative impact analysis
```

---

## Audience Model

Each view applies privacy rules based on the audience:

- **Engineer** (own data): `evidence`, `readiness`, `timeline`, `coverage`,
  `voice --email`
- **Manager** (1:1 tool): `health`, `readiness`, `timeline`, `practiced`,
  `voice --manager`
- **Director** (planning): `snapshot`, `coverage`, `practiced`, `initiative`

---

## Common Workflows

- "What should this engineer be demonstrating at the next level?" →
  `npx fit-landmark readiness --email <email>`
- "How is this team doing?" → `npx fit-landmark health --manager <email>`
- "What are engineers saying is blocking them?" →
  `npx fit-landmark voice --manager <email>`
- "Did the initiative we ran actually improve scores?" →
  `npx fit-landmark initiative impact`
- "What skills are practiced vs only on paper?" →
  `npx fit-landmark practiced --manager <email>`

---

## Prerequisites

- GetDX account with API access
- Map activity schema migrated and populated (`npx fit-map activity migrate`)
- Framework data with drivers and markers authored in capability YAML
- Summit (optional) for inline growth recommendations in health view

## Verification

```sh
npx fit-landmark org show                # Should display organization directory
npx fit-landmark snapshot list           # Should list available GetDX snapshots
npx fit-landmark health                  # Should display team health overview
```

## Documentation

For deeper context beyond this skill's scope:

- [Landmark Overview](https://www.forwardimpact.team/landmark/index.md) —
  Product overview, audience model, and key concepts
