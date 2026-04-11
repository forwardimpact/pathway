# Plan A — Landmark Product

Implementation plan for [spec.md](./spec.md) (spec 080).

## Approach

Landmark is a read-only CLI analysis layer over Map's activity schema. It has
one very close sibling in the repo — **Summit** (`products/summit/`) — which
already:

- Uses the same `libcli` + `--format text|json|markdown` conventions Landmark
  needs.
- Imports Map's pure loader (`createDataLoader`) and activity queries under the
  same subpath aliases Landmark will consume.
- Ships a Supabase client factory (`src/lib/supabase.js`) that mirrors Map's
  env-var contract and handles graceful unavailability.
- Exports `computeGrowthAlignment` — the function Landmark's `health` view
  imports directly.

The strategy is therefore: **scaffold Landmark as a near-twin of Summit**,
reusing its CLI bootstrap pattern, Supabase factory, `resolveFormat` helper,
formatter layout, and test harness. Anything that already works in Summit gets
copied, not rediscovered. Divergence from Summit happens only where the
products actually differ (Landmark's per-view audience model, its Map activity
queries, its evidence-based views).

### Key architectural decisions

1. **Mirror Summit's package layout.** `products/landmark/{bin,src,test}` with
   `src/{commands,formatters,lib}`. Commands live under `src/commands/<name>.js`
   and are dispatched from `bin/fit-landmark.js` through `libcli.createCli`.
   Shared helpers (`resolveDataDir`, `loadMapData`, `resolveFormat`,
   `createLandmarkClient`) live in `src/lib/`.

2. **Summit is a hard dependency, not optional.** Spec 090 is `done` and
   `@forwardimpact/summit` already exports `computeGrowthAlignment` from the
   package root. Landmark lists Summit in its `dependencies` and imports it
   directly. The spec's "Summit not installed" empty-state remains relevant
   only for hypothetical external users who strip Summit from their install —
   handled via a dynamic `import()` guarded by a try/catch in the health
   command, with the catch path rendering the graceful-degraded output.

