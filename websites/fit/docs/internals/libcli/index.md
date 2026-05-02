---
title: libcli — CLI Development
description: Internal reference for CLI argument parsing, help rendering, handler dispatch, and the InvocationContext contract.
layout: product
---

## Architecture

libcli has two layers. The **parse layer** (`Cli.parse()`) wraps `node:util`
`parseArgs` with command identification, option scoping, and help/version
interception. The **dispatch layer** (`Cli.dispatch()`) maps parsed positionals
to named arguments, builds a frozen `InvocationContext`, and calls the
subcommand handler. The parse layer exists in every CLI; the dispatch layer is
opt-in for CLIs that want named args and shared handler logic with a web UI.

```
argv
 │
 ▼
Cli.parse(argv)
 ├─ --help / --version → render, return null
 └─ { values, positionals }
      │
      ▼
  ┌──────────────────────────────┐
  │ Legacy path (most CLIs)      │
  │ Caller unpacks positionals   │
  │ and values manually          │
  └──────────────────────────────┘
      │
      ▼
  ┌──────────────────────────────┐
  │ Dispatch path (opt-in)       │
  │ Cli.dispatch(parsed, {data}) │
  │  → freezeInvocationContext   │
  │  → command.handler(ctx)      │
  └──────────────────────────────┘
```

Both paths coexist. A definition can mix legacy `args: "<usage>"` commands with
`args: string[]` + `handler` commands — `dispatch()` only activates for commands
that have a `handler` function.

Source: `libraries/libcli/src/cli.js`.

---

## Definition Schema

The definition object drives help rendering, argument parsing, and dispatch. All
fields are plain data — no class instances, no callbacks (except `handler`).

```js
const definition = {
  name: "fit-summit",
  version: "1.0.0",
  description: "Team capability planning from skill data.",
  commands: [
    {
      name: "coverage",
      args: "<team>",                // legacy: free-form usage string
      description: "Show capability coverage",
      options: {
        evidenced: { type: "boolean", description: "Include practiced capability" },
      },
      examples: ["fit-summit coverage platform --evidenced"],
    },
    {
      name: "skill",
      args: ["id"],                  // dispatch: declared positional names
      argsUsage: "[<id>]",           // display string for help output
      description: "Show skill detail",
      handler: (ctx) => showSkill(ctx),
    },
  ],
  globalOptions: {
    data: { type: "string", description: "Path to data directory" },
    help: { type: "boolean", short: "h", description: "Show help" },
    version: { type: "boolean", short: "v", description: "Show version" },
  },
  examples: ["fit-summit coverage platform"],
  documentation: [
    {
      title: "Summit Overview",
      url: "https://www.forwardimpact.team/summit/index.md",
    },
  ],
};
```

### Field reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | `string` | yes | CLI binary name |
| `version` | `string` | no | Shown by `--version` |
| `description` | `string` | no | One-line description after name in help |
| `usage` | `string` | no | Custom usage line; overrides auto-generated one |
| `commands` | `Command[]` | no | Subcommands |
| `globalOptions` | `Options` | no | Options accepted by every command |
| `examples` | `string[]` | no | Global-help examples |
| `documentation` | `DocEntry[]` | no | Links rendered in `Documentation:` section |

### Command fields

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | May be multi-word (`"org show"`) |
| `args` | `string \| string[]` | `string`: legacy free-form usage. `string[]`: named positionals for dispatch |
| `argsUsage` | `string` | Display string for help when `args` is an array |
| `description` | `string` | One-line description |
| `options` | `Options` | Command-scoped options |
| `examples` | `string[]` | Per-command examples |
| `handler` | `(ctx) => any` | Dispatch handler; required only when using `dispatch()` |

### Option fields

Each key in an `Options` object maps to:

| Field | Type | Notes |
|---|---|---|
| `type` | `"string" \| "boolean"` | Passed to `parseArgs` |
| `short` | `string` | Single-char alias (`-h`) |
| `default` | `any` | Default value |
| `multiple` | `boolean` | Accept repeated flags into an array |
| `description` | `string` | Help text |

**Legacy schema rejected.** A top-level `options` field (instead of
`globalOptions`) throws at construction with a migration message.

**Option name collisions.** A command option sharing a name with a global option
throws at construction. Command options merge with global options for the
`parseArgs` call — a collision would silently shadow the global.

---

## Argument Parsing

`cli.parse(argv)` is the entry point. It returns `{ values, positionals }` or
`null` (when `--help` or `--version` was handled).

### How parse works internally

1. **Command identification.** `#findCommand(argv)` filters out flags, then
   tries the longest positional prefix (up to 3 tokens) against
   `commands[].name`. This handles multi-word commands like `"org show"` —
   `parse(["org", "show", "--help"])` matches the two-word entry.

2. **Option merging.** `#buildOptions(command)` merges the matched command's
   `options` with `globalOptions`. The merged set is passed to `parseArgs` — a
   flag not in the merged set throws `ERR_PARSE_ARGS_UNKNOWN_OPTION`.

3. **parseArgs.** `node:util` `parseArgs` runs with `allowPositionals: true`.
   The result is `{ values, positionals }`.

