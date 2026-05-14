# Spec 950 — Landmark Offline/Demo Mode for Team-Level Commands

## Problem

Landmark's product positioning is an exact match for the *Measure Engineering
Outcomes* job — "demonstrate engineering progress without making individuals
feel surveilled" (Big Hire) and "tell whether culture investments are working
before the next budget cycle" (Little Hire). The
[Landmark for Leaders getting-started page](../../websites/fit/docs/getting-started/leaders/landmark/index.md)
opens with `npx fit-landmark org show`, `snapshot trend`, and `health` as the
canonical first-three-commands a leader runs. The published
`fit-landmark` package on npm installs cleanly and runs `marker <skill>`
end-to-end against local YAML.

Every other command — eleven of twelve — fails immediately with
`Authentication required: LANDMARK_AUTH_TOKEN is not set` before any data path
is consulted. A leader evaluating the tool cannot see the workflow's output
shape without first standing up the Map activity layer (Supabase CLI +
`fit-map activity start/migrate/seed` + GitHub webhook ingestion + GetDX sync
+ auth user provisioning + JWT minting). The cost of that activation is
unbounded relative to the persona's evaluation horizon — a quarterly review
two weeks out followed by budget season — and requires IT involvement at most
organizations. The global `--data` flag, documented as "Path to Map data
directory" and honored end-to-end by `marker`, has no effect on the eleven
analytical commands: every one of them is auth-walled before the data path
is even consulted by the downstream loader.

