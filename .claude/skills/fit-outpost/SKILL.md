---
name: fit-outpost
description: >
  Personal operations center — schedule AI agents, maintain a knowledge
  graph, and prepare daily briefings. Use when preparing briefings from
  email and calendar, managing email drafts, maintaining a personal
  knowledge base, scheduling background AI tasks, checking agent status,
  waking agents on demand, or initializing and updating a knowledge base.
---

# Outpost Package

Personal knowledge system with scheduled Claude Code agents. No server, no
database — just plain files, markdown, and the `claude` CLI. Packaged as a
native macOS app bundle (`Outpost.app`) with TCC-compliant process management.

## When to Use

- Preparing daily briefings from email, calendar, and knowledge context
- Managing email drafts and response preparation
- Maintaining a personal knowledge graph of people, projects, and topics
- Scheduling background AI tasks for syncing and organizing knowledge
- Checking agent status and last decisions
- Waking a specific agent immediately
- Initializing a new knowledge base
- Updating a KB with the latest templates and skills
- Starting, stopping, or monitoring the scheduler daemon
- Validating agent/skill references
- Configuring scheduled tasks in `scheduler.json`

---

## How It Works

### Scheduling

The scheduler polls configured tasks and evaluates whether each should wake:

- **Cron tasks** — the 5-field cron expression is matched against the current
  time; skipped if the agent already woke in the same minute
- **Interval tasks** — wakes when elapsed time since last wake exceeds the
  configured interval in minutes
- **Once tasks** — wakes exactly once when the scheduled time arrives

Tasks with `enabled: false` or an already-active agent are always skipped. Stale
agents left "active" from a previous daemon session are automatically reset on
startup.

### Task Execution

When a task wakes, the scheduler spawns a child process running
`claude --agent <name> --print` with the configured prompt. The process inherits
TCC attributes from the parent app bundle (via `posix_spawn` on macOS) so agents
can access Mail, Calendar, and other protected resources. Agent status, exit
code, and stderr are tracked in `state.json`.

### Knowledge Base Initialization

Running `init <path>` copies the bundled template into the target directory:
`CLAUDE.md` (instructions), `USER.md` (identity), `.claude/skills/` (built-in
skills), and `.claude/settings.json` (permissions). Running `update` on an
existing KB merges new files without overwriting user customizations — settings
permissions are reconciled rather than replaced.

---

## CLI Reference

See [`references/cli.md`](references/cli.md) for full command listings.

---

## Architecture

### Process Tree (App Bundle)

```
Outpost.app/Contents/MacOS/Outpost      ← Swift launcher, TCC responsible
├── fit-outpost daemon                   ← Node.js scheduler (posix_spawn)
│   └── claude --print ...                ← spawned via posix_spawn FFI
└── [status menu UI]                      ← AppKit menu bar, in-process
```

### Cache Directory

Synced data lives outside the KB:

```
~/.cache/fit/outpost/
├── apple_mail/         # Synced email threads (.md)
├── apple_calendar/     # Synced calendar events (.json)
├── drafts/             # Email drafts (.md)
└── state/              # Runtime state (plain text files)
```

---

## Common Tasks

### Adding a New KB Skill

1. Create `template/.claude/skills/{skill-name}/SKILL.md`
2. Add YAML front matter with `name`, `description`, optional `compatibility`
3. Write the skill workflow (trigger, prerequisites, inputs, outputs, steps)
4. Update `template/CLAUDE.md` to list the new skill
5. If scheduled, add a default task entry to `config/scheduler.json`
6. Run `npx fit-outpost update` to push the new skill to existing KBs

## Verification

```sh
npx fit-outpost status         # Check config and agent state
npx fit-outpost validate       # Verify agent/skill references exist
```

## Documentation

For deeper context beyond this skill's scope:

- [Knowledge Systems Guide](https://www.forwardimpact.team/docs/products/knowledge-systems/index.md)
  — Task-oriented guide to setting up and using Outpost for personal knowledge
  management
- [CLI Reference](https://www.forwardimpact.team/docs/reference/cli/index.md) —
  Complete command reference for all Forward Impact CLI tools
