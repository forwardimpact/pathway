---
title: Summit Internals
description: "Team capability aggregation — skill matrix aggregation, structural risk detection, what-if simulation, growth alignment, trajectory, and optional evidence/outcomes decorators."
---

## Overview

Summit treats a team as a system, not a collection of individuals. It aggregates
individual skill matrices (derived via libskill) into team-level capability
views, detects structural risks, simulates staffing scenarios, and recommends
growth directions that align with team needs.

Core Summit is fully local and deterministic — no network calls, no LLM
inference. The `--evidenced` and `--outcomes` flags are opt-in decorators that
read Map's activity layer through the shared Supabase client factory, and
degrade gracefully when that connection is unavailable.

---

## Architecture

```
Map data  ──┐
            ├──> Coverage  ──> Risks  ──┬──> What-if (clone + re-aggregate + diff)
libskill ───┤                           ├──> Compare (dual snapshots + diff)
            │                           ├──> Growth (+ Landmark export)
Roster ─────┘                           └──> Trajectory (git-sourced snapshots)

                                        ┌── Evidence decorator (Map activity)
                                        └── Outcomes decorator (GetDX drivers)
```

Summit consumes two inputs:

1. **Team roster** — from Map's `organization_people` table (grouped by
   `manager_email`) or a local `summit.yaml` file with `teams:` and optional
   `projects:` sections. Project members can reference reporting team members by
   `email` and carry an `allocation` percentage.
2. **Individual skill matrices** — derived via libskill's `deriveSkillMatrix()`
   for each team member using the loaded Map standard data.

---

## Package Layout

Summit follows spec 390 (`bin/`, `src/`, `starter/`, `test/`):

```
products/summit/
├── bin/fit-summit.js         # CLI entry point
├── src/
│   ├── aggregation/          # coverage, risks, what-if, growth, trajectory
│   ├── commands/             # one handler per CLI command
│   ├── evidence/             # Part 07 evidence decorator
│   ├── formatters/           # text / json / markdown per command
│   ├── git/                  # git log / git show wrapper for trajectory
│   ├── lib/                  # Supabase client, audience filter, CLI helpers
│   ├── outcomes/             # Part 07 outcomes decorator
│   ├── roster/               # YAML parser, Map loader, schema validator
│   └── index.js              # Public API (Landmark imports from here)
├── starter/summit.example.yaml
└── test/                     # Unit tests + fixture Map data
```

Downstream consumers (currently Landmark) import from the package root:
`import { computeGrowthAlignment } from "@forwardimpact/summit"`.

---

## Core Primitives

### TeamCoverage

`computeCoverage(resolvedTeam, data)` is the primitive every command reduces to.
It returns a `TeamCoverage` object keyed by `skillId`, with per-skill
`headcountDepth`, `effectiveDepth`, `maxProficiency`, per-proficiency
`distribution`, and a list of `holders` ({ email, name, proficiency, allocation
}). Effective depth is the allocation-weighted sum of holders at working+.

### TeamRisks

`detectRisks({ resolvedTeam, coverage, data })` runs three pure detectors:

- **Single points of failure** — skills with exactly one working+ holder,
  severity tiered by allocation (< 0.5 = high, 0.5–1.0 = medium, 1.0 = low).
- **Critical gaps** — union of each member's discipline core/supporting/broad
  skills plus positively-modified track skills, filtered by zero headcount
  depth. Reasons cite the mechanism.
- **Concentration risks** — (level, capability, proficiency) buckets with three
  or more members. Threshold exposed as `CONCENTRATION_THRESHOLD = 3`.

### Scenarios and Diffing

`applyScenario(roster, data, scenario)` clones the roster and mutates the clone.
Supported scenarios: `add`, `remove`, `move`, `promote`. Promote uses
`libskill.getNextLevel({ level, levels })` and requires resolving the level
object before the call.

`diffCoverage(before, after)` emits one row per skill in the union of the two
snapshots with an up/down/same direction marker. `diffRisks(before, after)`
buckets risks into added/removed/unchanged using stable keys (skillId for
SPOFs/gaps, `capabilityId|level|proficiency` for concentrations).

### Growth Alignment (Landmark contract)

`computeGrowthAlignment({ team, mapData, evidence?, driverScores? })` is
Summit's single public cross-product export. The signature is frozen:

- `team` — array of `{ email, name, job: { discipline, level, track? } }`.
- `mapData` — loaded Map standard data.
- `evidence` — optional `EvidenceMap` (Part 07).
- `driverScores` — optional driver scores map (Part 07).

