# Plan 760-a-02 — Pathway adopts the new contract

Spec: [`spec.md`](spec.md). Design: [`design-a.md`](design-a.md). Overview:
[`plan-a.md`](plan-a.md). Depends on Part 01 (`plan-a-01.md`) being on `main`.

Migrates pathway onto the libui/libcli surfaces shipped in Part 01, deletes the
three displaced files, and seals the migration with a route-bindings parity
fixture. After this part, `bun run lint products/pathway` is clean against the
rule from Part 01 Step 9.

## Step 1 — Generate the pre-migration baseline fixture

Adds the generator script and the fixture it produces from the **pre-migration**
build of pathway. This step lands on the branch as the first commit so reviewers
can see the fixture origin.

| Action  | Path                                                          |
| ------- | ------------------------------------------------------------- |
| Created | `products/pathway/scripts/generate-route-bindings-fixture.js` |
| Created | `products/pathway/test/fixtures/route-bindings.json`          |

The generator imports `getCliCommand` from the still-extant
`src/lib/cli-command.js` and the per-entity functions from
`src/formatters/json-ld.js`. For every entry returned by an enumeration of
`setupRoutes()` patterns in `src/main.js` (lifted into a separate exported
constant in this commit), the generator picks one representative concrete URL
(see § Representative URL table below), invokes the route's web handler against
a fixture data payload, captures the JSON-LD payload that page mints, and
records `{ pattern, url, cliCommand, jsonLd }`.

The fixture is built once and committed:

```sh
cd products/pathway && bun scripts/generate-route-bindings-fixture.js > test/fixtures/route-bindings.json
```

**Representative URL table** (committed inside the script as the source of truth
— used by the generator and by the post-migration replay test):

| Pattern                                | URL                                                    |
| -------------------------------------- | ------------------------------------------------------ |
| `/`                                    | `/`                                                    |
| `/skill`                               | `/skill`                                               |
| `/skill/:id`                           | `/skill/testing`                                       |
| `/discipline/:id`                      | `/discipline/engineering`                              |
| `/track/:id`                           | `/track/individual-contributor`                        |
| `/level/:id`                           | `/level/senior`                                        |
| `/driver/:id`                          | `/driver/customer-empathy`                             |
| `/behaviour/:id`                       | `/behaviour/clarity-of-thought`                        |
| `/tool`                                | `/tool`                                                |
| `/job/:discipline/:level/:track`       | `/job/engineering/senior/individual-contributor`       |
| `/interview/:discipline/:level/:track` | `/interview/engineering/senior/individual-contributor` |
| `/progress/:discipline/:level/:track`  | `/progress/engineering/senior/individual-contributor`  |
| `/agent-builder` (no CLI binding)      | `/agent-builder`                                       |

The agent-builder entry intentionally has `cliCommand: null` — exercises the
spec's "command bar handles routes without a CLI binding" success criterion.

**Verification:** generator script runs once; fixture file commits as a separate
commit ahead of any migration commit. Reviewer reads the fixture JSON and
confirms it carries one entry per `setupRoutes()` pattern.

## Step 2 — Per-entity `graph` formatters carved out of `json-ld.js`

Splits today's `formatters/json-ld.js` into per-entity body builders (kept) and
per-entity `graph` formatters (kept; `@id`-minting now done by libui).

| Action   | Path                                         |
| -------- | -------------------------------------------- |
| Modified | `products/pathway/src/formatters/json-ld.js` |

Today's file contains both halves (json-ld.js:43-218). After this commit:

- Removed: `createJsonLdScript` (lines 15-20), the `VOCAB_BASE` constant (line
  8), and the `@id`-string construction inside each `*ToJsonLd` function (lines
  28-34, and the `@id` assignment inside each entity function).
- Kept: every per-entity body builder, renamed from `*ToJsonLd` to `*Body` (e.g.
  `skillToJsonLd → skillBody`). Each `*Body` returns the merged
  `{ @context, @type, ...fields }` object **without** an `@id`.
