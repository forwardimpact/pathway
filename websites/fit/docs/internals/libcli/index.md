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
Options are scoped: `globalOptions` apply to every command, while per-command
`options` apply only to the command they belong to.

### Definition schema

```js
const definition = {
  name: "fit-summit",
  version: "1.0.0",
  description: "Team capability planning from skill data.",
  commands: [
    {
      name: "coverage",
      args: "<team>",
      description: "Show capability coverage",
      options: {
        evidenced: { type: "boolean", description: "Include practiced capability from Map evidence data" },
        "lookback-months": { type: "string", description: "Lookback window for practice patterns (default: 12)" },
      },
      examples: [
        "fit-summit coverage platform",
        "fit-summit coverage platform --evidenced --lookback-months=6",
      ],
    },
    { name: "validate", args: "", description: "Validate roster file" },
  ],
  globalOptions: {
    data: { type: "string", description: "Path to Map data directory" },
    roster: { type: "string", description: "Path to summit.yaml" },
    format: { type: "string", default: "text", description: "Output format: text, json, markdown (default: text)" },
    help: { type: "boolean", short: "h", description: "Show help" },
    version: { type: "boolean", short: "v", description: "Show version" },
  },
  examples: [
    "fit-summit coverage platform",
    "fit-summit what-if platform --add 'Jane, senior, backend'",
  ],
  documentation: [
    {
      title: "Team Capability Guide",
      url: "https://www.forwardimpact.team/docs/products/team-capability/index.md",
      description: "Coverage heatmaps, structural risks, and what-if scenarios.",
    },
    {
      title: "CLI Reference",
      url: "https://www.forwardimpact.team/docs/reference/cli/index.md",
    },
  ],
};
```

**Key fields:**

- **`globalOptions`** — Options that apply to every command. Shown under
  `Options:` in global help and `Global options:` in per-command help.
- **`commands[].options`** — Options specific to one command. Only shown in that
  command's per-command help. Not visible in global help.
- **`commands[].examples`** — Per-command examples, shown only in per-command
  help.