Returns `GrowthRecommendation[]`. Empty team returns `[]`. Unknown
discipline/level/track throws `GrowthContractError` with stable error codes so
Landmark can branch without string matching.

### Trajectory

`computeTrajectory({ historicalRosters, teamId, data })` is pure — it takes a
pre-assembled list of `{ quarter, roster }` snapshots and returns a
`TeamTrajectory` with per-quarter coverage, roster changes, persistent gaps, and
trend classifications. All git I/O happens in `src/commands/trajectory.js` which
shells out to `listCommits` / `showFileAt` in `src/git/history.js`.

The git helpers accept an injectable `exec` function for testability.
`GitUnavailableError` wraps ENOENT from missing git binaries.

---

## Evidence and Outcomes Decorators

The `--evidenced` and `--outcomes` flags layer on top of the deterministic
pipeline:

- `loadEvidence(supabase, { team, lookbackMonths })` — calls `getEvidence` from
  `@forwardimpact/map/activity/queries/evidence`, filters by `matched === true`
  and the lookback window, and builds a
  `Map<skillId, { count, practitioners }>`.
- `decorateCoverageWithEvidence(coverage, evidence)` — clones `coverage` and
  adds `evidencedDepth` / `evidencedHolders` per skill.
- `decorateRisksWithEvidence(risks, coverage, evidence)` — escalates skills to
  SPOF when only one practitioner is observed and to critical gap when zero
  practitioners exist alongside zero derived depth.
- `loadDriverScores(supabase, { team })` — reads the latest GetDX snapshot via
  `listSnapshots` + `getSnapshotScores` and returns a
  `Map<driverId, { percentile, vsOrg, vsPrev }>`.
- `decorateRecommendationsWithOutcomes(recommendations, driverScores, data)` —
  attaches `driverContext` using the worst-scoring driver and re-sorts within
  each impact tier. The critical > spof-reduction > coverage-strengthening
  hierarchy is preserved — outcome weighting only breaks ties within a tier.

All evidence/outcomes code paths catch `SupabaseUnavailableError` /
`EvidenceUnavailableError` and degrade to the deterministic output with a stderr
note. `--evidenced` on `trajectory` is explicitly rejected with a "not yet
supported" message: per-quarter evidence would mislead readers.

---

## Audience Model

Every command honours the audience model from the spec via
`withAudienceFilter(coverage, audience)`. Audiences:

- `engineer` — sees own-team coverage/risks/growth.
- `manager` — full specificity; the default.
- `director` — aggregate views only; holder identity (email, name) is stripped
  from coverage, risks formatters show "one engineer", growth formatters replace
  "Alice or Bob" with counts.

The filter is applied in each command handler before formatting — so director
scope always gets the same filter across text, JSON, and markdown output.

---

## Data Model

```ts
type Roster = {
  source: "map" | "yaml",
  teams: Map<string, RosterTeam>,
  projects: Map<string, RosterTeam>,
};

type TeamCoverage = {
  teamId: string,
  teamType: "reporting" | "project",
  memberCount: number,
  effectiveFte: number,
  managerEmail: string | null,
  capabilities: Map<string, CapabilityCoverage>,
  skills: Map<string, SkillCoverage>,
};

type TeamRisks = {
  singlePointsOfFailure: SingleFailureRisk[],
  criticalGaps: CriticalGap[],
  concentrationRisks: ConcentrationRisk[],
};

type GrowthRecommendation = {
  skillId: string,
  impact: "critical" | "spof-reduction" | "coverage-strengthening",
  candidates: GrowthCandidate[],
  driverContext: DriverContext | null,
};
```

See `products/summit/src/aggregation/*.js` for the full JSDoc types.

---

## Dependency Chain

```
Map ─── loader / activity queries
libskill ─── deriveSkillMatrix, getNextLevel, expandModifiersToSkills
libcli ─── createCli, HelpRenderer
libtelemetry ─── createLogger
libutil ─── Finder
yaml ─── parse (used by YAML roster + flow-YAML job parser)
@supabase/supabase-js ─── createClient (Map-sourced roster + Part 07)
```

Summit is a leaf dependency consumed by Landmark (spec 080), which imports
`computeGrowthAlignment` from the package root.

---

## Related Documentation

- [libskill Internals](/docs/internals/libskill/) — derivation engine for
  individual skill matrices.
- [Map Internals](/docs/internals/map/) — standard data model and activity
  layer.
- [Pathway Internals](/docs/internals/pathway/) — individual career progression;
  Summit is the team-level counterpart.
