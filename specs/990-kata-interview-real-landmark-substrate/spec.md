# Spec 990 — Real-Landmark Substrate for `kata-interview` Runs

## Problem

The `kata-interview` workflow exists to stress-test Forward Impact products
against synthesized JTBD personas — a Product Manager agent runs the
[`kata-interview` skill](../../.claude/skills/kata-interview/SKILL.md),
synthesizes a persona from `data/synthetic/story.dsl`, and hands the persona
the matching JTBD entry. The interview's job is to surface real product
gaps: missing features, broken docs, friction inside the documented
workflow.

For Landmark interviews, the workflow does not deliver that signal. Every
analytical Landmark command requires a Supabase-backed identity
(`LANDMARK_AUTH_TOKEN`), but the CI workspace prep does not stand one up.
Personas walk through the documented getting-started page, hit
`Authentication required: LANDMARK_AUTH_TOKEN is not set` on every
analytical command, and either abandon the run or hand-construct
workarounds. The product gap recorded by the run is the auth wall, not
whatever the product actually fails at downstream of identity.

[Issue #921](https://github.com/forwardimpact/monorepo/issues/921) carries
three independent persona reports of this failure mode, drawn from three
separate `kata-interview` runs:

> Persona: BioNova PEM `athena@bionova.example` (Measure Engineering Outcomes,
> Little Hire: tell whether culture investments are working before the next
> budget cycle). Every team-level command failed with `Authentication
> required: LANDMARK_AUTH_TOKEN is not set`.

> Persona: BioNova SWE `antiope@bionova.example` (Find Growth Areas, Little
> Hire: check whether recent Oncora-push work shows J070 signal). Every
> activity command — `readiness`, `evidence`, `timeline`, `coverage`,
> `sources` — failed identically.

> Persona: BioNova Director `zeus@bionova.example` (Measure Engineering
> Outcomes). Ended up writing 25 lines of `jsonwebtoken` HS256 signing
> code against `.env` to bypass the wall, because `sign-test-token.js` is
> not shipped with the npm package.

Three runs, three personas, one stuck pattern. None of the runs reached the
product surface they were sent to evaluate, because the interview's CI
substrate stops short of standing up identity.

[`.github/workflows/kata-interview.yml`](../../.github/workflows/kata-interview.yml)
prepares the agent workspace with only two operations under
`Prepare interview workspace`: it runs `bunx fit-terrain build` (which
generates `data/synthetic/story.dsl` and the typed activity dump under
`data/activity/` and `data/pathway/`) and installs the Supabase CLI
(`bun install -g supabase`). The local Supabase stack is not started; the
typed activity tables are never populated from the synthetic dump; no
`auth.users` row is created for any persona email; no JWT is minted; no
`LANDMARK_AUTH_TOKEN` is exported into the agent's environment. The
[`kata-interview` skill staging table](../../.claude/skills/kata-interview/SKILL.md)
copies `data/pathway/` and `data/activity/` into `$AGENT_CWD` for Landmark
interviews, then asks the persona to run commands that read tables which do
not exist.

The substrate that this spec depends on is already on `main`. Spec 960
([PR #933](https://github.com/forwardimpact/monorepo/pull/933)) consolidated
`SUPABASE_JWT_SECRET`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and
`SUPABASE_URL` into a single `just env-setup` bootstrap with libconfig-typed
getters and a no-direct-env enforcement test. Spec 840 slice 1.5
([PR #927](https://github.com/forwardimpact/monorepo/pull/927)) added the
operator verb `fit-map auth issue --email <e>` for JWT minting, the
`organization_people.kind` discriminator (`human` / `service_account`), and
the matching `fit-landmark login` / `logout` flows. The pieces the
substrate needs — `just env-setup`, `fit-map activity start`,
`fit-map activity migrate`, `fit-map activity seed`,
`fit-map people push`, `fit-map people provision`, and
`fit-map auth issue` — are all on `main` today. None of them are invoked
from the `kata-interview` workflow.

[PR #926](https://github.com/forwardimpact/monorepo/pull/926) approached the
same gap from the production-CLI side, proposing a `--demo` flag for
Landmark with a fixture-backed query layer. The maintainer un-approved that
spec on 2026-05-16:

> The ideal solution is not a demo mode, but set up the interviews such
> that they can operate with real commands based on synthetic data.

Spec 950 is now `spec draft` in [`wiki/STATUS.md`](../../wiki/STATUS.md);
this spec supersedes its problem framing by moving the work out of the
production CLI and into the interview workspace prep. `fit-landmark`
itself is not changed.

The blast radius is the *Evaluate and Improve Agents* job: every
`kata-interview` run that touches Landmark today, and every future run that
will touch any other product whose analytical commands need a Supabase
identity, surfaces unprovisioned-CI noise instead of product gaps. The
runs cost ANTHROPIC_API_KEY tokens, supervisor time, and trust in the
finding stream — a finding stream that currently re-files the same auth-wall
issue once per persona.

## Personas and Job

The hire is **Platform Builders** against the *Evaluate and Improve Agents*
job (see [JTBD.md](../../JTBD.md), under the
`<job user="Platform Builders" goal="Evaluate and Improve Agents">` entry).

The job's **Trigger** — "An agent change shipped but nobody can tell whether
it improved outcomes — the only evidence is anecdotal" — is the operating
context every `kata-interview` run sits inside. The runs *are* the evidence
stream; their fidelity determines whether anyone can tell.

- The **Little Hire** — "generate test data and chart agent metrics to
  distinguish signal from noise" — names the immediate outcome this spec
  delivers. Today the runs against Landmark do not distinguish signal from
  noise: every persona hits the same auth wall and the wall masks whatever
  product gap the run was sent to find. After this spec lands, the runs
  surface product gaps downstream of identity, not the absence of identity.
- The **Big Hire** — "prove whether agent changes improved outcomes with
  reproducible evidence" — is the long-arc outcome this spec keeps reachable.
  An evidence stream dominated by a single masking error cannot prove
  anything about agent improvements; clearing the mask is a precondition to
  the Big Hire on this product surface.

The **Anxiety** force ("Rigorous evaluation might reveal that recent changes
made things worse") is one this spec deliberately allows to fire: a run that
no longer hits the auth wall may surface real product regressions that were
previously hidden under it. That is the intended behavior.

## Scope

### In scope

| Component | What changes |
|---|---|
| `kata-interview` CI workspace prep | After this spec lands, the `Prepare interview workspace` block in [`.github/workflows/kata-interview.yml`](../../.github/workflows/kata-interview.yml) produces a workspace in which the chosen persona's email has a Supabase identity and `LANDMARK_AUTH_TOKEN` is exported into the agent's environment before the agent is started. Whether the substrate stands up unconditionally, only when the chosen product is Landmark, or only when the chosen product has `needsSupabase: true` commands is a design choice. The exact ordering of `just env-setup`, `fit-map activity start`, `fit-map activity migrate`, `fit-map activity seed`, `fit-map people push`, `fit-map people provision`, and `fit-map auth issue` is a design choice. |
| Identity coverage | The persona chosen for the run carries an `organization_people` row, an `auth.users` row, and a Supabase-shaped JWT minted against `SUPABASE_JWT_SECRET`. The JWT is the value of `LANDMARK_AUTH_TOKEN` in the agent's environment when the agent starts. Whether identities are also pre-provisioned for the persona's manager, direct reports, or peers is a design choice. |
| Synthetic-content ingestion | The typed activity dump produced by `bunx fit-terrain build` (`data/activity/` and `data/pathway/` in the workflow's working tree) is loaded into the local Supabase stack so that the analytical Landmark commands return non-empty rows when run as the chosen persona. The shape on disk is unchanged. The mechanism by which content lands in Supabase is a design choice; the observable property is that the chosen persona's queries return rows. |
| Coverage across Landmark's gated commands | After the workspace prep completes, every `needsSupabase: true` command in [`products/landmark/bin/fit-landmark.js`](../../products/landmark/bin/fit-landmark.js) — the eleven dispatch keys `org`, `snapshot`, `evidence`, `readiness`, `timeline`, `coverage`, `practice`, `practiced`, `health`, `voice`, `sources`, plus the user-visible subcommands of `org` (`show`, `team`) and `snapshot` (`list`, `show`, `trend`, `compare`) — exits 0 when invoked as the chosen persona against the seeded substrate. The fifteen user-visible invocations are enumerated in the libcli definition's `commands` array at the same file. |
| Kata-interview skill alignment | The [`kata-interview` skill](../../.claude/skills/kata-interview/SKILL.md) reflects what the workspace now provides. Its staging table (Step 3 — "Stage the Agent Workspace") documents that for Landmark interviews the substrate (including identity) is already in place, so the persona file the supervisor writes does not need to instruct the agent to provision auth. Whether the table is rewritten, a new section is added, or the substrate is hidden behind the existing entries is a design choice. |
| Determinism | A second `kata-interview` run with the same `product` and `job` inputs against the same `main` produces the same exit codes for the agent's gated-command invocations as the first run. The set of personas the workflow can choose from is the set of `human` rows in the synthetic content; the seed used to select among them must be deterministic given the workflow inputs (the inputs include `product`, `job`, and `task-amend`; whether `github.sha`, `github.run_id`, or another stable value joins them is a design choice). |
| Privacy of substrate data | The synthetic content already constrains personas' email addresses to the IETF reserved domains `example.com`, `example.org`, and `example.net` and their GitHub-shaped handles to the reserved `^demo-[a-z0-9-]+$` namespace (covered by spec 950's privacy criterion). This spec does not introduce any data that originates outside the synthetic content. JWTs minted in this substrate are HS256-signed against the ephemeral `SUPABASE_JWT_SECRET` generated by `just env-setup` at workspace prep time; that secret never leaves the runner. |
| Secret handling in logs | `LANDMARK_AUTH_TOKEN`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and any other JWT minted by `fit-map auth issue` during workspace prep are not logged at info level in the workflow's step output. Existing `::add-mask::` plumbing from `just env-setup --add-mask --output` (added in PR #933) is available; whether the workspace prep step also masks the per-persona JWT is a design choice. |
| Failure surfacing | If any of the substrate steps fails — Docker unavailable, migration error, seeding failure, no `human` rows in the synthetic content, JWT mint failure — the workflow fails the `Prepare interview workspace` step with a non-zero exit before the agent starts. The agent is not handed a half-built substrate. |

### Out of scope, deferred

- **Changes to `fit-landmark` itself.** No new flag, no offline mode, no
  fixture-backed query layer, no change to `resolveIdentity()` or the
  `needsSupabase` map. Spec 950's proposal is superseded by this spec, not
  partially carried forward.
- **Cross-product substrate.** Other products that the `kata-interview`
  skill can target (Pathway, Guide, Outpost, Summit, Map) have their own
  data and auth postures. Pathway and Guide already operate from local
  files; Outpost and Guide may need different substrate work in future
  specs. This spec changes only the Landmark path through the workflow.
- **Substrate for other CI workflows.** `eval-kata.yml`,
  `agent-team.yml`, `kata-storyboard.yml`, and `kata-coaching.yml` do
  not run product-against-persona interviews. If a future workflow needs
  the same substrate, it can reuse whatever surface this spec produces.
- **Hosted Supabase as a substrate.** The substrate is local: `fit-map
  activity start` brings up Docker. Pointing `kata-interview` at a hosted
  Supabase project is a separate spec with separate privacy considerations.
- **Per-persona identity provisioning for the entire roster.** Only the
  persona chosen for the run needs identity. Provisioning all human rows
  in the synthetic content into `auth.users` may be a useful side effect
  of the design choice, but it is not required.
- **Service-account identities for the interview supervisor.** The
  `service_account` discriminator added in PR #927 is reserved for
  unattended agents. Whether the supervisor agent (the
  `product-manager` profile in the workflow) carries a Supabase identity
  is out of scope; the supervisor today does not call Landmark.
- **Changing the synthetic content.** The substrate consumes whatever
  `bunx fit-terrain build` produces. Adding personas, regenerating the
  story DSL, or extending `data/synthetic/` to carry additional fields is
  a separate spec.
- **Caching the substrate across runs.** Each `kata-interview` invocation
  builds the substrate fresh from `bunx fit-terrain build`. Caching the
  Docker stack, the seeded database, or the JWT across runs is a
  performance optimization that this spec does not require.
- **Replacing the `kata-interview` skill's interview protocol.** The
  two-Ask handoff, persona file, JTBD classification, and finding-capture
  steps are unchanged. This spec changes only what the agent's
  environment carries when the supervisor writes `CLAUDE.md`.

## Success Criteria

| Claim | Verification |
|---|---|
| The workspace prep step produces an exported `LANDMARK_AUTH_TOKEN`. | After the workflow's `Prepare interview workspace` step runs, the agent process (started by the `Run interview` step) sees a non-empty `LANDMARK_AUTH_TOKEN` in its environment. Verifiable by an assertion step inserted between the prep step and the agent-start step, or by an assertion baked into the prep step's final command. |
| `LANDMARK_AUTH_TOKEN` is a JWT for the chosen persona's email. | The JWT decodes (base64url of the payload segment) to a JSON object whose `email` claim equals the chosen persona's email and whose `exp` claim is at least one hour in the future from the start of the agent run. Verifiable by parsing the token in the assertion step. |
| The chosen persona's email comes from synthetic content. | The persona email matches the `email` field of one of the `human`-kind `organization_people` rows derived from `data/synthetic/story.dsl` via `bunx fit-terrain build`. Verifiable by reading the synthetic source and the resolved persona email in the assertion step. |
| Every gated Landmark command exits 0 against the substrate. | For each of the fifteen user-visible gated invocations enumerated in the `commands` array of [`products/landmark/bin/fit-landmark.js`](../../products/landmark/bin/fit-landmark.js), invoking the command in the agent environment (with `LANDMARK_AUTH_TOKEN` set as the workspace prep produced it) exits 0. Verifiable by a smoke-test sequence added to the workflow that runs each gated invocation against the seeded substrate before the agent is handed control. |
| Gated commands return non-empty rows for at least one row class per command. | For each of `org show`, `evidence`, and `practice` invoked as the chosen persona, the standard-output payload (parsed under `--format json`) is non-empty for whatever its top-level row collection is. The three commands cover the roster, evidence-row, and practice-pattern classes that the Landmark queries consume. Verifiable by the same smoke-test sequence. |
| Substrate failures fail the workflow before the agent starts. | An induced failure in any substrate step (for example a deliberately corrupted `data/synthetic/story.dsl` or a stopped Docker daemon in a test run) causes the workflow to exit non-zero on the `Prepare interview workspace` step, with the agent step never invoked. Verifiable by a CI-only regression test (a workflow-dispatch run against a known-bad input) or by manual confirmation captured in the implementation PR. |
| Determinism across re-runs. | Two `workflow_dispatch` runs of `kata-interview.yml` with the same `product`, `job`, and `task-amend` inputs against the same commit on `main` resolve the same chosen persona's email, mint a JWT for that same email, and produce the same exit-code vector for the gated-command smoke test. Verifiable by running the workflow twice and comparing the assertion step's output. |
| Sensitive values are not logged at info level. | The workflow's run logs do not contain the literal value of `LANDMARK_AUTH_TOKEN`, `SUPABASE_JWT_SECRET`, or `SUPABASE_SERVICE_ROLE_KEY` outside masked groups. Verifiable by `grep` over the downloaded run logs against the values captured in the assertion step. |
| The kata-interview skill reflects what the substrate provides. | The [`kata-interview` skill](../../.claude/skills/kata-interview/SKILL.md) Step 3 ("Stage the Agent Workspace") documents that the Landmark substrate, including identity, is present in the agent workspace, and Step 4 ("Craft the Persona") does not instruct the supervisor to brief the agent on provisioning authentication. Verifiable by reading the skill on the post-implementation branch. |
| Production behavior is unchanged outside the workflow. | `fit-landmark`, `fit-map`, `libconfig`, `libsecret`, and the activity migrations are byte-identical to `main` on the implementation branch, with the sole exception of any changes the design picks to land alongside the workflow change. The diff is dominated by `.github/workflows/kata-interview.yml`, the kata-interview skill, and any helper scripts the design introduces. Verifiable by `git diff --stat main` on the implementation branch. |