- Added: per-entity `graph` formatters exported from the same file:

  ```js
  export const graphSkill = (ctx, vocabularyBase) => `${vocabularyBase}Skill/${ctx.args.id}`;
  export const graphDiscipline = (ctx, vocabularyBase) => `${vocabularyBase}Discipline/${ctx.args.id}`;
  // ...one per entity that previously minted @id
  ```

  IRIs match what the pre-migration code minted (the parity fixture enforces
  this).

**Verification:** the parity fixture's `jsonLd["@id"]` for every entity-detail
URL equals the value computed by the new `graph<Entity>(ctx, VOCAB_BASE)`.

## Step 3 — Web pages converge on `(ctx)`

Rewrites every page handler in `src/pages/*.js` to take a single `ctx` argument
and read state from `ctx.data` and `ctx.options`. The rule from Part 01 Step 9
enforces this.

| Action   | Path                                                   |
| -------- | ------------------------------------------------------ |
| Modified | `products/pathway/src/pages/agent-builder.js`          |
| Modified | `products/pathway/src/pages/agent-builder-download.js` |
| Modified | `products/pathway/src/pages/agent-builder-install.js`  |
| Modified | `products/pathway/src/pages/agent-builder-preview.js`  |
| Modified | `products/pathway/src/pages/assessment-results.js`     |
| Modified | `products/pathway/src/pages/behaviour.js`              |
| Modified | `products/pathway/src/pages/discipline.js`             |
| Modified | `products/pathway/src/pages/driver.js`                 |
| Modified | `products/pathway/src/pages/interview-builder.js`      |
| Modified | `products/pathway/src/pages/interview.js`              |
| Modified | `products/pathway/src/pages/job-builder.js`            |
| Modified | `products/pathway/src/pages/job.js`                    |
| Modified | `products/pathway/src/pages/landing.js`                |
| Modified | `products/pathway/src/pages/level.js`                  |
| Modified | `products/pathway/src/pages/progress-builder.js`       |
| Modified | `products/pathway/src/pages/progress-comparison.js`    |
| Modified | `products/pathway/src/pages/progress.js`               |
| Modified | `products/pathway/src/pages/self-assessment-steps.js`  |
| Modified | `products/pathway/src/pages/self-assessment.js`        |
| Modified | `products/pathway/src/pages/skill.js`                  |
| Modified | `products/pathway/src/pages/tool.js`                   |
| Modified | `products/pathway/src/pages/track.js`                  |

Per-file change shape (uniform):

| Before                                                                           | After                                                                                                                                                             |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `export function renderSkillDetail(params) { ... getState() ... params.id ... }` | `export function renderSkillDetail(ctx) { const { skills, capabilities } = ctx.data; const { id } = ctx.args; const wantsJson = ctx.options.json === true; ... }` |
| `export function renderSkillsList() { const { data } = getState(); ... }`        | `export function renderSkillsList(ctx) { const { skills, capabilities } = ctx.data; ... }`                                                                        |

`getState()` reaches are removed in this commit. Pages that today consume
non-route UI state (e.g. `self-assessment.js` reads assessment progress from the
store) keep their store import — `getState()` is allowed for **UI** state but
not for `data`. The Part 01 ESLint rule does not flag this; the parity fixture
asserts no behaviour change.

`window.location.hash` query-string parsing — currently absent from pages — is
moved upstream to `createBoundRouter` (Part 01 Step 3). No page reads
`window.location` after this commit. Verify with
`grep -nR 'window.location.hash' products/pathway/src/pages/` — zero hits.

**Verification:** `bun run lint products/pathway/src/pages` — clean.

## Step 4 — Shared presenters take `(ctx)`

Each entity's `formatters/<entity>/shared.js` exposes a single
`present<Entity>Detail(ctx) → view` function. This is the one presenter per
capability the spec mandates.