A BioNova Platform Engineering Manager (J080 persona) exercised the tool in
user testing on issue [#921](https://github.com/forwardimpact/monorepo/issues/921)
and reported the gap verbatim:

> The persona has a complete activity dump on the laptop (`./data/activity/`
> — GetDX snapshots Q3 2024 → Q1 2026, comments, GitHub events, initiatives,
> roster) and would have been able to produce the team-level trend table in
> seconds if `--data` had been an honored offline mode. … The activation cost
> is unbounded relative to the persona's two-week horizon and requires IT
> involvement. Net result: the tool's positioning is perfect for the JTBD but
> the activation step disqualifies it before any value is felt.

The persona's diagnosis matches the code. In `products/landmark/bin/fit-landmark.js`,
the `COMMANDS` map (`:48-61`) marks eleven of twelve commands `needsSupabase: true`;
`resolveIdentity()` is called (`:266`) **before** `buildContext()` (`:267-272`)
and before `--data` is consulted by `loadMapData()` — so the auth gate fires
even when the caller supplies a complete Map data directory and wants only to
see what the workflow would look like. `marker` is the sole `needsSupabase: false`
command, which matches the persona's report that `marker` worked end-to-end
while every other command did not.

The downstream effect is that the JTBD's **Fired When** force ("metrics get
used punitively; or leadership turnover deprioritizes measurement") and the
**Anxiety** force ("measurement feels like surveillance regardless of intent")
both activate before the leader has any chance to evaluate whether Landmark
delivers on the **Pull** ("system-level trends that show direction without
naming individuals"). The **Competes With** alternatives — sprint velocity,
ticket counts, asking managers "how's the team doing?", not measuring — hold
their appeal because the persona never reaches a Landmark output that would
displace them. The persona's own retreat path (constructing the trend table
manually from the raw GetDX dump) is the precise behavior the product copy
promises to dissolve.

The blast radius is the Little Hire on *Measure Engineering Outcomes* —
"tell whether culture investments are working before the next budget cycle" —
for any leader whose evaluation horizon is shorter than the Map activity-layer
stand-up timeline. The adjacent Big Hire ("demonstrate engineering progress
without making individuals feel surveilled") is delivered today by the
authenticated production pipeline for organizations that have already adopted
Map; this spec closes the funnel that gets new evaluators into a position to
see those outputs before they commit to the stand-up cost. Single-org
installations already running Map's activity layer with provisioned auth are
not affected by this change in their current workflow.

## Personas and Job

The hire is **Engineering Leaders** against the *Measure Engineering Outcomes*
job (see [JTBD.md](../../JTBD.md), under the
`<job user="Engineering Leaders" goal="Measure Engineering Outcomes">` entry).
Both hires apply at different stages of the funnel:

- The **Little Hire** — "tell whether culture investments are working before
  the next budget cycle" — names the evaluation-horizon outcome this spec
  delivers. A leader who can see the output shape inside an afternoon, before
  the budget meeting, is in a position to decide whether to commit to the
  full stand-up.
- The **Big Hire** — "demonstrate engineering progress without making
  individuals feel surveilled" — is the long-arc outcome this spec keeps
  reachable. A leader who never sees a single Landmark output, because
  activation gated them out, never reaches the Big Hire either.

The job's **Trigger** ("quarterly review is due and the only data is ticket
counts") is the exact context the persona is in when they install the
package. The downstream observable is the rendered output of team-level
commands (`org`, `snapshot`, `health`, `practice`, `voice`, `practiced`,
`evidence`, `readiness`, `timeline`, `coverage`, `sources`) running against
fixture or caller-supplied data — text the leader can read, screenshot,
share with peers, or take into the budget conversation, *before* the
organization has stood up Supabase.

## Scope

### In scope

| Component | What changes |
|---|---|
| Offline mode invocation | A single, documented way to invoke any team-level command without `LANDMARK_AUTH_TOKEN` and without contacting Supabase. The exact flag name, environment-variable equivalent, and whether the mode reads canned shipped fixtures, caller-supplied YAML/JSON files, or both are design choices. The mode must be discoverable from `fit-landmark --help` and from the per-command `--help` text. |
| Coverage across team-level commands | The mode applies to every command currently marked `needsSupabase: true` in `products/landmark/bin/fit-landmark.js:48-61` (`org`, `snapshot`, `marker`/`evidence`, `readiness`, `timeline`, `coverage`, `practice`, `practiced`, `health`, `voice`, `sources`). `marker` continues to work as today (it is already offline). Each command's offline output is shaped identically to its authenticated output — same columns, same headings, same `--format text|json|markdown` behavior — and is distinguishable as offline output via a documented banner, header line, or footer that names the data source. The exact wording and placement of that distinguishing element is a design choice. |
| Authentication-gate placement | When offline mode is requested, `resolveIdentity()` is not called and `LANDMARK_AUTH_TOKEN` is neither read nor referenced in error messages. When offline mode is not requested and the command is `needsSupabase: true`, the existing identity gate fires at `bin/fit-landmark.js:266` exactly as today, with the existing error class (`IdentityUnresolvedError`) and exit code (`4`). No third path. |
| Network-egress invariant | Under offline mode no Supabase client is constructed, no HTTP request is issued to any host derived from `MAP_SUPABASE_URL` or `MAP_SUPABASE_ANON_KEY`, and the values of those environment variables are not read. The invariant is testable from the command's runtime behavior (no outbound socket) and from a static check on `buildContext()` (`products/landmark/src/lib/context.js:20`) that the `supabase` branch is skipped. |
| Privacy and accident-prevention | The mode cannot be silently activated by environment alone — at minimum one explicit, named indicator must be present in the invocation (whether that indicator is a CLI flag, a fixture path, an env var, or a combination is a design choice). When the indicator is absent the production auth gate fires as today. The mode never reads from or writes to a Supabase database, and it never accepts a real `LANDMARK_AUTH_TOKEN` (passing both should error or ignore the token, design choice). The banner/header/footer that distinguishes offline output names the data source plainly enough that a leader pasting output into a peer message does not accidentally represent fixture numbers as their organization's numbers. |
| Fixture provenance | The package ships at least one demo dataset that exercises every team-level command without errors and renders non-empty output for the canonical first-three commands on the [Landmark for Leaders getting-started page](../../websites/fit/docs/getting-started/leaders/landmark/index.md) (`org show`, `org team`, `marker`). The dataset is small enough to ship inside the npm package without bloating it (specific size budget is a design choice). The shape of the dataset on disk — single bundled JSON, multiple YAML files, `./data/`-like directory tree, in-repo TypeScript constants — is a design choice. The dataset's roster is a fictional team that cannot be confused with a real organization (no real email domains, no employee handles drawn from public sources). |
| Caller-supplied data path | A leader who already has an activity dump on disk (the BioNova persona's `./data/activity/` case) can point the offline mode at their own files and see team-level output computed against their data. The path-shape contract for those files — what filenames are accepted, what JSON/CSV schemas they conform to, how the loader binds them to the eleven commands — is a design choice. Caller-supplied data and shipped-fixture data are independent paths; a single invocation reads from one source, not a mix. |
| Documentation | The [Landmark for Leaders getting-started guide](../../websites/fit/docs/getting-started/leaders/landmark/index.md) gains a section that shows how to run the canonical commands in offline mode without first standing up the Map activity layer, placed before the "Prerequisites" block (so a reader who cannot yet meet the prerequisites has a path forward). The [Demonstrate Engineering Progress guide](../../websites/fit/docs/products/engineering-outcomes/index.md) and the [Tell Whether Culture Investments Are Working guide](../../websites/fit/docs/products/engineering-outcomes/culture-investments/index.md) each carry an entry pointing leaders to the offline-mode section as the recommended first step before activation. The `fit-landmark <command> --help` text and the `fit-landmark` skill ([`.claude/skills/fit-landmark/SKILL.md`](../../.claude/skills/fit-landmark/SKILL.md), if it exists; otherwise `.claude/skills/landmark/SKILL.md`) carry the offline-mode guide URL per [products/CLAUDE.md § Linking rule](../../products/CLAUDE.md). |
| Telemetry honesty | If Landmark currently records or reports any usage metric (run counts, command names, error classes), an offline-mode invocation is either excluded from that telemetry or is tagged in a way that prevents fixture invocations from being conflated with production-data invocations. The exact mechanism is a design choice. |

### Out of scope, deferred

- **Synthetic-data generation in-product.** v1 ships static fixture(s). A
  `fit-landmark synth` subcommand that generates synthetic activity for an
  org of N people over M weeks is a separate spec. The `fit-terrain` library
  exists for this kind of work and is the likely home; v1 does not depend on it.
- **Write-mode offline.** Commands that today write to Supabase (none in
  Landmark; all writes are in Map's activity-ingestion layer) remain
  authenticated. Offline mode is read-only by construction.
- **`--data` deprecation or renaming.** The existing `--data` global option
  continues to behave as it does today for the `marker` command. Whether the
  offline mode reuses `--data`, introduces a new flag, or both is a design
  choice. Removing or repurposing `--data` is out of scope.
- **Cross-product offline mode.** Other product CLIs (Map, Pathway, Guide,
  Summit, Outpost) have their own auth and data postures. This spec changes
  only `fit-landmark`. Whether a unified offline mode across products makes
  sense is a separate question for a future spec.
- **Demo mode for the production-data path.** A leader who *has* stood up
  Supabase and wants to render Landmark output without contacting it (for
  example, a flaky-network demo at a conference) is not the primary use
  case here. If the offline mode happens to serve that case as a side
  effect, fine; designing for it is not in v1.
- **Multi-tenant fixtures.** v1 ships one or a small fixed number of
  fixture datasets. A registry of fixtures the leader can switch between by
  flag, or community-contributed fixture packs, is a separate spec.
- **Performance budget for fixture loads.** The eleven commands run
  end-to-end in offline mode; whether they run in 100 ms or 2 s on the
  shipped fixture is not constrained by this spec.
- **Replacing or simplifying the authenticated path.** The Map activity
  layer, the Supabase Auth JWT flow, and the `LANDMARK_AUTH_TOKEN`
  contract remain unchanged. v1 is a parallel offline lane, not a
  refactor of the authenticated lane.

## Success Criteria

| Claim | Verification |
|---|---|
| Every team-level command runs to non-error completion in offline mode. | Test: for each of the eleven `needsSupabase: true` commands listed in `products/landmark/bin/fit-landmark.js:48-61`, invoking the command in offline mode against the shipped fixture exits 0 and writes non-empty output to stdout. |
| Offline mode does not require `LANDMARK_AUTH_TOKEN`. | Test: with `LANDMARK_AUTH_TOKEN` unset and `MAP_SUPABASE_URL` / `MAP_SUPABASE_ANON_KEY` unset, every team-level command exits 0 in offline mode and writes non-empty output. The same invocations without the offline indicator continue to exit non-zero with the existing `IdentityUnresolvedError` message and exit code 4. |
| Offline mode contacts no network. | Test: under offline mode no Supabase client is constructed (verified by spying on `createLandmarkClient` in `products/landmark/src/lib/supabase.js`) and no outbound socket is opened during command execution (verified at the test-harness level by an outbound-connection counter or by running with network namespaces disabled, mechanism is a design choice). |
| Authenticated-path behavior is unchanged. | Test: without the offline indicator, every team-level command produces output byte-identical to the file the command produces on `main` immediately before this spec lands, for the same `--data` and same Supabase fixture (the test harness's existing mocked Supabase). The implementation captures that baseline as a fixture before the change ships, and the test compares against it. |
| Offline output is distinguishable from production output. | Test: every team-level command in offline mode emits a documented marker (banner, header line, or footer — design choice) that names the data source. The marker is present across all three `--format` values (`text`, `json`, `markdown`) in a form appropriate to each. The marker text is documented in the offline-mode section of the getting-started guide. |
| Caller-supplied data renders. | Test: pointing the offline mode at a caller-supplied directory whose contents match the documented path-shape contract renders team-level output computed against those files, distinct from output computed against the shipped fixture, for at least the `org show` and `snapshot trend` commands. |
| The shipped fixture is privacy-safe. | Test: the fixture's roster contains no email addresses at real domains (other than `example.com` / `example.org` / `example.net`), no GitHub handles matching the `^[a-z0-9-]+$` pattern that resolve to real users on `github.com` (verified at fixture-author time, not at runtime), and a documented banner names the data as fictional in every command's offline output. |
| `--help` discoverability holds. | Test: `npx fit-landmark --help` mentions offline mode by its documented name in the global-options block, and at least one per-command `--help` page (the canonical first-three commands on the getting-started page) names the mode in its options or examples block. |
| Documentation is in place. | Test: the [Landmark for Leaders getting-started guide](../../websites/fit/docs/getting-started/leaders/landmark/index.md) carries a section showing the offline-mode invocation, placed before the "Prerequisites" block. The [Demonstrate Engineering Progress](../../websites/fit/docs/products/engineering-outcomes/index.md) and [Tell Whether Culture Investments Are Working](../../websites/fit/docs/products/engineering-outcomes/culture-investments/index.md) guides each carry an entry pointing to the offline-mode section. The `fit-landmark` skill and CLI carry the guide URL per the repo's linking rule. |
| Telemetry separates offline from production. | Test: if Landmark records any usage telemetry today, offline-mode invocations are either absent from the telemetry stream or carry a tag that distinguishes them from production-data invocations. If Landmark records no usage telemetry today, the test is the absence of new telemetry introduced by this spec. |

— Product Manager 🌱
