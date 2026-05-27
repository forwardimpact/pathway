# Plan 1320-a: oauth + ghauth

Implements [spec.md](spec.md) per [design-a.md](design-a.md).

## Approach

Build `ghauth` first (proto → codegen → state → GitHub client → service →
server → tests), then `oauth` on top of the generated `ghauth` client. `ghauth`
is a standard `librpc` gRPC service whose three JSONL stores reuse
`libindex`'s `BufferedIndex` exactly as `libbridge`'s `DiscussionContextStore`
does; the GitHub user-to-server exchange/refresh/revoke is a small
`fetch`-based module (no new dependency, mirroring how `libconfig` already
refreshes OAuth tokens). `oauth` is a protocol-only `node:http` adapter modeled
on `services/mcp/index.js`: every endpoint maps to one gRPC call on a backend
client constructed by name from config (`createClient(config.provider, …)`),
so its source stays GitHub-free (SC#3). Credential accessors follow the
existing `msAppId()`/`mcpToken()` precedent in `libconfig`.

## Step 1 — ghauth proto + codegen

Define the provider-agnostic RPC contract and generate its base/client/types.
(`AuthProvider` in design-a is the conceptual contract name; the concrete proto
service is `Ghauth`, so `createClient("ghauth")` resolves `GhauthClient`.)

- **Created:** `services/ghauth/proto/ghauth.proto`
- **Modified (generated):** `generated/**` (via `just codegen`)

```proto
syntax = "proto3";
package ghauth;
import "common.proto";

service Ghauth {
  rpc Begin(BeginRequest) returns (BeginResponse);
  rpc Complete(CompleteRequest) returns (CompleteResponse);
  rpc Redeem(RedeemRequest) returns (RedeemResponse);
  rpc GetToken(GetTokenRequest) returns (GetTokenResponse);
  rpc Revoke(RevokeRequest) returns (common.Empty);
}

message BeginRequest {
  string surface = 1;
  string surface_user_id = 2;
  optional string redirect_uri = 3;     // client-initiated only
  optional string code_challenge = 4;   // downstream PKCE; client-initiated only
  repeated string scopes = 5;
}
message BeginResponse { string upstream_authorize_url = 1; string state = 2; }

message CompleteRequest { string code = 1; string state = 2; }
message CompleteResponse {
  optional string downstream_code = 1;  // absent for bridge-initiated link
  optional string redirect_uri = 2;
  optional string client_state = 3;
}

message RedeemRequest { string code = 1; string code_verifier = 2; }
message RedeemResponse { string access_token = 1; string token_type = 2; int64 expires_in = 3; }

message GetTokenRequest { string surface = 1; string surface_user_id = 2; }
message LinkRequired { string authorize_url = 1; }
message ReAuthRequired {}
message GetTokenResponse {
  oneof result {
    string token = 1;
    LinkRequired link_required = 2;
    ReAuthRequired re_auth_required = 3;
  }
}

message RevokeRequest { string surface = 1; string surface_user_id = 2; }
```

Verify: `just codegen` succeeds and `generated/services/exports.js` exports
`GhauthBase` and `GhauthClient`.

## Step 2 — libconfig credential accessors

Add Kata Agent User App client-id/secret accessors (can run alongside Step 1).

- **Modified:** `libraries/libconfig/src/config.js`

Add to `Config.#CREDENTIAL_KEYS`: `"SERVICE_GHAUTH_CLIENT_ID"`,
`"SERVICE_GHAUTH_CLIENT_SECRET"`. Add two methods beside `mcpToken()`:

```js
/** @returns {string} Kata Agent User App client id */
ghauthClientId() { return this.#resolve(["SERVICE_GHAUTH_CLIENT_ID"]); }
/** @returns {string} Kata Agent User App client secret */
ghauthClientSecret() { return this.#resolve(["SERVICE_GHAUTH_CLIENT_SECRET"]); }
```

The `SERVICE_GHAUTH_*` env names are deliberate (per design-a § Configuration),
unlike the bare-name accessors (`MCP_TOKEN`); keep them fully qualified and in
`#CREDENTIAL_KEYS` so they resolve via `#resolve` into the private credential
map rather than the auto-mapped config props. Verify:
`bun test libraries/libconfig/test/*.test.js` passes; bump
`libraries/libconfig/package.json` patch version.

## Step 3 — ghauth state stores

Three `BufferedIndex`-backed stores over one injected `libstorage` store.

- **Created:** `services/ghauth/src/stores.js`

- `BindingStore extends BufferedIndex` — `indexKey: "bindings.jsonl"`, no
  sweep; `static keyOf(surface, userId)`, `loadBinding(surface, userId)`,
  `upsert(record)`. Record: `{ id, github_user_id, access_token,
  refresh_token, expires_at, scopes }`. Server shutdown (Step 6) calls
  `shutdown()` on all three stores to flush buffered writes — required for
  SC#7 (a binding written before restart must survive).
- `TtlStore extends BufferedIndex` — generic short-TTL store mirroring
  `DiscussionContextStore`'s `#sweep`/`sweepNow(now)`/`stopSweep()`/
  `shutdown()`, evicting on `created_at` older than `ttlMs`.
- `FlowStore = TtlStore` over `flows.jsonl` keyed by outer `state`; record
  `{ id: state, surface, surface_user_id, code_challenge?, redirect_uri?,
  client_state?, created_at }`.
- `GrantStore = TtlStore` over `grants.jsonl` keyed by `downstream_code`;
  record `{ id: downstream_code, binding_id, code_challenge, redirect_uri,
  client_state, created_at }`; `consume(code)` reads-then-deletes.

Verify: `node --input-type=module -e "import('./services/ghauth/src/stores.js')"`
imports cleanly and `BindingStore.keyOf('teams','u1') === 'teams:u1'`.

## Step 4 — ghauth GitHub OAuth client

Encapsulate the Kata Agent User App authorization-code exchange/refresh/revoke.

- **Created:** `services/ghauth/src/github-oauth.js`

`createGithubOAuth({ clientId, clientSecret, fetchImpl = fetch })` returning:

| Method | GitHub call |
| --- | --- |
| `authorizeUrl({ state, redirectUri, scopes })` | builds `https://github.com/login/oauth/authorize?…` |
| `exchangeCode(code, redirectUri)` | `POST https://github.com/login/oauth/access_token` → `{ access_token, refresh_token, expires_in }` |
| `refresh(refreshToken)` | `POST …/access_token` `grant_type=refresh_token` → same shape; throws `RevokedError` on GitHub `bad_refresh_token`/`unauthorized` |
| `revoke(accessToken)` | `DELETE https://api.github.com/applications/{clientId}/token` — basic auth `clientId:clientSecret`, token in JSON body `{ "access_token": … }` |

Use `Accept: application/json` + `URLSearchParams`, mirroring
`libconfig`'s `#refreshOAuthToken`. `code_challenge`/`code_verifier` are
**not** forwarded to GitHub (downstream-only PKCE).

Verify: with a stub `fetchImpl` returning `{access_token,refresh_token,expires_in}`,
`exchangeCode` resolves that shape and a `bad_refresh_token` body makes `refresh`
throw `RevokedError`.

## Step 5 — ghauth service implementation

Implement the five RPCs against the stores and GitHub client.

- **Created:** `services/ghauth/index.js`

```js
import { services } from "@forwardimpact/librpc";
const { GhauthBase } = services;
export class GhauthService extends GhauthBase {
  constructor(config, { bindings, flows, grants, github }) { super(config); /* assign */ }
  // Begin: write flows row, return { upstream_authorize_url: github.authorizeUrl(...), state }
  // Complete: consume flows row; github.exchangeCode; bindings.upsert;
  //   if flow had redirect_uri → mint grants row + return downstream_code, else "linked"
  // Redeem: grants.consume(code); verify code_verifier vs grant.code_challenge;
  //   return stored binding's access_token, token_type, expires_in
  // GetToken: bindings.loadBinding; missing → { link_required: { authorize_url } };
  //   near-expiry → github.refresh (RevokedError → { re_auth_required:{} });
  //   else { token }
  // Revoke: github.revoke + bindings delete → common.Empty
}
```

`LinkRequired.authorize_url` is composed from `config.link_base_url` +
`/authorize?surface=…&surface_user_id=…` (one URL shape). `link_base_url` is
**`oauth`'s externally-reachable origin** (its `/authorize` is the user-facing
endpoint per design-a:94), not `ghauth`'s own address. Verify code-challenge
match with `crypto.createHash("sha256")` base64url (S256).

