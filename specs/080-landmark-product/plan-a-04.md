# Plan A · Part 04 — Snapshot comments pipeline + voice command

Parent plan: [plan-a.md](./plan-a.md). Spec: [spec.md](./spec.md). Depends on
[Part 01](./plan-a-01.md). Independent of Parts 02, 03, 05.

This part adds the `activity.getdx_snapshot_comments` table, extends Map's
GetDX extract/transform pipeline to populate it, exports a new query module
from Map, and ships the `fit-landmark voice` command. It also replaces the
Part 03 placeholder inside the `health` command with a real comment fetch.

Touches **both** Map and Landmark — this is intentional: the feature is only
verifiable end-to-end when migration + extract + transform + query + CLI all
land together.

## Scope

**In scope**

- New migration creating `activity.getdx_snapshot_comments` with the columns
  spec § Data Contracts enumerates.
- Extend
  `products/map/supabase/functions/_shared/activity/extract/getdx.js` to
  call `snapshots.comments.list` for each snapshot in the current extract
  loop.
- Extend `.../transform/getdx.js` with `transformSnapshotComments` and wire
  it into `transformAllGetDX`.
- New query module `products/map/src/activity/queries/comments.js`
  exporting `getSnapshotComments`, with matching subpath entry in
  `products/map/package.json`.
- Landmark: `voice` command with `--manager` and `--email` modes.
- Landmark: update `src/commands/health.js` to fetch comments for each
  driver-aligned contributor and render them inline, replacing Part 03's
  placeholder.
- Tests for the new extract path, transform, query, Landmark voice command,
  and the updated health command.

**Out of scope**

- Initiatives pipeline (Part 05).
- Theme analysis beyond a simple frequency bucket — the spec mock-ups show
  theme counts, which this part implements by grouping on
  case-insensitive keyword matches of a short stop-listed noun-phrase set.
  Anything more sophisticated is deferred.

## Files

### Created

```
products/map/supabase/migrations/
  <next-sequence>_getdx_snapshot_comments.sql

products/map/src/activity/queries/
  comments.js

products/map/test/activity/
  transform-getdx-comments.test.js
  query-comments.test.js

products/landmark/src/commands/
  voice.js

products/landmark/src/formatters/
  voice.js

products/landmark/test/
  voice.test.js
```

### Modified

- `products/map/supabase/functions/_shared/activity/extract/getdx.js` — add
  `extractSnapshotComments` helper and invoke it once per snapshot inside
  the existing loop.
- `products/map/supabase/functions/_shared/activity/transform/getdx.js` —
  add `transformSnapshotComments` and call it from `transformAllGetDX`;
  update the return shape to include `comments: number`.
- `products/map/package.json` — add
  `"./activity/queries/comments": "./src/activity/queries/comments.js"` to
  `exports`.
- `products/map/test/activity/transform-getdx.test.js` — extend to cover
  the new counts field or leave untouched if existing assertions don't
  pin the shape; add new test file for the comments path.
- `products/landmark/bin/fit-landmark.js` — wire `runVoiceCommand` into
  `COMMANDS`.
- `products/landmark/src/commands/health.js` — replace the
  "comments surface once Part 04 lands" placeholder with the real fetch.
- `products/landmark/src/formatters/health.js` — render the fetched
  comments per driver.
- `products/landmark/test/health.test.js` — add an assertion that
  comments render when present.

## Implementation details

### Migration

Name: `<next-sequence>_getdx_snapshot_comments.sql`. Look at existing
files under `products/map/supabase/migrations/` for the numbering
convention (the current activity schema is `20250101000000_activity_schema.sql`
— follow whatever date prefix pattern newer migrations use).

Schema:

```sql
create table if not exists activity.getdx_snapshot_comments (
  comment_id text primary key,
  snapshot_id text not null references activity.getdx_snapshots(snapshot_id) on delete cascade,
  email text references activity.organization_people(email) on delete set null,
  team_id text references activity.getdx_teams(getdx_team_id) on delete set null,
  text text not null,
  timestamp timestamptz not null,
  raw jsonb,
  inserted_at timestamptz not null default now()
);

create index if not exists idx_getdx_snapshot_comments_snapshot
  on activity.getdx_snapshot_comments(snapshot_id);
create index if not exists idx_getdx_snapshot_comments_email
  on activity.getdx_snapshot_comments(email);
create index if not exists idx_getdx_snapshot_comments_team
  on activity.getdx_snapshot_comments(team_id);
```

Decisions:

