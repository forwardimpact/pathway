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

| Library      | Capabilities                                                                 | Key Exports                                                                                             |
| ------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| libcli       | Parse arguments, render help text, format tables and colored output          | `Cli`, `createCli`, `HelpRenderer`, `SummaryRenderer`, `formatTable`, `colorize`                        |
| librepl      | Run interactive REPL sessions                                                | `Repl`                                                                                                  |
| libutil      | Retry with backoff, count tokens, hash, find project root, download tarballs | `Retry`, `createRetry`, `countTokens`, `generateHash`, `Finder`, `BundleDownloader`                     |
| libsecret    | Generate secrets, JWTs, read and write .env files                            | `generateSecret`, `generateBase64Secret`, `generateJWT`, `getOrGenerateSecret`                          |
| libsupervise | Supervise daemons with restart policies and log rotation                     | `SupervisionTree`, `createSupervisionTree`, `LongrunProcess`, `OneshotProcess`, `LogWriter`             |
| librc        | Manage service lifecycles via svscan daemon and Unix sockets                 | `ServiceManager`, `sendCommand`, `waitForSocket`                                                        |
| libcodegen   | Generate types, services, and definitions from .proto files                  | `CodegenBase`, `CodegenTypes`, `CodegenServices`, `CodegenDefinitions`                                  |
| libeval      | Process Claude Code traces, run agent evaluations, supervise loops           | `TraceCollector`, `createTraceCollector`, `AgentRunner`, `createAgentRunner`, `Supervisor`, `TeeWriter` |

## Decision Guide

- **libcli vs inline argument parsing** — Always use `Cli` for CLI entry points.
  It provides argument parsing, help text generation via `HelpRenderer`, and
  summary output via `SummaryRenderer`. Never hand-roll `process.argv` parsing.
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

## DI Wiring

### libcli

```javascript
// Cli — accepts options with name, commands, version
const cli = new Cli({ name: "tool", commands, version: "1.0.0" });

// createCli — convenience factory
const cli = createCli({ name: "tool", commands });

// HelpRenderer — accepts cli instance
const help = new HelpRenderer(cli);

// SummaryRenderer — accepts options
const summary = new SummaryRenderer({ title: "Results" });
```

### librepl

```javascript
// Repl — accepts options with prompt, commands
const repl = new Repl({ prompt: "> ", commands });
await repl.start();
```

### libutil

```javascript
// Pure functions — no DI, no classes
import { countTokens, createTokenizer } from "@forwardimpact/libutil";
import { generateHash, generateUUID } from "@forwardimpact/libutil";
import { Retry, createRetry } from "@forwardimpact/libutil";

// Retry — accepts options
const retry = createRetry({ maxAttempts: 3, backoff: "exponential" });
await retry.run(() => fetch(url));

// Finder — accepts options
import { Finder } from "@forwardimpact/libutil";
const finder = new Finder();
const root = finder.findProjectRoot();

// BundleDownloader — accepts options
import { BundleDownloader } from "@forwardimpact/libutil";
const downloader = new BundleDownloader(url, destDir);
```

### libsecret

```javascript
// Pure functions — no DI, no classes
import { generateSecret, generateBase64Secret } from "@forwardimpact/libsecret";
import { generateJWT } from "@forwardimpact/libsecret";
import { readEnvFile, updateEnvFile } from "@forwardimpact/libsecret";
import { getOrGenerateSecret } from "@forwardimpact/libsecret";
```

### libsupervise

```javascript
// LongrunProcess — accepts name, command, options
const proc = new LongrunProcess("api", "node server.js", {
  stdout: process.stdout,
  stderr: process.stderr,
});

// SupervisionTree — accepts log directory
const tree = new SupervisionTree("/var/log/services");

// LogWriter — accepts log directory and options
const writer = new LogWriter("/var/log/api", { maxFileSize: 1_000_000, maxFiles: 10 });
```

### librc

```javascript
// ServiceManager — accepts config and logger
const manager = new ServiceManager(config, logger);
await manager.start();
await manager.status();

// Socket utilities — pure functions
import { sendCommand, waitForSocket } from "@forwardimpact/librc";
await waitForSocket("/tmp/svscan.sock", 5000);
const response = await sendCommand("/tmp/svscan.sock", { command: "status" });
```

### libcodegen

```javascript
// CodegenTypes — accepts proto directory
const generator = new CodegenTypes("./proto");

// CodegenServices — accepts proto directory
const generator = new CodegenServices("./proto");

// CodegenDefinitions — accepts proto directory
const generator = new CodegenDefinitions("./proto");
```

### libeval

```javascript
// TraceCollector — accepts options
const collector = new TraceCollector({ traceDir: "./traces" });

// createTraceCollector — convenience factory
const collector = createTraceCollector({ traceDir: "./traces" });

// AgentRunner — accepts options
const runner = new AgentRunner({ traceDir: "./traces", logger });

// Supervisor — accepts agent runner and options
const supervisor = new Supervisor(runner, { maxIterations: 10 });

// TeeWriter — accepts write streams
const tee = new TeeWriter(stream1, stream2);
```

## Security

- **Secret generation** — Always use `libsecret` for generating secrets and
  tokens. Never hardcode secrets in source code.
- **Audit** — Run `just audit` for combined npm audit and gitleaks secret
  scanning.