Verify: importing `../index.js` exposes `GhauthService` with `Begin`/`Complete`/
`Redeem`/`GetToken`/`Revoke` methods (full behaviour in Step 8).

## Step 6 — ghauth server.js

Bootstrap config, storage, stores, GitHub client, and the gRPC server.

- **Created:** `services/ghauth/server.js`

```js
#!/usr/bin/env node
import "@forwardimpact/libpreflight/node22";
import { Server, createTracer } from "@forwardimpact/librpc";
import { createServiceConfig } from "@forwardimpact/libconfig";
import { createLogger } from "@forwardimpact/libtelemetry";
import { createStorage } from "@forwardimpact/libstorage";
import { GhauthService } from "./index.js";
import { BindingStore, FlowStore, GrantStore } from "./src/stores.js";
import { createGithubOAuth } from "./src/github-oauth.js";

const config = await createServiceConfig("ghauth", {
  protocol: "grpc", port: 3006, link_base_url: "http://localhost:3007",
});
const logger = createLogger("ghauth");
const tracer = await createTracer("ghauth");
const storage = createStorage("ghauth");                 // → data/ghauth/
const github = createGithubOAuth({ clientId: config.ghauthClientId(), clientSecret: config.ghauthClientSecret() });
const service = new GhauthService(config, {
  bindings: new BindingStore(storage), flows: new FlowStore(storage), grants: new GrantStore(storage), github,
});
const server = new Server(service, config, logger, tracer);
await server.start();
```

