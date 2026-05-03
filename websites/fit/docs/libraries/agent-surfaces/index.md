---
title: Agent-Friendly Surfaces
description: Build a product with both a web UI and a CLI that share handler logic through a single InvocationContext contract — agent-friendly by design.
---

Some products serve the same capability through two agent-friendly surfaces — a
web app for browsers and a CLI for terminals. Without a shared contract the
handler logic diverges: the web page reads route params and query strings, the
CLI reads positionals and flags, and the two slowly drift apart.

`@forwardimpact/libui` and `@forwardimpact/libcli` solve this with
**InvocationContext** — a frozen `{ data, args, options }` object that both
surfaces produce from their native inputs. The handler never knows which surface
called it, and both surfaces are agent-friendly: the CLI prints grep-friendly
help with JSON mode, the web app exposes the equivalent CLI command for
copy-to-clipboard.

This guide walks through building the simplest possible pairing: one entity, one
shared presenter, two agent-friendly surfaces.

## Prerequisites

- Node.js 18+
- `npm install @forwardimpact/libui @forwardimpact/libcli`

## The InvocationContext shape

Both surfaces produce the same object:

```js
{
  data,     // Object — your app's data (cities, forecasts, etc.)
  args,     // { city: "london" } — named positional arguments
  options,  // { units: "metric" } — flags or query parameters
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
// src/present-forecast.js
export function presentForecast(ctx) {
  const city = ctx.data.cities.find((c) => c.id === ctx.args.city);
  if (!city) throw new Error(`Unknown city: ${ctx.args.city}`);
  const forecast = city.forecast;
  return {
    city: city.name,
    temp: forecast.temp,
    units: ctx.options.units || "metric",
    condition: forecast.condition,
    wind: forecast.wind,
  };
}
```

This function is testable with a synthetic context — no browser, no process:

```js
import { freezeInvocationContext } from "@forwardimpact/libcli";
import { presentForecast } from "../src/present-forecast.js";

const ctx = freezeInvocationContext({
  data: {
    cities: [{
      id: "london",
      name: "London",
      forecast: { temp: 14, condition: "Cloudy", wind: "12 km/h" },
    }],
  },
  args: { city: "london" },
  options: { units: "metric" },
});

const view = presentForecast(ctx);
assert.strictEqual(view.city, "London");
assert.strictEqual(view.temp, 14);
```

## Step 2: Build the CLI surface

The CLI definition declares named positionals with `args: string[]` and a
`handler` that calls the shared presenter:

```js
#!/usr/bin/env node
// bin/weather.js
import { createCli } from "@forwardimpact/libcli";
import { presentForecast } from "../src/present-forecast.js";
import { loadCities } from "../src/data.js";

const cli = createCli({
  name: "weather",
  version: "0.1.0",
  description: "Weather forecasts from the terminal",
  commands: [
    {
      name: "forecast",
      args: ["city"],
      argsUsage: "<city>",
      description: "Show forecast for a city",
      handler: (ctx) => {
        const view = presentForecast(ctx);
        if (ctx.options.json) {
          console.log(JSON.stringify(view, null, 2));
        } else {
          console.log(`${view.city}: ${view.temp}° ${view.condition}, wind ${view.wind}`);
        }
      },
    },
  ],
  globalOptions: {
    units: { type: "string", description: "Temperature units (metric|imperial)" },
    json: { type: "boolean", description: "JSON output" },
    help: { type: "boolean", short: "h", description: "Show help" },
    version: { type: "boolean", description: "Show version" },
  },
});

const parsed = cli.parse(process.argv.slice(2));
if (!parsed) process.exit(0);

const data = { cities: loadCities() };
cli.dispatch(parsed, { data });
```

Running `weather forecast london` produces:

```
London: 14° Cloudy, wind 12 km/h
```

Running `weather forecast london --json` produces:

```json
{ "city": "London", "temp": 14, "units": "metric", "condition": "Cloudy", "wind": "12 km/h" }
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
import { presentForecast } from "./present-forecast.js";
import { renderForecastCard } from "./render-forecast.js";

const data = await fetch("/api/cities.json").then((r) => r.json());

const router = createBoundRouter({
  data,
  onNotFound: () => document.body.textContent = "City not found",
});

router.register(defineRoute({
  pattern: "/forecast/:city",
  page: (ctx) => {
    const view = presentForecast(ctx);
    renderForecastCard(view);
  },
  cli: (ctx) => `weather forecast ${ctx.args.city}`,
}));

createCommandBar(router, {
  mountInto: document.getElementById("command-bar"),
});

router.start();
```

When the user navigates to `#/forecast/london`, the bound router:

1. Matches the pattern, extracts `{ city: "london" }` as `args`
2. Parses the query string (if any) into `options`
3. Freezes everything into an `InvocationContext`
4. Calls `page(ctx, { vocabularyBase })`

The command bar displays `weather forecast london` with a copy button. An agent
or user can paste that command into a terminal to get the same result.

The `cli` function on the descriptor is optional. When present, the command bar
displays the equivalent CLI command. Routes without `cli` render the bar empty.

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

router.register(descriptor);      // mount a route descriptor
router.routes();                   // list registered descriptors
router.start();                    // listen for hashchange + replaceState
router.stop();                     // remove listeners, restore replaceState
router.navigate("/forecast/nyc");  // set window.location.hash
router.currentPath();              // read current hash path
router.activeRoute;                // reactive: { descriptor, ctx } | null
```

### Query string parsing

The query string after `?` in the hash is parsed with `URLSearchParams`:

| Input | Result |
|---|---|
| `?json` | `{ json: true }` |
| `?units=imperial` | `{ units: "imperial" }` |
| `?tag=rain&tag=wind` | `{ tag: ["rain", "wind"] }` |
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
import { presentForecast } from "../src/present-forecast.js";

const ctx = freezeInvocationContext({
  data: {
    cities: [{
      id: "london",
      name: "London",
      forecast: { temp: 14, condition: "Cloudy", wind: "12 km/h" },
    }],
  },
  args: { city: "london" },
  options: { units: "metric" },
});

const view = presentForecast(ctx);
assert.strictEqual(view.city, "London");
assert.strictEqual(view.condition, "Cloudy");
```

Both surfaces call the same function, so a passing presenter test covers the
core logic for both CLI and web.
