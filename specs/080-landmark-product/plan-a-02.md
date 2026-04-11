# Plan A · Part 02 — Evidence-based views + starter markers

Parent plan: [plan-a.md](./plan-a.md). Spec: [spec.md](./spec.md). Depends on
[Part 01](./plan-a-01.md) being merged.

This part adds marker definitions to the starter capabilities so the
evidence-based views have criteria to evaluate against, then ships the
Landmark commands that read from Map's existing `evidence` query module:
`evidence`, `readiness`, `timeline`, `coverage`, `practiced`.

## Scope

**In scope**

- Author `markers:` sections on `task_completion`, `planning`, and at least
  one skill inside `reliability.yaml`.
- Add a shared `evidenceHelpers.js` module in Landmark's `src/lib/` for join
  logic reused by multiple commands.
- Implement commands: `evidence`, `readiness`, `timeline`, `coverage`,
  `practiced`.
- Wire `readiness` to `libskill`'s `getNextLevel` and `deriveSkillMatrix` to
  resolve required skills at a target level for a given discipline+track.
- Empty-state handling for every command per spec § Empty States.
- Tests for each command using `node:test`.
- Update Part 01's `marker` command test to confirm it now produces real
  output for seeded skills (the test that previously asserted the empty path
  now asserts real output — both paths are kept, exercised via different
  fixtures).

**Out of scope**

- Health view (Part 03).
- Voice/initiative commands (Parts 04/05).
- Changes to `drivers.yaml` (Part 03 owns that).
- Marker authoring beyond the two starter capabilities (installations extend
  on their own).

## Files

### Created

```
products/landmark/src/lib/
  evidence-helpers.js

products/landmark/src/commands/
  evidence.js
  readiness.js
  timeline.js
  coverage.js
  practiced.js

products/landmark/src/formatters/
  evidence.js
  readiness.js
  timeline.js
  coverage.js
  practiced.js

products/landmark/test/
  evidence.test.js
  readiness.test.js
  timeline.test.js
  coverage.test.js
  practiced.test.js
  evidence-helpers.test.js
```

### Modified

- `products/map/starter/capabilities/delivery.yaml` — add `markers` to
  `task_completion` and `planning`.
- `products/map/starter/capabilities/reliability.yaml` — add `markers` to at
  least one skill (pick `incident_response` if defined, otherwise the first
  skill).
- `products/landmark/bin/fit-landmark.js` — replace "not yet implemented"
  stubs for `evidence`, `readiness`, `timeline`, `coverage`, `practiced` with
  the real handler imports and dispatch entries in `COMMANDS`.
- `products/landmark/src/formatters/index.js` — register the new formatters.
- `products/map/test/` — extend any test that loads starter capabilities to
  accept the new `markers` field, or confirm existing tests still pass
  without change (Map's loader test just snapshot-compares the loaded shape;
  update the snapshot if necessary).

## Implementation details

### Starter marker authoring

Authoring rule (from spec § Markers): each marker entry is a proficiency key
(`awareness` | `foundational` | `working` | `practitioner` | `expert`) with
an object containing `human:` and/or `agent:` string arrays. Validated by
`products/map/src/validation/skill.js#validateSkillMarkers`.

Author only `foundational` and `working` markers in this part — the starter's
two levels (`J040`, `J060`) only exercise those proficiencies, and adding
more would inflate the scope without adding coverage. Installations extend
with higher proficiencies as needed.

Example authored content for `task_completion` in `delivery.yaml`:

```yaml
- id: task_completion
  name: Task Completion
  # ... existing content ...
  markers:
    foundational:
      human:
        - Delivered a small feature end-to-end with minimal rework
        - Estimated and completed a defined task within the committed timeframe
      agent:
        - Completed a single-file change that passes CI on the first attempt
    working:
      human:
        - Delivered a feature end-to-end with no revision to the initial design
        - Independently resolved a production issue within SLA
      agent:
        - Completed a multi-file change that passes CI without human rework
        - Resolved an ambiguous bug report with evidence from logs and tests
```

