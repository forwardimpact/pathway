# Plan 760-a — Shared invocation surfaces for LibUI and LibCLI

Spec: [`spec.md`](spec.md). Design: [`design-a.md`](design-a.md). Plan parts:
[`plan-a-01.md`](plan-a-01.md), [`plan-a-02.md`](plan-a-02.md),
[`plan-a-03.md`](plan-a-03.md).

## Approach

Land the design's nine architectural decisions in three sequential parts. Part
01 publishes the new public surface (libui's `defineRoute`, `createBoundRouter`,
`createCommandBar`, `createJsonLdScript`, `freezeInvocationContext`; libcli's
amended `createCli` handler contract) and the repo-root ESLint rule that forbids
the legacy `params` and `{ data, args, options }` handler shapes — but touches
no product. Part 02 migrates pathway page-by-page and command-by-command onto
the new contract, replaces `setupTopBar` with `createCommandBar`, deletes the
three displaced files, and seals the migration with a route-bindings parity
fixture generated from the pre-migration build. Part 03 updates the catalog
metadata (`forwardimpact.needs`, regenerated `libraries/README.md`) and writes
the external library guide. Parts run sequentially because Part 02 imports from
the libui/libcli HEADs that Part 01 ships, and Part 03's `bun run check`
regeneration must observe the post-migration libui exports.

## Parts index

| #   | Plan                        | Scope                                                                                                  | Owner              | Depends on        |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------ | ----------------- |
| 01  | [`plan-a-01`](plan-a-01.md) | libui exports, libcli amendments, `freezeInvocationContext`, ESLint rule, library tests                | `staff-engineer`   | —                 |
| 02  | [`plan-a-02`](plan-a-02.md) | Pathway adoption: pages, commands, presenters, `main.js`, three deletions, parity fixture              | `staff-engineer`   | Part 01 on `main` |
| 03  | [`plan-a-03`](plan-a-03.md) | Catalog `forwardimpact.needs` entry, regenerated catalog, libui README snippet, external library guide | `technical-writer` | Part 02 on `main` |

## Libraries used

`@forwardimpact/libui` (new exports), `@forwardimpact/libcli` (amended
`createCli`), `@forwardimpact/libgraph` (`RDF_PREFIXES.fit`, read once at
pathway bootstrap), `node:test`, `node:assert`, `node:util` (`parseArgs`,
already a libcli dep), ESLint (`no-restricted-syntax` + a small in-repo plugin).

## Risks (cross-cutting)

- **`history.replaceState` interception.** `setupTopBar` today patches
  `history.replaceState` so the CLI display refreshes when a page (e.g. agent
  builder) rewrites the hash without firing `hashchange`. The design's dispatch
  sequence is silent about this case. Part 01 replicates the interception inside
  `createBoundRouter` so `activeRoute` updates on both `hashchange` and
  `replaceState`; Part 02's parity fixture must include at least one route that
  exercises the agent-builder hash rewrite to detect regression.
- **`parseArgs` positional → named-map mapping.** `node:util`'s `parseArgs`
  returns `positionals` as a flat array including the subcommand name (e.g.
  `["skill", "testing"]`). Part 01's libcli must drop the consumed subcommand
  prefix before zipping against the subcommand definition's `args: string[]`,
  and tolerate fewer-than-declared positionals (optional args).
- **ESLint AST selector for the destructured shape.** `no-restricted-syntax`
  selectors cannot enforce property-name sets directly. Part 01 ships a small
  in-repo ESLint plugin (`tools/eslint-rules/no-legacy-handler-shape.js`) rather
  than coercing this through selectors.
- **Fixture-generation ordering on a single branch.** Part 02's parity test
  requires a fixture generated from the **pre-migration** build of pathway. The
  fixture-generation script runs and commits its output before any pathway
  migration commit on the Part 02 branch; reviewers verify by checking that the
  fixture commit precedes the page-handler commits in the PR's commit list.
- **`createRouter` callers outside pathway.** `createRouter` stays exported
  unchanged for products that do not opt in. Part 01 adds `createBoundRouter`
  alongside it; Part 02 switches pathway over. Other products are not modified.

## Execution

- **Sequential.** Each part's PR depends on the previous part being on `main`
  (libui/libcli HEADs for Part 02; the new libui export visible to
  `bun run lib:fix` for Part 03).
- **Same-branch alternative for Part 02.** If `staff-engineer` opts to land
  Parts 01 + 02 in one branch, the parts remain separately verifiable — Part
  01's tests stay green at the part-01 commit, Part 02's parity test goes green
  at the part-02 commit. The PR description must list the two parts as separate
  review surfaces. Part 03 stays its own branch so `technical-writer` can own
  it.
- **Branches.**
  - Part 01: `feat/760-libui-libcli-invocation-context`
  - Part 02: `feat/760-pathway-adopts-invocation-context`
  - Part 03: `docs/760-web-cli-graph-bindings-guide`
- **Do not skip.** Part 02's migration is the spec's proof; Part 03's catalog
  entry is a success-criterion line in the spec ("The libui catalog reflects the
  new capability"). Both must land for the spec to be implemented.
