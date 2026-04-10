# 380 — Map Activity Seed: Synthetic-to-Database in One Command

Make it trivial for an internal contributor or agent to go from freshly generated
synthetic data to a fully populated, verified activity database — without manual
field remapping, env-var archaeology, or six sequential CLI invocations.

Builds on [spec 350](../350-map-activity-end-to-end/spec.md) (done), which
delivered the activity CLI surface and end-to-end transforms for external users.
This spec closes the gaps that remain for internal contributors and agents
working with synthetic data.

## Why

A full manual test of the Map activity layer — starting from `just synthetic`
and ending at `fit-map activity verify` — required seven manual interventions
that should have been zero.

### 1. No single command bridges synthetic output to the activity database

After `just synthetic` writes 13,107 raw documents and a roster, the contributor
must manually:

1. Parse `data/activity/roster.yaml` and `data/activity/teams.yaml`
2. Remap field names (`github` → `github_username`)
3. Remap level IDs (`L1` → `J040`, `L2` → `J060`, etc.)
4. Derive `manager_email` from the teams file
5. Write a consolidated `people.yaml` in the format `fit-map people push`
   expects
6. Push people, then run `fit-map activity transform`
7. Run `fit-map activity verify`

Each step requires knowledge of both the synthetic data schema and the activity
layer schema. An agent doing this for the first time spent more time on data
wrangling than on the testing it was trying to do.

### 2. Synthetic entity generator uses level aliases, not canonical IDs

`libraries/libsyntheticgen/engine/entities.js:74` assigns managers
`rng.pick(["L3", "L4", "L5"])`. `activity-roster.js:7` defines
`LEVEL_ORDER = ["L1", "L2", "L3", "L4", "L5"]`. These are aliases for the
framework-defined levels (`J040`–`J100`), but the mapping is never applied. The
roster, per-person YAML files, and all downstream raw documents carry `L1`–`L5`
through to the Supabase load, where `fit-map people validate` rejects every row
with "unknown level".

The DSL already defines the canonical levels:

```
levels {
  J040 { title "Associate Engineer" rank 1 }
  J060 { title "Engineer" rank 2 }
  ...
}
```

The entity generator ignores this mapping when assigning people.

### 3. The service role key is invisible to contributors

`just env-secrets` generates `SERVICE_SECRET`, `JWT_SECRET`, `JWT_ANON_KEY`, and
`DATABASE_PASSWORD`. It does not generate `MAP_SUPABASE_SERVICE_ROLE_KEY`.
Supabase local dev uses a well-known default JWT
(`eyJhbG...EGIM96RAZx35lJzdJsyH...`), but neither `fit-map activity start` nor
`supabase status` prints it. A contributor must know the Supabase default key
convention or read the `@supabase/supabase-js` source to discover the value.

Every `fit-map` activity command that touches the database fails with
"MAP_SUPABASE_SERVICE_ROLE_KEY is not set" until the contributor manually adds
the key to `.env`.

### 4. `fit-universe --load` uses a non-obvious env-var prefix

`fit-universe` calls `createScriptConfig("universe", { SUPABASE_URL: null })`
which resolves environment overrides as `SCRIPT_UNIVERSE_SUPABASE_URL` — not
`MAP_SUPABASE_URL` or `SUPABASE_URL`. The `.env` file contains
`MAP_SUPABASE_URL` and the getting-started guide documents `MAP_SUPABASE_URL`.
A contributor who sets `SUPABASE_URL` in their shell gets "supabaseUrl is
required" with no indication that the prefix should be `SCRIPT_UNIVERSE_`.

### Why this matters

The primary consumers of this workflow are agents and contributors running
`just quickstart` or testing Map changes. Every manual step is a place where an
agent gets stuck, asks a question, or silently produces bad data. The seven-step
workaround discovered during testing took longer than the actual validation work
it was supposed to enable.

## What

### 1. `fit-map activity seed` command

A new `fit-map activity seed` CLI command that populates the activity database
from synthetic data output in a single invocation. Given a running Supabase
instance with migrations applied, the command:

- Reads the synthetic roster (`data/activity/roster.yaml`) and teams
  (`data/activity/teams.yaml`)
- Remaps field names to match the `organization_people` schema
- Resolves canonical level IDs from the framework data directory
- Derives `manager_email` from the teams file
- Pushes the consolidated people roster
- Loads raw documents from `data/activity/raw/` into Supabase Storage (or
  accepts already-loaded documents from `fit-universe --load`)
- Runs all transforms (people, getdx, github)
- Runs `activity verify` and reports the result

The command accepts optional `--data` and `--activity` path overrides but
defaults to the monorepo's `data/` directory structure.

For external users, `fit-map activity seed` is not relevant — they use
`fit-map people push` and real webhook/GetDX data. The seed command is an
internal contributor tool and may be documented only in internal docs
(CONTRIBUTING.md, operations reference).

### 2. Canonical level IDs in the synthetic entity generator