- **`examples`** — Top-level examples, shown only in global help.
- **`documentation`** — Array of `{ title, url, description? }` entries that
  link out to published guides on the fit-doc site. Mirrors the matching
  SKILL.md `## Documentation` section so agents reaching the CLI without the
  skill loaded get the same progressive-disclosure links from `--help`. URLs
  must be fully qualified and end with `/index.md` — see
  [§ Documentation links](#documentation-links).

**Legacy schema rejected:** Passing a top-level `options` field (instead of
`globalOptions`) throws at startup with a migration message. See
[spec 430](../../../../specs/430-per-command-help/spec.md) for background.

**Option name collisions:** If a command option shares a name with a global
option, the constructor throws. Command options are merged with global options
for parsing — a collision would silently shadow the global option.

### Global help (`--help`)

Global help lists all commands and global options. Per-command options do not
appear — global help is a scannable index, not a dump of every flag.

```
fit-summit 1.0.0 — Team capability planning from skill data.

Usage: fit-summit <command> [options]

Commands:
  coverage <team>            Show capability coverage
  validate                   Validate roster file

Options:
  --data=<string>            Path to Map data directory
  --roster=<string>          Path to summit.yaml
  --format=<string>          Output format: text, json, markdown (default: text)
  --help, -h                 Show help
  --version, -v              Show version

Examples:
  fit-summit coverage platform
  fit-summit what-if platform --add 'Jane, senior, backend'

Documentation:
  Team Capability Guide
    https://www.forwardimpact.team/docs/products/team-capability/index.md
    Coverage heatmaps, structural risks, and what-if scenarios.
  CLI Reference
    https://www.forwardimpact.team/docs/reference/cli/index.md

Use fit-summit <command> --help for command-specific options.
```

The Documentation section appears between Examples and the hint line, and is
omitted entirely when `documentation` is unset. The hint line at the bottom is
the only indication that per-command help exists.

### Per-command help (`<command> --help`)

Per-command help shows the command's own options under `Options:` and global
options (minus `--version`) under `Global options:`. Each section aligns columns
independently.

```
fit-summit coverage <team> — Show capability coverage

Usage: fit-summit coverage <team> [options]

Options:
  --evidenced                Include practiced capability from Map evidence data
  --lookback-months=<string>   Lookback window for practice patterns (default: 12)

Global options:
  --data=<string>            Path to Map data directory
  --roster=<string>          Path to summit.yaml
  --format=<string>          Output format: text, json, markdown (default: text)
  --help, -h                 Show help

Examples:
  fit-summit coverage platform
  fit-summit coverage platform --evidenced --lookback-months=6
```

Commands with no `options` omit the `Options:` section and show only
`Global options:`.

### Grep-friendliness

Every command and every option occupies exactly one self-contained line. A grep
for any keyword returns a complete, actionable line — no wrapping to a second
line.

```sh
# Global help — find the command
$ fit-summit -h | grep coverage
  coverage <team>            Show capability coverage

# Per-command help — find the flag
$ fit-summit coverage -h | grep evidenced
  --evidenced                Include practiced capability from Map evidence data

# Command-specific options don't leak into global help
$ fit-summit -h | grep add
# (no output — --add is what-if-specific)
```

### Human and machine modes

- `--help` renders human-readable formatted text to stdout
- `--help --json` emits structured JSON

Global `--help --json` emits the full definition object — including the
`documentation` array verbatim, so agents that consume help via JSON get the
links as structured data rather than parsing them out of the rendered text.
Per-command `--help --json` emits a focused object with `parent`, `name`,
`args`, `description`, `options`, `globalOptions` (without `--version`), and
`examples`.

Both modes are handled automatically by `cli.parse()`.

### Documentation links

The `documentation` field is the bridge between a CLI and its skill. Each fit-\*
skill ends with a `## Documentation` section listing fully qualified `.md` URLs
published by the fit-doc static site generator; the same entries belong on the
CLI definition so an agent that reaches the CLI without the skill — no skill
installed, the skill omitted to save context, or a direct invocation in CI —
gets the same progressive-disclosure links.

Each entry is a plain object:

```js
{
  title: "Team Capability Guide",
  url: "https://www.forwardimpact.team/docs/products/team-capability/index.md",
  description: "Coverage heatmaps, structural risks, and what-if scenarios.",
}
```

The `description` is optional; entries without one render as title + URL only.
URLs should end with `/index.md` so agents fetching them receive raw markdown
rather than rendered HTML — fit-doc emits an `index.md` companion for every HTML
page and advertises it via `<link rel="alternate" type="text/markdown">`.

When wiring a CLI, copy the entries directly from the matching
`.claude/skills/fit-*/SKILL.md` so both surfaces stay in sync.

[librepl](#composition-with-other-libraries) accepts the same `documentation`
field with the same shape, so REPL-based CLIs (fit-guide) expose the section
under `--help` alongside their interactive command list.

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

`cli.parse(argv)` wraps `node:util` `parseArgs` with `allowPositionals: true`.
It returns `{ values, positionals }` on success, or `null` if `--help` or
`--version` was handled (the caller should exit cleanly).

### Command identification

When the definition has `commands`, `parse()` identifies the command by scanning
non-flag tokens and trying the longest match against `commands[].name`. This
handles multi-word commands like `org show` in fit-landmark —
`parse(["org", "show", "--help"])` correctly matches the `org show` entry.

### Option merging and scoping

Once a command is identified, its `options` are merged with `globalOptions` for
the `parseArgs()` call. Only the merged set is accepted — passing a
command-specific option on the wrong command throws
`ERR_PARSE_ARGS_UNKNOWN_OPTION`.

This is a tightening over the pre-spec-430 behavior: previously every option was
accepted on every command (the handler simply ignored irrelevant flags). Now
input validation is stricter while command behavior is unchanged.

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

| Library          | Scope                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------- |
| **libcli**       | CLI chrome: help, errors, summaries, argument parsing, color                                  |
| **libformat**    | Content rendering: markdown to HTML or ANSI terminal output                                   |
| **librepl**      | Interactive sessions: command loops, state, history, `documentation` pass-through in `--help` |
| **libtelemetry** | Operational diagnostics: Logger, Tracer, Observer                                             |

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
  globalOptions: {
    output:  { type: "string", description: "Output path" },
    json:    { type: "boolean", description: "Output as JSON" },
    help:    { type: "boolean", short: "h", description: "Show this help" },
    version: { type: "boolean", description: "Show version" },
  },
  examples: [
    "fit-example data.yaml",
    "fit-example data.yaml --json",
  ],
  documentation: [
    {
      title: "Example Guide",
      url: "https://www.forwardimpact.team/docs/libraries/example/index.md",
      description: "Task-oriented walkthrough for fit-example.",
    },
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
`cli.parse()` with null check, positional validation with usage error,
documentation links mirroring the matching SKILL.md, and the top-level catch
pattern with exception logging.