| Action   | Path                                                   |
| -------- | ------------------------------------------------------ |
| Modified | `products/pathway/src/formatters/skill/shared.js`      |
| Modified | `products/pathway/src/formatters/behaviour/shared.js`  |
| Modified | `products/pathway/src/formatters/discipline/shared.js` |
| Modified | `products/pathway/src/formatters/track/shared.js`      |
| Modified | `products/pathway/src/formatters/level/shared.js`      |
| Modified | `products/pathway/src/formatters/driver/shared.js`     |
| Modified | `products/pathway/src/formatters/tool/shared.js`       |
| Modified | `products/pathway/src/formatters/interview/shared.js`  |
| Modified | `products/pathway/src/formatters/progress/shared.js`   |
| Modified | `products/pathway/src/formatters/questions/shared.js`  |

Per-file change shape:

| Before                                                                     | After                                                                                                                                                                   |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `export function presentSkillDetail(skill, { capabilities, disciplines })` | `export function presentSkillDetail(ctx) { const { id } = ctx.args; const { skills, capabilities, disciplines } = ctx.data; const skill = findSkill(skills, id); ... }` |

`findSkill` / `findEntity` helpers move into the shared file (out of
`commands/command-factory.js`); web pages and CLI handlers both call the
presenter, which calls the finder. The web page mounts `view` to DOM via
existing `*ToDOM` formatters; the CLI handler renders `view` to stdout via
existing `formatDetail` formatters. Neither side carries capability logic.

**Verification:** parity fixture replay passes;
`grep -nR 'export function present' products/pathway/src/formatters/*/shared.js`
shows every presenter takes one parameter.

## Step 5 — `commands/command-factory.js` builds an `InvocationContext`

| Action   | Path                                               |
| -------- | -------------------------------------------------- |
| Modified | `products/pathway/src/commands/command-factory.js` |

Replace the `({ data, args, options })` parameter with `(ctx)` and replace the
inline finder/presenter calls with the shared presenter from Step 4.

```js
export function createEntityCommand({ entityName, pluralName, presentDetail, formatSummary, formatDetail, formatListItem, sortItems, validate }) {
  return async function runCommand(ctx) {
    const { args, options, data } = ctx;
    const id = args[entityName] ?? args.id;   // Part 01 Step 8 hands us a named map
    const rawItems = data[pluralName];
    if (options.validate) return doValidate(rawItems, validate);
    if (options.list) return printIds(rawItems);
    if (id === undefined) return formatSummary(rawItems, data);
    const view = presentDetail(ctx);          // shared with the web side
    return formatDetail(view, data.standard);
  };
}
```

`createCompositeCommand` (job/interview/progress) follows the same shape — the
composite key resolution uses `ctx.args.discipline`, `ctx.args.level`,
`ctx.args.track`.

**Verification:** existing CLI smoke `npx fit-pathway skill testing` after the
migration prints the same output as before; covered by a CLI snapshot test added
in Step 10.

## Step 6 — Per-entity command files take `(ctx)`

| Action   | Path                                          |
| -------- | --------------------------------------------- |
| Modified | `products/pathway/src/commands/skill.js`      |
| Modified | `products/pathway/src/commands/behaviour.js`  |
| Modified | `products/pathway/src/commands/discipline.js` |
| Modified | `products/pathway/src/commands/track.js`      |
| Modified | `products/pathway/src/commands/level.js`      |
| Modified | `products/pathway/src/commands/driver.js`     |
| Modified | `products/pathway/src/commands/tool.js`       |
| Modified | `products/pathway/src/commands/job.js`        |
| Modified | `products/pathway/src/commands/interview.js`  |
| Modified | `products/pathway/src/commands/progress.js`   |
| Modified | `products/pathway/src/commands/questions.js`  |

