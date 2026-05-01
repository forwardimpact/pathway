---
name: fit-guide
description: >
  Ask an AI agent that understands your agent-aligned engineering standard. Use when
  asking questions about skills, levels, and career expectations, getting
  context-specific career guidance, interpreting engineering artifacts
  against skill markers, setting up the Guide service stack, or ingesting
  knowledge content.
---

# Guide Product

AI agent that understands your organization's agent-aligned engineering standard
— skills, levels, behaviours, and expectations — and reasons about them in
context. Guide helps engineers onboard, find growth areas, and interpret
engineering artifacts against skill markers.

Guide runs on the Claude Agent SDK and exposes its knowledge through MCP, making
it accessible from three surfaces: `fit-guide` CLI, Claude Code, and Claude
Chat.

## When to Use

**Conversational agent-aligned engineering standard queries:**

- Getting career guidance specific to your organization's agent-aligned
  engineering standard
- Interpreting engineering artifacts against specific skill markers
- Asking about skills, levels, behaviours, and career expectations
- Piping prompts to `fit-guide` for scripted queries

**Setup and configuration:**

- Initializing a new Guide project (`npx fit-guide init`)
- Authenticating with Anthropic (`npx fit-guide login`)
- Processing knowledge content, graphs, and vectors

**Service operations:**

- Starting, stopping, or checking service status via `npx fit-rc`
- Ingesting new knowledge content into the pipeline
- Troubleshooting agent responses or connectivity

---

## How It Works

### Agent Orchestration

The CLI sends user queries to the Claude Agent SDK, which orchestrates the
conversation using a single-agent `guide-default` prompt. The agent follows a
structured workflow: orient (explore the ontology), query (retrieve data via
tools), and synthesize (compose a grounded answer). The SDK handles context
compaction and session persistence automatically.

### Tool Execution

Guide exposes 10 tools via an MCP endpoint, each backed by a gRPC service:

| Tool                             | Backend | Purpose                      |
| -------------------------------- | ------- | ---------------------------- |
| `get_ontology`                   | graph   | Schema vocabulary            |
| `get_subjects`                   | graph   | Entity URIs by type          |
| `query_by_pattern`               | graph   | Triple-pattern graph queries |
| `search_content`                 | vector  | Semantic similarity search   |
| `pathway_list_jobs`              | pathway | Job combinations             |
| `pathway_describe_job`           | pathway | Full job description         |
| `pathway_list_agent_profiles`    | pathway | Agent profile definitions    |
| `pathway_describe_agent_profile` | pathway | Agent profile detail         |
| `pathway_describe_progression`   | pathway | Level progression deltas     |
| `pathway_list_job_software`      | pathway | Software toolkit per job     |

### Knowledge Pipeline

Content flows through three stages: HTML files in `data/knowledge/` are
processed into typed resources (`data/resources/`), then indexed as RDF triples
in the graph store (`data/graphs/`) for structured queries, and as vector
embeddings (`data/vectors/`) for similarity search. This dual index lets the
agent combine precise graph lookups with fuzzy semantic retrieval.

### Three Surfaces

- **`fit-guide` CLI** — Reference implementation on the Claude Agent SDK.
  Fetches the `guide-default` prompt from MCP and streams the response.
- **Claude Code** — Register the MCP endpoint as an MCP server. Guide's tools
  appear in the tool picker; Claude Code provides the harness.
- **Claude Chat** — Configure a Claude Connector backed by the MCP endpoint.
  Same tools, same knowledge, same answers.

---

## Initialization

Run `npx fit-guide init` once in a fresh project directory:

```sh
mkdir my-guide && cd my-guide
npx fit-guide init
```

What `init` produces:

| File / directory     | Purpose                               |
| -------------------- | ------------------------------------- |
| `.env`               | `MCP_TOKEN`, service port assignments |
| `config/config.json` | Service composition and init order    |

After init, authenticate and set up the stack:

```sh
npx fit-codegen --all       # Generate gRPC stubs and field metadata
npx fit-guide login         # OAuth PKCE login (or set ANTHROPIC_API_KEY in .env)
npx fit-process-resources   # Process starter knowledge HTML
npx fit-process-graphs      # Build the RDF index
npx fit-process-vectors     # Build the vector index (skip if no embeddings backend)
npx fit-rc start            # Launch the service stack
npx fit-guide "What skills does a senior engineer need?"
```

---

## CLI Reference

See [`references/cli.md`](references/cli.md) for full command listings.

---

## Service Stack

Guide requires the service stack to be running. Services are supervised by
`fit-rc` and defined in `config/config.json`.

| Order | Service | Protocol        | Purpose                     | Port |
| ----- | ------- | --------------- | --------------------------- | ---- |
| 1     | trace   | gRPC            | Distributed tracing         | 3001 |
| 2     | vector  | gRPC            | Vector similarity search    | 3002 |
| 3     | graph   | gRPC            | RDF triple store            | 3003 |
| 4     | pathway | gRPC            | Standard data service       | 3004 |
| 5     | mcp     | Streamable HTTP | MCP tool and prompt gateway | 3005 |

### Service Management

```sh
npx fit-rc start          # Start all services
npx fit-rc status         # Check service health
npx fit-rc stop           # Stop all services
npx fit-rc restart        # Restart all services
```

### MCP Endpoint Configuration

For Claude Code, register the MCP endpoint in your MCP server config:

```json
{
  "guide": {
    "url": "http://localhost:3005",
    "headers": { "Authorization": "Bearer <MCP_TOKEN>" }
  }
}
```

### Authentication

| Surface         | LLM auth                     | MCP auth           |
| --------------- | ---------------------------- | ------------------ |
| `fit-guide` CLI | `ANTHROPIC_API_KEY` or OAuth | Bearer `MCP_TOKEN` |
| Claude Code     | Host credential              | Bearer `MCP_TOKEN` |
| Claude Chat     | Host credential              | Bearer `MCP_TOKEN` |

---

## Data Pipeline

See [`references/data.md`](references/data.md) for processing steps and
directory layout.

---

## Verification

```sh
npx fit-guide status                    # All services should show "ok"
echo "hello" | npx fit-guide            # Should return an agent response
```

## Documentation

- [Finding Your Bearing Guide](https://www.forwardimpact.team/docs/products/finding-your-bearing/index.md)
