# Agent Configuration

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