Mirror for `planning` and for one skill in `reliability.yaml`. Keep language
consistent with the existing `proficiencyDescriptions` on each skill.

Run `bunx fit-map validate` after editing to confirm the new content passes
schema validation. This is the single canonical validation entry point.

### `evidence-helpers.js`

Shared logic reused across commands. Export:

```js
// Groups raw evidence rows by skillId → { matched, unmatched, markers[] }.
export function groupEvidenceBySkill(evidenceRows) { ... }

// Groups evidence rows by ISO quarter (YYYY-Q{1..4}) derived from created_at.
export function groupEvidenceByQuarter(evidenceRows) { ... }

// Picks the highest matched level per (quarter, skill) using
// SKILL_PROFICIENCY_ORDER from @forwardimpact/map/levels.
export function highestLevelPerSkillPerQuarter(evidenceRows) { ... }

// Given markers at a target level and evidence rows, returns a checklist
// array: [{ marker, evidenced: boolean, artifactId?, rationale? }, ...].
export function buildMarkerChecklist(markers, evidenceRows) { ... }

// Computes coverage ratio: (artifacts with ≥1 evidence row) / (total artifacts).
export function computeCoverageRatio(artifacts, evidenceRows) { ... }
```

All functions are pure; each has its own unit test in `evidence-helpers.test.js`.

### Command: `evidence`

Signature: `fit-landmark evidence [--skill <id>] [--email <email>]`.

Handler calls `getEvidence(supabase, { skillId, email })` from
`@forwardimpact/map/activity/queries/evidence`. Groups results by skill via
`groupEvidenceBySkill`. Always includes a coverage line: uses
`getUnscoredArtifacts` + `getArtifacts` counts to render `Evidence covers
X/Y artifacts` (spec § Evidence coverage metrics). Empty → `NO_EVIDENCE`.

### Command: `readiness`

Signature: `fit-landmark readiness --email <email> [--target <level>]`.

Steps:

1. `getPerson(supabase, options.email)`. If null → `PERSON_NOT_FOUND`.
2. Resolve target level. If `options.target` is set, use it directly.
   Otherwise call `getNextLevel(mapData.levels, person.level)`. If no next
   level exists → `NO_HIGHER_LEVEL(person.level)`.
3. Derive the expected skill matrix at the target level for the person's
   discipline/track using `deriveSkillMatrix` from `libskill`. (Confirm the
   exact function name in Part 01 research; the agent reported
   `deriveSkillMatrix` as the canonical export.)
4. For each skill in the matrix, load its markers at the target level from
   `mapData.skills`. If no markers are defined for any required skill →
   `NO_MARKERS_AT_TARGET` (do not silently skip).
5. Load evidence rows for the person: `getEvidence(supabase, { email })`,
   filtered to `matched: true`.
6. Build the checklist via `buildMarkerChecklist`. Summary line:
   `"<evidenced>/<total> markers evidenced. Missing: ..."`.

The `readiness` formatter renders `[x]` / `[ ]` checkboxes with artifact ids
in text/markdown; JSON returns the raw checklist array.

Starter-limitation test: fixture with a person at level `J060` (the highest
in starter data) — handler returns the `NO_HIGHER_LEVEL` empty state. Second
fixture with a person at `J040` returns a real checklist.

### Command: `timeline`

Signature: `fit-landmark timeline --email <email> [--skill <id>]`.

Calls `getEvidence(supabase, { email, skillId })`. Passes the result through
`highestLevelPerSkillPerQuarter`. Output rows are `(quarter, skillId,
highestLevel)`. No markers needed — this view is purely temporal aggregation.

Empty → `NO_EVIDENCE`.

### Command: `coverage`

Signature: `fit-landmark coverage --email <email>`.

Calls `getPerson`, then `getArtifacts(supabase, { email })` and
`getUnscoredArtifacts(supabase, { email })`. Computes the coverage ratio via
`computeCoverageRatio`. The view groups uncovered artifacts by `artifact_type`
so the user sees which artifact categories have been interpreted and which
have not.

