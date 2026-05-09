# Plan 840-a — Landmark privacy substrate

Implements [spec.md](spec.md) under the architecture in [design-a.md](design-a.md).

## Approach

Land the substrate bottom-up so each layer is independently testable: enable
Supabase Auth in `config.toml`, add the RLS+retention migration and indexes,
introduce the test JWT helper, build the identity resolver, rewrite
`createLandmarkClient` to take a JWT, wire the dispatcher chokepoint, then add
the two new verbs (`fit-landmark sources`, `fit-map people provision`) and
their docs. Existing commands need only the dispatcher rewiring — their query
modules are untouched because RLS clamps results server-side. Each step ends
in a green test command before the next begins.

Libraries used: `@supabase/supabase-js` (`auth.admin.{listUsers,createUser,updateUserById}`), `node:crypto` (HMAC for `signTestToken`).

## Steps

### 1. Enable Supabase Auth in the local stack

`auth.admin.*` and `auth.email()` require the auth service running. The current
`config.toml` has `[auth] enabled = false` — toggle it and add the JWT secret
key.

- **Modified:** `products/map/supabase/config.toml`

```toml
[auth]
enabled = true
site_url = "http://localhost:54321"
jwt_expiry = 3600
enable_signup = false
```

Verify: `bunx fit-map activity start && bunx fit-map activity status` reports
the Auth service `RUNNING`; `MAP_SUPABASE_JWT_SECRET` is exported by
`status --output json` as `jwt_secret`. Patch `products/map/src/commands/activity.js`
`start()` to also export `MAP_SUPABASE_ANON_KEY=${status.anon_key}` and
`MAP_SUPABASE_JWT_SECRET=${status.jwt_secret}` in the same printed block.

### 2. RLS + retention migration

- **Created:** `products/map/supabase/migrations/20260510000000_landmark_rls.sql`

```sql
-- Revoke blanket grants from prior migrations.
REVOKE ALL ON ALL TABLES IN SCHEMA activity FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA activity REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA activity REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- Re-grant SELECT to authenticated on the six RLS'd tables only.
GRANT SELECT ON activity.organization_people, activity.evidence,
  activity.github_artifacts, activity.getdx_snapshot_comments,
  activity.getdx_snapshot_team_scores, activity.getdx_snapshots
  TO authenticated;

ALTER TABLE activity.organization_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity.github_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity.getdx_snapshot_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity.getdx_snapshot_team_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity.getdx_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY landmark_select ON activity.organization_people
  FOR SELECT TO authenticated
  USING (email = (SELECT auth.email()) OR manager_email = (SELECT auth.email()));

CREATE POLICY landmark_select ON activity.github_artifacts
  FOR SELECT TO authenticated
  USING (
    email = (SELECT auth.email()) OR EXISTS (
      SELECT 1 FROM activity.organization_people op
      WHERE op.email = github_artifacts.email
        AND op.manager_email = (SELECT auth.email())
    )
  );

CREATE POLICY landmark_select ON activity.evidence
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM activity.github_artifacts ga
    WHERE ga.artifact_id = evidence.artifact_id
  ));

CREATE POLICY landmark_select ON activity.getdx_snapshot_comments
  FOR SELECT TO authenticated
  USING (
    email = (SELECT auth.email()) OR EXISTS (
      SELECT 1 FROM activity.organization_people op
      WHERE op.email = getdx_snapshot_comments.email
        AND op.manager_email = (SELECT auth.email())
    )
  );

CREATE POLICY landmark_select ON activity.getdx_snapshot_team_scores
  FOR SELECT TO authenticated
  USING (getdx_team_id IN (
    SELECT getdx_team_id FROM activity.organization_people
    WHERE email = (SELECT auth.email()) OR manager_email = (SELECT auth.email())
  ));

CREATE POLICY landmark_select ON activity.getdx_snapshots
  FOR SELECT TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_evidence_artifact_id
  ON activity.evidence(artifact_id);
CREATE INDEX IF NOT EXISTS idx_github_artifacts_email
  ON activity.github_artifacts(email);

-- Retention metadata.
COMMENT ON TABLE activity.organization_people IS '';
COMMENT ON TABLE activity.evidence IS
  'retention.window=P180D retention.clock=created_at';
COMMENT ON TABLE activity.github_artifacts IS
  'retention.window=P180D retention.clock=occurred_at';
COMMENT ON TABLE activity.getdx_snapshot_comments IS
  'retention.window=P730D retention.clock=timestamp';
COMMENT ON TABLE activity.getdx_snapshot_team_scores IS
  'retention.window=P730D retention.clock=imported_at';
COMMENT ON TABLE activity.getdx_snapshots IS
  'retention.window=P730D retention.clock=imported_at';

DO $$
DECLARE
  rec RECORD;
  blob TEXT;
BEGIN
  FOR rec IN
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'activity' AND c.relname IN
      ('organization_people','evidence','github_artifacts',
       'getdx_snapshot_comments','getdx_snapshot_team_scores','getdx_snapshots')
  LOOP
    blob := obj_description(format('activity.%I', rec.relname)::regclass, 'pg_class');
    -- Validate tokens; null-window allowed (organization_people only).
    PERFORM activity._validate_retention_blob(rec.relname, blob);
  END LOOP;
END $$;
```

