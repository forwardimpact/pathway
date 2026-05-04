# Plan 800-A Part 01 — Data Layer + Synthetic Data

## Step 1: Schema migrations

Create three migration files.

**Created:**

- `products/map/supabase/migrations/20250504000001_org_people_getdx_team_id.sql`
- `products/map/supabase/migrations/20250504000002_evidence_not_null.sql`
- `products/map/supabase/migrations/20250504000003_comments_driver_name.sql`

**`20250504000001_org_people_getdx_team_id.sql`:**

```sql
ALTER TABLE activity.organization_people
  ADD COLUMN getdx_team_id TEXT
  REFERENCES activity.getdx_teams(getdx_team_id) ON DELETE SET NULL;

CREATE INDEX idx_org_people_getdx_team
  ON activity.organization_people(getdx_team_id);
```

**`20250504000002_evidence_not_null.sql`:**

```sql
UPDATE activity.evidence SET rationale = 'synthetic' WHERE rationale IS NULL;
UPDATE activity.evidence SET level_id = 'working' WHERE level_id IS NULL;

ALTER TABLE activity.evidence ALTER COLUMN rationale SET NOT NULL;
ALTER TABLE activity.evidence ALTER COLUMN level_id SET NOT NULL;
```

**`20250504000003_comments_driver_name.sql`:**

```sql
ALTER TABLE activity.getdx_snapshot_comments ADD COLUMN driver_name TEXT;
```

**Verify:** `bunx supabase migration list` shows all three; schema matches
design § Data model changes.

---

## Step 2: Manager-scoping query rewrites

Rewrite the broken `getdx_teams.manager_email` chain in two query files.

**Modified:** `products/map/src/activity/queries/snapshots.js`,
`products/map/src/activity/queries/comments.js`

### `snapshots.js` — `getSnapshotScores()` (line 30)

Replace lines 36–47 (`if (options.managerEmail)` block):

```js
if (options.managerEmail) {
  const { data: team } = await supabase.rpc("get_team", {
    root_email: options.managerEmail,
  });
  const emails = (team || []).map((p) => p.email);
  const { data: people } = await supabase
    .from("organization_people")
    .select("getdx_team_id")
    .in("email", emails)
    .not("getdx_team_id", "is", null);
  const teamIds = [...new Set(people.map((p) => p.getdx_team_id))];
  if (teamIds.length === 0) return [];
  query = query.in("getdx_team_id", teamIds);
}
```

### `snapshots.js` — `getItemTrend()` (line 63)

Replace lines 69–78 (`if (options.managerEmail)` block):

```js
if (options.managerEmail) {
  const { data: team } = await supabase.rpc("get_team", {
    root_email: options.managerEmail,
  });
  const emails = (team || []).map((p) => p.email);
  const { data: people } = await supabase
    .from("organization_people")
    .select("getdx_team_id")
    .in("email", emails)
    .not("getdx_team_id", "is", null);
  const teamIds = [...new Set(people.map((p) => p.getdx_team_id))];
  if (teamIds.length === 0) return [];
  query = query.in("getdx_team_id", teamIds);
}
```

### `comments.js` — `getSnapshotComments()` (line 16)

Replace lines 30–38 (`if (options.managerEmail)` block):

```js
if (options.managerEmail) {
  const { data: team } = await supabase.rpc("get_team", {
    root_email: options.managerEmail,
  });
  const emails = (team || []).map((p) => p.email);
  if (emails.length === 0) return [];
  query = query.in("email", emails);
}
```

