# Plan 760-a-01 — LibUI and LibCLI primitives

Spec: [`spec.md`](spec.md). Design: [`design-a.md`](design-a.md). Overview:
[`plan-a.md`](plan-a.md).

Adds `InvocationContext` (typedef + freeze helper) to both libraries, four new
libui exports, an amended libcli handler contract, and the ESLint rule that
rejects the legacy handler shapes. No product files change in this part.

## Step 1 — `freezeInvocationContext` and the typedef in libui

Adds the shared contract and runtime helper to libui.

| Action  | Path                                              |
| ------- | ------------------------------------------------- |
| Created | `libraries/libui/src/invocation-context.js`       |
| Created | `libraries/libui/test/invocation-context.test.js` |

`invocation-context.js` exports
`freezeInvocationContext(raw) → InvocationContext` that deep-freezes `ctx`,
`ctx.args`, `ctx.options`, and any `Array` value inside `ctx.options`. Body
sketch:

```js
/** @typedef {Object} InvocationContext
 *  @property {Object} data
 *  @property {Readonly<Object<string,string>>} args
 *  @property {Readonly<Object<string,string|boolean|string[]>>} options
 */
export function freezeInvocationContext({ data, args, options }) {
  for (const v of Object.values(options)) {
    if (Array.isArray(v)) Object.freeze(v);
  }
  return Object.freeze({ data, args: Object.freeze({ ...args }), options: Object.freeze({ ...options }) });
}
```

The full JSDoc typedef is the verbatim block from `spec.md` § 1, including the
three invariants. **Verification:**
`bun test libraries/libui/test/invocation-context.test.js` passes (frozen at all
levels for a fixed input; `'foo' in ctx.options` is the membership test).

## Step 2 — `defineRoute` and `RouteDescriptor`

Adds the pure data builder.

| Action  | Path                                            |
| ------- | ----------------------------------------------- |
| Created | `libraries/libui/src/route-descriptor.js`       |
| Created | `libraries/libui/test/route-descriptor.test.js` |

```js
/** @typedef {Object} RouteDescriptor
 *  @property {string} pattern
 *  @property {(ctx, opts: { vocabularyBase?: string }) => void} page
 *  @property {((ctx) => string)=} cli
 *  @property {((ctx, vocabularyBase: string) => string)=} graph
 */
export function defineRoute({ pattern, page, cli, graph }) {
  if (typeof pattern !== "string") throw new TypeError("pattern: string");
  if (typeof page !== "function") throw new TypeError("page: function");
  return Object.freeze({ pattern, page, cli, graph });
}
```

**Verification:** test asserts the descriptor is frozen, `cli`/`graph` are
optional, and `pattern`/`page` are required.

## Step 3 — `createBoundRouter`

Replaces today's `createRouter` for opt-in callers; produces an
`InvocationContext` on each match and exposes an `activeRoute` reactive plus a
`routes()` enumerator.

| Action  | Path                                        |
| ------- | ------------------------------------------- |
| Created | `libraries/libui/src/bound-router.js`       |
| Created | `libraries/libui/test/bound-router.test.js` |

Built on top of `router-core.js` (do not duplicate hash matching). Public shape:

```js
import { createReactive } from "./reactive.js";
import { freezeInvocationContext } from "./invocation-context.js";
import { withErrorBoundary } from "./error-boundary.js";

export function createBoundRouter({
  data, vocabularyBase, onNotFound, onError, renderError,
} = {}) {
  const descriptors = [];
  const activeRoute = createReactive(null); // { descriptor, ctx } | null
  // ... compile pattern → regex once at register() time, same shape as router-core.parsePattern
  // ... handleRoute(): match path, parse query string from `path.split('?')[1]`, build args/options, freeze, set activeRoute, dispatch descriptor.page(ctx, { vocabularyBase })
  // ... start()/stop()/navigate() mirror router-core's API
  // ... patch history.replaceState in start() so activeRoute updates without hashchange (mirrors pathway/src/components/top-bar.js:42-48); restore in stop()
  return { register, routes, start, stop, navigate, currentPath, activeRoute };
}
```

Dispatch contract (matches `design-a.md` § Dispatch sequence):

1. parse `path.split("?")[0]` → match descriptor → `args` from `paramNames`
   zipped against capture groups (decoded);
2. parse `path.split("?")[1]` with `URLSearchParams` → `options`: each key that
   appears multiple times becomes `string[]`; an empty value becomes `true`;
   otherwise `string`;
3. `ctx = freezeInvocationContext({ data, args, options })`;
4. `activeRoute.set({ descriptor, ctx })`;
5. `descriptor.page(ctx, { vocabularyBase })` — wrapped in `withErrorBoundary`.

`onNotFound`/`onError`/`renderError` retain the same semantics `createRouter`
exposes today (router-core.js:60).

