# Shared Libraries

The 32 packages under `libraries/` are the shared building blocks for every
product, service, website, and skill in the monorepo. They are designed for
agentic systems: agent-friendly CLIs and output formats, retrieval primitives
that surface rich grounded context, evaluation tooling that closes the
self-improvement loop, and service infrastructure with knobs agents can read and
tune via JSON.

## Mandate

When building a product, service, website, or script, you **must** check this
catalog before writing a generic capability. If a library here covers it, use
the library. If not, note that in the commit or plan so the next contributor
does not re-search.

This rule lives next to the other invariants in
[CONTRIBUTING.md](../CONTRIBUTING.md#read-do).

## Catalog

Five capability categories. Every library appears in exactly one.

### Agent Capability

What the agent surface looks like — entry points, voice, skill data,
human-facing output that agents produce.

| Library         | Capability                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **libcli**      | Agent-friendly CLIs: argument parsing, grep-friendly help output, JSON mode, and skill-doc links surfaced in `--help`. |
| **librepl**     | Agent-friendly interactive shells with command dispatch and skill-doc links.                                           |
| **libprompt**   | Agent-authored prompt templates loaded from `.prompt.md` files with Mustache substitution.                             |
| **libskill**    | Derive jobs, skill matrices, and agent profiles from engineering-standard data shared by humans and agents.            |
| **libformat**   | Render markdown to ANSI for agent-friendly terminal output or HTML for browsers.                                       |
| **libui**       | Functional web UI primitives — DOM helpers, SPA routing, reactive state — for products agents build.                   |
| **libdoc**      | Static documentation sites from markdown folders with front matter and navigation.                                     |
| **libtemplate** | Mustache template loader with project-level override directories for agent-rendered content.                           |

### Agent Retrieval

How agents fetch and shape context. The stack runs from raw bytes (`libstorage`)
through typed records (`libresource`) to schema-aware graph and vector
inference.

| Library         | Capability                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| **libstorage**  | Pluggable file storage (local, S3, Supabase) for context agents fetch and produce.                       |
| **libindex**    | JSONL-backed indexes with filtering and buffered writes — fast lookup of context chunks.                 |
| **libresource** | Typed resources with identifiers, access control, and rich RDF-friendly context chunks agents ground in. |
| **libpolicy**   | Access-control policy evaluation so agents only see context they are authorized for.                     |
| **libgraph**    | RDF triple store with named ontologies and SHACL serialization — schema-aware graph inference.           |
| **libvector**   | Vector dot-product scoring for cosine-similarity retrieval over agent embeddings.                        |

### Agent Self-Improvement

Tooling that closes the Plan-Do-Study-Act loop: evaluate agent runs, generate
synthetic test data so evals are deterministic, and chart process behavior so
signal is distinguished from noise.

| Library                | Capability                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| **libeval**            | Agent evaluation — collect Claude Code traces, run agent loops, supervise multi-step workflows.           |
| **libsyntheticgen**    | DSL parser and deterministic entity graph generator for repeatable agent eval fixtures.                   |
| **libsyntheticprose**  | LLM-generated prose and engineering-standard YAML for synthetic agent evaluation content.                 |
| **libsyntheticrender** | Multi-format rendering and validation of synthetic agent evaluation data (HTML, Markdown, YAML).          |
| **libterrain**         | Full parse-generate-render-validate pipeline for synthetic agent training and evaluation data.            |
| **libxmr**             | Agent-friendly XmR control charts: markdown sparklines and signal detection over time-series CSV metrics. |

### Agent Infrastructure

How agent services run — protocol, types, configuration, observability, process
supervision, and the bridge that exposes gRPC services as MCP tools.

| Library          | Capability                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| **librpc**       | gRPC server and client framework — how agent services talk to each other.                          |
| **libtype**      | Generated protobuf types and namespaces shared across agent-facing services.                       |
| **libconfig**    | Environment-aware configuration loading for services, CLIs, and extensions.                        |
| **libtelemetry** | Structured RFC 5424 logging and trace spans for observable agent operations.                       |
| **libsupervise** | Process supervision with restart policies, log rotation, and JSON config agents can read and tune. |
| **librc**        | Agent-friendly service management — start, stop, status via Unix sockets controlled by svscan.     |
| **libharness**   | Shared mocks and test fixtures so every agent service tests the same way.                          |
| **libmcp**       | Config-driven gRPC-to-MCP tool registration — agents see protobuf services as MCP tools.           |

### Foundations

Cross-cutting primitives and platform-specific helpers used by all of the above.

| Library        | Capability                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| **libutil**    | Cross-cutting utilities: retry with backoff, hashing, token counting, project-root finder, tarball downloader. |
| **libsecret**  | Secret generation, JWT signing, and `.env` file management for services and CLIs.                              |
| **libcodegen** | Protobuf code generation — produces the types and clients consumed by `libtype` and `librpc`.                  |
| **libmacos**   | macOS bundle assembly, code signing, and TCC responsibility helpers — desktop delivery for agent products.     |

## Per-library detail

Every library has a `README.md` that documents its key exports, decision
criteria, and a composition example. Open the library directory for depth.

## Adding a library

Same shape as every other library here:

- `package.json` — `@forwardimpact/lib<name>`, ESM, `description` and `keywords`
  follow the pattern in this catalog (capability-led, agent angle baked in).
- `README.md` — purpose, key exports, one composition example.
- `src/` — implementation (no tests in `src`).
- `test/` — `*.test.js` files, runner-independent (`bun:test` and `node:test`
  both work, see `libharness`).
- Add a row to the right category in this catalog and update any consuming
  product or service to import from the new library.