The entity generator must use the level IDs defined in the DSL's `framework {
levels { ... } }` block instead of hardcoded `L1`–`L5` aliases. The DSL already
carries a rank-ordered list of level IDs; the generator should index into that
list by rank when assigning levels to people.

After this change:

- `data/activity/roster.yaml` contains `level: J040` (not `level: L1`)
- Per-person YAML files in `data/activity/raw/people/` contain canonical IDs
- `fit-map people validate` passes without field remapping
- The `LEVEL_ORDER` constant in `activity-roster.js` is derived from the parsed
  framework, not hardcoded

### 3. `env-secrets` generates the Supabase service role key

`scripts/env-secrets.js` must generate `MAP_SUPABASE_SERVICE_ROLE_KEY` using the
same `JWT_SECRET` it already generates for `JWT_ANON_KEY`. The key is a JWT with
`role: "service_role"` and a long expiry, signed with the project's JWT secret.

After `just env-setup`, all `fit-map activity` commands work without manual
key configuration.

### 4. `fit-universe --load` reads `MAP_SUPABASE_URL`

`fit-universe` should resolve its Supabase connection from the same env vars
that `fit-map` uses (`MAP_SUPABASE_URL`, `MAP_SUPABASE_SERVICE_ROLE_KEY`),
falling back to the current `SCRIPT_UNIVERSE_*` prefix for backwards
compatibility.

A contributor who has run `just env-setup` and `fit-map activity start` should
be able to run `fit-universe --load` without setting any additional env vars.

### 5. `just` targets for the full seed workflow

A `just seed` target (or similar) that chains the full workflow:

```
supabase-up → supabase-migrate → synthetic → seed
```

This gives contributors a single command to go from zero to a fully populated
local activity database with synthetic data. The existing `just quickstart`
should include this path when Supabase is available (Docker running), or skip it
gracefully when Docker is not.

## Scope

### In scope

- `products/map/bin/lib/commands/activity.js` — add `seed` subcommand
- `libraries/libsyntheticgen/engine/entities.js` — use canonical level IDs
- `libraries/libsyntheticgen/engine/activity-roster.js` — derive level order
  from framework
- `libraries/libsyntheticrender/render/raw.js` — ensure per-person YAML carries
  canonical IDs (flows from generator fix)
- `scripts/env-secrets.js` — generate `MAP_SUPABASE_SERVICE_ROLE_KEY`
- `libraries/libuniverse/bin/fit-universe.js` — resolve `MAP_SUPABASE_*` env
  vars
- `justfile` — add `seed` target, update `quickstart`
- `website/docs/internals/operations/index.md` — document `seed` workflow
- Tests for the seed command and level-ID resolution

### Out of scope

- External user workflows — `seed` is internal-only
- Changes to the activity database schema
- Changes to the activity transform logic (beyond what commit `5d26430` already
  fixed)
- Synthetic prose generation or DSL syntax changes
- `fit-map people push` or `fit-map activity transform` behaviour for external
  users
- The getting-started leadership guide (external users don't seed)

## Success Criteria

1. **Single command**: After `just supabase-setup && just synthetic`, running
   `bunx fit-map activity seed` populates all activity tables and exits 0.
   No manual env vars, field remapping, or intermediate files required.

2. **Level IDs are canonical**: `grep "level:" data/activity/roster.yaml`
   returns only framework-defined IDs (e.g. `J040`, `J060`). No `L1`–`L5`
   aliases appear in any synthetic output file.

3. **`just env-setup` is sufficient**: After `just env-setup`,
   `MAP_SUPABASE_SERVICE_ROLE_KEY` is present in `.env` and all `fit-map
   activity` commands work.

4. **`fit-universe --load` reads MAP_SUPABASE_URL**: Running
   `fit-universe --load` after `just env-setup` succeeds without setting
   `SCRIPT_UNIVERSE_*` env vars.

5. **Verify passes**: `bunx fit-map activity verify` exits 0 after `seed` with
   non-zero counts in `organization_people`, `github_events`, and
   `getdx_snapshots`.

6. **Existing tests pass**: `bun test` in `products/map` continues to pass. New
   tests cover the seed command's roster-to-people conversion and level-ID
   resolution.

7. **Idempotent**: Running `fit-map activity seed` twice produces the same
   database state. The second run reports the same counts without errors.

## Risks

- **Level ID change is a breaking change for cached synthetic data.** The prose
  cache keys include entity context. If level IDs appear in cache keys, the
  cache may need regeneration after this change. The plan should verify cache key
  independence from level IDs before implementing.

- **`env-secrets` JWT generation must match Supabase's expectations.** The
  generated service role key must use the same JWT claims (`iss`, `role`, `exp`)
  that Supabase validates. The plan should confirm the exact claim structure by
  reading the Supabase config.toml or the Kong auth plugin configuration.

- **`just quickstart` Docker detection.** Detecting whether Docker is running
  must be fast and not produce noisy errors when it isn't. The plan should use
  `docker info` with a short timeout rather than attempting to start Supabase
  and catching the failure.