Verify: `bunx fit-rc start ghauth` then `services/ghauth/test/smoke.test.js`.

## Step 7 — ghauth package.json + README

Service metadata + contributor docs per `services/CLAUDE.md`.

- **Created:** `services/ghauth/package.json`, `services/ghauth/README.md`

`@forwardimpact/svcghauth`, ESM, `bin.fit-svcghauth: ./server.js`, `files`
listing `index.js`/`server.js`/`src`/`proto`, `description`, `keywords`
(last `agent`), one `jobs` entry. Deps: `librpc`, `libconfig`, `libstorage`,
`libindex`, `libtelemetry`, `libpreflight`, `libtype`; dev `libharness`.
README documents the `service.ghauth` config block + `init.services` entry +
`SERVICE_GHAUTH_CLIENT_ID/SECRET` env.

Verify: `bun run context:fix` regenerates `services/README.md` cleanly.

## Step 8 — ghauth tests

Cover SC#1,4,5,6,7,8 with `node:test` + `libharness` mocks.

- **Created:** `services/ghauth/test/smoke.test.js`,
  `services/ghauth/test/query-linked.test.js`,
  `services/ghauth/test/query-unlinked.test.js`,
  `services/ghauth/test/query-reauth.test.js`,
  `services/ghauth/test/persistence.test.js`,
  `services/ghauth/test/query-contract.test.js`