Empty (no artifacts at all) → `"No artifacts found for ${email}."` (a new
empty-state constant `NO_ARTIFACTS_FOR_PERSON` added to
`src/lib/empty-state.js`).

### Command: `practiced`

Signature: `fit-landmark practiced --manager <email>`.

Shows evidenced depth alongside derived depth for a manager's team. Steps:

1. `getTeam(supabase, options.manager)`. If empty → `MANAGER_NOT_FOUND`.
2. For each team member, derive their expected skill matrix via
   `deriveSkillMatrix(mapData, { discipline, level, track })`. Aggregate the
   derived depths across the team per skill (using the highest required
   proficiency wins, matching Summit's convention).
3. Fetch evidenced depth via `getPracticePatterns(supabase, { managerEmail })`
   which returns `[{ skill_id, matched, unmatched, total }, ...]`.
4. For each skill, render `derived_depth` alongside `evidenced_depth`.
   Divergence highlight rule: if `derived_depth` is non-null and
   `evidenced_depth` is zero, flag as "on paper only". If `evidenced_depth`
   is non-zero for a skill not in the derived matrix, flag as "evidenced
   beyond role".

Empty (no evidence rows for any team member) → `NO_EVIDENCE`.

### Bin dispatch update

In `bin/fit-landmark.js`:

```js
import { runEvidenceCommand } from "../src/commands/evidence.js";
import { runReadinessCommand } from "../src/commands/readiness.js";
import { runTimelineCommand } from "../src/commands/timeline.js";
import { runCoverageCommand } from "../src/commands/coverage.js";
import { runPracticedCommand } from "../src/commands/practiced.js";

const COMMANDS = {
  org: runOrgCommand,
  snapshot: runSnapshotCommand,
  marker: runMarkerCommand,
  evidence: runEvidenceCommand,
  readiness: runReadinessCommand,
  timeline: runTimelineCommand,
  coverage: runCoverageCommand,
  practiced: runPracticedCommand,
};
```

`health`, `voice`, and `initiative` entries remain routed to the stub
handler from Part 01 — Parts 03/04/05 replace them.

## Tests

- `evidence.test.js` — fixtures: one person with 3 evidence rows across 2
  skills, one person with none. Covers `--skill` filter, `--email` filter, and
  the empty-state path. Also asserts the coverage line is always present.
- `readiness.test.js` — three cases: J040 person with partial evidence
  (checklist with mix of `[x]` / `[ ]`), J060 person (`NO_HIGHER_LEVEL`
  empty state), person with required skills that have no markers at the
  target level (`NO_MARKERS_AT_TARGET`).
- `timeline.test.js` — fixture with evidence across 3 quarters, two skills.
  Verifies highest-level-per-(quarter, skill) aggregation and the `--skill`
  filter.
- `coverage.test.js` — person with mix of scored and unscored artifacts.
  Verifies ratio and category grouping.
- `practiced.test.js` — team of 3 with differing job profiles. Verifies
  derived-depth aggregation and the "on paper only" / "evidenced beyond role"
  divergence flags.
- `evidence-helpers.test.js` — pure unit tests for every exported function.
- Update `marker.test.js` from Part 01: add a new case that uses a fixture
  where `task_completion` has markers, asserting the formatted output now
  matches spec § Marker reference view.

## Verification

1. `bunx fit-map validate` with the updated starter data — confirms the new
   `markers` fields pass schema validation.
2. `bun test products/landmark/test` — all command tests green, including the
   updated `marker.test.js`.
3. `bun test products/map/test` — Map's loader and validation tests still
   green with the expanded starter content.
4. `bun run check` — lint, format, layout, exports check.
5. Smoke test against `fit-map activity seed`:
   - `bunx fit-landmark readiness --email engineer-1@example.com` produces a
     checklist.
   - `bunx fit-landmark coverage --email engineer-1@example.com` produces a
     ratio.
   - `bunx fit-landmark practiced --manager manager-1@example.com` produces a
     derived-vs-evidenced table.

## Deliverable

A merged PR that enables every evidence-based view declared in spec § Product
Behavior (except `health`). Starter data now demonstrates markers. `fit-map
validate` stays green.
