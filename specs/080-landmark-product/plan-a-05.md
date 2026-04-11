# Plan A · Part 05 — Initiatives pipeline + initiative commands

Parent plan: [plan-a.md](./plan-a.md). Spec: [spec.md](./spec.md). Depends on
[Part 01](./plan-a-01.md). Independent of Parts 02, 03, 04.

This part adds the `activity.getdx_initiatives` table, extends Map's GetDX
extract/transform pipeline to populate it from the GetDX Initiatives API,
exports a new query module, and ships `fit-landmark initiative list|show|impact`.

Structurally identical to Part 04 but for the initiatives table. The impact
command is the novel piece: it joins initiative completion dates against
`getdx_snapshot_team_scores` across before/after snapshots to compute
percentile deltas.

## Scope

**In scope**

- New migration creating `activity.getdx_initiatives` with the columns spec
  § Data Contracts enumerates.
- Extend Map's GetDX extract with an Initiatives API fetch.
- Add `transformInitiatives` and wire into `transformAllGetDX`.
- New query module `products/map/src/activity/queries/initiatives.js`
  exporting `listInitiatives`, `getInitiative`, and `getInitiativeImpact`.
- Subpath export entry in `products/map/package.json`.
- Landmark: `initiative list`, `initiative show`, `initiative impact`
  subcommands on a single `initiative` command file.
- Tests for extract, transform, query, and the three Landmark subcommands.

**Out of scope**

- Extending the health view to show active initiatives inline — the spec
  mentions this (§ Initiative tracking) but it's a small additive formatter
  change that can follow in Part 06 as a polish, or in a separate small PR.
  Keeping it out of this part reduces the diff size and keeps the initiative
  command self-contained.
- Any write path to initiatives (Landmark is read-only).
- Driver linking UI changes beyond what the schema requires.

## Files

### Created

```
products/map/supabase/migrations/
  <next-sequence>_getdx_initiatives.sql

products/map/src/activity/queries/
  initiatives.js

products/map/test/activity/
  transform-getdx-initiatives.test.js
  query-initiatives.test.js

products/landmark/src/commands/
  initiative.js

products/landmark/src/formatters/
  initiative.js

products/landmark/test/
  initiative.test.js
```

### Modified

- `products/map/supabase/functions/_shared/activity/extract/getdx.js` — add
  `extractInitiatives` helper and call it once per extract (not per
  snapshot, since initiatives are org-scoped in GetDX).
- `products/map/supabase/functions/_shared/activity/transform/getdx.js` —
  add `transformInitiatives` and call it from `transformAllGetDX`; update
  the return shape to include `initiatives: number`.
- `products/map/package.json` — add
  `"./activity/queries/initiatives": "./src/activity/queries/initiatives.js"`.
- `products/landmark/bin/fit-landmark.js` — wire `runInitiativeCommand`.
- `products/landmark/src/formatters/index.js` — register initiative
  formatter.

## Implementation details

### Migration

Schema follows spec § Data Contracts:

```sql
create table if not exists activity.getdx_initiatives (
  id text primary key,
  name text not null,
  description text,
  scorecard_id text,
  owner_email text references activity.organization_people(email) on delete set null,
  due_date date,
  priority text,
  passed_checks integer,
  total_checks integer,
  completion_pct numeric,
  tags jsonb,
  completed_at timestamptz,
  raw jsonb,
  inserted_at timestamptz not null default now()
);

create index if not exists idx_getdx_initiatives_owner
  on activity.getdx_initiatives(owner_email);
create index if not exists idx_getdx_initiatives_completed_at
  on activity.getdx_initiatives(completed_at);
create index if not exists idx_getdx_initiatives_scorecard
  on activity.getdx_initiatives(scorecard_id);
```

Notes:

- `completed_at` is added beyond the spec's enumeration because the impact
  computation needs it as the join key. `due_date` is the scheduled date;
  `completed_at` is derived from GetDX's status transition. If GetDX does
  not expose a completion timestamp, fall back to the first snapshot where
  `completion_pct` reaches 100 (computed at transform time).
