# Guide

For general product conventions see [products/CLAUDE.md](../CLAUDE.md).

## Starter Config

`starter/config.json` is copied to `config/config.json` by `npx fit-guide init`.
It is the single source of truth for what the Guide agent sees.

```
starter/config.json
├── init                # Service supervisor (which processes to start)
├── product.guide
│   └── systemPrompt    # Identity — "You are Guide…"
└── service.mcp
    ├── systemPrompt    # Tool routing preamble (how to use tools)
    └── tools.<Name>
        ├── method      # gRPC route, e.g. "graph.Graph.QueryByPattern"
        ├── description # Shown in MCP tools/list — agent picks tools by this
        └── routing     # Optional intent phrases for prompt routing lines
```

### How config becomes the agent's prompt

`bin/fit-guide.js` layers two prompts at startup:

1. `product.guide.systemPrompt` — identity.
2. The MCP `guide-default` prompt, built by `buildPromptText()` in
   `services/mcp/index.js` from `service.mcp`:

```
{service.mcp.systemPrompt}          ← static preamble
{routing[0]} -> {ToolName}          ← one line per (tool, routing statement)
```

Tools without `routing` are registered and callable but get no routing line.
The agent receives: identity + blank line + preamble + routing lines.

### What the agent sees

| Config field | Surfaces as | Purpose |
|---|---|---|
| `product.guide.systemPrompt` | System prompt (top) | Who the agent is |
| `service.mcp.systemPrompt` | System prompt (middle) | How to use tools |
| `tools.*.description` | MCP `tools/list` | Tool picker signal |
| `tools.*.routing` | System prompt (bottom) | Intent → tool mapping |
| `tools.*.method` | Never (internal wiring) | gRPC dispatch |

### Adding a tool

1. Add the gRPC method to the service proto, run `just codegen`.
2. Add to `service.mcp.tools` in `starter/config.json`:
   ```json
   "NewTool": {
     "method": "package.Service.Method",
     "description": "What the agent sees in tools/list."
   }
   ```
3. Optionally add `"routing": ["Intent phrase"]` for a prompt hint.

`registerToolsFromConfig` (libmcp) auto-wires the tool — builds a Zod schema
from codegen metadata and dispatches to the gRPC client. To remove a tool,
delete its entry; it vanishes from both tool listing and prompt.

### Improving prompt behavior

The most common issue is the agent not knowing _when_ to use a tool.

- **Preamble** (`service.mcp.systemPrompt`) — general instructions: ground
  claims in tool results, call `GetOntology` first, never fabricate. Edit when
  overall behavior needs correction.
- **Routing** (`tools.*.routing`) — intent-to-tool mappings. Add an entry when
  the agent fails to pick the right tool for a query type.
- **Descriptions** (`tools.*.description`) — if the agent ignores a tool, the
  description may lack the right trigger words. Per-field descriptions come from
  proto comments via codegen and cannot be overridden in config.

The identity prompt (`product.guide.systemPrompt`) rarely needs changes.

## Eval Workflow

`eval-guide.yml` exercises the config end-to-end. Each matrix case runs a
supervisor–agent session: the supervisor asks a question, the agent answers
using only MCP tools (it runs in a temp dir with no local files), and the
supervisor grades against `data/synthetic/story.dsl`.

When an eval fails, download the trace with `fit-trace` and check whether the
agent called the right tools. Common failure modes:

- Agent answered from general knowledge instead of calling tools.
- Agent called a tool but with wrong arguments.
- Missing routing line — agent didn't know which tool to use.
- Tool description lacked terms the agent associated with the question.