- `comment_id` uses whatever stable id GetDX returns per comment; if GetDX
  does not provide a stable id, fall back to `${snapshot_id}::${email}::${timestamp}`
  concatenation computed at transform time. Extract stores the raw response
  verbatim; transform handles id synthesis.
- `email` is nullable because anonymous responses are possible; the
  Landmark `--email` filter ignores null rows.
- `team_id` is derived at transform time by looking up the respondent's
  current team in `getdx_teams` (via manager-email join).
- `inserted_at` mirrors existing activity tables' idempotency column.

### Extract extension

Inside the existing loop that iterates `snapshots.list`, after fetching
`snapshots.info`, call `/snapshots.comments.list?snapshot_id=<id>` and
store the response to `getdx/snapshots-comments/<snapshot_id>.json`. Handle
rate limiting with the existing retry helper if present.

```js
async function extractSnapshotComments(supabase, config, snapshotId) {
  const url = `${config.baseUrl}/snapshots.comments.list?snapshot_id=${encodeURIComponent(snapshotId)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.apiToken}` },
  });
  if (!response.ok) {
    return { error: `snapshots.comments.list ${snapshotId} → HTTP ${response.status}` };
  }
  const payload = await response.json();
  await storeDocument(supabase, `getdx/snapshots-comments/${snapshotId}.json`, payload);
  return { ok: true };
}
```

(Use the existing `storeDocument` helper Map already uses for raw
responses.) Accumulate errors into the extract's `errors` array; do not
fail the whole extract on a single comment fetch.

### Transform

Add `transformSnapshotComments(supabase)` to `.../transform/getdx.js`:

1. List all documents under `getdx/snapshots-comments/`.
2. For each document, parse the array of comments.
3. For each comment, derive:
   - `comment_id` from the raw payload if present, else
     `${snapshotId}::${email ?? "anon"}::${timestamp}`.
   - `email`, `text`, `timestamp` from the payload.
   - `team_id` by looking up `organization_people(email)` → manager_email,
     then `getdx_teams` where `manager_email` matches. If no match, leave
     `team_id` null.
4. Upsert into `activity.getdx_snapshot_comments` with `on conflict
   (comment_id) do update`.
5. Return `{ comments: <count>, errors: [...] }`.

Wire into `transformAllGetDX`:

```js
const commentsResult = await transformSnapshotComments(supabase);
return {
  teams,
  snapshots,
  scores,
  comments: commentsResult.comments,
  errors: [...teams.errors, ..., ...commentsResult.errors],
};
```

### Query module

`products/map/src/activity/queries/comments.js`:

```js
export async function getSnapshotComments(supabase, options = {}) {
  let query = supabase
    .from("getdx_snapshot_comments")
    .select("*, getdx_snapshots(scheduled_for)")
    .order("timestamp", { ascending: false });
  if (options.snapshotId) query = query.eq("snapshot_id", options.snapshotId);
  if (options.email) query = query.eq("email", options.email);
  if (options.managerEmail) {
    // Filter via getdx_teams where manager_email matches.
    // First look up the team id, then filter.
    const { data: teams } = await supabase
      .from("getdx_teams")
      .select("getdx_team_id")
      .eq("manager_email", options.managerEmail);
    const teamIds = (teams ?? []).map((t) => t.getdx_team_id);
    if (teamIds.length === 0) return [];
    query = query.in("team_id", teamIds);
  }
  if (options.driverId) {
    // Optional future filter — unused in Part 04, reserved for Part 03's
    // per-driver comment pulling when GetDX exposes driver-tagged comments.
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
```

Decision: the manager-to-team resolution happens inside the query for
ergonomic reasons (one helper, one semantic). If profiling later shows this
is hot, the resolution can move into a cached lookup.

Add the exports entry:

```json
"./activity/queries/comments": "./src/activity/queries/comments.js"
```

### Landmark: `voice` command

Signature:

```
fit-landmark voice --manager <email>
fit-landmark voice --email <email>
```

Handler:

```js
export const needsSupabase = true;

export async function runVoiceCommand({ options, supabase, mapData, format }) {
  if (options.email) return runEmailVoice({ email: options.email, supabase, mapData, format });
  if (options.manager) return runManagerVoice({ managerEmail: options.manager, supabase, mapData, format });
  throw new UsageError("voice: one of --email or --manager is required");
}
```

`runEmailVoice` fetches `getSnapshotComments(supabase, { email })`, sorts by
snapshot `scheduled_for` DESC, limits to the last 4 snapshots. Pulls
evidence counts via `getEvidence(supabase, { email })` and joins them into
a "Context from evidence" section matching spec § Engineer voice.

