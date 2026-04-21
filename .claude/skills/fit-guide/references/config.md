# Configuration

### Agent Instructions

Guide uses a single `guide-default` prompt served by the MCP endpoint. The
prompt defines the agent's workflow (orient → query → synthesize), tool
selection guidance, and response format rules.

The prompt lives at `services/mcp/prompts/guide-default.md` in the monorepo and
is served to all three surfaces via MCP `prompts/get`.

### Service Configuration (`config/config.json`)

Controls the service startup order for `fit-rc`:

```json
{
  "init": {
    "services": [
      { "name": "trace", "command": "..." },
      { "name": "vector", "command": "..." },
      { "name": "graph", "command": "..." },
      { "name": "pathway", "command": "..." },
      { "name": "mcp", "command": "..." },
      { "name": "web", "command": "..." }
    ]
  }
}
```

To restore the starter config, delete `config/` and re-run `npx fit-guide init`.