4. **Help/version interception.** If `values.help` is truthy, `#renderHelp`
   fires and `parse()` returns `null`. Same for `values.version`. The caller
   should exit cleanly on `null`.

5. **Command-as-option hint.** If `parseArgs` throws on an unknown flag whose
   name matches a command, the error message suggests the command form:
   `Unknown option "--daemon". "daemon" is a command, not an option.`

```js
const parsed = cli.parse(process.argv.slice(2));
if (!parsed) process.exit(0);
const { values, positionals } = parsed;
```

Positional validation is the caller's responsibility — libcli does not enforce
required positionals because usage patterns vary.

---

## Handler Dispatch

The dispatch layer is opt-in. A subcommand opts in by declaring `args` as
`string[]` (named positional names) and providing a `handler` function. The
legacy `args: "<usage>"` string form continues to work for commands that don't
need dispatch.

### How dispatch works internally

`Cli.dispatch(parsed, { data })` does the following:

1. **Find command.** Calls `#findCommand(parsed.positionals)` — same logic as
   `parse()`. Throws if no match.

2. **Validate handler.** Throws if the matched command has no `handler` function.

3. **Consume subcommand prefix.** `command.name.split(" ").length` gives the
   number of positional tokens the command name consumed (1 for `"skill"`, 2 for
   `"org show"`). The remaining positionals are the actual arguments.

4. **Build named args.** Zips the command's `args` array against the remaining
   positionals: `args[0]` maps to the first remaining positional, `args[1]` to
   the second, etc. Missing trailing positionals are omitted (not set to
   `undefined`).

5. **Freeze.** Calls `freezeInvocationContext({ data, args, options: parsed.values })`.
   This deep-freezes the context, `args`, `options`, and any array values inside
   `options`.

6. **Call handler.** `command.handler(ctx)`.

```js
// argv: ["skill", "testing", "--json"]
// command.args: ["id"]
// → consumed prefix: 1 ("skill")
// → remaining: ["testing"]
// → args: { id: "testing" }
// → options: { json: true } (from parsed.values)
```

Source: `libraries/libcli/src/cli.js`, `dispatch()` method.

---

## InvocationContext

`InvocationContext` is a frozen `{ data, args, options }` object produced by
both libcli's `dispatch()` (from argv) and libui's `createBoundRouter` (from a
URL hash). The handler receives the same shape regardless of surface.

### Shape

```js
{
  data,     // Object — host-provided dependencies, opaque to the libraries
  args,     // Readonly<Object<string, string>> — named positionals
  options,  // Readonly<Object<string, string | boolean | string[]>> — flags/query params
}
```

### Three invariants

- **No surface affordances.** No DOM nodes, streams, `Request`/`Response`, or
  surface tag. Anything that exists on only one surface stays out.
- **Uniform value shapes.** `args` values are always strings. `options` values
  are one of `string`, `boolean true`, or `string[]`. No nulls, no numbers.
- **Frozen at all levels.** `Object.freeze` on the context, `args`, `options`,
  and any array inside `options`. Handlers may assume immutability without
  checking.

### freezeInvocationContext

The helper is duplicated in both libraries (design decision D1 — a shared
package was rejected for ~40 lines). Each library's test suite runs the same
fixture through its own copy; the identical fixture serves as a drift gate.

The freeze is shallow on `data` (host-owned, may be mutated by the host between
invocations) and deep on `args` and `options` (contract-owned, must not be
mutated by handlers). Arrays inside `options` are individually frozen.

Source: `libraries/libui/src/invocation-context.js`,
`libraries/libcli/src/invocation-context.js`.

### How each surface produces it

| Surface | Producer | args source | options source |
|---|---|---|---|
| CLI | `Cli.dispatch()` | positionals zipped against `command.args` names | `parsed.values` from `parseArgs` |
| Web | `createBoundRouter` | route-pattern capture groups keyed by param names | `URLSearchParams` from the hash query string |

The web side parses query strings as: repeated keys become `string[]`, empty
values become `true`, everything else is `string`. This matches the shape
`parseArgs` produces from CLI flags.

---

## Help Rendering

`HelpRenderer` formats the definition into text or JSON. libcli owns the
renderer; the `Cli` class delegates to it.

### args display logic

When `args` is a string, it renders directly (`<team>`). When `args` is an
array (the dispatch form), the renderer reads `argsUsage` instead. If
`argsUsage` is absent, the command renders with no args suffix. This applies to
both the commands list in global help and the header in per-command help.

Source: `libraries/libcli/src/help.js`, `#argsDisplay()`.

### Global help sections (in order)

1. Header — name, version, description
2. Usage — auto-generated or custom `usage` string
3. Commands — one line per command, aligned
4. Options — global options, aligned
5. Examples — top-level examples
6. Documentation — title, URL, optional description
7. Hint line — "Use \<name\> \<command\> --help for command-specific options."

Sections with no data are omitted entirely.

### Per-command help sections (in order)

1. Header — name + command + args + description
2. Usage — name + command + args + `[options]`
3. Options — command-scoped options
4. Global options — global options minus `--version`
5. Examples — per-command examples

