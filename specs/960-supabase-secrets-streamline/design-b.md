# Design 960-b — Supabase Capability Library

## Rationale (vs design-a)

Design-a treats Supabase as **credentials accessed through `Config`** — every
consumer reads URL/key, then calls `createClient(...)` locally. Design-b adds a
new `libraries/libsupabase/` that **owns the three Supabase JWT mints, the
HS256 verify primitive, and `@supabase/supabase-js` client construction**.
`Config` keeps the spec-required four accessors with the same shape as
`mcpToken()`; consumers prefer the higher-level `createAnonClient(...)` /
`createServiceClient(...)` factories that hide URL+key wiring and the
`auth: {persistSession:false}` defaults.

Net deltas vs design-a:

- New leaf library `libsupabase` (depends on `@supabase/supabase-js` and
  `libsecret`). All three Supabase JWT mints (anon, service-role, per-caller
  `authenticated`) live here, co-located with `verifySupabaseHmac` so payload
  shape and algorithm stay consistent. `libsecret` retains generic
  `generateJWT` and the `.env` helpers.
- A second static-inspection rule forbids `@supabase/supabase-js` imports
  (static **and** dynamic) outside `libsupabase/src/client.js` and the Deno
  edge function. This retires the dynamic `await import("@supabase/supabase-js")`
  at `landmark/src/lib/identity.js:154`.
- The static-inspection rule for `process.env.SUPABASE_*` reads **retains the
  same `libstorage` exemption design-a uses**. design-b does not break the
  pre-existing `libconfig/src → libstorage` import; routing `libstorage` reads
  through a new abstraction is out of this spec's scope.
- `Config`'s four accessors remain the spec § Persona observable; the factories
  are an additional affordance, not a replacement.

## Components

