# Plan 820-A — Prose-bearing activity contract

[spec.md](spec.md) · [design-a.md](design-a.md)

## Approach

Introduce a `ProseActivity` contract module under
`libraries/libsyntheticgen/src/activity/` carrying JSDoc typedefs
(`ProseActivity`, `ProseContext`, `DriverImpact`, `GenerateContext`,
`ProseKeysContext`) and a single `PROSE_ACTIVITIES` registration array.
Move the snapshot-comment and webhook-stream logic out of
`engine/activity-comments.js`, `engine/activity-webhooks.js`, the
prose-key collection branches in `engine/prose-keys.js`, and the raw
renderers in `render/raw.js` into two per-output modules
(`activity/comment.js`, `activity/webhook.js`) implementing
`generate`/`proseKeys`/`render`. The three call sites then iterate the
registration. The comment module's `generate` removes the `drivers[0]`
filter so the full team-affect driver array flows through; its
`proseKeys` populates `ProseContext.drivers` accordingly. `#buildPrompt`
in `libsyntheticprose/src/engine/generator.js` derives the scalar
`driver`/`direction`/`magnitude` (template `{{#scenario}}` block) from
`drivers[0]`. Validators in `libsyntheticrender/src/validate-activity.js`
read post-refactor field names. A captured baseline of generated file
paths gates the parity claim.

Libraries used: `libsyntheticgen` (new `activity/` module), `libutil`
(`generateHash`, already imported), `yaml` (already imported).

## Field-shape decisions (cross-cutting)

| Decision                                                | Choice                                                                                                                                  |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Where per-output `TOut` lives on `entities.activity`    | `entities.activity[<id>]` keyed by `ProseActivity.id` — `entities.activity.comment = { keys }`, `entities.activity.webhook = { events, keys }`. Old top-level `commentKeys`/`webhookKeys`/`webhooks` keys removed. |
| `ProseActivity.id` values                               | `"comment"`, `"webhook"`. Stable strings used as keys on `entities.activity` and as identifiers in tests/logs.                          |
| `DriverImpact` shape                                    | `{ driver_id: string, trajectory: string, magnitude: number }`. Matches design typedef; no `driver_name`.                               |
| Scalar derivation in `#buildPrompt`                     | `driver = drivers[0]?.driver_id`, `direction = drivers[0]?.trajectory === "declining" ? "declining" : "improving"`, `magnitude = drivers[0]?.magnitude`. `driverContext` block already iterates `drivers` (line 170). |
| Comment-key `driver_name` field (template humanization) | Removed from `commentKeys` (no longer needed once `#buildPrompt` derives the scalar from `drivers[0].driver_id`). The template's `{{#scenario}}` block will render `the deep_work driver is declining` instead of `the Deep Work driver is declining` — explicit non-goal per spec § Scope (out) ("template wording … stay untouched unless the schema change makes them incorrect"). |
| Comment render proseMap lookup                          | Substring-match fallback in `renderGetDXComments` (raw.js:285–294) preserved as-is when the logic moves into `comment.render`.          |
| Validators' new field reads                             | `entities.activity.comment.keys` (was `entities.activity.commentKeys`); `entities.activity.webhook.events` (was `entities.activity.webhooks`); `entities.activity.webhook.keys` (was `entities.activity.webhookKeys`). |

## Step 1 — Add the contract module

Create `libraries/libsyntheticgen/src/activity/index.js`.

- **Created:** `libraries/libsyntheticgen/src/activity/index.js`

Contents (JSDoc only; no runtime types):