For files that already use `createEntityCommand` (most), no body change is
needed — the factory now returns the new shape. For hand-rolled commands
(`runJobCommand`, `runQuestionsCommand`), rewrite the signature and destructure
as in Step 5.

**Verification:** `bun run lint products/pathway/src/commands` — clean.

## Step 7 — `bin/fit-pathway.js` folds runtime extras into `data`

| Action   | Path                                  |
| -------- | ------------------------------------- |
| Modified | `products/pathway/bin/fit-pathway.js` |

Three changes:

1. Import `RDF_PREFIXES` from `@forwardimpact/libgraph` once and pass
   `RDF_PREFIXES.fit` as a `vocabularyBase` (where libcli does not need it
   directly — it is stashed in `data` for `graph` formatters that may render
   IRIs to stdout, e.g. `--json` output).
2. Build `data` as the union of the loaded YAML data plus runtime extras the
   spec calls out:
   ```js
   const data = { ...loaded, dataDir, templateLoader, vocabularyBase: RDF_PREFIXES.fit };
   ```
3. Subcommand definitions in the local `definition` object gain
   `args: string[]`:
   ```js
   { name: "skill", args: ["id"], options: { ... } },
   { name: "job",   args: ["discipline", "level"], options: { track: { type: "string" } } },
   ```

Replace today's
`await handler({ data, args, options: values, dataDir, templateLoader, loader })`
with `cli.dispatch(parsed, { data })` (the new entry point added in Part 01 Step
8).

**Verification:** `npx fit-pathway --help` renders the new `args` names in usage
strings; `npx fit-pathway skill testing` exits 0 and matches the pre-migration
snapshot.

## Step 8 — `main.js` switches to `createBoundRouter` and registers descriptors

| Action   | Path                           |
| -------- | ------------------------------ |
| Modified | `products/pathway/src/main.js` |

Replace the `createRouter` import with
`createBoundRouter, defineRoute, createCommandBar` from `@forwardimpact/libui`.
Pass the loaded `data` and `RDF_PREFIXES.fit` once at construction.
`setupRoutes()` becomes a list of
`router.register(defineRoute({ pattern, page, cli, graph }))` — one call per
route, with `cli` an inline arrow that returns the CLI string the pre-migration
`getCliCommand` returns for that pattern, and `graph` the formatter from Step 2
(omitted on routes without a graph entity, e.g. `/agent-builder`).

```js
const router = createBoundRouter({
  data, vocabularyBase: RDF_PREFIXES.fit,
  onNotFound: renderNotFound, onError: ..., renderError: ...,
});

router.register(defineRoute({
  pattern: "/skill/:id",
  page: renderSkillDetail,
  cli: (ctx) => `npx fit-pathway skill ${ctx.args.id}`,
  graph: graphSkill,
}));
// ... one register call per route, mirroring main.js:85-139
createCommandBar(router, { mountInto: document.getElementById("cli-command-bar") });
router.start();
```

`updateActiveNav` continues to subscribe to `hashchange` directly (UI concern,
not a router concern). The page-private `updateNav()` in main.js:73-79 stays.

**Verification:** load pathway in a browser; navigate `/skill/testing` → command
bar shows `npx fit-pathway skill testing`; navigate `/agent-builder` → command
bar shows empty text; navigate back → bar updates immediately.

## Step 9 — Delete the three displaced files

| Action  | Path                                         |
| ------- | -------------------------------------------- |
| Deleted | `products/pathway/src/lib/cli-command.js`    |
| Deleted | `products/pathway/src/components/top-bar.js` |
| Deleted | `products/pathway/test/cli-command.test.js`  |