A companion `_validate_retention_blob(relname, blob)` PL/pgSQL function lives
in the same migration above the `DO` block; it parses
`retention.window=<P\d+[DWMY]>` and `retention.clock=<col>`, verifies the
column exists in `information_schema.columns`, and `RAISE EXCEPTION` on any
malformed input. Function body is short (≤30 lines) — bundle in this
migration, not a separate file.

Verify: `bunx fit-map activity migrate` succeeds; `bun test products/map/test/activity/migration-rls.test.js` (added in step 8) passes; `psql` shows `relrowsecurity = true` on all six tables and the per-table `COMMENT` blobs round-trip.

### 3. Test JWT helper

- **Created:** `products/landmark/test/lib/sign-test-token.js`

```js
import { createHmac } from "node:crypto";
import { randomUUID } from "node:crypto";

const b64url = (b) => Buffer.from(b).toString("base64url");

export function signTestToken({ email, secret = process.env.MAP_SUPABASE_JWT_SECRET, ttlSeconds = 900 }) {
  if (!secret) throw new Error("signTestToken: MAP_SUPABASE_JWT_SECRET not set");
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({
    role: "authenticated", aud: "authenticated",
    email, sub: randomUUID(), iss: "supabase",
    iat: now, exp: now + ttlSeconds,
  }));
  const sig = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}
```

Containment: never imported from `products/landmark/src/`. Step 8 adds a
guard test that greps `src/` for the helper path.

Verify: `bun test products/landmark/test/lib/sign-test-token.test.js` (added in step 8) decodes the token and asserts the claim shape.

### 4. Identity resolver

- **Created:** `products/landmark/src/lib/identity.js`

```js
export class IdentityUnresolvedError extends Error {
  constructor(reason) {
    super(`Authentication required: ${reason}`);
    this.code = "LANDMARK_IDENTITY_UNRESOLVED";
  }
}

export function resolveIdentity(env = process.env) {
  const jwt = env.LANDMARK_AUTH_TOKEN;
  if (!jwt) throw new IdentityUnresolvedError(
    "LANDMARK_AUTH_TOKEN is not set. The Landmark CLI requires an authenticated caller — see `fit-landmark` --help for the issuance flow follow-up."
  );
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new IdentityUnresolvedError("LANDMARK_AUTH_TOKEN is not a JWT");
  let claims;
  try { claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")); }
  catch { throw new IdentityUnresolvedError("LANDMARK_AUTH_TOKEN payload is not valid JSON"); }
  if (!claims.email) throw new IdentityUnresolvedError("LANDMARK_AUTH_TOKEN missing email claim");
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now())
    throw new IdentityUnresolvedError("LANDMARK_AUTH_TOKEN is expired");
  return { email: claims.email, jwt };
}
```

