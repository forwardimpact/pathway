# Spec 760 — LibUI route–channel bindings

## Problem

Pathway is the only product whose web routes are bound to a parallel CLI
command and a stable graph entity IRI. The three bindings live as one-off files
inside the product:

- `products/pathway/src/lib/cli-command.js` — an ordered table of
  `{ pattern: RegExp, toCommand }` rules that turns a hash route like
  `/skill/testing` into the equivalent `npx fit-pathway skill testing`.
- `products/pathway/src/components/top-bar.js` — the Safari-style URL bar that
  displays the current command, plus copy-to-clipboard and a
  `history.replaceState` interception that keeps the display in sync.
- `products/pathway/src/formatters/json-ld.js` — per-entity functions that mint
  `https://www.forwardimpact.team/schema/rdf/<Type>/<id>` IRIs (matching
  `libgraph`'s `fit:` prefix in `libraries/libgraph/src/index.js`) and emit them
  as `<script type="application/ld+json">` from each detail page.

Specs [080-landmark-product](../080-landmark-product/spec.md) and
[090-summit-product](../090-summit-product/spec.md) commit to web UIs for those
products. Both will need the same three bindings, and without abstraction each
product will copy pathway's pattern, with predictable drift: a Landmark route
will forget to update its CLI string when a flag changes, or its IRI will
diverge from libgraph's `fit:` prefix.

The capability also belongs in libui by intent. The library catalog frames
libui as web UI primitives "for products agents build". The route–CLI–graph
triangle is libui's most agent-shaped affordance: it gives an agent reading a
rendered page (a) the exact command to type to get the same view in a terminal
and (b) the RDF subject IRI the view is about, identical to the IRI the guide
agent reads through libgraph. Today that affordance is locked inside pathway.

## Why

- **Reuse without duplication.** Landmark and Summit web UIs are queued; we
  want one mechanism, not three near-copies.
- **Prevent drift.** A single descriptor per route makes the URL, the CLI
  string, and the graph IRI co-evolve. Today the three are wired in three
  different files and only kept in sync by convention.
- **Honour libui's stated capability.** `libraries/libui/package.json` lists
  one `forwardimpact.needs` entry today: "Build a reactive single-page web
  app". The route↔channel binding is part of what makes such an app legible to
  an agent and belongs at the same layer as `createRouter`.
- **Strengthen the human–agent contract.** Agents that read the JSON-LD on a
  rendered page should land on the same IRI they would query through libgraph.
  Centralising the IRI minting eliminates the failure mode where the page IRI
  silently drifts from the graph's view of the same entity.

## What

### 1. A unified route descriptor in libui

`@forwardimpact/libui` exposes a way to register each route once and bind it to
up to two channels in addition to its DOM handler:

| Channel | Role                                                                                                              | Today's analogue in pathway                                                                                                          |
| ------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Pages   | Render the route into the DOM.                                                                                    | `router.on(pattern, handler)` from `libui/router-core`.                                                                              |
| CLI     | Produce a CLI command string equivalent to the route.                                                             | `getCliCommand(path)` in `src/lib/cli-command.js`.                                                                                   |
| Graph   | Produce a stable graph entity IRI for the route, when one exists, against a vocabulary base supplied by the host. | `@id` minting in `*ToJsonLd` in `src/formatters/json-ld.js` (vocabulary base shared with `libgraph`'s `fit:` prefix, set verbatim). |

A registered route is one descriptor that names the pattern, the page handler,
and the optional CLI and Graph formatters. The router consults the descriptor
on every navigation. Either non-Pages channel may be absent: a builder page may
have no graph entity; an internal-only debug route may have no CLI form.

Routes that today have no graph entity (e.g. the `/skill` list view) remain
unbound to the Graph channel. Routes that today have no CLI equivalent (e.g.
in-progress builder steps) remain unbound to the CLI channel. The descriptor
must accept absence on either channel without forcing a placeholder.

### 2. A reusable command bar component in libui

`@forwardimpact/libui` exposes a top-bar component that displays the active
route's CLI command and offers a copy-to-clipboard affordance. Product-specific
styling stays in the consuming product's CSS; the component itself is
structurally complete and product-agnostic.

The component must remain in sync with the active route as the user navigates
and must behave gracefully on routes that have no CLI binding (e.g. hide
itself, render an empty state — the design phase decides which).

### 3. A JSON-LD emission helper in libui

`@forwardimpact/libui` exposes a helper that, given the active route's Graph
formatter and a body object, returns a `<script type="application/ld+json">`
element whose JSON content carries the formatter's IRI as `@id` merged with
the caller's body fields. Mounting the returned element into the page DOM is
the caller's responsibility, mirroring how `createJsonLdScript` is used in
pathway today. The vocabulary itself (the value of the `fit:` prefix) stays
owned by `libraries/libgraph`.

Per-entity body shapes — `Skill.proficiencyDescriptions`,
`Discipline.coreSkills`, etc. — remain owned by each product's formatters.
libui only owns the script-element wiring and the `@id` minting through the
Graph channel.

### 4. Pathway adopts the new capability

Pathway is the proof of the abstraction. After migration:

- `products/pathway/src/lib/cli-command.js` no longer exists as a separate
  module — pathway expresses every route's CLI binding through libui's
  descriptor API.
- `products/pathway/src/components/top-bar.js` no longer exists as a separate
  component — pathway consumes libui's command-bar component.
- `products/pathway/src/formatters/json-ld.js` keeps its per-entity body
  builders but stops minting `@id` strings and stops constructing `<script>`
  elements; both responsibilities sit in libui.

How each consumer wires up to the libui exports — argument shape, registration
site, file layout, CSS placement — is a plan-phase concern.

### 5. Catalog and documentation

- `libraries/libui/package.json` gains a new entry in `forwardimpact.needs`.
  The library has one such entry today: "Build a reactive single-page web
  app". Wording for the new entry is a design decision; the catalog generator
  (`bun run lib:fix`) enforces uniqueness across the monorepo at check time.
- A library guide documents the capability for external readers under
  `websites/fit/docs/libraries/<task-slug>/index.md`, with the task slug
  decided in the design phase per the linking rule in `libraries/CLAUDE.md`.
  The skill and CLI must link the same fully-qualified URL form
  (`https://www.forwardimpact.team/docs/libraries/<task-slug>/index.md`).
- `libraries/libui/README.md` shows the descriptor registration form in its
  getting-started snippet.

## Scope

### In scope

- Public API additions to `@forwardimpact/libui` for the route descriptor, the
  top-bar component, and the JSON-LD helper.
- Migration of pathway to consume the new API (the three files named above).
- Catalog metadata updates and the new library guide.

### Out of scope

- Adding the capability to Landmark or Summit web UIs. Those products are the
  future beneficiaries; landing the abstraction with one consumer (pathway) is
  sufficient proof.
- Changes to `libgraph`'s `RDF_PREFIXES` or to the underlying vocabulary at
  `https://www.forwardimpact.team/schema/rdf/`.
- Per-product CLI command strings or per-entity JSON-LD body shapes — the
  abstraction is the mechanism, not the values.
- Reverse mapping (from a CLI command back to a web URL, or from a graph IRI
  to a web URL). This spec is one-directional from route.
- Renaming or restructuring of existing libui exports (`createRouter`,
  hyperscript helpers, reactive primitives, error boundary, YAML loader).
- Server-side rendering of JSON-LD. The capability operates in the browser,
  the same as today.

## Success criteria

| Claim                                                                                                                                                  | Verifiable by                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@forwardimpact/libui` exposes a public route descriptor API that accepts a pattern, a page handler, and optional CLI and Graph formatters.            | Public exports of `libraries/libui/src/index.js` include the new API, and `libraries/libui/README.md`'s getting-started snippet shows it with all three channel slots.                                                                     |
| `@forwardimpact/libui` exposes a top-bar component that consuming products mount with one call.                                                        | Public exports of `@forwardimpact/libui` include the component; mounting it in a libui app with at least one CLI-bound route renders that route's command and a working copy button.                                                       |
| `@forwardimpact/libui` exposes a JSON-LD helper that mints `@id` from the route descriptor and emits a `<script type="application/ld+json">` element.  | Public exports include the helper; given a Graph formatter and a body, the helper produces a script element whose JSON content carries the formatter's IRI as `@id` and the body fields merged in.                                        |
| Pathway no longer holds its own copies of the three mechanisms.                                                                                        | `products/pathway/src/lib/cli-command.js` and `products/pathway/src/components/top-bar.js` are deleted; `products/pathway/src/formatters/json-ld.js` no longer constructs `<script>` elements or builds `@id` strings.                     |
| Pathway's user-visible behaviour is unchanged after the migration.                                                                                     | A baseline snapshot of pre-migration outputs — the CLI command string and the full JSON-LD payload (`@id` plus every body field) for each route registered in `products/pathway/src/main.js` — is recorded, and post-migration outputs match the snapshot field-for-field. |
| The libui catalog reflects the new capability.                                                                                                         | `libraries/libui/package.json` carries a new unique entry in `forwardimpact.needs`; `bun run lib:fix` regenerates `libraries/README.md` cleanly and `bun run check` passes.                                                                |
| External readers can learn the capability without cloning the monorepo.                                                                                | A guide exists under `websites/fit/docs/libraries/<task-slug>/index.md` (slug decided in design); it explains all three channels and shows an end-to-end example.                                                                          |
| The libui additions are independent of pathway.                                                                                                        | The new libui exports contain no hardcoded pathway-specific literals (no literal `fit-pathway` command name, no literal `forwardimpact.team/schema/rdf/` vocabulary base); product-specific CLI strings and vocabulary bases are passed in by the consumer at registration time. |

## Notes

- `libgraph`'s `RDF_PREFIXES` registers `fit:` as
  `https://www.forwardimpact.team/schema/rdf/` and pathway's `VOCAB_BASE`
  matches that string verbatim. The bridge is implicit today; the design phase
  decides whether libui makes the linkage explicit (e.g. by accepting a
  vocabulary base on the descriptor) or leaves it as a per-call argument.
- Two design questions are deferred: (a) whether the descriptor extends
  `router.on(...)` with an options argument or introduces a sibling registry
  primitive, and (b) whether the top-bar is a libui-owned component or a
  thinner "command provider" hook that consumers wrap into their own bar.
- Specs 080 (Landmark) and 090 (Summit) are the future consumers; this spec
  does not depend on either being in flight.
