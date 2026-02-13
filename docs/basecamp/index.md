---
title: Basecamp
description: Claude Code-native personal knowledge system with scheduled AI tasks.
---

## Purpose

Basecamp is a personal knowledge system that runs as scheduled Claude Code
tasks. No server, no database — just plain files, markdown, and the `claude`
CLI. It can be compiled to a standalone executable via Deno.

## Architecture

```
~/.fit/basecamp/                          # Scheduler home (central config)
├── scheduler.json                    # Task definitions
├── state.json                        # Task run state
└── logs/                             # Scheduler logs

~/Documents/Team/                     # A knowledge base (default)
├── CLAUDE.md                         # Claude Code instructions for this KB
├── knowledge/                        # Knowledge graph (Obsidian-compatible)
│   ├── People/
│   ├── Organizations/
│   ├── Projects/
│   └── Topics/
├── .claude/skills/                   # Claude Code skill files
└── drafts/                           # Email drafts
```

The scheduler is the only real code — a single JavaScript file. Everything else
is markdown, JSON, and skill files. Knowledge bases are self-contained
directories that can live anywhere on disk. Synced data and processing state
live in `~/.cache/fit/basecamp/`, keeping KB directories clean.

## Features

### Scheduled Tasks

The scheduler runs Claude Code tasks on configurable schedules:

- **Interval** — Every N minutes
- **Cron** — Standard cron expressions
- **Once** — One-time execution at a specified time

### Multiple Knowledge Bases

Each KB is independent with its own CLAUDE.md, skills, and knowledge graph. The
scheduler can run tasks across multiple KBs.

### Built-in Skills

| Skill                | Purpose                                  |
| -------------------- | ---------------------------------------- |
| Sync Apple Mail      | Sync email threads via SQLite            |
| Sync Apple Calendar  | Sync calendar events via SQLite          |
| Extract Entities     | Process synced data into knowledge graph |
| Draft Emails         | Draft responses using knowledge context  |
| Meeting Prep         | Prepare briefings for upcoming meetings  |
| Create Presentations | Generate PDF slide decks via Playwright  |
| Document Collab      | Document creation and collaboration      |
| Organize Files       | File organization and cleanup            |

### Standalone Binary

Compiles to a self-contained executable via Deno that embeds the KB template, so
`basecamp --init <path>` works without source files.

## CLI

```sh
npx fit-basecamp                     # Run due tasks once and exit
npx fit-basecamp --daemon            # Run continuously (poll every 60s)
npx fit-basecamp --run <task>        # Run a specific task immediately
npx fit-basecamp --init <path>       # Initialize a new knowledge base
npx fit-basecamp --install-launchd   # Install macOS LaunchAgent
npx fit-basecamp --uninstall-launchd # Remove macOS LaunchAgent
npx fit-basecamp --validate          # Validate agents and skills exist
npx fit-basecamp --status            # Show task status
npx fit-basecamp --help              # Show help
```

## Configuration

`~/.fit/basecamp/scheduler.json`:

```json
{
  "tasks": {
    "sync-mail": {
      "kb": "~/Documents/Team",
      "schedule": { "type": "interval", "minutes": 5 },
      "prompt": "Sync Apple Mail.",
      "skill": "sync-apple-mail",
      "enabled": true
    }
  }
}
```

## Building

Requires Deno >= 2.x for building standalone binaries:

```sh
npm run build           # Build executable (current arch)
npm run build:dmg       # Build executable + macOS DMG
npm run build:all       # Build for arm64 + x86_64 + DMGs
```

## How It Works

1. Scheduler reads `~/.fit/basecamp/scheduler.json` for task configs
2. For each due task, invokes `claude` CLI with `--print` mode
3. Claude runs with `cwd` set to the target KB directory
4. Claude reads the KB's `CLAUDE.md`, executes the task, writes results
5. State (last run times, status) tracked in `~/.fit/basecamp/state.json`
