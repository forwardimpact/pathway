---
title: Landmark
description: Show engineering progress without making individuals feel surveilled — evidence, trends, and engineer voice grounded in your engineering standard.
layout: product
toc: false
hero:
  image: /assets/scene-landmark.svg
  alt: An engineer, an AI robot, and a business professional stand on a rocky outcrop, scanning the horizon for signals
  subtitle: Check the cairn. Landmark shows what the signals say about how engineering is functioning — marker evidence, practice patterns, and snapshot trends assessed by Guide against your engineering standard.
  cta:
    - label: View on GitHub
      href: https://github.com/forwardimpact/monorepo/tree/main/products/landmark
    - label: View on npm
      href: https://www.npmjs.com/package/@forwardimpact/landmark
      secondary: true
---

The quarterly review is due and the only data available is ticket counts —
which single out individuals rather than illuminate the system. Career
conversations feel subjective with no shared evidence base. Landmark resolves
both by surfacing marker evidence — assessed by Guide against your engineering
standard — alongside developer-experience outcomes, presented without blaming
individuals.

## What becomes possible

### For Engineering Leaders

Demonstrate engineering progress without making individuals feel surveilled.
See system-level trends that show direction, tell whether culture investments
are working before the next budget cycle, and track initiative impact tied to
organizational drivers.

- Team health dashboards combining evidence, driver scores, and engineer voice
- GetDX snapshot trends and quarterly comparisons
- Initiative impact tracking tied to organizational drivers
- Practice pattern analysis showing which skills are actively exercised

### For Empowered Engineers

Show concrete evidence of growth, not just a manager's impression. Ground
career conversations in facts and know exactly where you stand against the
standard.

- Marker evidence linking GitHub artifacts to skill definitions
- Promotion readiness and growth timeline views
- Skill coverage analysis against standard markers

---

## How Landmark Works

### Audience Model

| Audience                | Views                                                                | Privacy                                   |
| ----------------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| **Engineer** (own data) | `evidence`, `readiness`, `timeline`, `coverage`, `voice --email`     | Full individual detail                    |
| **Manager** (1:1 tool)  | `health`, `readiness`, `timeline`, `practiced`, `voice --manager`    | Individual specificity for direct reports |
| **Director** (planning) | `snapshot`, `coverage`, `practiced`, `initiative`, `voice --manager` | Aggregated team views                     |

### Commands

#### Organization

```sh
npx fit-landmark org show                    # Full organization directory
npx fit-landmark org team --manager <email>  # Hierarchy under a manager
```

#### Snapshots

```sh
npx fit-landmark snapshot list
npx fit-landmark snapshot show --snapshot <id> [--manager <email>]
npx fit-landmark snapshot trend --item <item_id> [--manager <email>]
npx fit-landmark snapshot compare --snapshot <id> [--manager <email>]
```

#### Evidence & Readiness

```sh
npx fit-landmark evidence [--skill <id>] [--email <email>]
npx fit-landmark marker <skill> [--level <level>]
npx fit-landmark readiness --email <email> [--target <level>]
npx fit-landmark timeline --email <email> [--skill <id>]
npx fit-landmark coverage --email <email>
npx fit-landmark practiced --manager <email>
```

#### Health

```sh
npx fit-landmark health [--manager <email>]
```

Shows driver scores, contributing skill evidence, engineer voice comments, and
(when Summit is installed) inline growth recommendations.

#### Engineer Voice

```sh
npx fit-landmark voice --manager <email>   # Themed team comments
npx fit-landmark voice --email <email>     # Individual comment timeline
```

#### Initiatives

```sh
npx fit-landmark initiative list [--manager <email>]
npx fit-landmark initiative show --id <id>
npx fit-landmark initiative impact [--manager <email>]
```

All commands support `--format text|json|markdown`.

### Prerequisites

- **GetDX account** with API access configured
- **Map** with the activity schema migrated (`npx fit-map activity migrate`)
- **Standard data** with drivers and markers authored in your capability YAML

### Data Flow

Landmark reads from Map's activity layer:

1. `organization_people` for hierarchy and team slicing
2. `github_artifacts` + `evidence` for marker analysis — Guide assesses artifacts against your standard's markers and writes results to Map
3. `getdx_snapshots` + `getdx_snapshot_team_scores` for quarterly outcomes
4. `getdx_snapshot_comments` for engineer voice
5. `getdx_initiatives` for initiative tracking

```
GitHub + GetDX → Map (ingest + store) → Landmark (present)
                       ↑                       ↑
              Guide (marker analysis)    Summit (recommendations)
```

Health works without Summit — it shows driver scores, evidence, and comments.
Growth recommendations appear when Summit is installed.

---

## Getting Started

```sh
npm install @forwardimpact/landmark
npx fit-landmark marker task_completion
```

<div class="grid">

<!-- part:card:../docs/getting-started/leaders/landmark -->

<!-- part:card:../docs/getting-started/engineers/landmark -->

</div>

---
