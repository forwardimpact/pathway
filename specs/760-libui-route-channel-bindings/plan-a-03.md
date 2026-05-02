# Plan 760-a-03 — Catalog and library guide

Spec: [`spec.md`](spec.md). Design: [`design-a.md`](design-a.md). Overview:
[`plan-a.md`](plan-a.md). Depends on Part 02 (`plan-a-02.md`) being on `main`.

Updates the libraries catalog and ships the external library guide for the new
capability. No source files in `libraries/libui/` or `libraries/libcli/` change;
this is metadata + documentation.

## Step 1 — `forwardimpact.needs` entry on libui

Adds the design's chosen phrase (D11).

| Action   | Path                           |
| -------- | ------------------------------ |
| Modified | `libraries/libui/package.json` |

In `forwardimpact.needs`, append the new entry alongside the existing one:

```json
"forwardimpact": {
  "capability": "agent-capability",
  "needs": [
    "Build a reactive single-page web app",
    "Bind a web route to its CLI command and graph entity"
  ]
}
```

**Verification:** `bun run lib:fix` runs without "duplicate need" error.

## Step 2 — Regenerate the catalog

Catalog regeneration is mechanical; the change must land in this commit so
`bun run check` stays green.

| Action   | Path                  |
| -------- | --------------------- |
| Modified | `libraries/README.md` |

Run from the repo root:

```sh
bun run lib:fix
```

The libui row in `libraries/README.md` updates to carry the new entry in the
flat index. `bun run check` verifies.

**Verification:** `git diff libraries/README.md` shows only the libui row
change; `bun run check` passes.

## Step 3 — libui README getting-started snippet

`libraries/libui` does not have a `README.md` today (per research). Create one
that shows the descriptor registration form.

| Action  | Path                        |
| ------- | --------------------------- |
| Created | `libraries/libui/README.md` |

Body sketch (~40 lines):

````md
# @forwardimpact/libui

Web UI primitives for products agents build. Reactive single-page app
infrastructure plus route↔CLI↔graph bindings.

## Getting started

```js
import {
  createBoundRouter, defineRoute, createCommandBar,
  createJsonLdScript, freezeInvocationContext,
} from "@forwardimpact/libui";

const router = createBoundRouter({
  data: appData,
  vocabularyBase: "https://example.invalid/schema/rdf/",
});

router.register(defineRoute({
  pattern: "/skill/:id",
  page: (ctx, { vocabularyBase }) => {
    const view = present(ctx);
    mount(view.dom);
    document.head.appendChild(
      createJsonLdScript(graphSkill, view.body, { vocabularyBase })
    );
  },
  cli: (ctx) => `npx fit-pathway skill ${ctx.args.id}`,
  graph: (ctx, base) => `${base}Skill/${ctx.args.id}`,
}));

createCommandBar(router, { mountInto: document.getElementById("cli-bar") });
router.start();
```

See the [Web ↔ CLI ↔ graph bindings guide](https://www.forwardimpact.team/docs/libraries/web-cli-graph-bindings/index.md) for the full contract and the `InvocationContext` shape.
````

(Direct link to the guide lands in Step 4.)

**Verification:** `bun run check` passes; the README's only outbound link is the
fully-qualified guide URL (matches `libraries/CLAUDE.md` audience rule).

## Step 4 — External library guide

Adds the spec's required guide under
`websites/fit/docs/libraries/web-cli-graph-bindings/index.md`. Slug is fixed by
design D10.

| Action  | Path                                                          |
| ------- | ------------------------------------------------------------- |
| Created | `websites/fit/docs/libraries/web-cli-graph-bindings/index.md` |

Body covers, in order:

1. **What this is.** One paragraph naming the route↔CLI↔graph triangle and the
   `InvocationContext` it produces.
2. **The contract.** The verbatim `InvocationContext` JSDoc from spec § 1 plus
   the three invariants and the handler signature.
3. **Three channels.** Pages / CLI / Graph table from spec § 2 with role and
   absence behaviour for each.
4. **End-to-end example.** A Landmark- or Summit-style author registers one
   route with all three channels; shows `defineRoute`, `createBoundRouter`,
   `createCommandBar`, `createJsonLdScript` together.
5. **CLI side.** `createCli` definition with `args: ["id"]` and a handler taking
   `(ctx)` calling the same shared presenter the page calls.
6. **`vocabularyBase`.** One paragraph: where it is set (`createBoundRouter`),
   how it reaches the `graph` formatter, why the host reads `RDF_PREFIXES.fit`
   from `@forwardimpact/libgraph` rather than hardcoding.

Front-matter (matches existing guides' style):

```md
---
title: Web ↔ CLI ↔ graph bindings
description: Bind a web route to its CLI command and graph entity using @forwardimpact/libui's bound router and @forwardimpact/libcli's handler contract.
---
```

**Verification:** the guide renders in `bun run dev:website`; `bun run check`
passes (link checker runs).

## Libraries used

`@forwardimpact/libui` (referenced from the guide), `@forwardimpact/libcli`
(referenced), `@forwardimpact/libgraph` (referenced). No new code.

## Risks

- **Catalog regen drift.** `bun run lib:fix` re-sorts the flat index. If the
  rerun changes any unrelated row, treat it as a separate concern — open a
  follow-up issue rather than absorbing the diff into this PR.
- **Guide title collision.** Confirm no existing guide carries "Web ↔ CLI ↔
  graph bindings" or a near variant before committing the front-matter.

## Verification (whole part)

- `bun run lib:fix && bun run check` — green.
- The new guide is reachable from the libui README's hyperlink (Step 3) and from
  the catalog row in `libraries/README.md` (Step 2).
