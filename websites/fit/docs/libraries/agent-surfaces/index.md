---
title: Web + CLI Surfaces
description: Build a product with both a web UI and a CLI that share handler logic through a single InvocationContext contract.
---

# Web + CLI Surfaces

Some products serve the same capability through two surfaces — a web app for
browsers and a CLI for terminals. Without a shared contract the handler logic
diverges: the web page reads route params and query strings, the CLI reads
positionals and flags, and the two slowly drift apart.

`@forwardimpact/libui` and `@forwardimpact/libcli` solve this with
**InvocationContext** — a frozen `{ data, args, options }` object that both
surfaces produce from their native inputs. The handler never knows which surface
called it.

This guide walks through building the simplest possible pairing: one entity, one
shared presenter, two surfaces.

## Prerequisites

- Node.js 18+
- `npm install @forwardimpact/libui @forwardimpact/libcli`

## The InvocationContext shape

Both surfaces produce the same object:

```js
{
  data,     // Object — your app's data (skills, items, etc.)
  args,     // { id: "testing" } — named positional arguments
  options,  // { json: true } — flags or query parameters
}
```

The context is frozen. Handlers can rely on immutability without checking.

**Value types are uniform across surfaces.** `args` values are always strings.
`options` values are `string`, `boolean` (`true` for presence-only flags or
empty query params), or `string[]` (repeated keys). No nulls, no numbers — if
you need a number, parse it in the handler.

## Step 1: Write the shared presenter

The presenter takes an `InvocationContext`, looks up data, and returns a plain
view object. No DOM, no stdout — just data in, data out.

```js
// src/present-skill.js
export function presentSkill(ctx) {
  const skill = ctx.data.skills.find((s) => s.id === ctx.args.id);
  if (!skill) throw new Error(`Unknown skill: ${ctx.args.id}`);
  return {
    name: skill.name,
    level: skill.level,
    description: skill.description,
  };
}
```

This function is testable with a synthetic context — no browser, no process:

```js
import { freezeInvocationContext } from "@forwardimpact/libcli";

const ctx = freezeInvocationContext({
  data: { skills: [{ id: "testing", name: "Testing", level: "advanced", description: "..." }] },
  args: { id: "testing" },
  options: {},
});
const view = presentSkill(ctx);
assert.strictEqual(view.name, "Testing");
```

## Step 2: Build the CLI surface

The CLI definition declares named positionals with `args: string[]` and a
`handler` that calls the shared presenter:

```js
#!/usr/bin/env node
// bin/fit-myapp.js
import { createCli } from "@forwardimpact/libcli";
import { presentSkill } from "../src/present-skill.js";
import { loadData } from "../src/data.js";

const cli = createCli({
  name: "fit-myapp",
  version: "0.1.0",
  description: "My app",
  commands: [
    {
      name: "skill",
      args: ["id"],
      argsUsage: "<id>",
      description: "Show a skill",
      handler: (ctx) => {
        const view = presentSkill(ctx);
        if (ctx.options.json) {
          console.log(JSON.stringify(view, null, 2));
        } else {
          console.log(`${view.name} (${view.level})\n${view.description}`);
        }
      },
    },
  ],
  globalOptions: {
    data: { type: "string", description: "Path to data directory" },
    json: { type: "boolean", description: "JSON output" },
    help: { type: "boolean", short: "h", description: "Show help" },
    version: { type: "boolean", description: "Show version" },
  },
});

const parsed = cli.parse(process.argv.slice(2));
if (!parsed) process.exit(0);

const data = loadData(parsed.values.data);
cli.dispatch(parsed, { data });
```

Running `npx fit-myapp skill testing --json` produces:

```
{ "name": "Testing", "level": "advanced", "description": "..." }
```

## Step 3: Build the web surface

The web side uses `defineRoute` to declare a route and `createBoundRouter` to
dispatch it. The route descriptor's `page` function calls the same presenter:

```js
// src/main.js
import {
  createBoundRouter,
  defineRoute,
  createCommandBar,
} from "@forwardimpact/libui";
import { presentSkill } from "./present-skill.js";
import { renderSkillToDOM } from "./render-skill.js";

const data = await fetch("/data.json").then((r) => r.json());

const router = createBoundRouter({
  data,
  onNotFound: () => document.body.textContent = "Not found",
});

router.register(defineRoute({
  pattern: "/skill/:id",
  page: (ctx) => {
    const view = presentSkill(ctx);
    renderSkillToDOM(view, ctx.options);
  },
  cli: (ctx) => `npx fit-myapp skill ${ctx.args.id}`,
}));

createCommandBar(router, {
  mountInto: document.getElementById("command-bar"),
});

router.start();
```

When the user navigates to `#/skill/testing`, the bound router:

1. Matches the pattern, extracts `{ id: "testing" }` as `args`
2. Parses the query string (if any) into `options`
3. Freezes everything into an `InvocationContext`
4. Calls `page(ctx, { vocabularyBase })`

The `cli` function on the descriptor is optional. When present, the command bar
displays the equivalent CLI command and offers copy-to-clipboard. Routes without
`cli` render the bar empty.

## How `createBoundRouter` works

The bound router wraps libui's hash-based routing with three additions:

- **InvocationContext production.** Each match builds a frozen context from route
  params + query string, matching what `cli.dispatch()` builds from argv.
- **`activeRoute` reactive.** A reactive value carrying
  `{ descriptor, ctx } | null` that subscribers (like the command bar) observe.
- **`history.replaceState` interception.** Some pages rewrite the hash without
  firing `hashchange` (e.g., updating query params in place). The bound router
  patches `replaceState` in `start()` and restores it in `stop()` so
  `activeRoute` stays current.

### API

```js
const router = createBoundRouter({ data, onNotFound, onError, renderError });

router.register(descriptor);   // mount a route descriptor
router.routes();                // list registered descriptors
router.start();                 // listen for hashchange + replaceState
router.stop();                  // remove listeners, restore replaceState
router.navigate("/skill/x");   // set window.location.hash
router.currentPath();           // read current hash path
router.activeRoute;             // reactive: { descriptor, ctx } | null
```

### Query string parsing

The query string after `?` in the hash is parsed with `URLSearchParams`:

| Input | Result |
|---|---|
| `?json` | `{ json: true }` |
| `?json=1` | `{ json: "1" }` |
| `?tag=a&tag=b` | `{ tag: ["a", "b"] }` |
| (no query) | `{}` |

Empty values become `true`; repeated keys become arrays; everything else is a
string.

## How `createCommandBar` works

`createCommandBar(router, { mountInto })` creates a `<div>` with a command
display and a copy button, appends it to `mountInto`, and subscribes to
`router.activeRoute`. On each route change it calls `descriptor.cli(ctx)` to get
the command string. Routes without a `cli` slot render empty text and disable
the copy button.

Returns `{ destroy }` to unsubscribe and remove the DOM elements.

## Testing

The shared presenter is the primary test surface. Since it takes a plain frozen
object and returns plain data, tests need no DOM and no process:

```js
import { freezeInvocationContext } from "@forwardimpact/libcli";
import { presentSkill } from "../src/present-skill.js";

const ctx = freezeInvocationContext({
  data: { skills: [{ id: "testing", name: "Testing", level: "advanced" }] },
  args: { id: "testing" },
  options: { json: true },
});

const view = presentSkill(ctx);
assert.strictEqual(view.name, "Testing");
```

Both surfaces call the same function, so a passing presenter test covers the
core logic for both CLI and web.