`cli-command.test.js` (today's tests for `getCliCommand`) is replaced by the
parity replay test added in Step 10.

**Verification:**
`grep -nR "from .*lib/cli-command" products/pathway/src && grep -nR "from .*components/top-bar" products/pathway/src`
— zero hits.

## Step 10 — Parity replay test and CLI snapshot

| Action  | Path                                                  |
| ------- | ----------------------------------------------------- |
| Created | `products/pathway/test/route-bindings-parity.test.js` |
| Created | `products/pathway/test/handler-shape.test.js`         |
| Created | `products/pathway/test/cli-snapshot.test.js`          |

`route-bindings-parity.test.js` reads `test/fixtures/route-bindings.json`
(Step 1) and, for each entry, drives the post-migration code: constructs an
`InvocationContext` from `url`, calls the matching descriptor's `cli(ctx)` and
asserts equality with `cliCommand`; calls the descriptor's
`graph(ctx, VOCAB_BASE)` and the matching `*Body` function, mounts the result
through `createJsonLdScript`, parses `script.textContent`, and asserts
deep-equal with `jsonLd`.

`handler-shape.test.js` is the spec § Success-criteria test: imports every
module in `pages/` and `commands/`, runs each export through Babel parser (or
`@babel/parser` already a dev dep, otherwise `acorn`), and asserts every
exported function declares exactly one parameter, the function body references
neither `getState` nor `window.location.hash`, and the parameter is not a
`{ data, args, options }` destructure.

`cli-snapshot.test.js` runs `bun run bin/fit-pathway skill testing`,
`...discipline engineering`, etc. (one per shared presenter capability, ≥ 3 per
success criterion line 327) and asserts stdout matches a committed snapshot.

**Verification:** `cd products/pathway && bun test` — all green; existing
non-touched tests remain green.

## Libraries used

`@forwardimpact/libui` (consumes `defineRoute`, `createBoundRouter`,
`createCommandBar`, `createJsonLdScript`, `freezeInvocationContext` from Part
01), `@forwardimpact/libcli` (amended `Cli.dispatch`), `@forwardimpact/libgraph`
(`RDF_PREFIXES.fit`, read once at bootstrap), `@babel/parser` or `acorn` (dev —
for the AST shape test; whichever the repo already depends on; verify in commit
1).

## Risks

- **`getState()` retained for UI state.** `self-assessment.js` and a couple of
  agent-builder pages read assessment progress and form state from the store.
  Removing those reaches is out of spec scope (spec.md success criterion 332
  forbids `getState` only as a `data` reach). The handler-shape test in Step 10
  must distinguish: it asserts `getState` is not used to pull `data` — i.e.
  `getState().data` is forbidden, while `getState().ui` is allowed. Encode this
  by pattern-matching on the member-expression property.
- **`agent-builder.js` route param shape.** The agent-builder routes
  `/agent/:discipline` and `/agent/:discipline/:track` resolve to the same page
  handler. Confirm `ctx.args.discipline` and `ctx.args.track` (undefined when
  absent) reach the page; the parity fixture covers `/agent/engineering` and the
  three-segment form.
- **`createJsonLdScript` invocation site.** Today, every detail page calls
  `createJsonLdScript(skillToJsonLd(skill))` and mounts it. Post-migration,
  pages call `createJsonLdScript(descriptor.graph, body, { vocabularyBase })`.
  `descriptor` is reachable via `router.activeRoute.get().descriptor`; the page
  accepts `{ vocabularyBase }` as the second argument to its `page(ctx, opts)`
  signature (per Part 01 Step 3) and forwards both to the helper. Reviewers
  verify the call sites in Step 3's pages match this.
- **CLI snapshot drift.** `cli-snapshot.test.js` snapshots may carry ANSI colour
  codes; commit them with `process.env.NO_COLOR=1` so the snapshot is stable
  across local and CI runs.

## Verification (whole part)

- `cd products/pathway && bun test` — all green.
- `bun run lint products/pathway` — clean (no `local/no-legacy-handler-shape`
  errors).
- `bun run check` — clean.
- Manual smoke: `cd products/pathway && bun run dev`, navigate the routes in the
  fixture; command bar reflects the active route on every change, including
  `/agent-builder`'s `replaceState`-driven hash updates.
