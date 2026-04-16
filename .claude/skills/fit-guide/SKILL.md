---
name: fit-guide
description: >
  Ask an AI agent that understands your engineering framework. Use when
  asking questions about skills, levels, and career expectations, getting
  context-specific career guidance, interpreting engineering artifacts
  against skill markers, setting up the Guide service stack, configuring
  agents and tools, or ingesting knowledge content.
---

# Guide Product

AI agent that understands your organization's engineering framework — skills,
levels, behaviours, and expectations — and reasons about them in context. Guide
helps engineers onboard, find growth areas, and interpret engineering artifacts
against skill markers.

## When to Use

**Conversational framework queries:**

- Getting career guidance specific to your organization's framework
- Interpreting engineering artifacts against specific skill markers
- Running the fit-guide REPL for interactive agent conversations
- Piping prompts to fit-guide for scripted queries
- Asking about skills, levels, behaviours, and career expectations

**Setup and configuration:**

- Initializing a new Guide project (`npx fit-guide init`)
- Configuring agent definitions (`config/agents/*.agent.md`)
- Adding or updating tool descriptors (`config/tools.yml`)
- Processing knowledge content, graphs, and vectors

**Service operations:**

- Starting, stopping, or checking service status via `npx fit-rc`
- Ingesting new knowledge content into the pipeline
- Troubleshooting agent responses or connectivity

---

## How It Works

### Agent Orchestration

The CLI sends user messages to the Agent gRPC service, which orchestrates
multi-turn conversations. The default pipeline is **planner → researcher →
editor**: the planner analyzes the query and creates an execution plan, the
researcher retrieves relevant data using tools (graph queries, vector search),
and the editor synthesizes the final response. Agents hand off to each other via
configured `handoffs`.

### Tool Execution

Agents call tools during conversation turns. Available tools include graph
queries (`get_ontology`, `query_by_pattern`), vector similarity search
(`search_content`), and agent delegation (`run_sub_agent`, `run_handoff`). When
the LLM returns tool calls, each is executed via the Tool service, results are
appended to the conversation, and the LLM is called again with the new context.

### Knowledge Pipeline

Content flows through three stages: HTML files in `data/knowledge/` are
processed into typed resources (`data/resources/`), then indexed as RDF triples
in the graph store (`data/graphs/`) for structured queries, and as vector
embeddings (`data/vectors/`) for similarity search. This dual index lets agents
combine precise graph lookups with fuzzy semantic retrieval.

### Conversation Memory

Each conversation maintains a memory window — the most recent messages that fit
within the model's token budget. The window is built newest-first: it includes
system prompt, tool definitions, and as much conversation history as the budget
allows, ensuring tool call/response pairs are never split.

---

## Initialization

Run `npx fit-guide init` once in a fresh project directory. It generates
secrets, writes a `.env` file, and copies a starter `config/` tree:

```sh
mkdir my-guide && cd my-guide
npx fit-guide init
```

What `init` produces:

| File / directory           | Purpose                                               |
| -------------------------- | ----------------------------------------------------- |
| `.env`                     | `SERVICE_SECRET`, `JWT_SECRET`, `JWT_ANON_KEY`, ports |
| `config/config.json`       | Service composition, tool endpoints, init order       |
| `config/agents/*.agent.md` | Starter `planner`, `researcher`, `editor` definitions |
| `config/tools.yml`         | Starter tool descriptors                              |

`init` does not generate the LLM credentials — set `LLM_TOKEN` and
`LLM_BASE_URL` in `.env` (or in your shell) before starting services. After
init, generate the proto/codegen layer once with `npx fit-codegen --all`, then
process the starter content and bring up the stack:

```sh
npx fit-codegen --all     # Generate gRPC stubs from installed @forwardimpact/* packages
npx fit-process-agents    # Register starter agent definitions
npx fit-process-resources # Process starter knowledge HTML
npx fit-process-tools     # Register starter tool descriptors
npx fit-process-graphs    # Build the RDF index
npx fit-process-vectors   # Build the vector index (skip if no embeddings backend)
npx fit-rc start          # Launch the service stack
npx fit-guide             # Verify end-to-end with an interactive prompt
```

If you already have a `data/pathway/` framework from `npx fit-map init`, Guide
picks it up automatically — Map exports framework entities to `data/knowledge/`
during processing so they appear in the graph alongside other content.

---

## CLI Reference

### Conversational Agent

```sh
npx fit-guide                              # Interactive REPL — multi-turn conversations
npx fit-guide --help                       # Auto-generated flag and /command listing
npx fit-guide --version                    # Print package version
npx fit-guide init                       # First-run bootstrap (see Initialization)
npx fit-guide --data <path>                # Override the framework data directory
npx fit-guide --data=<path>                # Equivalent inline form
npx fit-guide --streaming                  # Use the streaming gRPC endpoint (default: unary)
echo "Tell me about X" | npx fit-guide     # Piped single prompt
```