| Component | Where | Role |
| --- | --- | --- |
| `libsupabase` package | `libraries/libsupabase/` (new) | New leaf library. Carries `package.json` (`description`, `keywords` ending in `agent`, `jobs` per `libraries/CLAUDE.md`) and `README.md`; ships no CLI in v1. Runtime deps: `@supabase/supabase-js`. Monorepo deps: `@forwardimpact/libsecret` (for `generateJWT`). Exports: `createAnonClient`, `createServiceClient`, `mintSupabaseAnonKey`, `mintSupabaseServiceRoleKey`, `mintSupabaseJwt`, `verifySupabaseHmac`. |
| `createAnonClient` / `createServiceClient` | `libraries/libsupabase/src/client.js` (new) | Signatures: `createAnonClient({config, jwt, schema, auth})` and `createServiceClient({config, schema})`. `config` is duck-typed: anything exposing the four `supabase*()` accessors — a `Config` instance is the canonical caller; tests pass a stub with the same shape. No `instanceof Config` check (which would force a `libsupabase → libconfig` import); no record-vs-instance polymorphism either. `jwt` sets `global.headers.Authorization = "Bearer <jwt>"`. `schema` is the PostgREST schema. `auth` is an optional pass-through merged over the default `{persistSession: false, autoRefreshToken: false}` — Landmark login passes `{flowType: "pkce", storage: createPkceStorage()}` here. |
| `mintSupabaseAnonKey` / `mintSupabaseServiceRoleKey` / `mintSupabaseJwt` | `libraries/libsupabase/src/jwt.js` (new) | First two: `(jwtSecret) → string`, 10-year `{iss: "supabase", role, iat, exp}` payload — replace the inline anon/service-role payloads at `scripts/env-storage.js:37-79`. `mintSupabaseJwt({email, secret, ttlSeconds}) → string` is the per-caller `role: "authenticated"` mint relocated from `libsecret/src/index.js:167` — signature unchanged, only the import path changes. All three wrap `libsecret.generateJWT` so the HS256 algorithm pin is single-sourced. |
| `verifySupabaseHmac` | `libraries/libsupabase/src/jwt.js` (new) | `(headerPayload, signatureB64Url, secret) → boolean`. Computes HS256 over `headerPayload` and `timingSafeEqual`s against the decoded `signatureB64Url`. Returns `false` on length mismatch or signature mismatch — same two failure modes as today's `products/landmark/src/lib/identity.js:73-83`. The caller throws its own `IdentityUnresolvedError("signature does not verify")` on `false`, preserving today's user-facing message. No `jose` dependency. |
| `Config` Supabase accessors | `libraries/libconfig/src/config.js` (edit) | Adds four method-shaped accessors using `#resolve` per-field, matching `mcpToken()` exactly. Per-field lazy resolution is load-bearing for Decision 8: external `npx fit-landmark login` users have URL + anon but no JWT secret; `supabaseUrl()` must not throw because `SUPABASE_JWT_SECRET` is unset. Credential-set membership: three secrets join `#CREDENTIAL_KEYS`; URL does not (compose interpolation). `libconfig` does not import `libsupabase`. |
| Unified bootstrap script | `scripts/env-setup.js` (new; replaces `scripts/env-secrets.js` + `scripts/env-storage.js`) | Single CLI: generates `SERVICE_SECRET`, `DATABASE_PASSWORD`, `MCP_TOKEN`, `SUPABASE_JWT_SECRET` via `libsecret.getOrGenerateSecret`; derives `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` via `libsupabase.mintSupabase*`; generates **one** `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` pair shared across `STORAGE_TYPE` switches (today's `env-storage.js` writes a distinct pair per backend; collapsing to one is a behavior change called out in Decision 12). All values land in a single `.env`. Retains the `--output <path>` / `--add-mask` flags `env-secrets.js` exposes for CI. |
| `just env-setup` recipe | `justfile` (edit) | One recipe replacing `env-secrets` + `env-storage`. The recipe name is unchanged. |
| `config.toml` `[auth]` block | `products/map/supabase/config.toml` (edit) | Adds new line `jwt_secret = "env(SUPABASE_JWT_SECRET)"` to the existing `[auth]` table. Supabase CLI substitutes at `supabase start` time (documented at `https://supabase.com/docs/guides/cli/config#variable-interpolation`). Rationale + rejected alternatives in Decision 3. |
| `fit-map activity start` | `products/map/src/commands/activity.js` (edit) | Stops printing the `export MAP_SUPABASE_*` block; emits a one-line ready confirmation. The local Supabase stack reads `SUPABASE_JWT_SECRET` via `config.toml`'s `env()` interpolation; no command-side wiring. |
| Docker Compose env passthrough | `docker-compose.yml` (edit) | Four Supabase services (`storage-supabase`, `supabase-db`, `supabase-kong`, `supabase-map-storage`) drop the `env_file: .env.storage.supabase` line, take values from `.env` directly, and rename every `${MAP_SUPABASE_*}` / `${JWT_SECRET}` to the canonical names. Standalone `.env.storage.*` files deleted with `env-storage.js`. |
| `.env.*.example` files | `.env.local.example`, `.env.docker-native.example`, `.env.docker-supabase.example` (edit) | Each lists the same four-variable Supabase block; only `SUPABASE_URL` differs. `MAP_SUPABASE_DB_PORT` is removed. |
| Consumer call sites | 10 files across `services/`, `libraries/`, `products/` (edit) | Each replaces `process.env.MAP_SUPABASE_*` + `createClient(...)` with `libsupabase.createAnonClient(...)` / `createServiceClient(...)` (when constructing a client) or `config.supabase*()` accessors (when reading raw values). Each consumer's `package.json` gains `@forwardimpact/libsupabase` in `dependencies`; `summit` and `libterrain` additionally drop their `optionalDependencies: {"@supabase/supabase-js"}` per Decision 11. |
| Live-Postgres test setup | `products/map/test/activity/{migration-rls,rls-scope,people-provision,auth-issue}.test.js`, `products/map/test/activity/lib/live.js`, `products/landmark/test/{sources,dispatcher}.test.js`, `products/landmark/test/lib/{identity,sign-test-token}.test.js`, `products/landmark/test/commands/login.test.js` (edit) | Each reads `MAP_SUPABASE_*` from `process.env` to skip-gate or construct live clients. Each migrates to the canonical name. Test files are exempt from both static-inspection rules. |
| Static-inspection tests | `products/map/test/activity/service-role-still-used.test.js`, `products/landmark/test/lib/no-service-role-in-src.test.js` (edit); `libraries/libsupabase/test/repo-wide-invariants.test.js` (new) | First two assert the new canonical name. The new repo-wide test walks every `src/`/`bin/` under `products/`, `services/`, `libraries/` from the monorepo root (located via `Finder.findUpward`) and fails on (a) `process.env.SUPABASE_` / `process.env.MAP_SUPABASE_` literals **except** in `libstorage/src/index.js` and the Deno edge function, and (b) any `@supabase/supabase-js` import (static `import` declaration **or** dynamic `await import(...)`) **except** in `libsupabase/src/client.js` and the Deno edge function. |
| Documentation | 7 pages listed in spec § Documentation table (edit) | Mechanical rename of `MAP_SUPABASE_*` and `JWT_SECRET` to canonical names; recipe-name updates. |

## Component graph

```mermaid
graph TD
  EX[.env.*.example] --> SETUP[scripts/env-setup.js]
  SETUP -->|writes| ENV[.env]
  SETUP -->|mintSupabase*| LIBSB[libsupabase]
  LIBSB -->|generateJWT| LIBSEC[libsecret]
  ENV --> CFGTOML[products/map/supabase/config.toml]
  CFGTOML -->|env(SUPABASE_JWT_SECRET)| SBCLI[supabase CLI]
  ENV --> CONFIG[libconfig.Config]
  CONFIG --> MAPSVC[services/map/server.js]
  CONFIG --> MAPCLI[products/map/src/lib/client.js]
  CONFIG --> MAPAUTH[products/map/src/commands/auth-issue.js]
  CONFIG --> LM_SB[landmark/src/lib/supabase.js]
  CONFIG --> LM_ID[landmark/src/lib/identity.js]
  CONFIG --> LM_LOG[landmark/src/commands/login.js]
  CONFIG --> SUMMIT[summit/src/lib/supabase.js]
  CONFIG --> TERRAIN[libterrain/src/cli-helpers.js]
  MAPSVC -->|createServiceClient| LIBSB
  MAPCLI -->|createServiceClient| LIBSB
  MAPAUTH -->|mintSupabaseJwt| LIBSB
  LM_SB -->|createAnonClient| LIBSB
  LM_LOG -->|createAnonClient| LIBSB
  LM_ID -->|createAnonClient + verifySupabaseHmac| LIBSB
  SUMMIT -->|createServiceClient| LIBSB
  TERRAIN -->|createServiceClient| LIBSB
  STOR[libstorage/src/index.js] -.->|env-direct, exempted| ENV
```

`libsupabase` depends only on `libsecret` (which has no monorepo deps).
`libconfig` does not import `libsupabase`. Arrows above show *import
direction*: `MAPSVC → LIBSB` means `services/map/server.js` imports from
`libsupabase`. `libstorage`'s edge is dashed because it stays env-direct
(same as design-a) — see Decision 2.

## `Config` accessor interface

```js
class Config {
  static #CREDENTIAL_KEYS = new Set([
    "ANTHROPIC_API_KEY", "GH_TOKEN", "GITHUB_TOKEN", "MCP_TOKEN",
    "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_JWT_SECRET",
  ]);
  supabaseUrl()            { return this.#resolve(["SUPABASE_URL"], stripTrailingSlashes); }
  supabaseAnonKey()        { return this.#resolve(["SUPABASE_ANON_KEY"]); }
  supabaseServiceRoleKey() { return this.#resolve(["SUPABASE_SERVICE_ROLE_KEY"]); }
  supabaseJwtSecret()      { return this.#resolve(["SUPABASE_JWT_SECRET"]); }
}
```

Throw shape matches existing `#resolve`: `"<KEY> not found in environment"`.
Per-field lazy resolution lets `supabaseUrl()` succeed while
`supabaseJwtSecret()` throws on the same Config (Decision 8 wraps the latter
in a `try`).

## Per-module migration

| Module | Migration |
| --- | --- |
| `services/map/server.js:13-20` | Replace the `||` chain with `createServiceClient({config})`. Dead property branch and `process.env` fallback delete. |
| `services/map/index.js` | No change. `MapService` already takes a pre-built `supabase` client. |
| `libraries/libterrain/src/cli-helpers.js:50-72` | `resolveSupabaseClient(config)` returns `createServiceClient({config})`. Callers construct `Config` via `createScriptConfig("terrain")`. |
| `libraries/libstorage/src/index.js:198-229` | Rename `process.env.SUPABASE_SERVICE_ROLE_KEY` reference (canonical name is already correct in unprefixed form; only the surrounding env-var lookups change). libstorage stays env-direct and is on the static-inspection allow-list, same as design-a. |
| `products/map/src/lib/client.js:12-32` | `createMapClient(opts)` defaults `config = createProductConfig("map")` and calls `createServiceClient({config})`. |
| `products/map/src/commands/auth-issue.js:53-60` | Reads `config.supabaseJwtSecret()` via existing handler `params`; calls `libsupabase.mintSupabaseJwt({email, secret, ttlSeconds})` — same signature as today's `libsecret` export, only the import path changes. |
| `products/map/src/commands/activity.js:20` | `createSupabaseCli()` constructed inside `start()`. The `formatSubheader("Export these variables…")` block deletes in full. |
| `products/landmark/src/lib/supabase.js:30-48` | `createLandmarkClient({config, jwt, schema})` calls `createAnonClient({config, jwt, schema})`. |
| `products/landmark/src/lib/identity.js:71-104,139,154-155` | Public API becomes `resolveIdentity({config, env, createClient})` — `createClient` test-seam **retained** so `identity.test.js` doesn't lose its injection point. `env` carries `LANDMARK_AUTH_TOKEN` only. HMAC verify path calls `verifySupabaseHmac(headerPayload, sigB64, config.supabaseJwtSecret())` inside a `try`; on `false` or thrown "not found", the existing `IdentityUnresolvedError("signature does not verify")` is thrown (silent skip when JWT secret is unset — Decision 8). `refreshSession`'s dynamic `await import("@supabase/supabase-js")` is replaced by `createAnonClient({config})`, retiring the only dynamic Supabase import. |
| `products/landmark/src/commands/login.js:103-134` | `createPkceStorage()` stays in-module (Landmark-local). `resolveAnonClient({config, createClient})` calls `createAnonClient({config, auth: {flowType: "pkce", storage: createPkceStorage()}})`. The `createClient` test-seam is retained. Error wording points at `just env-setup`. |
| `products/map/test/activity-start.test.js:35-54` | The four `assert.match(text, /export MAP_SUPABASE_*/)` assertions and the order check are replaced with one assertion on the new ready-confirmation output. |
| `products/summit/src/lib/supabase.js:27-51` | `createSummitClient({config, schema})` calls `createServiceClient({config, schema})`. |
| `products/landmark/test/lib/sign-test-token.js:14-20` | Renames `process.env.MAP_SUPABASE_JWT_SECRET` → `process.env.SUPABASE_JWT_SECRET`. Test helper stays env-direct. |

## Key Decisions

| # | Decision | Rejected alternative | Why |
| --- | --- | --- | --- |
| 1 | Unprefixed canonical names. | Keep `MAP_` prefix; introduce parallel `LANDMARK_SUPABASE_*` / `SUMMIT_SUPABASE_*`. | One Supabase instance exists; prefix is dead structure (spec § Problem). |
| 2 | New `libsupabase` capability library centralizing client construction + JWT mint/verify. `Config` accessors stay in `libconfig` (`#resolve` per-field) and do not delegate to `libsupabase`. `libstorage` stays env-direct + exempt from the static-inspection rule (same as design-a). | (a) Add four accessors directly to `Config` and let consumers call `createClient(...)` per-module (**design-a**). (b) Have `Config` accessors delegate into a `readSupabaseEnv` helper in `libsupabase`. (c) Route `libstorage` through `libsupabase` to drop the exemption. | (a) leaves five duplicate `createClient(...)` call sites. (b) muddles ownership: either `libsupabase` imports `Config` (cycle) or it duck-types the four accessors twice. (c) requires breaking the pre-existing `libconfig/src → libstorage` import or having `libsupabase` re-read `.env` independently, both larger refactors than spec scope authorizes. design-b accepts the same `libstorage` exemption design-a uses and wins on factory centralization + dynamic-import removal. |
| 3 | Override Supabase CLI demo secret via `jwt_secret = "env(SUPABASE_JWT_SECRET)"` in `config.toml`. | `supabase start --jwt-secret <ours>`; docker-compose `map-supabase`-only stack. | `--jwt-secret` flag does not exist on `supabase start`. Docker-compose-only is explicitly out of spec scope. |
| 4 | Single unified bootstrap script. | Keep two scripts with one delegating. | The split is the root cause of spec defect 1; collapsing eliminates the bug class. |
| 5 | `mintSupabase*` and `verifySupabaseHmac` live in `libsupabase`, not `libsecret`. | Keep mint in `libsecret`; verify in `libsupabase`. | Mint and verify must agree on payload shape, iss, role, algorithm. Splitting them re-opens "they don't agree" bugs. `libsecret` retains generic `generateJWT` and `.env` helpers. |
| 6 | All values in single `.env`; `.env.storage.*` files deleted. | Keep the storage-backend split files. | The split was about storage-type selection, not credential isolation. `STORAGE_TYPE` + `AWS_ENDPOINT_URL` already select the backend. |
| 7 | `#CREDENTIAL_KEYS` registers the three secrets; URL is not registered. | Register all four. | URL must reach docker-compose `${SUPABASE_URL}` shell interpolation. Hiding it breaks compose. |
| 8 | Landmark HMAC stays best-effort: `try { verifySupabaseHmac(headerPayload, sig, config.supabaseJwtSecret()) }` — a thrown "not found" on the accessor or a `false` from the verify silently skips the check. | (a) Make HMAC mandatory. (b) Add `supabaseJwtSecretIfPresent()` accessor. | (a) breaks external `npx fit-landmark login` (no bootstrap, no JWT secret). (b) is the same shape with a different name; idiomatic `try` suffices. |
| 9 | Static-inspection extends to forbid `@supabase/supabase-js` imports (static **and** dynamic) outside `libsupabase/src/client.js` and the Deno edge function. | Trust code review. | Without the second rule, the next consumer skips `libsupabase` and re-introduces `createClient(...)` boilerplate. This is a design-introduced invariant beyond spec § Success Criteria; load-bearing for Decision 2's centralization durability. |
| 10 | Delete `MAP_SUPABASE_DB_PORT`. | Keep for documentary value. | Zero source consumers; spec § Scope requires removal. |
| 11 | `@supabase/supabase-js` becomes a hard `dependencies` entry on `libsupabase`. `products/summit` and `libraries/libterrain` **drop** their `optionalDependencies: {"@supabase/supabase-js"}` and **add** `@forwardimpact/libsupabase` to `dependencies`. The eight non-libstorage consumer packages likewise add `@forwardimpact/libsupabase` to `dependencies`. | Keep `optionalDependencies` and mirror on libsupabase. | Today's optional-dep guard is paired with `try { await import(...) }`. Decision 9 forbids that import shape, so the guard becomes vestigial. Owning the dep at `libsupabase` makes the install requirement explicit and one-source. |
| 12 | env-setup generates **one** `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` pair shared across `STORAGE_TYPE` switches. | Keep two pairs (one per backend) as `env-storage.js` does today. | The two backends are mutually exclusive at any moment; one pair is sufficient. This is a small behavior change beyond strict spec scope (spec § Out of scope excludes *consolidating storage credentials into libconfig accessors*, not collapsing generation). Acknowledged here so the planner does not silently inherit two-pair generation. |

## Test surfaces

| Surface | What it covers |
| --- | --- |
| `libsupabase` unit | `mintSupabaseAnonKey(secret)` / `mintSupabaseServiceRoleKey(secret)` / `mintSupabaseJwt({email, secret, ttlSeconds})` produce HS256 JWTs whose third segment `verifySupabaseHmac` accepts against the same `secret`. `createAnonClient` / `createServiceClient` call `createClient` with `auth: {persistSession: false, autoRefreshToken: false}` merged under any caller-provided `auth` block; PKCE options (`flowType`, `storage`) pass through. `config` arg is duck-typed (a stub with the four `supabase*()` methods works in tests). |
| `libconfig` unit | The four accessors return env values; `SUPABASE_*` secrets do not appear on `process.env` after `Config.load()` (credential isolation); URL does appear on `process.env`; throw shape matches `#resolve`. |
| `env-setup` integration | Bootstrap against a tmpdir produces a `.env` with all 8 expected keys; second run is idempotent; signed anon + service-role JWTs verify against the generated `SUPABASE_JWT_SECRET`. |
| Static-inspection | No `process.env.SUPABASE_` / `process.env.MAP_SUPABASE_` in product/service/library `src/` + `bin/` outside `libstorage/src/index.js` and the Deno edge function. No `@supabase/supabase-js` imports (static or dynamic) outside `libsupabase/src/client.js` and the Deno edge function. No hardcoded `"super-secret-jwt-token-..."` literal in source. |
| Consumer migration | Existing test suites pass after a one-token env-var rename in test setup; no fixture or assertion logic changes. |
| Docker compose | `docker compose --profile map-supabase config` against a bootstrap-produced `.env` reports no unset-variable warnings. |