```js
/**
 * ProseActivity contract — uniform binding for prose-bearing activity
 * outputs across deterministic generation, prose-context construction,
 * and output rendering.
 *
 * @module libsyntheticgen/activity
 *
 * @typedef {{ driver_id: string, trajectory: string, magnitude: number }} DriverImpact
 *
 * @typedef {object} ProseContext
 * @property {string} topic
 * @property {string} tone
 * @property {string} length
 * @property {number} [maxTokens]
 * @property {string} [domain]
 * @property {string} [orgName]
 * @property {string} [role]
 * @property {string} [scenario]
 * @property {DriverImpact[]} [drivers]
 *
 * @typedef {{ ast: import('../dsl/parser.js').TerrainAST, rng: import('../engine/rng.js').SeededRNG, entities: object }} GenerateContext
 * @typedef {{ domain: string, orgName: string, entities: object }} ProseKeysContext
 *
 * @typedef {object} ProseActivity
 * @property {string} id
 * @property {(ctx: GenerateContext) => any} generate
 * @property {(output: any, ctx: ProseKeysContext) => Iterable<[string, ProseContext]>} proseKeys
 * @property {(output: any, files: Map<string,string>, prose: Map<string,string>|undefined) => void} render
 */

import { commentActivity } from "./comment.js";
import { webhookActivity } from "./webhook.js";

/** @type {ProseActivity[]} */
export const PROSE_ACTIVITIES = [commentActivity, webhookActivity];
```

- **Verify:** `node -e "import('./libraries/libsyntheticgen/src/activity/index.js').then(m=>console.log(m.PROSE_ACTIVITIES.map(p=>p.id)))"` prints `["comment","webhook"]` once Steps 2–3 land.

## Step 2 — Comment ProseActivity module

Move comment generation, prose-context construction, and render into a single per-output module. Strip the top-driver filter; carry the full team-affect `DriverImpact[]` through.

- **Created:** `libraries/libsyntheticgen/src/activity/comment.js`
- **Modified (this step):** none yet — sources still in old locations until Step 5.

`comment.js` exports `commentActivity` with three methods:

| Method       | Source today                                                                | Move + change                                                                                                                                                                                                                                                                                                                                                                  |
| ------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `generate`   | `engine/activity-comments.js` `generateCommentKeys` + helpers (entire file) | Move verbatim with two changes: (a) `collectAffectCandidates` (lines 39–60) returns one candidate per `dx_drivers` entry **carrying the full `drivers: DriverImpact[]` array** rather than collapsing to `drivers[0]` and emitting scalar `driver_id`/`trajectory`/`magnitude`. The top driver remains the *topic* driver (used for shuffle ordering by trajectory) but is no longer the only one carried forward. (b) Each emitted comment-key carries `drivers: DriverImpact[]` (full array) and a `topic_driver_id` scalar (for shuffle/ordering) — `driver_id`, `driver_name`, `trajectory`, `magnitude` are removed. Returns `{ keys: [...] }` (matches design `TOut` style). |
| `proseKeys`  | `engine/prose-keys.js` `addSnapshotCommentKeys` (lines 120–140)             | Yields `[key, ProseContext]` tuples. `ProseContext.drivers = ck.drivers` (full array). Drops scalar `driver`/`direction`/`magnitude` from the context — `#buildPrompt` derives them in Step 7.                                                                                                                                                                                 |
| `render`     | `render/raw.js` `renderGetDXComments` (lines 272–315)                       | Move verbatim. Reads `output.keys` (was `entities.activity.commentKeys`). proseMap substring-match fallback preserved.                                                                                                                                                                                                                                                          |

Sketch of `commentActivity.generate` driver-array section (replacing `activity-comments.js:44–59`):

```js
function collectAffectCandidates(affect, scenario, people, teams) {
  const team = teams.find((t) => t.id === affect.team_id);
  if (!team) return [];
  const teamPeople = people.filter((p) => p.team_id === team.id);
  const drivers = (affect.dx_drivers || [])
    .map((d) => ({ driver_id: d.driver_id, trajectory: d.trajectory, magnitude: d.magnitude }))
    .sort((a, b) => Math.abs(b.magnitude) - Math.abs(a.magnitude));
  if (drivers.length === 0) return [];
  const topDriver = drivers[0];
  return teamPeople.map((person) => ({
    person, team, scenario,
    topic_driver_id: topDriver.driver_id,
    topic_trajectory: topDriver.trajectory,  // kept locally for trajectory bucketing
    drivers,                                  // FULL array — flows to ProseContext.drivers
  }));
}
```