- `tags` stored as JSONB for flexibility.
- `scorecard_id` is the join key to `getdx_snapshot_team_scores.item_id`
  — spec says initiatives target drivers through scorecard items, so
  `scorecard_id === driver.id` for linked initiatives. Unlinked
  initiatives (no scorecard) leave this null.

### Extract

```js
async function extractInitiatives(supabase, config) {
  // GetDX Initiatives API endpoint — confirm exact path during
  // implementation. Store the raw response under
  // getdx/initiatives-list/<timestamp>.json for idempotent replay.
  const url = `${config.baseUrl}/initiatives.list`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.apiToken}` },
  });
  if (!response.ok) {
    return { error: `initiatives.list → HTTP ${response.status}` };
  }
  const payload = await response.json();
  await storeDocument(
    supabase,
    `getdx/initiatives-list/${Date.now()}.json`,
    payload,
  );
  return { ok: true };
}
```

Accumulate errors into the extract's return value; do not fail the whole
extract on an initiatives fetch error.

**Risk:** the spec does not pin the exact GetDX Initiatives API path. The
implementer should cross-reference GetDX docs at implementation time. If
the path is wrong, only this function needs patching — the rest of the
pipeline treats the payload as opaque JSON.

### Transform

`transformInitiatives(supabase)`:

1. List documents under `getdx/initiatives-list/`.
2. Parse the most recent document (initiatives are state-of-the-world, not
   event-sourced — always prefer the latest extract).
3. For each initiative in the array, build an upsert row:
   - `id`, `name`, `description` from the payload.
   - `scorecard_id` from the payload's scorecard field.
   - `owner_email` from the payload's owner field.
   - `due_date`, `priority` from the payload.
   - `passed_checks`, `total_checks`, `completion_pct` from the payload's
     aggregate fields.
   - `tags` as JSONB.
   - `completed_at` from the payload if present, else computed as
     `passed_checks === total_checks && total_checks > 0 ? now() : null`.
   - `raw` = the entire payload entry.
4. Upsert on `id`.
5. Return `{ initiatives: <count>, errors: [...] }`.

### Query module

```js
export async function listInitiatives(supabase, options = {}) {
  let query = supabase
    .from("getdx_initiatives")
    .select("*")
    .order("due_date", { ascending: true });
  if (options.ownerEmail) query = query.eq("owner_email", options.ownerEmail);
  if (options.managerEmail) {
    // Team roster → list of emails → filter by owner_email IN (...)
    const { data: team } = await supabase
      .from("organization_people")
      .select("email")
      .eq("manager_email", options.managerEmail);
    const emails = (team ?? []).map((t) => t.email);
    if (emails.length === 0) return [];
    query = query.in("owner_email", emails);
  }
  if (options.status === "active") query = query.is("completed_at", null);
  if (options.status === "completed") query = query.not("completed_at", "is", null);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getInitiative(supabase, id) {
  const { data, error } = await supabase
    .from("getdx_initiatives")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Core impact computation: for each initiative, find the snapshot
// immediately before completion and the snapshot immediately after, then
// return the score delta on the linked scorecard driver.
export async function getInitiativeImpact(supabase, options = {}) {
  const completed = await listInitiatives(supabase, {
    ...options,
    status: "completed",
  });
  const snapshots = await listSnapshots(supabase);
  // For each completed initiative, find the latest snapshot with
  // scheduled_for <= completed_at (= "before") and the earliest snapshot
  // with scheduled_for > completed_at (= "after").
  const results = [];
  for (const init of completed) {
    const before = [...snapshots]
      .filter((s) => s.scheduled_for <= init.completed_at)
      .sort((a, b) => b.scheduled_for.localeCompare(a.scheduled_for))[0];
    const after = snapshots
      .filter((s) => s.scheduled_for > init.completed_at)
      .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))[0];
    if (!before || !after || !init.scorecard_id) {
      results.push({ initiative: init, before: null, after: null, delta: null });
      continue;
    }
    const beforeScore = await getScoreForItem(supabase, before.snapshot_id, init.scorecard_id);
    const afterScore = await getScoreForItem(supabase, after.snapshot_id, init.scorecard_id);
    results.push({
      initiative: init,
      before: beforeScore,
      after: afterScore,
      delta: beforeScore && afterScore ? afterScore - beforeScore : null,
    });
  }
  return results;
}
```

`getScoreForItem` is a small private helper inside the same module that
queries `getdx_snapshot_team_scores`. It accepts an optional `managerEmail`
to scope to a team when needed.

Note: `listSnapshots` comes from `@forwardimpact/map/activity/queries/snapshots`
— keep the cross-module import.

### Landmark: `initiative` command

One file dispatches three subcommands:

```js
export const needsSupabase = true;