`runManagerVoice` fetches comments for the manager's team via
`{ managerEmail }`. Groups by a lightweight theme bucket (simple
substring-match against a small curated list: `estimation`, `incident`,
`planning`, `handoff`, `onboarding`, `deploy`, `runbook`). Returns top N
themes with comment counts and representative snippets. Also fetches driver
scores from the latest snapshot and surfaces the "aligned with health
signals" footer when a theme aligns with a poorly-scoring driver.

Theme bucketing is intentionally crude. Anything smarter is an LLM call,
which spec § Out of Scope forbids.

Empty paths:

- Comments table does not exist yet (query throws a "relation not found"
  error) → catch and return `NO_COMMENTS` empty state. This handles the
  case where the migration has not been applied locally.
- No comments matching filter → `NO_COMMENTS` empty state with a specific
  message: "No snapshot comments found for scope."

Add `NO_COMMENTS_FOR_SCOPE` to `src/lib/empty-state.js`.

### Health view integration

Replace the Part 03 placeholder in `src/commands/health.js`:

```js
// Fetch comments once per health render; filter per driver downstream.
let comments = [];
try {
  comments = await getSnapshotComments(supabase, {
    snapshotId: latestSnapshot.snapshot_id,
    managerEmail: options.manager,
  });
} catch (err) {
  if (isRelationNotFoundError(err)) {
    comments = [];
    meta.warnings.push("Snapshot comments unavailable — table not present.");
  } else {
    throw err;
  }
}
```

Attach `comments` to each driver in the view by the same theme-bucket
match used by voice (so "estimation" comments appear under `quality`).
Formatter renders up to 2 comment snippets per driver.

Add `isRelationNotFoundError(err)` to `src/lib/supabase.js` — matches
Postgres error code `42P01` from the underlying client.

## Tests

- `products/map/test/activity/transform-getdx-comments.test.js` — feeds
  mocked `getdx/snapshots-comments/<id>.json` documents into
  `transformSnapshotComments` and asserts the upsert payload. Covers
  id-fallback path, null-email path, team lookup via manager join.
- `products/map/test/activity/query-comments.test.js` — stubs Supabase
  query builder, verifies filter chaining for each option.
- `products/landmark/test/voice.test.js`:
  - `--email` path with comments across 4 snapshots.
  - `--manager` path with themed comments.
  - `--email` with no comments → `NO_COMMENTS_FOR_SCOPE`.
  - `--manager` with table missing → `NO_COMMENTS` (simulate via stub
    throwing a 42P01 error).
  - Missing both flags → `UsageError`.
- `products/landmark/test/health.test.js` — extend with an assertion that
  comments render under driver sections when the stub returns them, and
  that the missing-table path records a warning without failing the
  command.

## Verification

1. `just migrate` (or the repo's local migration runner) against a fresh
   Supabase — migration applies cleanly.
2. `fit-map getdx sync` against a real (or stubbed) GetDX endpoint — new
   extract path stores `snapshots-comments` documents.
3. `fit-map activity transform` — new transform step populates the table
   and the count appears in the CLI's output.
4. `bun test products/map/test/activity` — new and existing tests green.
5. `bun test products/landmark/test` — new and existing tests green,
   including the updated `health.test.js`.
6. `bun run check` — lint, format, layout, exports (confirms the new
   subpath export is wired).
7. Smoke test: `bunx fit-landmark voice --manager alice@example.com`
   returns themed comments; `bunx fit-landmark voice --email
   dan@example.com` returns the per-snapshot timeline with the evidence
   context footer.

## Risks

- **GetDX comments API shape is not fully documented here.** The extract
  stores whatever the endpoint returns; the transform is the only layer
  that parses the shape. If the real shape diverges from what this part
  assumes, adjust only the transform — the rest of the pipeline stays put.
- **`isRelationNotFoundError` error-code matching is client-version
  dependent.** The helper is a single place to patch if `@supabase/supabase-js`
  changes its error shape.
- **Theme bucketing is fragile.** This is deliberate — a richer
  classifier would require LLM calls which the spec forbids. Keep the theme
  keyword list small and obvious; users can read the full list via
  `fit-landmark voice --email` if the manager view's grouping is
  unsatisfactory.

## Deliverable

A merged PR that ships `fit-landmark voice` and completes the `health`
command's engineer-voice section. The `getdx_snapshot_comments` table exists
end-to-end: extract, transform, query, CLI.