Sketch of `commentActivity.proseKeys`:

```js
export const commentActivity = {
  id: "comment",
  generate(ctx) { /* ...returns { keys } per above... */ },
  *proseKeys(output, { domain, orgName }) {
    for (const ck of output.keys) {
      yield [
        `snapshot_comment_${ck.snapshot_id}_${ck.email.replace(/[@.]/g, "_")}`,
        {
          topic: `GetDX snapshot survey comment about ${ck.topic_driver_id.replace(/_/g, " ")}`,
          tone: "authentic, first-person developer voice",
          length: "1-2 sentences",
          maxTokens: 80,
          domain, orgName,
          role: `${ck.person_level} ${ck.person_discipline.replace(/_/g, " ")} on the ${ck.team_name}`,
          scenario: ck.scenario_name,
          drivers: ck.drivers,
        },
      ];
    }
  },
  render(output, files, proseMap) { /* ...moved renderGetDXComments body... */ },
};
```

- **Verify:** new test (Step 9, Test 1) confirms emitted `commentKeys` carry `drivers: DriverImpact[]` of length ≥ number of declining drivers in the affect.

## Step 3 — Webhook ProseActivity module

Move webhook event generation, key construction, and render into one module. `TOut = { events, keys }` per design.

- **Created:** `libraries/libsyntheticgen/src/activity/webhook.js`