Note: signature verification is the database's job (Postgres rejects bad
signatures during the request). The resolver only fails fast on missing or
malformed tokens to satisfy criterion 3b's "no query before error" property.

Verify: `bun test products/landmark/test/lib/identity.test.js` (added in step 8) — covers missing, malformed, expired, no-email, and happy paths.

### 5. Authenticated Supabase client

- **Modified:** `products/landmark/src/lib/supabase.js`

```js
import { createClient } from "@supabase/supabase-js";

export class SupabaseUnavailableError extends Error {
  constructor(reason) {
    super(`Supabase connection unavailable: ${reason}`);
    this.code = "LANDMARK_SUPABASE_UNAVAILABLE";
  }
}

export function createLandmarkClient({ jwt, url = process.env.MAP_SUPABASE_URL,
    anonKey = process.env.MAP_SUPABASE_ANON_KEY, schema = "activity" } = {}) {
  if (!url || !anonKey) throw new SupabaseUnavailableError(
    "MAP_SUPABASE_URL / MAP_SUPABASE_ANON_KEY not set. Run `fit-map activity start` and export the URL + anon key it prints."
  );
  if (!jwt) throw new SupabaseUnavailableError("missing JWT — resolveIdentity must run first");
  return createClient(url, anonKey, {
    db: { schema },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

export function isRelationNotFoundError(err) {
  return err?.code === "42P01" || err?.message?.includes("42P01");
}
```

Criterion 3a chokepoint: no `MAP_SUPABASE_SERVICE_ROLE_KEY` reference remains.

Verify: `grep -r MAP_SUPABASE_SERVICE_ROLE_KEY products/landmark/src/` returns no matches; `bun test products/landmark/test/lib/supabase.test.js` (added in step 8).

### 6. Dispatcher rewiring

- **Modified:** `products/landmark/src/lib/context.js`

```js
import { loadMapData, resolveFormat } from "./cli.js";
import { createLandmarkClient } from "./supabase.js";

export async function buildContext({ dataDir, options, needsSupabase, identity }) {
  const mapData = await loadMapData(dataDir);
  const supabase = needsSupabase ? createLandmarkClient({ jwt: identity.jwt }) : null;
  const format = resolveFormat(options);
  return { mapData, supabase, format, options, identity };
}
```

- **Modified:** `products/landmark/bin/fit-landmark.js`

In the `main()` flow, immediately before `buildContext`:

```js
let identity = null;
if (entry.needsSupabase) {
  try { identity = resolveIdentity(); }
  catch (e) {
    if (e.code === "LANDMARK_IDENTITY_UNRESOLVED") {
      cli.error(e.message);
      process.exit(4);
    }
    throw e;
  }
}
const ctx = await buildContext({ dataDir, options: values, needsSupabase: entry.needsSupabase, identity });
```

Adds `resolveIdentity` import from `../src/lib/identity.js`. The `marker`
command keeps `needsSupabase: false` and skips identity resolution.

Verify: `bun test products/landmark/test/cli-command.test.js` after extending it
(step 8) to cover exit codes 0 (marker, no token), 4 (any other command, no
token), 3 (Supabase unavailable). Manually: `LANDMARK_AUTH_TOKEN= fit-landmark
voice --email a@b` exits 4 with the auth message; `fit-landmark marker x` runs.

### 7. New verbs

#### 7a. `fit-landmark sources`

- **Created:** `products/landmark/src/commands/sources.js`

