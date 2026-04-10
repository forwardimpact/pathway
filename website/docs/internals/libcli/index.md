---
title: libcli — CLI Development
description: Standard patterns for building CLI programs in the Forward Impact monorepo.
layout: product
---

## Logger Conventions

CLI programs use libtelemetry's Logger for operational output and reserve
`console.log` / direct stdout writes for primary data output. The decision
matrix:

| Output type           | Use Logger? | Why                                  |
| --------------------- | ----------- | ------------------------------------ |
| Progress updates      | Yes         | Structured attributes beat free text |
| Errors and exceptions | Yes         | Preserves trace context              |
| Help text             | No          | Rendered by libcli                   |
| Pure data output      | No          | Primary result for piping            |
| Version string        | No          | Single value, rendered by libcli     |

### Creating a Logger

```js
import { createLogger } from "@forwardimpact/libtelemetry";

const logger = createLogger("codegen");
```

**Domain naming:** use the package name without the `lib` prefix. Examples:
`"codegen"` for libcodegen, `"rc"` for librc, `"pathway"` for fit-pathway.

### Level usage

- **`debug`** — internal tracing, invisible unless `LOG_LEVEL=debug`
- **`info`** — operational output the user expects to see
- **`error`** — errors with context attributes
- **`exception`** — caught errors with stack traces (use in `catch` blocks)

### Structuring attributes

Attributes make log lines parseable by both humans and agents:

```js
logger.info("step", "Generated types", { files: "12" });
logger.error("compile", "Proto compilation failed", { path: "agent.proto" });
```

### Suppression

The `--silent` / `--quiet` pattern (established in fit-rc) suppresses Logger
output. When a CLI supports these flags, configure the Logger's minimum level
accordingly — `--silent` raises it above `error`, `--quiet` raises it above
`info`.

### Output format

Logger emits RFC 5424 structured messages:

```
{level} {timestamp} {domain} {appId} {procId} {msgId} [{attrs}] {message}
```

---

## Help Text

libcli renders help from a **definition object** — a plain data structure that
declares the CLI's name, version, description, commands, options, and examples.

```js
const definition = {
  name: "fit-example",
  version: "0.1.0",
  description: "Example CLI showing standard pattern",
  usage: "fit-example <input>",
  commands: [
    { name: "validate", args: "<file>", description: "Validate a framework" },
    { name: "list",                      description: "List all entities" },
  ],
  options: {
    output: { type: "string", description: "Output path" },
    json:   { type: "boolean", description: "Output as JSON" },
    help:   { type: "boolean", short: "h", description: "Show this help" },
    version: { type: "boolean", description: "Show version" },
  },
  examples: [
    "fit-example data.yaml",
    "fit-example data.yaml --json",
  ],
};
```

### One line per command

Each command occupies exactly one line in help output, with aligned columns.
This is intentional — agents parse help text line-by-line, and a predictable
one-command-per-line layout makes discovery reliable.

### Human and machine modes

- `--help` renders human-readable formatted text to stdout
- `--help --json` emits the definition object as JSON, suitable for agent
  consumption

Both modes are handled automatically by `cli.parse()`.

---

## Error Handling

### Standard format

All errors write to stderr in a consistent format with no ANSI color codes:

```
cli-name: error: message
```

### Exit codes

| Code | Meaning       | Method             |
| ---- | ------------- | ------------------ |
| 1    | Runtime error | `cli.error()`      |
| 2    | Usage error   | `cli.usageError()` |

`cli.error(message)` writes the formatted error and sets `process.exitCode = 1`.
Use it for runtime failures — file not found, network errors, invalid data.

`cli.usageError(message)` writes the same format but sets
`process.exitCode = 2`. Use it for bad arguments — missing positionals, unknown
flags, invalid combinations.

### Exception logging

In `catch` blocks, use `logger.exception()` for operational errors before
calling `cli.error()`. This preserves the stack trace in structured logs while
showing a clean message on stderr:

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
aligned label/description pairs.

```js
import { SummaryRenderer } from "@forwardimpact/libcli";

const summary = new SummaryRenderer({ process });

summary.render({
  title: "Generated 3 files",
  items: [
    { label: "types.js",    description: "Compiled proto types" },
    { label: "clients.js",  description: "Service client stubs" },
    { label: "index.js",    description: "Re-export barrel" },
  ],
});
```

Output:

```
Generated 3 files
  types.js    — Compiled proto types
  clients.js  — Service client stubs
  index.js    — Re-export barrel
```

The data structure is `{ title: string, items: Array<{ label, description }> }`.
The fit-codegen CLI is the reference pattern for summary usage.

---

## Argument Parsing

The definition object's `options` field serves double duty — it drives both help
text generation and argument parsing.

`cli.parse(argv)` wraps `node:util` `parseArgs` with `allowPositionals: true`
always set. It returns `{ values, positionals }` on success, or `null` if
`--help` or `--version` was handled (the caller should exit cleanly).

```js
const parsed = cli.parse(process.argv.slice(2));
if (!parsed) process.exit(0);

const { values, positionals } = parsed;
```

Positional validation is the caller's responsibility — libcli does not enforce
required positionals because usage patterns vary across CLIs:

```js
const [input] = positionals;
if (!input) {
  cli.usageError("missing required argument <input>");
  process.exit(2);
}
```

---

## Composition with Other Libraries

libcli covers CLI chrome. Other libraries handle content and sessions:

| Library          | Scope                                                        |
| ---------------- | ------------------------------------------------------------ |
| **libcli**       | CLI chrome: help, errors, summaries, argument parsing, color |
| **libformat**    | Content rendering: markdown to HTML or ANSI terminal output  |
| **librepl**      | Interactive sessions: command loops, state, history          |
| **libtelemetry** | Operational diagnostics: Logger, Tracer, Observer            |

A CLI that renders markdown (fit-guide) uses **libformat** for content and
**libcli** for chrome. A REPL-based CLI uses **libcli** for initial argument
parsing and **librepl** for the interactive session.

---

## Minimal CLI Example

A complete, runnable CLI showing the standard pattern from shebang to exit code:

```js
#!/usr/bin/env node

import { createCli } from "@forwardimpact/libcli";
import { createLogger } from "@forwardimpact/libtelemetry";

const definition = {
  name: "fit-example",
  version: "0.1.0",
  description: "Example CLI showing standard pattern",
  usage: "fit-example <input>",
  options: {
    output:  { type: "string", description: "Output path" },
    json:    { type: "boolean", description: "Output as JSON" },
    help:    { type: "boolean", short: "h", description: "Show this help" },
    version: { type: "boolean", description: "Show version" },
  },
  examples: [
    "fit-example data.yaml",
    "fit-example data.yaml --json",
  ],
};

const logger = createLogger("example");
const cli = createCli(definition);

async function main() {
  const parsed = cli.parse(process.argv.slice(2));
  if (!parsed) process.exit(0);

  const { values, positionals } = parsed;
  const [input] = positionals;

  if (!input) {
    cli.usageError("missing required argument <input>");
    process.exit(2);
  }

  // ... do work, using logger for operational output
  logger.info("main", "Processing complete", { file: input });
}

main().catch((error) => {
  logger.exception("main", error);
  cli.error(error.message);
  process.exit(1);
});
```

This demonstrates: shebang line, imports, definition as data, Logger creation,
`cli.parse()` with null check, positional validation with usage error, and the
top-level catch pattern with exception logging.
