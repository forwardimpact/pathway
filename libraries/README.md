# Shared Libraries

The packages under `libraries/` are agent-shaped utilities — designed for
agentic systems from the ground up. Agent-friendly CLIs and output formats,
retrieval primitives that surface rich grounded context, evaluation tooling that
closes the self-improvement loop, and service infrastructure with knobs agents
can read and tune via JSON.

## Mandate

When building a product, service, website, or script, you **must** check this
catalog before writing a generic capability. If a library here covers it, use
the library. If not, note that in the commit or plan so the next contributor
does not re-search.

This rule lives next to the other invariants in
[CONTRIBUTING.md](../CONTRIBUTING.md#read-do).

## Catalog

Five capability categories. Every library appears in exactly one.

The tables below are generated from each library's `package.json`
(`forwardimpact.capability` + `description`). To regenerate after editing a
library: `bun run lib:fix`. CI fails the build if the catalog drifts.

### Agent Capability

What the agent surface looks like — entry points, voice, skill data,
human-facing output that agents produce.

<!-- BEGIN:capability:agent-capability -->

| Library         | Capability                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **libcli**      | Agent-friendly CLIs: argument parsing, grep-friendly help output, JSON mode, and skill-doc links surfaced in `--help`. |
| **libdoc**      | Static documentation sites from markdown folders with front matter and navigation.                                     |
| **libformat**   | Render markdown to ANSI for agent-friendly terminal output or HTML for browsers.                                       |
| **libprompt**   | Agent-authored prompt templates loaded from `.prompt.md` files with Mustache substitution.                             |
| **librepl**     | Agent-friendly interactive REPL with command dispatch and skill-doc links surfaced in `--help`.                        |
| **libskill**    | Derive jobs, skill matrices, and agent profiles from engineering-standard data shared by humans and agents.            |
| **libtemplate** | Mustache template loader with project-level override directories for agent-rendered content.                           |
| **libui**       | Functional web UI primitives — DOM helpers, SPA routing, reactive state — for products agents build.                   |

<!-- END:capability:agent-capability -->

### Agent Retrieval

How agents fetch and shape context. The stack runs from raw bytes (`libstorage`)
through typed records (`libresource`) to schema-aware graph and vector
inference.

<!-- BEGIN:capability:agent-retrieval -->

| Library         | Capability                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| **libgraph**    | RDF triple store with named ontologies and SHACL serialization — schema-aware graph inference for agents.   |
| **libindex**    | JSONL-backed indexes with filtering and buffered writes — fast lookup of agent context chunks.              |
| **libpolicy**   | Access-control policy evaluation — agents see only context they are authorized for.                         |
| **libresource** | Typed resources with identifiers, access control, and rich RDF-friendly context chunks for agent grounding. |
| **libstorage**  | Pluggable file storage (local, S3, Supabase) for context agents fetch and produce at runtime.               |
| **libvector**   | Vector dot-product scoring for cosine-similarity retrieval over agent embeddings.                           |

<!-- END:capability:agent-retrieval -->

### Agent Self-Improvement

Tooling that closes the Plan-Do-Study-Act loop: evaluate agent runs, generate
synthetic test data so evals are deterministic, and chart process behavior so
signal is distinguished from noise.

<!-- BEGIN:capability:agent-self-improvement -->

| Library                | Capability                                                                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **libeval**            | Agent evaluation: collect Claude Code traces, run agent loops, supervise multi-step workflows.                                                |
| **libsyntheticgen**    | DSL parser and deterministic entity graph generator for repeatable agent eval fixtures.                                                       |
| **libsyntheticprose**  | LLM-generated prose and engineering-standard YAML for synthetic agent evaluation content.                                                     |
| **libsyntheticrender** | Multi-format rendering and validation of synthetic agent evaluation data (HTML, Markdown, YAML).                                              |
| **libterrain**         | Full parse-generate-render-validate pipeline for synthetic agent training and evaluation data.                                                |
| **libxmr**             | Agent-friendly Wheeler/Vacanti XmR control charts: 14-line ASCII charts and the canonical three detection rules over time-series CSV metrics. |

<!-- END:capability:agent-self-improvement -->

### Agent Infrastructure

How agent services run — protocol, types, configuration, observability, process
supervision, and the bridge that exposes gRPC services as MCP tools.

<!-- BEGIN:capability:agent-infrastructure -->

| Library          | Capability                                                                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **libcodegen**   | Protobuf code generation — produces the types and clients consumed by `libtype` and `librpc`.                                                             |
| **libconfig**    | Environment-aware loading of application settings for services, CLIs, and extensions.                                                                     |
| **libmcp**       | Config-driven gRPC-to-MCP tool registration — agents see protobuf services as MCP tools.                                                                  |
| **librc**        | Agent-friendly service lifecycle management: start, stop, and status of long-running services via a Unix socket interface.                                |
| **librpc**       | gRPC server and client framework — how agent services talk to each other.                                                                                 |
| **libsupervise** | Process supervision (restart policies, log rotation) driven by JSON daemon manifests agents can read and tune; built on `libconfig` for settings loading. |
| **libtelemetry** | Structured RFC 5424 logging and trace spans for observable agent operations.                                                                              |
| **libtype**      | Generated protobuf types and namespaces shared across agent-facing services.                                                                              |

<!-- END:capability:agent-infrastructure -->

### Foundations

Cross-cutting primitives and platform-specific helpers used by all of the above.

<!-- BEGIN:capability:foundations -->

| Library        | Capability                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **libharness** | Shared mocks and test fixtures so every library and service tests the same way.                                                   |
| **libmacos**   | macOS bundle assembly, code signing, and OS permission entitlement helpers — desktop delivery for agent products.                 |
| **libsecret**  | Secret generation, JWT signing, and `.env` file management for agent services and CLIs.                                           |
| **libutil**    | Cross-cutting utilities for agents and services: retry with backoff, hashing, token counting, project finder, tarball downloader. |

<!-- END:capability:foundations -->

## I need to…

Common needs that map directly to a single library. Generated from each
library's `package.json` (`forwardimpact.needs`); regenerate with
`bun run lib:fix`.

<!-- BEGIN:needs -->

| I need to…                                                                     | Library              |
| ------------------------------------------------------------------------------ | -------------------- |
| Add a distributed trace span (OpenTelemetry-style observability)               | `libtelemetry`       |
| Assemble a macOS app bundle                                                    | `libmacos`           |
| Buffer high-volume index writes                                                | `libindex`           |
| Build a gRPC service                                                           | `librpc`             |
| Build a reactive single-page web app                                           | `libui`              |
| Build a static documentation site                                              | `libdoc`             |
| Call another gRPC service                                                      | `librpc`             |
| Chart a metric with the canonical Wheeler/Vacanti XmR rules                    | `libxmr`             |
| Code-sign a macOS app                                                          | `libmacos`           |
| Compute a stable hash (SHA-256 checksum)                                       | `libutil`            |
| Compute cosine similarity between embeddings                                   | `libvector`          |
| Configure restart policies and log rotation for a daemon manifest              | `libsupervise`       |
| Control a service's start, stop, and status                                    | `librc`              |
| Count LLM tokens                                                               | `libutil`            |
| Declare macOS permission entitlements for an app                               | `libmacos`           |
| Derive a role definition from a competency matrix (discipline × level × track) | `libskill`           |
| Download and extract a tarball                                                 | `libutil`            |
| Drive an LLM agent through a scripted run and capture its trace                | `libeval`            |
| Emit a structured log line                                                     | `libtelemetry`       |
| Evaluate an access-control policy                                              | `libpolicy`          |
| Filter records in a JSONL index                                                | `libindex`           |
| Find the project root                                                          | `libutil`            |
| Generate a deterministic entity graph                                          | `libsyntheticgen`    |
| Generate a secret (random token or API key)                                    | `libsecret`          |
| Generate a UUID                                                                | `libutil`            |
| Generate an agent role profile from discipline, level, and track               | `libskill`           |
| Generate code from .proto files                                                | `libcodegen`         |
| Generate LLM prose for synthetic data                                          | `libsyntheticprose`  |
| Import shared protobuf types and namespaces                                    | `libtype`            |
| Load a prompt template from disk                                               | `libprompt`          |
| Load application settings (config) from environment                            | `libconfig`          |
| Manage typed resources with access control                                     | `libresource`        |
| Mock a config, storage, logger, or gRPC handler in a test                      | `libharness`         |
| Parse a terrain DSL                                                            | `libsyntheticgen`    |
| Parse and query Claude Code trace NDJSON files                                 | `libeval`            |
| Parse CLI args and render help                                                 | `libcli`             |
| Query an RDF triple graph                                                      | `libgraph`           |
| Read or write .env (dotenv) files                                              | `libsecret`          |
| Read or write JSONL                                                            | `libstorage`         |
| Register a gRPC service as MCP tools                                           | `libmcp`             |
| Render a Mustache template with project overrides                              | `libtemplate`        |
| Render a prompt template with variable substitution                            | `libprompt`          |
| Render an XmR control chart as monospace text                                  | `libxmr`             |
| Render colored tables and JSON output                                          | `libcli`             |
| Render markdown as ANSI                                                        | `libformat`          |
| Render markdown as HTML                                                        | `libformat`          |
| Render synthetic data as HTML, Markdown, or YAML                               | `libsyntheticrender` |
| Resolve a typed resource by URN                                                | `libresource`        |
| Retry a flaky network call                                                     | `libutil`            |
| Run an interactive REPL session                                                | `librepl`            |
| Run the end-to-end synthetic-data pipeline from a terrain file                 | `libterrain`         |
| Score a candidate's skills against a job's required skill markers              | `libskill`           |
| Serialize SHACL shapes                                                         | `libgraph`           |
| Sign a JWT                                                                     | `libsecret`          |
| Store files to local, S3, or Supabase                                          | `libstorage`         |
| Supervise a long-running daemon                                                | `libsupervise`       |
| Supervise a multi-step or multi-agent workflow                                 | `libeval`            |
| Surface skill-doc links in CLI --help output                                   | `libcli`             |
| Surface skill-doc links in REPL --help output                                  | `librepl`            |
| Validate synthetic data integrity                                              | `libsyntheticrender` |

<!-- END:needs -->

## Vocabulary

A few recurring terms used in this catalog and across the monorepo.

- **engineering-standard** — the agent-aligned engineering standard data model
  (disciplines, levels, tracks, capabilities, skills, behaviours, drivers)
  authored as YAML under [products/map/starter/](../products/map/starter/).
  Defines what good engineering looks like for the organization.
- **skill-doc** — the published markdown documentation for a skill or
  capability, surfaced to agents via `--help` links so they can locate
  authoritative usage docs without prior context.
- **MCP** — [Model Context Protocol](https://modelcontextprotocol.io/),
  Anthropic's standard for exposing tools to LLM agents. `libmcp` bridges gRPC
  services into MCP tools.
- **Plan-Do-Study-Act** — the Toyota-Kata improvement loop the Kata Agent Team
  uses: agents plan, ship, study their traces, and act on findings. See
  [KATA.md](../KATA.md).

## Per-library detail

Every library has a `README.md` that documents its key exports, decision
criteria, and a composition example. Open the library directory for depth.

## Adding a library

Same shape as every other library here:

- `package.json` — `@forwardimpact/lib<name>`, ESM, with `description`,
  `keywords`, and `forwardimpact: { capability, needs }` (capability is one of
  `agent-capability`, `agent-retrieval`, `agent-self-improvement`,
  `agent-infrastructure`, `foundations`; needs is an array of "I need to…"
  phrases unique across the monorepo).
- `README.md` — purpose, key exports, one composition example.
- `src/` — implementation (no tests in `src`).
- `test/` — `*.test.js` files, runner-independent (`bun:test` and `node:test`
  both work, see `libharness`).
- Run `bun run lib:fix` to regenerate the tables above. Update any consuming
  product or service to import from the new library.
