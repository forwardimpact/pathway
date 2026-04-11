# Plan A · Part 03 — Health view + drivers expansion

Parent plan: [plan-a.md](./plan-a.md). Spec: [spec.md](./spec.md). Depends on
[Part 02](./plan-a-02.md) being merged.

This part expands the starter `drivers.yaml` to demonstrate multi-driver
views and ships the `health` command. Health joins snapshot scores,
contributing-skill evidence counts, and (when available) Summit growth
recommendations rendered inline.

Summit exists in the repo (spec 090 is `done`) and already exports
`computeGrowthAlignment` from the package root, so this part consumes it as
a hard dependency while keeping the graceful-degrade path exercised in tests
via a controlled wrapper.

## Scope

**In scope**

- Add two additional drivers to `products/map/starter/drivers.yaml`:
  `reliability` and `cognitive_load` (names and contributing skills picked to
  match skills already defined in the starter).
- Add `@forwardimpact/summit` to Landmark's `dependencies`.
- Implement the `health` command.
- Wire a wrapper (`src/lib/summit.js`) that imports `computeGrowthAlignment`
  and exposes a synchronous feature-detection boolean plus an async
  `computeGrowth({ team, mapData, evidence, driverScores })` function that
  tests can stub.
- Extend the `item_id`↔driver validation introduced in Part 01 with a
  formatter surface: warnings are rendered under the health view output.
- Tests: health command with Summit present, health command with Summit
  stubbed absent (graceful-degrade path).

**Out of scope**

- Voice command (Part 04). Health's comment section renders whatever
  `voice` data is passed in; Part 04 adds the fetch. Part 03 leaves the
  comment section empty with a note "comments surface once Part 04 lands" —
  the render path is ready, the data source is not.
- Initiative tracking in health (Part 05 extends health to include
  initiatives once the table exists).
- Changes to Summit.

## Files

### Created

```
products/landmark/src/lib/
  summit.js

products/landmark/src/commands/
  health.js

products/landmark/src/formatters/
  health.js

products/landmark/test/
  health.test.js
  summit.test.js
```

### Modified

- `products/map/starter/drivers.yaml` — add `reliability` and
  `cognitive_load` drivers.
- `products/landmark/package.json` — add `"@forwardimpact/summit": "^0.1.0"`
  to `dependencies` (the actual version pin matches whatever Summit is
  currently publishing; use the workspace convention of the caret of the
  current minor).
- `products/landmark/bin/fit-landmark.js` — replace `health` stub with real
  handler import and dispatch.
- `products/landmark/src/formatters/index.js` — register health formatter.
- Root `package.json` — no change (workspace entry already added in Part 01).

## Implementation details

### `drivers.yaml` expansion

Starter authoring must not break the existing `quality` driver. Add entries
after the current one; do not reorder. Pick contributing skills from the
set already present in the starter (`task_completion`, `planning`, plus any
skills added in `reliability.yaml` if Part 02 added them).

Exact content to add (adjust skill ids to match whatever Part 02 authored):

```yaml
- id: reliability
  name: Reliability
  description: Keep systems dependable and recover quickly from disruption.
  contributingSkills:
    - incident_response   # or whatever skill Part 02 added markers to
  contributingBehaviours: []

- id: cognitive_load
  name: Cognitive Load
  description: Keep day-to-day engineering tractable by managing complexity.
  contributingSkills:
    - planning
  contributingBehaviours: []
```

Validate with `bunx fit-map validate`. Confirm the new drivers load via
`createDataLoader().loadAllData(dataDir)` in a unit test — Map's loader test
may already assert the count; update the expected count.

Note: real GetDX installations will match `driver.id` to
`getdx_snapshot_team_scores.item_id` values. The starter drivers use short
ids that are unlikely to collide with a real GetDX scorecard, which is
intentional: starter drivers are demonstrative, not production.

### `src/lib/summit.js`

Wrapper around Summit's growth export. Exposes an injectable surface so
tests can exercise both the "Summit installed" and "Summit missing" paths.

```js
let cached = null;
let cacheSet = false;

export async function loadSummit() {
  if (cacheSet) return cached;
  try {
    const mod = await import("@forwardimpact/summit");
    cached = mod?.computeGrowthAlignment ?? null;
  } catch {
    cached = null;
  }
  cacheSet = true;
  return cached;
}

// Test helper — reset cache and optionally inject a stub.
export function __setSummitForTests(fn) {
  cached = fn;
  cacheSet = true;
}

export async function computeGrowth(params) {
  const fn = await loadSummit();
  if (!fn) return { available: false, recommendations: [] };
  try {
    return { available: true, recommendations: fn(params) };
  } catch (err) {
    return {
      available: false,
      recommendations: [],
      error: `Summit growth computation failed: ${err.message}`,
    };
  }
}
```

Decision: `loadSummit` is cached because `import()` is async and repeated
dispatch inside the health view would otherwise re-resolve the module. The
test hook `__setSummitForTests` is the documented seam and is used only by
`summit.test.js` and `health.test.js`. No production code calls it.

### Command: `health`