```js
import { EMPTY_STATES } from "../lib/empty-state.js";

export const needsSupabase = true;

const SOURCE_CLASSES = [
  { id: "organization_people", label: "Profile (organization_people)",
    keyResolver: async (s, e) => ({ table: "organization_people", filter: q => q.eq("email", e) }) },
  { id: "evidence", label: "Evidence",
    keyResolver: async (s, e) => ({ table: "evidence",
      select: "*,github_artifacts!inner(email)", filter: q => q.eq("github_artifacts.email", e) }) },
  { id: "github_artifacts", label: "GitHub artifacts",
    keyResolver: async (s, e) => ({ table: "github_artifacts", filter: q => q.eq("email", e) }) },
  { id: "getdx_snapshot_comments", label: "GetDX comments",
    keyResolver: async (s, e) => ({ table: "getdx_snapshot_comments", filter: q => q.eq("email", e) }) },
  { id: "getdx_snapshot_team_scores", label: "GetDX team scores",
    keyResolver: async (s, e) => {
      const { data } = await s.from("organization_people").select("getdx_team_id").eq("email", e).maybeSingle();
      const t = data?.getdx_team_id;
      if (!t) return null;
      return { table: "getdx_snapshot_team_scores", filter: q => q.eq("getdx_team_id", t) };
    } },
  { id: "getdx_snapshots", label: "GetDX snapshot cycles",
    keyResolver: async (s, e) => {
      const c = await s.from("getdx_snapshot_comments").select("snapshot_id").eq("email", e);
      const t = await s.from("organization_people").select("getdx_team_id").eq("email", e).maybeSingle();
      const teamId = t.data?.getdx_team_id;
      const sc = teamId
        ? await s.from("getdx_snapshot_team_scores").select("snapshot_id").eq("getdx_team_id", teamId)
        : { data: [] };
      const ids = [...new Set([...(c.data ?? []), ...(sc.data ?? [])].map(r => r.snapshot_id))];
      if (ids.length === 0) return null;
      return { table: "getdx_snapshots", filter: q => q.in("snapshot_id", ids) };
    } },
];
```

The handler iterates `SOURCE_CLASSES`, resolves each, runs a `count`+`oldest`
query (asc) and a `newest` query (desc) using the per-class `clock` from
`retention.js`, omits zero-count classes, computes
`falloff = oldest + window` (omitted when `window` is null), and renders.
Empty result set → `meta.emptyState = EMPTY_STATES.NO_SOURCES_FOR_PERSON(email)`.

- **Created:** `products/landmark/src/formatters/sources.js` — text/json/markdown
  exports keyed off `view.classes[]`, mirroring `org.js` formatter shape.
- **Modified:** `products/landmark/src/formatters/index.js` — add `sources`
  import and registry entry.
- **Modified:** `products/landmark/bin/fit-landmark.js` — add to `COMMANDS` map
  (`needsSupabase: true`), add to `commands` array with `--email <e>` option,
  add example, add documentation entry (see step 9).

Verify: `bun test products/landmark/test/sources.test.js` (added in step 8) covers populated, zero, scope-clamped, and falloff cases.

#### 7b. `fit-map people provision`

- **Created:** `products/map/src/commands/people-provision.js`

