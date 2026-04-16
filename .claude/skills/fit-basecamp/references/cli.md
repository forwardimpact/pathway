# CLI Reference

### Operations

```sh
npx fit-basecamp                         # Wake due agents once and exit
npx fit-basecamp daemon                  # Run continuously (poll every 60s)
npx fit-basecamp wake <agent>            # Wake a specific agent immediately
npx fit-basecamp stop                    # Gracefully stop daemon and all running agents
npx fit-basecamp status                  # Show agent status and last decisions
npx fit-basecamp validate                # Validate agent definitions exist
```

### Knowledge Base Management

```sh
npx fit-basecamp init <path>             # Initialize a new knowledge base
npx fit-basecamp update [path]           # Update KB with latest CLAUDE.md, agents, skills
```

### Key Paths

| Path                             | Purpose                              |
| -------------------------------- | ------------------------------------ |
| `~/.fit/basecamp/scheduler.json` | Agent/task definitions               |
| `~/.fit/basecamp/state.json`     | Runtime state (last run, etc.)       |
| `~/.fit/basecamp/logs/`          | Agent execution logs                 |
| `~/.cache/fit/basecamp/`         | Synced data (mail, calendar, drafts) |

### Configuration (`scheduler.json`)

Each task entry defines:

- `kb` — Path to the knowledge base directory (supports `~`)
- `schedule` — `{"type": "interval", "minutes": N}`,
  `{"type": "cron", "expression": "..."}`, or `{"type": "once"}`
- `prompt` — Text sent to Claude
- `skill` — Skill name (auto-discovered from `.claude/skills/`)
- `agent` — Optional Claude sub-agent name
- `enabled` — Toggle task on/off