**Verify:** `bunx fit-landmark voice --manager athena@bionova.example` returns
only comments from Athena's direct reports. `bunx fit-landmark snapshot trend
--item clear_direction --manager athena@bionova.example` returns rows for teams
containing Athena's direct reports only.

---

## Step 3: GetDX sync — `getdx_team_id` population

Extend `transformTeams()` to write `getdx_team_id` back to
`organization_people` for each contributor found in the team data.

**Modified:** `products/map/src/activity/transform/getdx.js`

After the team upsert (line 120), add:

```js
const contributorUpdates = [];
for (const team of teams) {
  const contributors = team.contributors || [];
  for (const contributor of contributors) {
    if (contributor.email) {
      contributorUpdates.push({
        email: contributor.email,
        getdx_team_id: team.id,
      });
    }
  }
}
if (contributorUpdates.length > 0) {
  for (const { email, getdx_team_id } of contributorUpdates) {
    await supabase
      .from("organization_people")
      .update({ getdx_team_id })
      .eq("email", email);
  }
}
```

**Verify:** After `bunx fit-map activity seed`, query
`SELECT email, getdx_team_id FROM activity.organization_people WHERE
getdx_team_id IS NOT NULL` returns rows.

---

## Step 4: `driver_name` capture in comment transform

**Modified:** `products/map/src/activity/transform/getdx.js`

In `transformSnapshotComments()`, line 252 (the row object literal), add:

```js
driver_name: comment.driver_name || null,
```

**Verify:** After `bunx fit-map activity seed`, `getdx_snapshot_comments` rows
with source data containing `driver_name` have non-null values.

---

## Step 5: Unscored-artifact retrieval — team and org scope

**Modified:** `products/map/src/activity/queries/artifacts.js`

In `getArtifacts()`, add after the existing `email` filter (line 20):

```js
if (options.managerEmail) {
  const { data: team } = await supabase.rpc("get_team", {
    root_email: options.managerEmail,
  });
  const emails = (team || []).map((p) => p.email);
  if (emails.length === 0) return [];
  query = query.in("email", emails);
}
```

**Verify:** `getUnscoredArtifacts(supabase, { managerEmail:
"athena@bionova.example" })` returns only artifacts for Athena's team members.

---

## Step 6: Initiative removal

Remove the initiative command group from Landmark, the initiative query module
from Map, and the initiative transform from the GetDX sync.

**Deleted:**

- `products/landmark/src/commands/initiative.js`
- `products/landmark/src/formatters/initiative.js`
- `products/landmark/src/lib/initiative-helpers.js`
- `products/landmark/test/initiative.test.js`
- `products/landmark/test/initiative-helpers.test.js`
- `products/map/src/activity/queries/initiatives.js`
- `products/map/supabase/migrations/20250101000004_getdx_initiatives.sql`

**Modified:**

| File | Change |
|------|--------|
| `products/landmark/bin/fit-landmark.js` | Remove `runInitiativeCommand` import (line 28), `initiative` entry from `COMMANDS` (line 52), and the three `initiative *` entries from `definition.commands` (lines 141–160) |
| `products/landmark/src/formatters/index.js` | Remove `initiativeFormatter` import (line 20) and `initiative: initiativeFormatter` entry (line 34) |
| `products/landmark/src/commands/health.js` | Remove `listInitiatives` import (line 18). Remove `listInitiatives` from the `q` default object (line 46). Remove `fetchInitiatives()` call (line 91), `attachInitiatives()` call (line 92), and both functions `fetchInitiatives` (lines 258–272) and `attachInitiatives` (lines 275–281). Remove `initiatives: []` from driver objects in `buildDriverRows` (line 190) |
| `products/landmark/src/formatters/health.js` | Remove `renderTextInitiatives` (lines 61–68), `renderMdInitiatives` (lines 111–118), `formatInitPct` (lines 34–36). Remove calls to these from `renderTextDriver` (line 83) and `renderMdDriver` (line 129) |
| `products/landmark/src/lib/empty-state.js` | Remove `NO_INITIATIVES` entry (line 22–23) |
| `products/landmark/test/empty-state.test.js` | Remove the assertion referencing `NO_INITIATIVES` (line 37) |
| `products/map/src/activity/transform/getdx.js` | Remove `transformInitiatives()` function (lines 283–346), its call site in `transformAllGetDX()` (lines 65–75), `initiativeCount` variable (line 65), and `initiatives` from the return object (line 78) |

**Verify:** `bunx fit-landmark initiative` exits with "unknown command"
(exit code 2). `bunx fit-landmark health` runs without errors.
`bun test products/landmark/test/` passes.

---

## Step 7: Synthetic data — markers generation

**Modified:** `libraries/libsyntheticprose/src/prompts/pathway/capability.js`

After the `agent.confirmChecklist` instructions (line 72), add:

```js
"  - markers: An object keyed by proficiency level",
`    (${PROFICIENCY_LEVELS.join(", ")}). Each level is an object with:`,
"    - human: Array of 2-4 observable marker strings for human engineers.",
"      Each marker is a short sentence starting with a past-tense verb",
"      (e.g., 'Delivered a small feature end-to-end with minimal rework').",
"    - agent: Array of 1-3 observable marker strings for AI agents",
"      (omit for skills marked isHumanOnly).",
"    Markers describe concrete, observable evidence of skill proficiency",
"    at that level. Higher levels show broader scope and autonomy.",
```

**Verify:** After `bunx fit-terrain generate`, inspect a capability YAML in
`data/pathway/capabilities/` — each skill has a `markers` block. After
`bunx fit-map activity seed`, `bunx fit-landmark marker data_integration`
returns markers. `bunx fit-landmark readiness --email actaeon@bionova.example`
returns a non-empty checklist.