```js
import { formatHeader, formatSuccess, formatBullet } from "@forwardimpact/libcli";

const BAN_FOREVER = "876000h"; // ≈100 years

async function listAuthUsers(supabase) {
  const out = new Map();
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    for (const u of data.users) out.set(u.email, u);
    if (data.users.length < 1000) break;
    page += 1;
  }
  return out;
}

export async function provision(supabase) {
  process.stdout.write(formatHeader("Provisioning auth.users from organization_people") + "\n\n");
  const { data: roster, error } = await supabase.schema("activity")
    .from("organization_people").select("email");
  if (error) throw new Error(`organization_people: ${error.message}`);
  const rosterEmails = new Set(roster.map(r => r.email));
  const authUsers = await listAuthUsers(supabase);

  let created = 0, restored = 0, banned = 0, unchanged = 0;
  for (const email of rosterEmails) {
    const existing = authUsers.get(email);
    if (!existing) {
      const { error } = await supabase.auth.admin.createUser({ email, email_confirm: true });
      if (error) throw new Error(`createUser ${email}: ${error.message}`);
      created += 1;
    } else if (existing.banned_until && new Date(existing.banned_until) > new Date()) {
      const { error } = await supabase.auth.admin.updateUserById(existing.id, { ban_duration: "none" });
      if (error) throw new Error(`unban ${email}: ${error.message}`);
      restored += 1;
    } else {
      unchanged += 1;
    }
  }
  for (const [email, user] of authUsers) {
    if (rosterEmails.has(email)) continue;
    if (user.banned_until && new Date(user.banned_until) > new Date()) continue;
    const { error } = await supabase.auth.admin.updateUserById(user.id, { ban_duration: BAN_FOREVER });
    if (error) throw new Error(`ban ${email}: ${error.message}`);
    banned += 1;
  }

  process.stdout.write(formatBullet(`created: ${created}`, 0) + "\n");
  process.stdout.write(formatBullet(`restored: ${restored}`, 0) + "\n");
  process.stdout.write(formatBullet(`decommissioned: ${banned}`, 0) + "\n");
  process.stdout.write(formatBullet(`unchanged: ${unchanged}`, 0) + "\n");
  process.stdout.write("\n" + formatSuccess("Reconciliation complete") + "\n");
  return 0;
}
```

The auth admin API requires a service-role-keyed client; the existing
`createMapClient` already provides that. The provisioning client needs the
*top-level* client (not schema-scoped to `activity`) so `auth.admin.*` works —
the function uses `supabase.schema("activity").from(...)` to query
organization_people while keeping `auth.admin.*` accessible on the root
client. `createMapClient` returns a client scoped to `activity`; for this
verb pass `{ schema: "public" }` from the dispatcher so `schema("activity")`
restores activity for the roster query.

- **Modified:** `products/map/bin/fit-map.js` `dispatchPeople` switch and the
  `commands[].args` description for `people` (`<validate|push|provision> [file]`).
  New case:

```js
case "provision": {
  const supabase = await mapClient({ ...values, schema: "public" });
  const { provision } = await import("../src/commands/people-provision.js");
  return provision(supabase);
}
```

Verify: `bun test products/map/test/activity/people-provision.test.js` (added in step 8) covers create / idempotent re-run / decommission / re-add lifecycle, asserting `id` stability across the no-op and re-add paths.

### 8. Tests

Create or extend the following test files. Each has its own `bun test` target;
all are run by the existing top-level `bun run test`.

