# Design 1380-a — link binding integrity and auth-completion resume

Spec 1380 closes two coupled defects on the `github-discussions` linking flow:
the completion step binds a token without checking who authorized, and the
message that triggered linking is dropped. The integrity fix lands in `ghauth`
(`Complete`); the resume flow is composed in `ghbridge` over a new
`services/bridge` store, the existing `libbridge` `Dispatcher`, and the
`oauth` round-trip already used for OAuth-client redirects. Out of scope:
the Teams surface, alternative token-minting methods, and the clickable-link
UX (retained).

## Components and flow

```mermaid
graph LR
  U[Discussion participant] -->|webhook| GB[ghbridge intake]
  GB -->|dispatch| DSP[libbridge Dispatcher]
  DSP -->|GetToken| GH[ghauth]
  GB -.->|link_required / reauth_required:<br/>mint link_token, stash target,<br/>augment authorize URL| PD[(PendingDispatchStore<br/>services/bridge)]
  GB -->|post link| TH[discussion thread]
  U -->|click| OA[oauth /authorize]
  OA -->|Begin client_state=link_token| GH
  GH --> GHUB[GitHub User App]
  GHUB -->|callback| OC[oauth /callback]
  OC -->|Complete: verify authorizer == surface id,<br/>record github_user_id| GH
  OC -->|302 to redirect_uri, state=link_token| LC[ghbridge /api/link-complete]
  LC -->|lookup link_token| PD
  LC -->|re-dispatch ctx| DSP
  LC -->|confirmation page| U
```

| Component | Role in this design |
|---|---|
| `ghauth.Complete` | Verifies the authorizing GitHub account against the flow's `surface_user_id`; records the verified id on the binding. |
| `PendingDispatchStore` (`services/bridge`) | Canonical, TTL'd map `link_token → replay target`; sibling to the discussion/origin stores so it survives `ghbridge` restarts. |
| `ghbridge` link-prompt path | Mints `link_token`, stashes the target, augments the authorize URL with its completion redirect + token. |
| `ghbridge` `/api/link-complete` | Post-auth landing endpoint: resolves `link_token`, re-dispatches, renders confirmation. |
| `oauth /authorize` | Forwards `client_state` (carrying `link_token`) into `Begin` — the one new pass-through. |
| `libbridge.Dispatcher` | Unchanged dispatch primitive; the replay calls it exactly as intake does. |

## Identity verification (Defect 1)

`Complete` today binds `tokens.access_token` to `flow.surface_user_id` and
writes `github_user_id: null` with no authorizer check. The fix: after the code
exchange, resolve the authorizing account's GitHub id from the freshly minted
token, then bind **only** when that id equals the flow's `surface_user_id`,
recording it as the binding's `github_user_id`. A mismatch performs no upsert —
no create, no overwrite — and returns a typed `identity_mismatch` outcome the
`oauth /callback` renders as a refusal page.

The equality rule applies to surfaces whose identity namespace **is** GitHub
accounts, which `github-discussions` is (its `surface_user_id` is the GitHub
numeric id, per Spec 1340). This is expressed as a per-surface identity policy
on the provider so a future surface with a non-GitHub namespace records the
verified id without asserting equality. Teams is explicitly deferred.

## Resume flow (Defect 2)

When `Dispatcher.dispatch` returns `link_required` or `reauth_required`,
`ghbridge` (not `libbridge`, keeping it channel-agnostic) mints an opaque
`link_token`, writes a `PendingDispatch` target keyed by it, and augments the
`authorize_url` with `redirect_uri=<callback_base>/api/link-complete` and
`client_state=<link_token>` before posting. `transient` stashes nothing (no
link is shown).

`oauth /callback` already redirects to a downstream `redirect_uri` with the
echoed `client_state`; `/api/link-complete` receives `state=link_token`,
resolves the `PendingDispatch` target, reloads the discussion context, and
re-dispatches through `Dispatcher.dispatch`. The pending record is deleted on
re-dispatch (idempotent against a page refresh) and renders a "processing your
message" page in place of today's terminal notice.

**Safety property:** the replay re-runs the same `GetToken` gate, which returns
a token only if a binding now exists for `target.surface_user_id` — and after
the Defect 1 fix, that binding exists only if the legitimate user authorized.
So a forged or stale `link_token` hit cannot dispatch; it re-posts the link
harmlessly. No separate proof-of-completion is needed.

## Canonical store as the single source of truth

The replay reconstructs the prompt from the discussion store, so the inbound
turn must be persisted **before** the pending pointer on every intake path.
Today only the comment path persists on decline; the discussion-created path
relies on `Dispatcher` appending `historyText` on success only. This design
unifies both: intake appends the inbound turn to the context and flushes it
through the `DiscussionAdapter` before calling `dispatch`, and the success-only
`historyText` append inside `Dispatcher` is removed (clean break). The pending
record therefore carries **no message body**.

History entries gain an `author` field (the participant's `external_id`;
assistant turns carry none) so the replay selects the latest turn authored by
`target.surface_user_id` as the message to re-dispatch — correct even when
several humans have posted in the thread.

## Data structures

| Structure | Shape |
|---|---|
| `PendingDispatch` record | `{ link_token, surface, surface_user_id, discussion_id, created_at }` — target only, TTL-swept like the flow/grant stores. |
| Binding (`ghauth`) | `github_user_id` populated with the verified authorizer id (was always `null`). |
| History entry | `{ role, text, author? }` (was `{ role, text }`). |

## Key Decisions

| Decision | Choice | Rejected alternative |
|---|---|---|
| How `Complete` learns who authorized | Resolve the account id from the minted token, compare to the flow's `surface_user_id` | Trust the OAuth callback / the request parameter — that is the current vulnerability |
| Where the replay target lives | Server-held `PendingDispatch` keyed by an opaque token | Encode `(user, thread)` in `client_state` — the completer could edit it to redirect the replay to another user/thread |
| Where the pending store lives | `services/bridge` alongside discussion/origin state | In-memory in `ghbridge` — lost on restart between link-post and completion; violates "ghbridge holds no own disk state" |
| Proof that completion was genuine | The `GetToken` gate during replay (binding exists ⇒ verified user linked) | `ghbridge` redeeming the downstream OAuth code — pulls the bridge into the OAuth-client role and hands it a user token it never uses |
| How resume is modeled | Dedicated pending store + completion endpoint | A new `ResumeScheduler` trigger kind — its triggers fire off inbound replies / elapsed time, not an external OAuth callback; overloading muddies the abstraction |
| How the message is re-sent | Replay through `Dispatcher.dispatch` | A bespoke dispatch path — would duplicate rate-limiting, callback registration, and the `GetToken` safety gate |
| Which message a multi-party thread replays | Latest history turn authored by the linking user | Latest turn regardless of author — could re-dispatch another participant's message |
| Where link augmentation happens | `ghbridge` (channel-specific completion endpoint) | `libbridge` `TokenResolver` — would import a channel-specific callback path, breaking its no-channel invariant |

## Notes for the planner

- The only `oauth` change is forwarding `client_state` through `/authorize`
  into `Begin`; `Complete` already echoes `flow.client_state`.
- `Begin`/the flow record must persist `client_state` (today set `null` on the
  GetToken-originated path).
- Removing `historyText` touches both bridges' intake and the `Dispatcher`
  contract; `msbridge` must adopt the same intake-persists-first ordering.
- The confirmation page is a `ghbridge` HTTP response; no channel SDK involved.