export async function runInitiativeCommand({ args, options, supabase, mapData, format }) {
  const [sub] = args;
  switch (sub) {
    case "list":   return runList({ options, supabase, format });
    case "show":   return runShow({ options, supabase, format });
    case "impact": return runImpact({ options, supabase, mapData, format });
    default:       throw new UsageError("initiative: expected `list`, `show`, or `impact`");
  }
}
```

- `list` → `listInitiatives(supabase, { managerEmail: options.manager })`.
  Empty → `NO_INITIATIVES`. Table-missing error → same empty state.
- `show` → requires `--id`. `getInitiative(supabase, options.id)`. Null →
  `"No initiative found with id ${id}."` empty state.
- `impact` → `getInitiativeImpact(supabase, { managerEmail: options.manager })`.
  Renders per the spec's mocked output (§ Initiative impact, lines 510–541).
  Initiatives with null `scorecard_id` render the "no driver linked" note.

Catch `42P01` errors on the initiatives query and return `NO_INITIATIVES`,
matching Part 04's pattern for `NO_COMMENTS`.

### Formatter

`initiative.js` formatter renders the spec § Initiative impact output
exactly: initiative name, target driver id, before/after percentile, delta,
and any engineer voice quote (deferred — engineer voice is Part 04's
concern; initiatives formatter only renders voice if the view object has a
`voice` field, which Part 06 polish can add later).

## Tests

- `transform-getdx-initiatives.test.js` — feeds mocked
  `getdx/initiatives-list/<ts>.json` into `transformInitiatives`, asserts
  upsert payload, including `completed_at` fallback logic.
- `query-initiatives.test.js` — stubs Supabase query builder, verifies
  filter chaining for `listInitiatives`, `getInitiative`, and especially
  `getInitiativeImpact` (before/after snapshot selection, delta calculation,
  handling of unlinked initiatives).
- `initiative.test.js`:
  - `list` with and without `--manager`.
  - `show` with valid and invalid `--id`.
  - `impact` with a completed initiative that has scorecard alignment (real
    delta), a completed initiative without alignment (null delta), and an
    in-progress initiative (skipped in impact view).
  - `NO_INITIATIVES` empty state for the three subcommands.

## Verification

1. `just migrate` — migration applies cleanly.
2. `fit-map getdx sync` — new extract stores initiatives document.
3. `fit-map activity transform` — new transform step populates the table.
4. `bun test products/map/test/activity` — new tests green.
5. `bun test products/landmark/test` — new tests green.
6. `bun run check` — lint, format, layout, exports.
7. Smoke tests:
   - `bunx fit-landmark initiative list --manager alice@example.com`
   - `bunx fit-landmark initiative show --id <id>`
   - `bunx fit-landmark initiative impact --manager alice@example.com`

## Risks

- **GetDX Initiatives API shape is the primary unknown.** Same mitigation
  as Part 04: the extract stores raw payload; the transform is the only
  layer that parses. Patch the transform if the shape differs.
- **Before/after snapshot selection is sensitive to `completed_at` fidelity.**
  If GetDX does not supply a completion timestamp, the fallback (first
  snapshot at 100%) is imperfect — it may delay the "before" marker by up
  to one quarter. Document this limitation in the formatter output when the
  fallback path is used.
- **`scorecard_id === driver.id` join assumes parity.** Real installations
  may need an explicit mapping layer. This part does not build one; Part 06
  documents the assumption.

## Deliverable

A merged PR that ships `fit-landmark initiative list|show|impact` and the
supporting Map pipeline. Spec § Initiative tracking and § Initiative impact
are fully implemented except for the optional health-view integration,
which is tracked as a Part 06 polish item.