Signature: `fit-landmark health [--manager <email>]`.

Steps:

1. `getTeam(supabase, options.manager)` if `--manager` is set, else
   `getOrganization(supabase)`. No results → `MANAGER_NOT_FOUND` or
   `EMPTY_STATES.NO_ORGANIZATION` (add a new constant for the latter).
2. `listSnapshots(supabase)` — pick the most recent (first row, spec says
   ordered DESC). No snapshots → `NO_SNAPSHOTS`.
3. `getSnapshotScores(supabase, latest.snapshot_id, { managerEmail })`.
4. Load Map drivers. Join scores to drivers by `item_id === driver.id`.
   Collect unknown-item warnings in `meta.warnings`.
5. For each matched driver, gather contributing skills from the driver
   definition, then fetch evidence counts per skill via `getEvidence(supabase,
   { skillId, managerEmail? })`. The query does not natively support
   managerEmail filtering on evidence; when `--manager` is set, filter
   client-side by intersecting artifact emails against the team roster.
   (Encapsulate this filter in `evidence-helpers.js#filterEvidenceByTeam`
   added here, with its own unit test.)
6. Build the growth-recommendation bundle: team roster (from step 1), map
   data, evidence grouped by skillId via
   `evidence-helpers.js#groupEvidenceBySkill`, and driverScores as a Map
   from `driver.id` to `{ score, vs_prev, vs_org, vs_50th, vs_75th, vs_90th }`.
   Call `computeGrowth(...)`. If `available: false`, render without
   recommendation lines; if `available: true`, render each recommendation
   inline under its driver section matching the spec's output (§ Health
   view, lines 410–440).
7. Comment section: reserved for Part 04. Render a placeholder `"(engineer
   voice requires Part 04 — getdx_snapshot_comments table)"` when Part 04
   has not landed. Part 04 will replace the placeholder with the real fetch.
8. Return `{ view: { drivers: [...] }, meta: { format, warnings } }`.

### Formatter

`health.js` formatter renders the spec's exact shape:

```
Platform team — health view

  Driver: quality (42nd percentile, vs_org: -10)
    Contributing skills: task_completion, planning
    Evidence: 3 artifacts for task_completion, 0 for planning
    GetDX comments: (comments surface once Part 04 lands)

    ⮕ Recommendation: Dan (Level I) or Carol (Level II) could develop planning.
      (Summit growth alignment: high impact)
```

Text formatter uses the arrow glyph in the spec (`⮕`). Markdown formatter
uses plain `>` blockquotes. JSON formatter emits the full structured view
untouched.

## Tests

- `health.test.js`:
  - **With Summit present.** Fixture: team of 3, snapshot with scores for
    `quality`, evidence rows for `task_completion`. Asserts the formatted
    text output contains the driver header line, the evidence counts, and
    the recommendation line. Asserts `meta.warnings` is empty.
  - **With Summit absent.** Uses `__setSummitForTests(null)`. Asserts the
    recommendation line is omitted and the rest of the output is identical.
  - **Unknown item_id.** Fixture includes a score with `item_id: "sci_fi"`
    that has no driver. Asserts warning is collected and the unknown item
    does not render.
  - **No snapshots.** Empty snapshot list → `NO_SNAPSHOTS` empty state.
  - **Manager not found.** `--manager unknown@example.com` → 
    `MANAGER_NOT_FOUND`.
- `summit.test.js`:
  - `loadSummit` caches results across calls.
  - `__setSummitForTests(null)` → `computeGrowth` returns `available: false`.
  - `__setSummitForTests(() => { throw new Error("boom"); })` →
    `computeGrowth` returns `available: false` with `error` populated.

## Verification

1. `bunx fit-map validate` — updated `drivers.yaml` passes.
2. `bun test products/landmark/test` — new tests green. Part 02 tests still
   green (no regressions from Part 02 helpers reused in Part 03).
3. `bun test products/map/test` — starter-count assertions updated; green.
4. `bun run check` — lint, format, layout, exports.
5. Smoke test against `fit-map activity seed`:
   - `bunx fit-landmark health --manager manager-1@example.com` prints a
     multi-driver health view including at least one Summit recommendation
     line.
   - `bunx fit-landmark health` (no manager) prints an organization-wide
     view.

## Risks and open questions

- **Driver ids vs GetDX item ids in real installations.** The warning
  surface this part adds makes silent mismatches visible, but does not
  resolve them. Document the join contract clearly in Part 06's internals
  page so installations know to align their GetDX scorecard item ids with
  `drivers.yaml`.
- **Summit's growth signature might narrow in future.** Pinned minor
  version in `package.json` limits blast radius; CI catches breakage.
- **`filterEvidenceByTeam` assumes team roster fits in memory.** Acceptable
  for realistic team sizes (dozens to hundreds); document the assumption
  inline and revisit if ever needed.

## Deliverable

A merged PR that ships a working `fit-landmark health` command demonstrating
the full spec § Health view output (minus the comment section, which Part 04
completes). Starter drivers now include `reliability` and `cognitive_load`
alongside `quality`.