| Method      | Source today                                                                                                              | Move + change                                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `generate`  | `engine/activity-webhooks.js` `generateWebhooks` + `generateWebhookKeys` + all module-private helpers                     | Move verbatim. Returns `{ events: <today's webhooks array>, keys: <today's webhookKeys array> }`. The webhook-prose `cap` slicing inside `generateWebhookKeys` is preserved. |
| `proseKeys` | `engine/prose-keys.js` `addWebhookProseKeys` (lines 207–238)                                                              | Yields `[key, ProseContext]` for each `wk` in `output.keys`. Internal `prose_type === "pr_body"` vs `"review_body"` branching kept (allowed per design Decision #5).      |
| `render`    | `render/raw.js` `renderGitHubWebhooks` + `injectWebhookProse` (lines 50–88)                                              | Move verbatim. Reads `output.events` (was `entities.activity.webhooks`). The `github/index.json` index still emits.                                                       |

- **Verify:** new test (Step 9, Test 2) — `webhookActivity.generate(...)` returns `{ events, keys }` and webhookEvents match the pre-refactor `activity.webhooks` array for the `MINI_TERRAIN` fixture.

## Step 4 — Add a baseline file-path capture script (criterion #6)

Capture the file-path set produced by today's pipeline against the activity test fixture, **before any other refactor commit**, so post-refactor parity is checkable.

- **Created:** `libraries/libsyntheticgen/test/fixtures/file-path-baseline.json`
- **Created:** `libraries/libsyntheticgen/test/fixtures/file-path-baseline.terrain` — minimal DSL fixture extracted from `MINI_TERRAIN` in `activity.test.js` (or imported from a shared module).

`file-path-baseline.json` contains a sorted JSON array of every key produced by `renderRawDocuments(entities, undefined)` against the captured fixture. Generated by a one-off node script run on `main` HEAD before Step 5 lands; the script output is committed, the script itself is not. Document the regeneration command in `file-path-baseline.json`'s sibling `README.md`:

```json
[
  "activity/roster-snapshots.json",
  "activity/roster-snapshots/snap_2024_Q3.yaml",
  "...",
  "github/evt-00000001.json",
  "...",
  "profiles/index.json"
]
```

- **Verify:** `cat libraries/libsyntheticgen/test/fixtures/file-path-baseline.json | jq 'length' > 0` and the file contains the prefixes `github/`, `getdx/`, `activity/`, `profiles/`. Hand-eyeball ≥ 1 entry per current top-level `renderRawDocuments` helper (8 helpers). The post-refactor parity test in Step 9, Test 5 asserts the new pipeline reproduces this exact set.

## Step 5 — Refactor `engine/activity.js` to consult the registration

- **Modified:** `libraries/libsyntheticgen/src/engine/activity.js`
- **Deleted:** `libraries/libsyntheticgen/src/engine/activity-comments.js`
- **Deleted:** `libraries/libsyntheticgen/src/engine/activity-webhooks.js`

Replace lines 7–9 (imports of `generateWebhooks`, `generateWebhookKeys`, `generateCommentKeys`) with one import:

```js
import { PROSE_ACTIVITIES } from "../activity/index.js";
```

Replace lines 72–73, 82, and the corresponding return-object keys (`webhooks`, `webhookKeys`, `commentKeys` at lines 97–98, 102) with the registration loop:

```js
const proseOutputs = {};
const genCtx = { ast, rng, entities: { people, teams, snapshots } };
for (const pa of PROSE_ACTIVITIES) {
  proseOutputs[pa.id] = pa.generate(genCtx);
}

return {
  roster, activityTeams, snapshots, scores, evidence,
  initiatives, scorecards, rosterSnapshots, projectTeams,
  ...proseOutputs,  // adds .comment and .webhook keyed by ProseActivity.id
};
```

The non-prose outputs (`roster`, `activityTeams`, `snapshots`, `scores`, `evidence`, `initiatives`, `scorecards`, `rosterSnapshots`, `projectTeams`) stay top-level — design Decision #3.

The deleted `activity-comments.js` and `activity-webhooks.js` files have no other importers in the repo (verified by grep — only references are from `activity.js` line 7–9 and the spec/design docs themselves).

- **Verify:** `bun run test --filter libsyntheticgen` passes (existing `activity.test.js` will need a small update — see Step 9). `grep -RIn 'commentKeys\|webhookKeys\|webhooks' libraries/libsyntheticgen/src/engine/activity.js` returns zero matches in identifier or string-literal positions.

## Step 6 — Refactor `engine/prose-keys.js` activity branches

- **Modified:** `libraries/libsyntheticgen/src/engine/prose-keys.js`

Delete `addSnapshotCommentKeys` (lines 113–140) and `addWebhookProseKeys` (lines 200–239). Replace the two `entities.activity?.commentKeys` and `entities.activity?.webhookKeys` branches in `collectProseKeys` (lines 184–195) with a single registration loop:

```js
import { PROSE_ACTIVITIES } from "../activity/index.js";

// inside collectProseKeys, after the org_readme/projects/guide_html/outpost_markdown branches:
const pkCtx = { domain, orgName, entities };
for (const pa of PROSE_ACTIVITIES) {
  const output = entities.activity?.[pa.id];
  if (!output) continue;
  for (const [k, ctx] of pa.proseKeys(output, pkCtx)) keys.set(k, ctx);
}
```

The non-activity branches (`org_readme`, `projects`, `guideContent`, `outpostContent` — lines 152–182) stay unchanged.

- **Verify:** `grep -n 'commentKeys\|webhookKeys\|addSnapshotCommentKeys\|addWebhookProseKeys' libraries/libsyntheticgen/src/engine/prose-keys.js` returns zero. Existing prose-key consumers see the same key set for `MINI_TERRAIN` (covered by Step 9 Test 4).

## Step 7 — Refactor `render/raw.js` activity branches

- **Modified:** `libraries/libsyntheticrender/src/render/raw.js`

Delete `renderGitHubWebhooks` (lines 70–88) and its helper `injectWebhookProse` (lines 50–68); delete `renderGetDXComments` (lines 272–315). Replace lines 20 and 24 (the two calls to those helpers inside `renderRawDocuments`) with one registration loop:

```js
import { PROSE_ACTIVITIES } from "@forwardimpact/libsyntheticgen/activity";

export function renderRawDocuments(entities, proseMap) {
  const files = new Map();
  for (const pa of PROSE_ACTIVITIES) {
    const output = entities.activity?.[pa.id];
    if (!output) continue;
    pa.render(output, files, proseMap);
  }
  renderGetDXPayloads(entities, files);
  renderGetDXInitiatives(entities, files);
  renderGetDXScorecards(entities, files);
  renderRosterSnapshots(entities, files);
  renderSummitYAML(entities, files);
  renderPeopleYAML(entities, files);
  return files;
}
```

The non-prose helpers (`renderGetDXPayloads`, `renderGetDXInitiatives`, `renderGetDXScorecards`, `renderRosterSnapshots`, `renderSummitYAML`, `renderPeopleYAML`) stay inline. Update the JSDoc top comment (lines 1–7) to reflect that webhook and comment rendering now live in `libsyntheticgen/activity/`.

The `@forwardimpact/libsyntheticgen/activity` import requires an `exports` map entry in `libraries/libsyntheticgen/package.json`:

```json
"exports": {
  "./vocabulary.js": "./src/vocabulary.js",
  "./activity": "./src/activity/index.js"
}
```

- **Modified:** `libraries/libsyntheticgen/package.json` — add the `./activity` export.
- **Verify:** `grep -n 'webhook\|comment' libraries/libsyntheticrender/src/render/raw.js` returns matches **only** in the non-prose helpers' bodies (e.g. `renderGetDXPayloads` reads `entities.activity?.webhook?.events` indirectly? — no, only the new registration loop touches webhook/comment data). The string literals `"comment"`, `"webhook"`, `commentKeys`, `webhookKeys` no longer appear in raw.js.

## Step 8 — Update `#buildPrompt` to derive scalars from `drivers[0]`

- **Modified:** `libraries/libsyntheticprose/src/engine/generator.js`

In `#buildPrompt` (lines 169–190), derive scalar `driver`/`direction`/`magnitude` from `context.drivers?.[0]` instead of reading them as separate context fields:

```js
#buildPrompt(key, context) {
  const drivers = context.drivers || [];
  const top = drivers[0];
  const driverContext = drivers
    .map((d) => `- ${d.driver_id}: ${d.trajectory} (magnitude: ${d.magnitude})`)
    .join("\n");

  return this.promptLoader.render("prose-user", {
    topic: context.topic || key.replace(/_/g, " ").replace(/-/g, " "),
    tone: context.tone || "technical",
    length: context.length || "2-3 paragraphs",
    domain: context.domain,
    orgName: context.orgName,
    role: context.role,
    audience: context.audience,
    scenario: context.scenario,
    driver: top?.driver_id,
    direction: top
      ? (top.trajectory === "declining" ? "declining" : "improving")
      : undefined,
    magnitude: top?.magnitude,
    driverContext: driverContext || undefined,
  });
}
```

The prompt template (`libraries/libsyntheticprose/src/prompts/prose-user.prompt.md`) is **not** edited — design § Comment driver-context fix line 113 says only `#buildPrompt` changes.

- **Verify:** Step 9 Test 3 asserts `#buildPrompt` returns equal strings for two contexts with identical fields but different cache keys.

## Step 9 — Update validators to read post-refactor field shape

- **Modified:** `libraries/libsyntheticrender/src/validate-activity.js`

Mechanical rename — six checks read the old field names and must be updated:

| Function (line)                        | Old read                            | New read                                |
| -------------------------------------- | ----------------------------------- | --------------------------------------- |
| `checkWebhookPayloadSchemas` (15)      | `entities.activity?.webhooks`       | `entities.activity?.webhook?.events`    |
| `checkWebhookDeliveryIds` (34)         | `entities.activity?.webhooks`       | `entities.activity?.webhook?.events`    |
| `checkWebhookSenderUsernames` (49)     | `entities.activity?.webhooks`       | `entities.activity?.webhook?.events`    |
| `checkCommentSnapshotRefs` (234)       | `entities.activity?.commentKeys`    | `entities.activity?.comment?.keys`      |
| `checkCommentEmailRefs` (253)          | `entities.activity?.commentKeys`    | `entities.activity?.comment?.keys`      |
| `checkCommentTeamRefs` (268)           | `entities.activity?.commentKeys`    | `entities.activity?.comment?.keys`      |

No other validator touches these fields (`grep -n 'commentKeys\|webhookKeys\|activity?.webhooks' libraries/libsyntheticrender/src/validate-activity.js` confirms scope). Test files for validate-activity (if any) update with the same renames.

- **Verify:** `bun run test --filter libsyntheticrender` passes. `grep -n 'commentKeys\|webhookKeys' libraries/libsyntheticrender/src/validate-activity.js` returns zero.

## Step 10 — Tests aligned to spec success criteria

- **Modified:** `libraries/libsyntheticgen/test/activity.test.js`
- **Created:** `libraries/libsyntheticgen/test/prose-activity.test.js`
- **Created:** `libraries/libsyntheticprose/test/build-prompt.test.js`
- **Created:** `libraries/libsyntheticgen/test/file-path-parity.test.js`

| #   | Test                                                                                                                                                                                                                                                                                                            | File                                                  | Spec criterion |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------- |
| 1   | "comment proseKeys carries multi-driver array" — fixture extends `MINI_TERRAIN` so `pressure` scenario `affect alpha` declares `dx_drivers` with two declining drivers (`deep_work -6`, `ease_of_release -4`); for any comment-key whose author is on team `alpha`, assert `ProseContext.drivers.length === 2` and contains both `driver_id`s with their magnitudes. | `prose-activity.test.js`                              | #3             |
| 2   | "webhook generate emits {events, keys}" — `webhookActivity.generate({ ast, rng, entities: { people, teams } })` returns object with `events: object[]` and `keys: object[]`; `events.length > 0` and each event has `delivery_id` + `event_type`.                                                              | `prose-activity.test.js`                              | #1             |
| 3   | "buildPrompt is a function of context alone" — construct two `ProseContext` entries with identical `topic`/`tone`/`length`/`scenario`/`role`/`drivers`; pass them to a `ProseGenerator` instance with a stub `promptLoader.render` (echoes its template + locals) under different cache keys; assert both rendered prompts are byte-equal. | `build-prompt.test.js`                                | #4             |
| 4   | "registration is the single source of truth" — `assert.deepStrictEqual(PROSE_ACTIVITIES.map(p=>p.id).sort(), ["comment","webhook"])`. Static `grep` test using `node:fs.readFileSync`: assert that `engine/activity.js`, `engine/prose-keys.js`, and `render/raw.js` source contains zero matches for `/commentKeys|webhookKeys|addSnapshotCommentKeys|addWebhookProseKeys/`. | `prose-activity.test.js`                              | #1, #2         |
| 5   | "post-refactor file paths match baseline" — read `test/fixtures/file-path-baseline.json`, run `generateActivity` + `renderRawDocuments(entities, undefined)` on the same fixture, assert `Array.from(files.keys()).sort()` equals the baseline.                                                                | `file-path-parity.test.js`                            | #6             |
| 6   | "snapshot comment generation under multi-driver-declining input" (per-output unit test, criterion #5) — same fixture as Test 1; assert `commentActivity.generate(ctx).keys` is non-empty and every comment-key carries `drivers: DriverImpact[]` of length `≥ 1`.                                              | `prose-activity.test.js`                              | #5             |
| 7   | "webhook proseKeys yields PR + review entries with drivers" (per-output unit test, criterion #5) — for `MINI_TERRAIN` fixture, collect tuples from `webhookActivity.proseKeys(output, pkCtx)`; assert at least one `pr_body_*` and one `review_body_*` key, each with `drivers: DriverImpact[]`.                | `prose-activity.test.js`                              | #5             |

The `activity.test.js` modifications are mechanical: `activity.commentKeys` → `activity.comment.keys`, `activity.webhooks` → `activity.webhook.events`, plus a stub of the new `drivers` field where the existing test asserts comment-key field presence (line 293–304). The "comment keys are stable when upstream RNG drifts" test (lines 306–324) keeps working because the isolated `commentRng` lives inside `commentActivity.generate`.

- **Verify:** `bun run test` passes from monorepo root. CI passes.

## Step 11 — Update READMEs and JSDoc only where references break

- **Modified:** `libraries/libsyntheticgen/README.md` — if it lists `engine/activity-comments.js` or `engine/activity-webhooks.js` as exports, update to `activity/comment.js`/`activity/webhook.js`. If those names are not in the README, no edit.
- **Modified:** `libraries/libsyntheticrender/src/render/raw.js` JSDoc top comment — note webhook + comment branches now live in `libsyntheticgen/activity/`.

No documentation pages on `websites/fit/docs/` reference these internal modules (verified by grep — only `specs/820-…/spec.md` and `specs/820-…/design-a.md` reference them, and those are the upstream artifacts).

- **Verify:** `bun run check` passes.

## Risks (implementer-blind)

- **`libsyntheticrender` import path on `@forwardimpact/libsyntheticgen/activity`.** `libsyntheticgen/package.json` does not currently expose `src/activity/index.js` as an entry point (only `vocabulary.js` is in `exports`). Step 7 adds the export. Test the import resolves under both Node (`node --input-type=module -e "import('@forwardimpact/libsyntheticgen/activity').then(m=>console.log(m))"`) and Bun before relying on it.
- **Webhook prose `cap` slicing semantics.** `generateWebhookKeys` (lines 438–443) slices the keys array down to `ast.snapshots?.webhook_prose_cap` if set. Move-verbatim into `webhookActivity.generate` must preserve this — easy to drop accidentally because `events` (uncapped) and `keys` (capped) live in the same `TOut`.
- **Cross-module RNG isolation.** `activity-comments.js` line 106 builds an isolated RNG (`createSeededRNG(${ast.seed}:comments)`) and explicitly ignores the shared `rng` parameter. `commentActivity.generate({ ast, rng, ... })` must keep the isolated RNG and the `void rng` discipline; otherwise the "comment keys are stable when upstream RNG drifts" test fails.
- **`drivers` field name collision in webhook keys.** Today's `webhookKeys` already carry a `drivers` field that is itself a `DriverImpact[]` (built in `extractDriversFromAffect`, lines 314–320) — that field is exactly what `proseKeys` passes to `ProseContext.drivers`. No change needed for webhook semantics; risk is only that a sloppy refactor renames the field in one place but not the other.
- **`renderGetDXComments` substring-matching of proseMap keys.** The fallback loop at raw.js:285–294 iterates `proseMap` looking for substring matches. The behavior is unchanged in `commentActivity.render`, but the implementer should not "tidy" this into a direct `proseMap.get(proseKey)` — the substring fallback exists for a reason (cache-key drift) per the inline comment.
- **Comment `driver_name` removal from prompt template variables.** Removing the human-readable `driver_name` from the comment context ("Deep Work" → "deep_work" in the rendered prompt) is a deliberate non-goal regression per spec § Scope (out). Manual prose inspection post-merge (per spec test plan) should confirm LLM output remains coherent. If LLM output degrades, follow-up spec covers humanization in `#buildPrompt`.
- **Baseline fixture brittleness.** The Step 4 baseline captures every file path including those whose count depends on RNG (e.g. `github/evt-NNNNNNNN.json`, `getdx/snapshots-info/snap_*.json`). The fixture must use a fixed `seed` and the captured baseline regenerated only when the fixture itself changes. Document the regeneration command in the baseline file's sibling README so a future mechanical change does not silently rewrite the baseline.

## Execution

Single-agent sequential execution by `staff-engineer`. Steps 1–11 are sequenced because each step's verification depends on the prior step's source state (e.g. Step 5's `grep` check assumes Step 1 created `activity/index.js`; Step 9's validators assume Step 5 changed the field shape on `entities.activity`). Total expected diff: ~600 lines added (new modules + tests), ~500 lines removed (deleted source + branches). No parallel decomposition warranted.

Pair this plan with the `kata-implement` skill — implementation runs `bun run check` + `bun run test` after each step and opens one impl PR.