### JSON mode

`--help --json` emits the full definition as JSON (global) or a focused
`{ parent, name, args, description, options, globalOptions, examples,
documentation }` object (per-command). Both handled by `cli.parse()`.

### Documentation links

The `documentation` array bridges the CLI and its matching skill. Each entry is
`{ title, url, description? }` with a fully qualified `.md` URL. This way an
agent that reaches the CLI without the skill loaded gets the same
progressive-disclosure links from `--help`.

URLs end with `/index.md` so agents receive raw markdown. Copy entries from the
matching `.claude/skills/fit-*/SKILL.md` to keep both in sync.

---

## Error Handling

### Standard format

All errors write to stderr with no ANSI codes:

```
cli-name: error: message
```

### Exit codes

| Code | Meaning | Method |
|---|---|---|
| 1 | Runtime error | `cli.error()` |
| 2 | Usage error | `cli.usageError()` |

### Exception pattern

```js
main().catch((error) => {
  logger.exception("main", error);
  cli.error(error.message);
  process.exit(1);
});
```

---

## Summary Output

`SummaryRenderer` prints a post-command summary — a title line followed by
aligned label/description pairs:

```js
const summary = new SummaryRenderer({ process });
summary.render({
  title: "Generated 3 files",
  items: [
    { label: "types.js",   description: "Compiled proto types" },
    { label: "clients.js", description: "Service client stubs" },
  ],
});
```

---

## Logger Conventions

CLI programs use libtelemetry's Logger for operational output and reserve
`console.log` / direct stdout writes for primary data output.

| Output type | Use Logger? | Why |
|---|---|---|
| Progress updates | Yes | Structured attributes beat free text |
| Errors and exceptions | Yes | Preserves trace context |
| Help text | No | Rendered by libcli |
| Pure data output | No | Primary result for piping |

```js
import { createLogger } from "@forwardimpact/libtelemetry";
const logger = createLogger("codegen");

logger.info("step", "Generated types", { files: "12" });
logger.error("compile", "Proto compilation failed", { path: "agent.proto" });
```

**Domain naming:** package name without `lib` prefix — `"codegen"` for
libcodegen, `"pathway"` for fit-pathway.

**Levels:** `debug` (invisible unless `LOG_LEVEL=debug`), `info` (expected
output), `error` (with context), `exception` (with stack trace, use in `catch`).

**Suppression:** `--silent` raises the minimum level above `error`, `--quiet`
raises it above `info`.

---

## Composition with Other Libraries

| Library | Scope |
|---|---|
| **libcli** | CLI chrome: help, errors, summaries, argument parsing, color |
| **libui** | Web UI: routing, `createBoundRouter`, `defineRoute`, `createCommandBar` |
| **libformat** | Content rendering: markdown to HTML or ANSI terminal output |
| **librepl** | Interactive sessions: command loops, state, history |
| **libtelemetry** | Operational diagnostics: Logger, Tracer, Observer |

---

## Legacy Handler Shape Enforcement

An AST-based test (`tests/no-legacy-handler-shape.test.js`) scans
`libraries/libui/src/` and `libraries/libcli/src/` for functions whose first
parameter is either a destructured `{ data, args, options }` or an identifier
named `params`. These are the pre-InvocationContext handler shapes. The test
runs during `bun run test` and gates every commit.

The `invocation-context.js` files in both libraries are allowlisted since
`freezeInvocationContext` itself destructures `{ data, args, options }` by
design.

---

## Minimal Examples

### Legacy parse path

```js
#!/usr/bin/env node
import { createCli } from "@forwardimpact/libcli";

const cli = createCli({
  name: "fit-example",
  version: "0.1.0",
  description: "Example CLI",
  usage: "fit-example <input>",
  globalOptions: {
    json: { type: "boolean", description: "JSON output" },
    help: { type: "boolean", short: "h", description: "Show help" },
    version: { type: "boolean", description: "Show version" },
  },
});

const parsed = cli.parse(process.argv.slice(2));
if (!parsed) process.exit(0);

const [input] = parsed.positionals;
if (!input) { cli.usageError("missing <input>"); process.exit(2); }
```

### Dispatch path

```js
#!/usr/bin/env node
import { createCli } from "@forwardimpact/libcli";

const cli = createCli({
  name: "fit-example",
  version: "0.1.0",
  description: "Example CLI with dispatch",
  commands: [
    {
      name: "show",
      args: ["id"],
      argsUsage: "<id>",
      description: "Show an item",
      handler: (ctx) => {
        const item = ctx.data.items.find((i) => i.id === ctx.args.id);
        console.log(ctx.options.json ? JSON.stringify(item) : item.name);
      },
    },
  ],
  globalOptions: {
    json: { type: "boolean", description: "JSON output" },
    help: { type: "boolean", short: "h", description: "Show help" },
    version: { type: "boolean", description: "Show version" },
  },
});

const parsed = cli.parse(process.argv.slice(2));
if (!parsed) process.exit(0);

const data = { items: [{ id: "a", name: "Alpha" }] };
cli.dispatch(parsed, { data });
```