**Verification:** test exercises (a) a route with `:id`, query
`?json=1&tag=a&tag=b` producing `args.id`, `options.json === true`,
`options.tag === ["a","b"]`; (b) unmatched path triggers `onNotFound`; (c)
`activeRoute` subscribers fire on both `hashchange` and `history.replaceState`;
(d) `routes()` returns registered descriptors enumerable.

## Step 4 — `createCommandBar`

DOM component subscribing to `activeRoute`.

| Action  | Path                                       |
| ------- | ------------------------------------------ |
| Created | `libraries/libui/src/command-bar.js`       |
| Created | `libraries/libui/test/command-bar.test.js` |

```js
export function createCommandBar(router, { mountInto }) {
  // commandEl + copyButton built with createElement
  const unsubscribe = router.activeRoute.subscribe((entry) => {
    const text = entry?.descriptor.cli ? entry.descriptor.cli(entry.ctx) : "";
    commandEl.textContent = text;
    copyButton.disabled = text === "";
  });
  // copy click handler: navigator.clipboard.writeText(commandEl.textContent), with the same fallback as pathway/src/components/top-bar.js:84-96
  return { destroy() { unsubscribe(); mountInto.removeChild(root); } };
}
```

Routes without a `cli` slot render empty text (success-criterion: "command bar
neither throws nor renders a stale command from a previous route").

**Verification:** test mounts the bar with a synthetic router whose
`activeRoute` reactive emits a sequence (cli-bound → no-cli → cli-bound) and
asserts the displayed text and `copyButton.disabled` track the sequence.

## Step 5 — `createJsonLdScript`

Helper that mints `@id` through a descriptor's `graph` formatter.

| Action  | Path                                          |
| ------- | --------------------------------------------- |
| Created | `libraries/libui/src/json-ld-script.js`       |
| Created | `libraries/libui/test/json-ld-script.test.js` |

```js
export function createJsonLdScript(graphFormatter, body, { vocabularyBase }) {
  if (!graphFormatter) return null;
  const id = graphFormatter(body.ctx ?? body, vocabularyBase);
  const payload = { "@context": vocabularyBase, "@id": id, ...body };
  delete payload.ctx;
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(payload);
  return script;
}
```

**Verification:** test asserts `null` when formatter is absent; given a
formatter and a body, asserts the returned element's `type` is
`application/ld+json`, `JSON.parse(textContent)["@id"]` is the formatter's
return value, and body fields are merged.

## Step 6 — Wire new exports into libui's public surface

| Action   | Path                           |
| -------- | ------------------------------ |
| Modified | `libraries/libui/src/index.js` |

Add at the end of the existing export block (after `getItemsByIds`):

```js
// Invocation context (shared with libcli — typedef duplicated, see design D1)
export { freezeInvocationContext } from "./invocation-context.js";
// Route descriptors and bound router
export { defineRoute } from "./route-descriptor.js";
export { createBoundRouter } from "./bound-router.js";
// UI helpers tied to the bound router
export { createCommandBar } from "./command-bar.js";
export { createJsonLdScript } from "./json-ld-script.js";
```

`createRouter` stays exported unchanged.

**Verification:**
`import { defineRoute, createBoundRouter, createCommandBar, createJsonLdScript, freezeInvocationContext } from "@forwardimpact/libui"`
from a sibling test file succeeds.

## Step 7 — `freezeInvocationContext` in libcli

Duplicates the helper into libcli (design D1 records the rejection of a shared
package).

| Action   | Path                                               |
| -------- | -------------------------------------------------- |
| Created  | `libraries/libcli/src/invocation-context.js`       |
| Created  | `libraries/libcli/test/invocation-context.test.js` |
| Modified | `libraries/libcli/src/index.js`                    |

`invocation-context.js` is a byte-for-byte copy of libui's file (typedef +
helper). `index.js` adds
`export { freezeInvocationContext } from "./invocation-context.js";`.

**Verification:** a small "drift gate" test in **either** library imports the
other's helper relative-path-style and asserts both freeze identically against
the same fixture (the equivalence test design D1 calls out). Place it at
`libraries/libcli/test/invocation-context.test.js` to keep the gate in the
direction libcli depends on libui (libcli already declares libui as a peer-test
dev dep — confirm; if not, add `@forwardimpact/libui` to libcli's
`devDependencies` for tests only).

## Step 8 — libcli `createCli` produces an `InvocationContext`

Amends the handler dispatch so subcommand handlers receive a single `ctx`.

| Action   | Path                                |
| -------- | ----------------------------------- |
| Modified | `libraries/libcli/src/cli.js`       |
| Modified | `libraries/libcli/test/cli.test.js` |

Subcommand definition gains a typed positional-name field:

```js
{
  name: "skill",
  args: ["id"],          // NEW: array of declared positional names (replaces today's free-form string)
  description: "Show skill",
  options: { validate: { type: "boolean" } },
}
```