The CLI is built on `@forwardimpact/librepl`, so every flag has a matching
`/command` form inside the interactive REPL: `/help`, `/clear`, `/exit`,
`/version`, `/data <path>`, `/streaming`.

**Transport.** The CLI uses the unary RPC by default. The streaming RPC
(`--streaming`) is opt-in because some HTTP/2 proxies drop streamed responses.

### Supporting CLI Tools

```sh
npx fit-search "query text"              # Vector similarity search
npx fit-query <s> <p> <o>                # Graph triple pattern queries
npx fit-subjects <type>                  # List graph subjects by type
npx fit-rc status                        # Service health
```

---

## Service Stack

Guide requires the gRPC service stack to be running. Services are supervised by
fit-rc and defined in `config/config.json`.

### Service Management

```sh
npx fit-rc start          # Start all services
npx fit-rc status         # Check service health
npx fit-rc stop           # Stop all services
npx fit-rc restart        # Restart all services
```

For the full bootstrap sequence (init, codegen, processing), see §
Initialization.

### Service Order

Services start in dependency order (defined in `config/config.json`):

1. **tei** — Text Embeddings Inference (local embeddings)
2. **trace** — Distributed tracing
3. **vector** — Embedding vector store
4. **graph** — RDF knowledge graph
5. **llm** — LLM completion proxy
6. **memory** — Conversation memory
7. **tool** — Tool dispatch
8. **agent** — Agent orchestration (fit-guide connects here)
9. **web** — HTTP API gateway

---

## Environment

`npx fit-guide init` writes a single `.env` file with everything the service
stack needs except your LLM credentials:

| Variable                                       | Source              |
| ---------------------------------------------- | ------------------- |
| `SERVICE_SECRET`, `JWT_SECRET`, `JWT_ANON_KEY` | Generated by `init` |
| `SERVICE_*_URL` (agent, llm, memory, …)        | Written by `init`   |
| `LLM_TOKEN`, `LLM_BASE_URL`                    | **Set manually**    |

`LLM_TOKEN` and `LLM_BASE_URL` point at any OpenAI-compatible chat completions
endpoint. Set them in `.env` or export in your shell — both work.

---

## Data Pipeline

### Processing

Run each processor from your project root after `npx fit-guide init`. They are
independent and idempotent — re-run any step after editing its inputs:

```sh
npx fit-process-agents    # Process agent definitions from config/agents/
npx fit-process-resources # Process knowledge resources from data/knowledge/
npx fit-process-tools     # Register tool descriptors from config/tools.yml + protos
npx fit-process-graphs    # Build the graph index from data/resources/
npx fit-process-vectors   # Build the vector index from data/resources/
```

### Data Directories

| Path              | Contents                                 |
| ----------------- | ---------------------------------------- |
| `data/knowledge/` | Input HTML files                         |
| `data/resources/` | Processed resources                      |
| `data/vectors/`   | Embedding vector indices                 |
| `data/graphs/`    | RDF quad index + ontology                |
| `data/memories/`  | Conversation state                       |
| `data/traces/`    | Distributed traces                       |
| `data/policies/`  | Access control policies                  |
| `data/logs/`      | Service logs                             |
| `data/cli/`       | CLI session data                         |
| `data/eval/`      | Evaluation results                       |
| `data/ingest/`    | Ingestion pipeline (in/pipeline/done)    |
| `data/pathway/`   | Framework data (created by fit-map init) |

---

## Agent Configuration

### Agent Definitions (`config/agents/`)

Agent files use YAML front matter + Markdown body:

```yaml
---
name: planner
description: Analyzes queries and creates execution plans.
infer: false
tools:
  - get_ontology
  - list_handoffs
  - run_handoff
handoffs:
  - label: researcher
    agent: researcher
    prompt: |
      Execute the plan below.
---

# Planner Agent

[Agent instructions in Markdown...]
```

Key fields:

| Field      | Purpose                                   |
| ---------- | ----------------------------------------- |
| `name`     | Agent identifier                          |
| `infer`    | Whether agent can be spawned as sub-agent |
| `tools`    | List of tool names this agent can call    |
| `handoffs` | Agents this agent can hand off to         |

Default agents: **planner** (creates plans), **researcher** (retrieves data),
**editor** (synthesizes responses).

To restore the starter agents, delete `config/agents/` and re-run
`npx fit-guide init`.

### Tool Descriptors (`config/tools.yml`)

Maps tool names to descriptions and parameters. Tools include graph queries
(`get_ontology`, `get_subjects`, `query_by_pattern`), search (`search_content`),
agent delegation (`run_sub_agent`, `list_sub_agents`), and handoff control
(`list_handoffs`, `run_handoff`).

---

## Verification

```sh
npx fit-rc status                       # All services should show "up"
echo "hello" | npx fit-guide            # Should return an agent response
npx fit-search "test query"             # Should return vector search results
npx fit-subjects fit:Skill              # Should list framework skill entities
```

## Documentation

- [Finding Your Bearing Guide](https://www.forwardimpact.team/docs/guides/finding-your-bearing/index.md)
