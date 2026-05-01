---
title: Guide Internals
description: "Agent infrastructure — Claude Agent SDK harness, MCP endpoint, knowledge pipeline, and service stack."
---

## Architecture

Guide is an AI agent that understands your organization's agent-aligned
engineering standard and reasons about it in context. It runs on the Claude
Agent SDK and exposes its knowledge services through a Model Context Protocol
(MCP) endpoint, making it accessible from three surfaces:

- **`fit-guide` CLI** — Reference implementation built on the Claude Agent SDK.
- **Claude Code** — Connects to Guide's MCP endpoint as an MCP server.
- **Claude Chat** — Connects via a Claude Connector backed by the MCP endpoint.

All three surfaces share the same tools, the same agent instructions
(`guide-default` prompt), and the same knowledge backends.

---

## MCP Endpoint

The `mcp` service is a Streamable HTTP MCP server built on
`@modelcontextprotocol/sdk`. It exposes tools and the `guide-default` prompt.
All three surfaces connect to this endpoint with a bearer token (`MCP_TOKEN`).
The `/health` probe is unauthenticated.

---

## Tools

Tools are registered at startup from `config.json` via `registerToolsFromConfig`
(`@forwardimpact/libmcp`). Each entry maps an MCP tool name to a gRPC method on
a backend service. The starter template ships these defaults:

| MCP tool                         | Backend | gRPC method            |
| -------------------------------- | ------- | ---------------------- |
| `get_ontology`                   | graph   | `GetOntology`          |
| `get_subjects`                   | graph   | `GetSubjects`          |
| `query_by_pattern`               | graph   | `QueryByPattern`       |
| `search_content`                 | vector  | `SearchContent`        |
| `pathway_list_jobs`              | pathway | `ListJobs`             |
| `pathway_describe_job`           | pathway | `DescribeJob`          |
| `pathway_list_agent_profiles`    | pathway | `ListAgentProfiles`    |
| `pathway_describe_agent_profile` | pathway | `DescribeAgentProfile` |
| `pathway_describe_progression`   | pathway | `DescribeProgression`  |
| `pathway_list_job_software`      | pathway | `ListJobSoftware`      |

---

## Agent Instructions

A single `guide-default` prompt serves all three surfaces. It collapses the
former planner → researcher → editor chain into one agent with a structured
workflow: orient (ontology) → query (tools) → synthesize (grounded answer).

The prompt is served by the MCP server via `prompts/get` and loaded by the CLI
as the SDK `systemPrompt`. Claude Code and Claude Chat receive it through their
respective configuration mechanisms.

---

## Knowledge Pipeline

```
HTML files -> typed resources -> RDF triples (graph store)
                              + vector embeddings (vector store)
```

Documents are processed through a dual-index pipeline:

1. **Extraction** — HTML files are parsed and typed as resources (articles,
   guides, FAQs, etc.)
2. **Graph indexing** — Resources are converted to RDF triples and stored in the
   graph service for precise structured lookups
3. **Vector indexing** — Resources are embedded via TEI (Text Embeddings
   Inference) and stored in the vector service for fuzzy semantic retrieval

---

## Session Persistence

The Claude Agent SDK manages conversation history through JSONL session files
and automatic context compaction. `fit-guide resume` continues a previous
session. Each surface maintains its own history — cross-surface sharing is out
of scope.

---

## Service Stack

Guide requires the service stack, supervised by `fit-rc`. Services start in
dependency order:

| Order | Service | Protocol        | Purpose                     | Port |
| ----- | ------- | --------------- | --------------------------- | ---- |
| 1     | trace   | gRPC            | Distributed tracing         | 3001 |
| 2     | vector  | gRPC            | Vector similarity search    | 3002 |
| 3     | graph   | gRPC            | RDF triple store            | 3003 |
| 4     | pathway | gRPC            | Standard data service       | 3004 |
| 5     | mcp     | Streamable HTTP | MCP tool and prompt gateway | 3005 |

Start all services with `npx fit-rc start` (external) or `just rc-start`
(internal contributors).

---

## Authentication

| Surface         | LLM auth                     | MCP auth           |
| --------------- | ---------------------------- | ------------------ |
| `fit-guide` CLI | `ANTHROPIC_API_KEY` or OAuth | Bearer `MCP_TOKEN` |
| Claude Code     | Host credential              | Bearer `MCP_TOKEN` |
| Claude Chat     | Host credential              | Bearer `MCP_TOKEN` |

`fit-guide login` runs an OAuth PKCE flow against Anthropic's auth endpoint.
`ANTHROPIC_API_KEY` works as an environment variable alternative.

---

## Data Directories

| Path                  | Purpose                       |
| --------------------- | ----------------------------- |
| `starter/config.json` | Service startup configuration |
| `products/guide/bin/` | CLI entry point (fit-guide)   |

---

## Related Documentation

- [Map Internals](/docs/internals/map/) — Data contracts consumed by Guide
- [Finding Your Bearing Guide](/docs/products/finding-your-bearing/) —
  User-facing Guide documentation