`Cli` gains a `dispatch(parsed, { data })` method (and `createCli` returns it
through the public surface):

```js
dispatch(parsed, { data }) {
  const command = this.#findCommand(parsed.positionals);
  const consumed = command ? command.name.split(" ").length : 0;
  const argv = parsed.positionals.slice(consumed);
  const argNames = command?.args ?? [];
  const args = Object.fromEntries(argNames.map((n, i) => [n, argv[i]]).filter(([, v]) => v !== undefined));
  const ctx = freezeInvocationContext({ data, args, options: parsed.values });
  return command.handler(ctx);
}
```

`#findCommand` already exists at cli.js:112-124 — reuse it.

**Verification:** `bun test libraries/libcli/test/cli.test.js` covers (a)
positional names mapped to argv values, missing trailing positionals omitted
from `args`; (b) subcommand definitions whose `args` is a string (legacy
free-form) throw a clear `TypeError` at construction (forces all consumers to
migrate); (c) handler receives a frozen `ctx`.

## Step 9 — Repo-root ESLint rule

Custom rule rejects either legacy handler shape inside the three scoped paths.

| Action   | Path                                                 |
| -------- | ---------------------------------------------------- |
| Created  | `tools/eslint-rules/no-legacy-handler-shape.js`      |
| Created  | `tools/eslint-rules/index.js`                        |
| Created  | `tools/eslint-rules/no-legacy-handler-shape.test.js` |
| Modified | `eslint.config.js`                                   |

Rule rejects any
`FunctionDeclaration | FunctionExpression | ArrowFunctionExpression` whose first
parameter is either:

- an `ObjectPattern` with property keys exactly the set `{data, args, options}`
  (CLI-side legacy), or
- a non-destructured single `Identifier` named `params` whose body references
  `params.id` or `params.discipline` (web-side legacy heuristic — pages always
  destructured route params from a single `params` argument).

Apply via `defineConfig`'s `files` field:

```js
{
  files: ["libraries/libui/**/*.js", "libraries/libcli/**/*.js", "products/pathway/**/*.js"],
  plugins: { local: localPlugin },
  rules: { "local/no-legacy-handler-shape": "error" },
}
```

The rule's test file uses `RuleTester` from `eslint`. Running the rule against
pre-migration `products/pathway/src/pages/skill.js` produces 2 errors (the two
legacy `(params)` handlers); after Part 02 migrates pathway, errors go to 0.

**Verification:** `bun run lint` is clean against the **new** files in this
part; pre-migration pathway is still expected to fail the rule (Part 02 clears
it). Document the expected pre-migration failure count in the PR description so
reviewers do not mis-read the lint output.

## Step 10 — Test-runner wiring for libui

libui has no `test/` directory today. Add one and wire scripts.

| Action   | Path                           |
| -------- | ------------------------------ |
| Modified | `libraries/libui/package.json` |

Add `"test": "bun test test/*.test.js"` to `scripts` (matches libcli's
package.json:38). Tests use `node:test` + `node:assert` (matches libcli's
existing tests). Since libui touches the DOM (command-bar, json-ld-script),
import a minimal DOM via `happy-dom` **only inside the test files that need it**
(`new Window()` then alias `document`/`HTMLElement`); add `happy-dom` to libui's
`devDependencies`. Pure-data tests (invocation-context, route-descriptor,
bound-router with a stubbed `window`) do not need the DOM dep.

**Verification:** `cd libraries/libui && bun test` reports all green.

## Libraries used

`@forwardimpact/libui` (creates new exports; reuses `router-core.js`,
`reactive.js`, `error-boundary.js`, `render.js`), `@forwardimpact/libcli`
(amends `cli.js`, adds `invocation-context.js`), `node:test`, `node:assert`,
`node:util` (`parseArgs`), `happy-dom` (test-only), `eslint` + `RuleTester`
(existing dev dep).

## Risks

- **`devDependencies` of libcli on libui (Step 7).** If
  `libraries/libcli/package.json` does not already declare libui, the drift-gate
  test breaks `bun install` order. Verify in the first commit; if missing, add
  it as `"@forwardimpact/libcli/test only"` (workspace protocol), not as a
  runtime dep.
- **`happy-dom` API surface.** The two DOM-touching tests should construct
  `Window` per-test (no shared global) so concurrent test runs don't race on
  `document`.
- **`history.replaceState` patching from a library.** The patch in
  `bound-router.start()` must be reversed in `stop()`; if the host calls
  `start()` twice without `stop()`, the patch must detect re-entry and not
  double-wrap. Test asserts the original function is restored.

## Verification (whole part)

- `cd libraries/libui && bun test` — green.
- `cd libraries/libcli && bun test` — green.
- `bun run lint libraries/libui libraries/libcli` — green (rule does not flag
  any newly-introduced handler).
- `bun run check` — green.