3. **Supabase client is created lazily per command.** Commands that need
   activity data call `createLandmarkClient()` from `src/lib/supabase.js` (a
   thin clone of Summit's factory). Commands that only need framework data
   (`marker`) do not open a client at all.

4. **Audience flags are per-command, not global.** Spec's audience model maps
   to `--email` (engineer scope), `--manager` (manager/director scope). The
   privacy rule (director aggregation vs manager specificity) is encoded per
   command. No global `--audience` flag — command options are sufficient.

5. **Empty states are data, not exceptions.** Every command produces a
   well-formed result object with a `meta.emptyState` string when a data
   source is missing. Formatters render the empty-state message verbatim; JSON
   output always includes the field. This keeps the "explain in terms the user
   can act on" rule (spec line 571) enforceable in tests.

6. **Markers are authored in starter data as part of this plan.** Part 02 adds
   marker definitions to `delivery.yaml` and `reliability.yaml`. Part 03 adds
   additional drivers (`reliability`, `cognitive_load`) to `drivers.yaml` so
   the starter demonstrates multi-driver `health` views. These changes are
   scoped to the starter template and are independent from external
   installations, which must still author their own markers and drivers.

7. **New Map tables (`getdx_snapshot_comments`, `getdx_initiatives`) are
   authored here**, inside Parts 04 and 05. Those parts touch
   `products/map/supabase/` to extend the extract/transform pipeline, add
   migrations, export new query modules, and wire them through
   `products/map/package.json`. Landmark consumes the new queries in the same
   part to keep each feature end-to-end verifiable.

### Dependency graph

```
┌──────────────────────────────┐
│ Part 01 — Scaffolding +      │   foundation
│  org, snapshot, marker       │
└──────┬───────────────────────┘
       │
       ├──→ Part 02 — Evidence views + starter markers
       │        (evidence, readiness, timeline, coverage, practiced)
       │
       ├──→ Part 03 — Health view + drivers expansion
       │        (depends on Part 02 for evidence query wiring)
       │
       ├──→ Part 04 — Map snapshot comments + voice
       │        (independent of Parts 02/03 on the Map side; the voice
       │         command reuses Part 01's CLI plumbing only)
       │
       ├──→ Part 05 — Map initiatives + initiative commands
       │        (independent of Part 04)
       │
       └──→ Part 06 — Documentation + published skill
                (depends on Parts 01-05 being merged)
```

Parts 02 and 03 are strictly sequential (Part 03's `health` view reuses
evidence query helpers written in Part 02). Parts 04 and 05 are independent
of each other and of Parts 02/03 — they can run in parallel after Part 01
lands. Part 06 is the last step.

### Blast radius

**Created (Part 01 baseline):**

- `products/landmark/package.json`
- `products/landmark/bin/fit-landmark.js`
- `products/landmark/src/index.js`
- `products/landmark/src/lib/{cli,supabase,context,empty-state}.js`
- `products/landmark/src/commands/{org,snapshot,marker}.js`
- `products/landmark/src/formatters/{index,org,snapshot,marker,shared}.js`
- `products/landmark/test/*.test.js`

**Modified (Part 01):**

- `package.json` (root) — add `products/landmark` to workspaces array
- `justfile` — add `landmark` target wrappers if present for other products
- No changes to Map or existing products in Part 01.

Parts 02–05 each list their own created/modified files in their part file.
Part 06 touches `website/`, `.claude/skills/`, and root docs.

### Risks

| Risk                                                                                                                        | Mitigation                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getdx_snapshot_team_scores.item_id` ↔ `drivers.yaml` id is an implicit contract                                            | Part 03 adds a validation step: when `health` runs, it cross-references the set of `item_id` values against loaded drivers and surfaces unknown items as a warning rather than silently dropping them.                    |
| Starter data has only 2 levels (`J040`, `J060`), so `readiness` at Level II produces "no higher level defined"              | Spec already anticipates this (§ Promotion readiness). Part 02's test covers both paths: Level I → Level II checklist, Level II → empty-state.                                                                             |
| `getEvidence({email})` joins via `github_artifacts.email` — confirms the join chain but assumes artifact rows exist         | Part 02 covers the empty-evidence case (no artifacts yet) by rendering the standard "No evidence data available" empty state. Test fixture uses an org_people row with no artifacts to prove the path.                    |
| Summit's `computeGrowthAlignment` signature could change                                                                    | Part 03 pins a compatible `@forwardimpact/summit` minor version in `products/landmark/package.json` and asserts the expected output shape in a unit test. A breaking change in Summit will be caught by CI.               |
| GetDX Initiatives API shape is unknown in advance (no existing code to copy)                                                | Part 05 defines the Initiatives API integration against a stub extract that stores raw responses. The migration + query can be written against the stub. Wiring the real endpoint is a one-line change once verified.    |
| Adding markers to starter capabilities is a breaking change for downstream installations that have their own marker schema | Starter markers are additive — existing capabilities keep their `proficiencyDescriptions` and simply gain a `markers` field. Since nobody currently defines markers, this cannot conflict with external installations.   |
| New Supabase migrations require coordinating with `just migrate`                                                            | Parts 04 and 05 use the Map migration conventions (single `.sql` file under `products/map/supabase/migrations/NNNN_*.sql`) and note the `just migrate` run step in their verification sections.                           |
| Dynamic `import("@forwardimpact/summit")` in Part 03 needs a test path that simulates "Summit missing"                      | Part 03's test uses `mock.module` or a controlled wrapper function (`loadSummit()`) injected into the command handler so that unit tests can pass `() => null` to exercise the graceful path without touching node_modules. |

### Execution

Route every part to **`staff-engineer`** except Part 06, which goes to
**`technical-writer`**. Plan execution is:

1. **Part 01** runs first in isolation. It creates the package and lands
   nothing else. Merge before starting any other part.
2. After Part 01 merges, launch **Parts 02, 04, and 05 in parallel** as three
   concurrent staff-engineer sub-agents. They touch disjoint files (Part 02
   only inside `products/landmark/` + starter markers; Parts 04/05 touch Map's
   Supabase layer and the Landmark command files they own).
3. **Part 03** waits for Part 02 to merge (it reuses Part 02's evidence
   helper). Launch after Part 02 lands.
4. **Part 06** runs after all code parts are merged — it needs the final
   command surface to write accurate documentation.

Each part includes its own verification steps (tests, CI, smoke test). Do not
chain parts past a failing verification.

### Cross-part conventions

All parts follow these shared conventions so they compose cleanly:

- **File naming:** commands at `products/landmark/src/commands/<name>.js`,
  formatters at `products/landmark/src/formatters/<name>.js`. One file per
  top-level command (`org`, `snapshot`, `evidence`, `health`, etc.). Subcommands
  (`snapshot list` vs `snapshot show`) dispatch inside the command file.
- **Command handler signature:** `async function run<Name>Command({ data, args,
  options, supabase, mapData })`, matching Summit's shape. `supabase` is
  `null` when the command did not open a client. `mapData` is the result of
  `loadMapData(dataDir)`.
- **Return shape:** every handler returns `{ view, meta }` where `view` is the
  command-specific data object and `meta` is `{ format, emptyState, warnings }`.
  The dispatcher in `bin/fit-landmark.js` passes this to the appropriate
  formatter.
- **Tests:** Node's built-in `node:test` and `node:assert`, mirroring Pathway
  and Summit. Test files at `products/landmark/test/<name>.test.js`. Use
  fixture objects for Map data and a stub Supabase client that returns seeded
  results; no real network calls.
- **Lint & format:** run `bun run check` inside `products/landmark/` after
  each part.

## Part Index

1. **[Part 01 — Scaffolding + foundational views](./plan-a-01.md)** — Create
   the `@forwardimpact/landmark` package, wire `fit-landmark` through libcli,
   ship `org`, `snapshot`, and `marker` commands that depend only on
   already-existing Map infrastructure.
2. **[Part 02 — Evidence-based views + starter markers](./plan-a-02.md)** —
   Add marker definitions to starter `delivery.yaml` and `reliability.yaml`,
   ship `evidence`, `readiness`, `timeline`, `coverage`, and `practiced`
   commands reading Map's existing evidence query module.
3. **[Part 03 — Health view + drivers expansion](./plan-a-03.md)** — Expand
   `drivers.yaml` to demonstrate multi-driver views, ship the `health` command
   joining snapshot scores, evidence counts, and Summit growth recommendations
   inline.
4. **[Part 04 — Snapshot comments pipeline + voice](./plan-a-04.md)** — Add
   `activity.getdx_snapshot_comments` migration, extend Map's GetDX extract
   with `snapshots.comments.list`, add the transform step and the new query
   module, ship `fit-landmark voice` with both `--manager` and `--email`
   modes.
5. **[Part 05 — Initiatives pipeline + initiative commands](./plan-a-05.md)** —
   Add `activity.getdx_initiatives` migration, extend Map's GetDX extract with
   Initiatives API, add the transform step and new query module, ship
   `fit-landmark initiative list|show|impact`, including the before/after
   snapshot score delta computation.
6. **[Part 06 — Documentation, skill, and starter template](./plan-a-06.md)** —
   Update `website/landmark/index.md`, add `website/docs/internals/landmark/`,
   ship `.claude/skills/fit-landmark/SKILL.md` (published skill for external
   users), update `CLAUDE.md` if needed, and refresh the spec 080 STATUS entry.