| New / extended | Coverage |
| --- | --- |
| `products/map/test/activity/migration-rls.test.js` (new) | criterion 1 (`pg_class.relrowsecurity`); criterion 2 anon zero-rows; retention `COMMENT` round-trip; index existence; criterion 6 (mutate one `COMMENT`, re-read via `retention.js`). |
| `products/map/test/activity/rls-scope.test.js` (new) | criterion 2/4 — three callers (engineer A, manager M with reports A+B, engineer C under M'≠M) hit each of the six tables; assert per-row-class admit/deny matrix. Uses `signTestToken` to mint per-caller JWTs. |
| `products/map/test/activity/people-provision.test.js` (new) | criterion 10/11 — seeds N rows, runs `provision`, asserts `auth.admin.listUsers()` returns N matching active users; second run is no-op (count, ids, active state unchanged); remove → run → A is banned; second remove run no-op; re-add → A active again with same id. |
| `products/landmark/test/lib/identity.test.js` (new) | resolver branches (missing, malformed, expired, no email, happy). |
| `products/landmark/test/lib/sign-test-token.test.js` (new) | helper round-trips header+claims; signature is HMAC-SHA256 over `MAP_SUPABASE_JWT_SECRET`. |
| `products/landmark/test/lib/supabase.test.js` (new) | `createLandmarkClient` fails fast on missing url/anon/jwt; sets the `Authorization` header. |
| `products/landmark/test/lib/no-service-role-in-src.test.js` (new) | criterion 3a: greps `products/landmark/src/` for `MAP_SUPABASE_SERVICE_ROLE_KEY` and `auth.admin.` — both must be zero. Greps `products/landmark/src/` for `sign-test-token` — must be zero. |
| `products/landmark/test/cli-command.test.js` (extended) | criterion 3b — invoking `voice` with no `LANDMARK_AUTH_TOKEN` exits 4, errors before any Supabase call (assert via spy that records `from()`/`rpc()` invocations). marker command exits 0 with no token. |
| `products/landmark/test/sources.test.js` (new) | criterion 5 — populated classes appear with five fields; zero-count classes omitted; criterion 6 retention mutation reflected; criterion 7 — out-of-scope email returns `NO_SOURCES_FOR_PERSON`. |
| `products/landmark/test/regression-scope.test.js` (new) | criterion 9 — for each of `voice`, `evidence`, `readiness`, `coverage`, `timeline`, capture pre-change row sets via the existing fixtures, then re-run under an Engineer-scope JWT bound to the fixture self; assert row-set equality. |
| `products/map/test/activity/integration.test.js` (extended) | criterion 8 — end-to-end seed → migrate → `activity verify` passes against the migrated schema. |
| `products/landmark/test/empty-state.test.js` (extended) | `NO_SOURCES_FOR_PERSON(email)` returns a function whose output includes the email. |

Tests that need a live Postgres use the `bunx fit-map activity start` harness
the integration tests already rely on (`products/map/test/activity/`); pure
unit tests stub the client.

Verify: `bun run test` green; `bun run check` green; `bun run format`.

### 9. Empty state, retention reader, docs

- **Modified:** `products/landmark/src/lib/empty-state.js` — append:

```js
NO_SOURCES_FOR_PERSON: (email) =>
  `No sources retained for ${email} that you can see.`,
```

- **Created:** `products/map/src/activity/retention.js`

```js
const TOKEN = /retention\.(window|clock)=([A-Za-z0-9_]+)/g;

export async function readRetention(supabase, table) {
  if (readRetention._cache?.has(table)) return readRetention._cache.get(table);
  const { data, error } = await supabase.rpc("retention_blob", { p_table: table });
  if (error) throw new Error(`readRetention: ${error.message}`);
  const blob = data ?? "";
  const out = { window: null, clock: null };
  for (const m of blob.matchAll(TOKEN)) out[m[1]] = m[2];
  if (!readRetention._cache) readRetention._cache = new Map();
  readRetention._cache.set(table, out);
  return out;
}

export function clearRetentionCache() { readRetention._cache?.clear(); }
```

`retention_blob(p_table)` is a tiny SQL helper added by the migration in
step 2 returning `obj_description(format('activity.%I', p_table)::regclass, 'pg_class')`
— callable by both `service_role` and `authenticated`.

- **Created:** `websites/fit/docs/products/engineering-data-sources/index.md` —
  engineer-facing guide to `fit-landmark sources --email <self>`. Covers the
  retained classes, retention windows, fall-off semantics ("projection, not
  guarantee of deletion"), and the auth prerequisite.
- **Created:** `websites/fit/docs/products/provisioning-engineers/index.md` —
  operator-facing guide to `fit-map people provision`. Covers the operator
  credential boundary (service-role required), idempotency, decommissioning
  semantics, and the engineer-side login follow-up.
- **Modified:** `.claude/skills/fit-landmark/SKILL.md` — add the
  `engineering-data-sources` link to `## Documentation` (matching ordering in
  CLI `documentation[]`).
- **Modified:** `.claude/skills/fit-map/SKILL.md` — add the
  `provisioning-engineers` link.
- **Modified:** `products/landmark/bin/fit-landmark.js` `definition.documentation` — add the same entry.
- **Modified:** `products/map/bin/fit-map.js` `definition.documentation` — add the same entry.

Verify: `bun run context:fix` regenerates catalog rows; `bun run check` is green.

### 10. Final integration sweep

Run the full sequence end-to-end against a fresh local stack to surface any
plan gaps before the panel:

```sh
bunx fit-map activity stop || true
bunx fit-map activity start
bunx fit-map activity seed --data ./data
bunx fit-map people provision
LANDMARK_AUTH_TOKEN=$(node -e 'import("./products/landmark/test/lib/sign-test-token.js").then(m=>process.stdout.write(m.signTestToken({email:"alice@example.com"})))') \
  bunx fit-landmark sources --email alice@example.com
bun run test
bun run check
```

Verify: each command exits 0; `sources` output lists at least three
populated classes with falloff dates; `bun run test` and `bun run check` are
green.

## Risks

| Risk | Why it's not visible from the plan | Mitigation |
| --- | --- | --- |
| `[auth] enabled = true` requires `supabase` CLI to pull the GoTrue Auth image; first-run is slow on CI runners with cold caches. | First-time activation under `bunx fit-map activity start`. | Step 10 sweep timeboxes the cold start; CI workflow already caches `~/.supabase`. If it bites, add an explicit `auth.image` pin in `config.toml`. |
| `auth.email()` returns `NULL` when the JWT is signed but the email claim is absent or the Postgres GUC `request.jwt.claims` is unset under direct `psql` connections (test harness path). | RLS test fixtures will silently return zero rows under a `psql` connection that does not set `request.jwt.claims`. | The `rls-scope.test.js` fixture goes through the PostgREST endpoint with `Authorization: Bearer <jwt>`, not raw `psql`. Documented in the test file header. |
| `get_team` with `SECURITY INVOKER` + RLS bottoms out at depth 1 — grand-reports drop. Pre-change Manager queries that walked the full subtree shrink to direct reports. | Behavior is intentional per design's behavior-changes table, but downstream consumers (`org team --manager`, `practice --manager`, etc.) may have callers depending on transitive walks. | Captured by criterion 9 regression test for `--email` paths and called out in the design's behavior-changes table for `--manager` paths; release notes must surface the change. |
| `auth.admin.listUsers()` paginates at 50 by default; `876000h` is parsed by `gotrue` as ≈100 years, but the parser is undocumented for values >`8760h` in older releases. | Supabase JS client masks the round-trip detail. | Pin `@supabase/supabase-js` ≥ 2.105 (already present); `people-provision.test.js` asserts the resulting `banned_until` parses as a timestamp >50 years in the future. |
| Migration runs against schemas that have already been seeded with non-attributed `getdx_snapshot_comments` (`email IS NULL`) rows — those become invisible to all `authenticated` callers (intentional per design), but downstream aggregations may produce numbers that no longer match pre-change. | Behavior change is intentional per design but quietly affects rollups. | Plain-text bullet in PR body; criterion 9 test catches mismatches against pre-change fixtures. |
| `fit-codegen --all` regenerates proto stubs; this slice does not touch protos but a stale `generated/` checkout could mask a breakage. | Codegen runs at SessionStart but worktrees can skip it (per recurring pattern in staff-engineer summary). | Step 10 sweep runs `bun run check` which transitively requires generated artifacts; failure mode is loud. |

## Execution

Sequential — every step depends on the prior. Step 10 is the only step that
could parallelize, but it is purely verification.

Single agent: `staff-engineer` via `kata-implement`. No part of this plan is
better routed to `technical-writer` because the doc pages in step 9 are
tightly coupled to the CLI surface introduced in step 7 — splitting risks
drift between CLI `documentation[]` and skill `## Documentation`. TW remains
the right reviewer post-merge for prose polish.

— Staff Engineer 🛠️
