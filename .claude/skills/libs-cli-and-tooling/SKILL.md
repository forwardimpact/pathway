---
name: libs-cli-and-tooling
description: >
  Use when building a CLI tool, parsing arguments, rendering help text or
  summary output, running an interactive REPL session, finding the project
  root, retrying flaky network calls with backoff, counting LLM tokens,
  generating hashes or UUIDs, downloading and extracting tarballs, generating
  secrets or JWTs, reading or writing .env files, supervising long-running
  daemons, managing service lifecycles, generating code from Protocol Buffer
  definitions, or processing Claude Code traces and running agent evaluations.
---

# CLI and Tooling

## When to Use

- Building CLI entry points with argument parsing and help rendering
- Running interactive REPL sessions
- Retrying flaky operations with exponential backoff
- Finding the project root, counting tokens, generating hashes or UUIDs
- Downloading and extracting tarballs
- Creating cryptographic secrets, JWTs, or managing .env files
- Supervising long-running daemon processes with automatic restarts
- Managing service lifecycles (start/stop/status/restart)
- Generating code from Protocol Buffer definitions
- Processing Claude Code traces, running agent evaluations

## Libraries

| Library      | Capabilities                                                                                              | Key Exports                                                                                             |
| ------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| libcli       | Parse arguments, render help text (including skill documentation links), format tables and colored output | `Cli`, `createCli`, `HelpRenderer`, `SummaryRenderer`, `formatTable`, `colorize`                        |
| librepl      | Run interactive REPL sessions, surface skill documentation links in `--help`                              | `Repl`                                                                                                  |
| libutil      | Retry with backoff, count tokens, hash, find project root, download tarballs                              | `Retry`, `createRetry`, `countTokens`, `generateHash`, `Finder`, `BundleDownloader`                     |
| libsecret    | Generate secrets, JWTs, read and write .env files                                                         | `generateSecret`, `generateBase64Secret`, `generateJWT`, `getOrGenerateSecret`                          |
| libsupervise | Supervise daemons with restart policies and log rotation                                                  | `SupervisionTree`, `createSupervisionTree`, `LongrunProcess`, `OneshotProcess`, `LogWriter`             |
| librc        | Manage service lifecycles via svscan daemon and Unix sockets                                              | `ServiceManager`, `sendCommand`, `waitForSocket`                                                        |
| libcodegen   | Generate types, services, and definitions from .proto files                                               | `CodegenBase`, `CodegenTypes`, `CodegenServices`, `CodegenDefinitions`                                  |
| libeval      | Process Claude Code traces, run agent evaluations, supervise loops                                        | `TraceCollector`, `createTraceCollector`, `AgentRunner`, `createAgentRunner`, `Supervisor`, `TeeWriter` |

## Decision Guide

- **libcli vs inline argument parsing** — Always use `Cli` for CLI entry points.
  It provides argument parsing, help text generation via `HelpRenderer`, and
  summary output via `SummaryRenderer`. Never hand-roll `process.argv` parsing.
- **Documentation links in `--help`** — Whenever a CLI has a matching
  `.claude/skills/fit-*/SKILL.md`, mirror its `## Documentation` section into
  the CLI definition's `documentation` array. Both libcli and librepl render it
  under `--help` (and pass it through to `--help --json`), so agents that reach
  the CLI without the skill loaded still get the same progressive- disclosure
  links. Use the same titles, fully qualified `index.md` URLs, and blurbs as the
  skill — the two surfaces must stay in sync.
- **librepl vs readline** — Use `Repl` for interactive command loops. It handles
  prompt display, history, and command dispatch. Never use raw `readline`.
- **libsupervise vs librc** — `libsupervise` for direct process supervision
  (LongrunProcess, OneshotProcess with restart policies and log rotation).
  `librc` for managing services through the svscan daemon via Unix socket
  commands (start/stop/status).
- **libutil `generateHash` vs libsecret `generateSecret`** — `generateHash` for
  deterministic content hashing (SHA256 of input data). `generateSecret` for
  cryptographic random secrets (API keys, tokens). `libsecret.generateJWT` for
  signed JSON Web Tokens.
- **libcodegen** — Run once after .proto file changes (`just codegen`). Not used
  at runtime. Output consumed by libtype and librpc.
- **libeval** — `TraceCollector` for downloading and parsing Claude Code JSONL
  traces. `AgentRunner` for running agent evaluation loops. `Supervisor` for
  orchestrating multi-step agent workflows with intervention support.
- **For CLI logging, see libtelemetry in libs-grpc-services** — use
  `createLogger` for operational output in CLI tools.

## Composition Recipes

### Recipe 1: Create a CLI entry point

```javascript
import { Cli, createCli, HelpRenderer } from "@forwardimpact/libcli";

const cli = createCli({
  name: "my-tool",
  version: "1.0.0",
  commands: {
    build: { description: "Build the project", handler: buildCommand },
    test: { description: "Run tests", handler: testCommand },
  },
  // Mirror the matching SKILL.md `## Documentation` section so agents
  // reaching the CLI without the skill loaded still see the same links.
  documentation: [
    {
      title: "My Tool Guide",
      url: "https://www.forwardimpact.team/docs/guides/my-tool/index.md",
      description: "Task-oriented walkthrough.",
    },
  ],
});

const help = new HelpRenderer(cli);
await cli.run(process.argv.slice(2));
```

### Recipe 2: Run an interactive REPL

```javascript
import { Repl } from "@forwardimpact/librepl";

const repl = new Repl({
  prompt: "> ",
  commands: {
    status: async () => console.log("OK"),
    quit: () => process.exit(0),
  },
  // Same shape as libcli — surfaced under `--help` alongside the
  // interactive command list.
  documentation: [
    {
      title: "My Tool Guide",
      url: "https://www.forwardimpact.team/docs/guides/my-tool/index.md",
    },
  ],
});

await repl.start();
```

### Recipe 3: Supervise a service

```javascript
import { SupervisionTree } from "@forwardimpact/libsupervise";

const tree = new SupervisionTree("/var/log/services");
await tree.start();
await tree.add("db", "node db-service.js");
await tree.add("api", "node api-service.js");
const status = tree.getStatus();
await tree.stop();
```

### Recipe 4: Generate secrets for environment

```javascript
import { generateSecret, generateBase64Secret } from "@forwardimpact/libsecret";
import { generateJWT } from "@forwardimpact/libsecret";
import { updateEnvFile } from "@forwardimpact/libsecret";

const secret = generateSecret();
await updateEnvFile(".env", "SERVICE_SECRET", secret);

const jwt = generateJWT({ userId: "123" }, secret, { expiresIn: "1h" });
await updateEnvFile(".env", "JWT_TOKEN", jwt);
```

### Recipe 5: Generate code from proto definitions

```javascript
import { CodegenTypes, CodegenServices } from "@forwardimpact/libcodegen";

const typeGen = new CodegenTypes("./proto");
await typeGen.generate("./generated/types");

const serviceGen = new CodegenServices("./proto");
await serviceGen.generate("./generated/services");

// CLI: just codegen
```

### Recipe 6: Run an agent evaluation

```javascript
import { AgentRunner, createAgentRunner } from "@forwardimpact/libeval";

const runner = createAgentRunner({ traceDir: "./traces", logger });
const result = await runner.run({ prompt: "Fix the bug", workDir: "." });
```

## Security

- **Secret generation** — Always use `libsecret` for generating secrets and
  tokens. Never hardcode secrets in source code.
- **Audit** — Run `just audit` for combined npm audit and gitleaks secret
  scanning.