| Test | Asserts |
| --- | --- |
| `smoke` | service constructs; a gRPC `GetToken` returns a response object, not a connection error (SC#1) |
| `query-linked` | linked user + valid token → `result.token === stored` (SC#4) |
| `query-unlinked` | unlinked → `result.link_required.authorize_url` set, no token (SC#5) |
| `query-reauth` | expired + `refresh` throws `RevokedError` → `result.re_auth_required` (SC#6) |
| `persistence` | write binding via `createMockStorage`-backed `BindingStore`, build a fresh store over the same storage, read it back (SC#7) |
| `query-contract` | `GetToken({surface, surface_user_id})` token arm is `typeof === "string"` (SC#8) |

Use a stub `github` (`{ refresh: async () => { throw new RevokedError() } }`
etc.) injected via the constructor. Verify: `bun test services/ghauth/test/*.test.js`.

## Step 9 — oauth service implementation

Protocol-only HTTP adapter delegating to the configured provider client.

- **Created:** `services/oauth/index.js`

Factory `createOauthService({ config, logger, providerClient })` returning
`{ start }`, modeled on `services/mcp/index.js` (`node:http` `createServer`,
route table, `/health`). Routes:

| Route | Action |
| --- | --- |
| `GET /.well-known/oauth-authorization-server` | JSON metadata from `config.issuer` |
| `GET /authorize` | `providerClient.Begin(query)` → 302 `upstream_authorize_url` |
| `GET /callback` | `providerClient.Complete({code,state})` → 302 client `redirect_uri` w/ `downstream_code`, else render "linked" page |
| `POST /token` | `providerClient.Redeem({code,code_verifier})` → JSON token response |
| `GET /health` | `{status:"ok"}` |

No `github`/`octokit` identifiers anywhere in this file (SC#3).
Verify: SC#3 `rg` check in Step 12.

## Step 10 — oauth server.js

Bootstrap config + provider client by name, start the HTTP service.

- **Created:** `services/oauth/server.js`

```js
const config = await createServiceConfig("oauth", {
  protocol: "http", port: 3007, issuer: "http://localhost:3007", provider: "ghauth",
});
const logger = createLogger("oauth");
const tracer = await createTracer("oauth");
const providerClient = await createClient(config.provider, logger, tracer);  // "ghauth" → GhauthClient
await createOauthService({ config, logger, providerClient }).start();
```

`createClient("ghauth", …)` resolves `GhauthClient` and dials the `service.ghauth`
config (grpc, port 3006 per Step 6 defaults), so client and server agree on the
port without a committed `config.json`. Verify: `bunx fit-rc start oauth` boots
both services (ghauth listed first) and `GET /health` returns `{status:"ok"}`.

## Step 11 — oauth package.json + README

Service metadata + docs per `services/CLAUDE.md`.

- **Created:** `services/oauth/package.json`, `services/oauth/README.md`

`@forwardimpact/svcoauth`, `bin.fit-svcoauth: ./server.js`, deps `librpc`,
`libconfig`, `libtelemetry`, `libpreflight`, `libtype` (no octokit). README
documents `service.oauth` config (`issuer`, `provider`, `port`) +
`init.services` ordering (`ghauth` before `oauth`).

Verify: `bun run context:fix`.

## Step 12 — oauth tests

Cover SC#2 and SC#3.

- **Created:** `services/oauth/test/{metadata,authorize,no-github}.test.js`

- `metadata` — `GET /.well-known/oauth-authorization-server` returns valid
  AS metadata derived from `config.issuer` (SC#2).
- `authorize` — `GET /authorize` calls a stub `providerClient.Begin` and
  returns 302 to the returned `upstream_authorize_url` (SC#2).
- `no-github` — asserts `rg -i 'github|octokit' services/oauth/ -g '!test/'
  -g '!*.md'` yields no matches (SC#3), via a `child_process` exec.

Verify: `bun test services/oauth/test/*.test.js`.

## Step 13 — config docs + catalog regen

Document the two `init.services`/`service.*` blocks and regenerate catalogs.

- **Modified:** `services/README.md` (generated), root catalog via `context:fix`

`config/config.json` is gitignored, so runnable defaults live in the
`createServiceConfig(name, defaults)` argument in each `server.js` (Steps 6,
10), with the documented `service.*`/`init.services` blocks in each README; no
committed `config.json` to edit.

Verify: `bun run context` passes (catalog + workspace-imports guards green).

Libraries used: librpc (Server, createClient, services), libconfig (createServiceConfig), libstorage (createStorage), libindex (BufferedIndex), libtelemetry (createLogger), libtype (generated message types), libpreflight; libharness (dev). No new third-party dependency — GitHub OAuth uses built-in `fetch`.

## Risks

- **GitHub App token-expiration setting.** Refresh tokens + `expires_in` are
  only issued when the Kata Agent User App has "Expire user authorization
  tokens" enabled. If disabled, `refresh_token` is absent and tokens never
  expire; `GetToken`/`Redeem` must treat absent `refresh_token`/`expires_in`
  as a non-expiring binding rather than erroring.
- **PKCE scope.** `code_challenge`/`code_verifier` are the downstream
  (client↔`oauth`) PKCE only and are verified inside `ghauth.Redeem`; they
  must not be forwarded to GitHub's upstream exchange.
- **Client resolution order.** `oauth`'s `createClient(config.provider)`
  resolves `GhauthClient` from `generated/`; Step 1 codegen must land before
  `oauth` boots or the client lookup fails at startup.
- **Port collisions.** `config/config.json` is gitignored; the suggested
  defaults (ghauth 3006, oauth 3007) must not collide with a contributor's
  existing service ports — confirm against the local `init.services` set.
- **libconfig is shared.** The new accessors/`#CREDENTIAL_KEYS` entries are
  additive, but the patch bump must be released for downstream services that
  pin `@forwardimpact/libconfig`.

## Execution

Single engineering agent (`staff-engineer`), sequential. Step 2 may run
alongside Step 1. Steps 1–8 (ghauth) must complete before Steps 9–12 (oauth),
since `oauth` constructs the generated `ghauth` client. Step 13 last. READMEs
in Steps 7/11 are within the engineering agent's scope; no separate
`technical-writer` pass required.
