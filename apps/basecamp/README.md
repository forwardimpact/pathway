# @forwardimpact/basecamp

A personal knowledge system that runs as scheduled Claude Code tasks. No server,
no database — just plain files, markdown, and the `claude` CLI. Compiles to a
standalone executable via Deno.

Part of the [Forward Impact](https://www.forwardimpact.team) monorepo.

## Architecture

```
~/.fit/basecamp/                          # Scheduler home (central config)
├── scheduler.json                    # Task definitions
├── state.json                        # Task run state
└── logs/                             # Scheduler logs

~/Documents/Personal/                 # Default personal knowledge base
├── CLAUDE.md                         # Claude Code instructions for this KB
├── knowledge/                        # The knowledge graph (Obsidian-compatible)
│   ├── People/
│   ├── Organizations/
│   ├── Projects/
│   └── Topics/
├── .claude/skills/                   # Claude Code skill files (auto-discovered)
└── drafts/                           # Email drafts

~/Documents/Team/                     # Example knowledge base for team work
├── CLAUDE.md
├── knowledge/
├── .claude/skills/
└── ...
```

The scheduler is the only real code — a single JavaScript file. Everything else
is markdown, JSON, and skill files. Knowledge bases are self-contained
directories that can live anywhere on disk. Synced data and processing state
live in `~/.cache/fit/basecamp/`, keeping KB directories clean — only the parsed
knowledge graph, notes, documents, and drafts belong in the KB.

## Install from Package

The easiest way to install is from the pre-built macOS installer package:

1. Double-click `basecamp-1.0.0-arm64.pkg` (or `basecamp-1.0.0-x86_64.pkg`)
2. Follow the installer prompts

The installer places the `basecamp` binary in `/usr/local/bin/`, initializes
`~/Documents/Personal/` as the default knowledge base, and installs a
LaunchAgent so the scheduler runs automatically on login.

To uninstall, run `/usr/local/share/basecamp/uninstall.sh`.

## Install from Source

```bash
cd apps/basecamp
./scripts/install.sh

# Configure your identity
vi ~/Documents/Personal/USER.md

# Start the daemon
npx fit-basecamp --install-launchd

# Open your KB interactively
cd ~/Documents/Personal && claude
```

## Building

Requires [Deno](https://deno.com) >= 2.x.

```bash
# Build standalone executable (current architecture)
npm run build           # or: deno task build

# Build executable + macOS installer package (.pkg)
npm run build:pkg       # or: deno task build:pkg

# Build for both arm64 and x86_64 + packages
npm run build:all       # or: deno task build:all
```

Output goes to `dist/`:

```
dist/
├── basecamp-aarch64-apple-darwin       # arm64 binary
├── basecamp-x86_64-apple-darwin        # x86_64 binary
├── basecamp-1.0.0-arm64.pkg           # arm64 installer package
└── basecamp-1.0.0-x86_64.pkg          # x86_64 installer package
```

The compiled binary is fully self-contained — it embeds the `template/`
directory (CLAUDE.md, skills) so `basecamp --init <path>` works without any
source files present.

## Multiple Knowledge Bases

The scheduler can run tasks across multiple knowledge bases. Each KB is an
independent directory with its own CLAUDE.md, skills, and knowledge graph.

### Adding a new KB

```bash
# Initialize a new knowledge base
npx fit-basecamp --init ~/Documents/Team

# Edit the scheduler config to register it
vi ~/.fit/basecamp/scheduler.json
```

### Scheduler config format

`~/.fit/basecamp/scheduler.json`:

```json
{
  "tasks": {
    "sync-personal-mail": {
      "kb": "~/Documents/Personal",
      "schedule": { "type": "interval", "minutes": 5 },
      "enabled": true,
      "agent": null,
      "skill": "sync-apple-mail",
      "prompt": "Sync Apple Mail."
    },
    "sync-team-calendar": {
      "kb": "~/Documents/Team",
      "schedule": { "type": "interval", "minutes": 10 },
      "enabled": true,
      "agent": null,
      "skill": "sync-apple-calendar",
      "prompt": "Sync Apple Calendar."
    }
  }
}
```

### Task fields

| Field      | Required | Description                                                     |
| ---------- | -------- | --------------------------------------------------------------- |
| `kb`       | yes      | Path to the knowledge base directory (supports `~`)             |
| `schedule` | yes      | When to run (`interval`, `cron`, or `once`)                     |
| `prompt`   | yes      | The prompt sent to Claude                                       |
| `enabled`  | no       | Set to `false` to disable. Default: `true`                      |
| `agent`    | no       | Claude sub-agent name (passed as `--agent`)                     |
| `skill`    | no       | Skill name (matches `.claude/skills/<name>/SKILL.md` in the KB) |

### Schedule types

```json
{ "type": "interval", "minutes": 5 }
{ "type": "cron", "expression": "0 8 * * *" }
{ "type": "once", "runAt": "2025-02-12T10:00:00Z" }
```

## Agents

Set the `agent` field on a task to use a specific Claude sub-agent. The value is
passed as `--agent <name>` to the `claude` CLI.

```json
{
  "sync-personal-mail": {
    "kb": "~/Documents/Personal",
    "agent": "basecamp-sync",
    "schedule": { "type": "interval", "minutes": 5 },
    "skill": "sync-apple-mail",
    "prompt": "Sync Apple Mail."
  }
}
```

## CLI Reference

```
fit-basecamp                     Run due tasks once and exit
fit-basecamp --daemon            Run continuously (poll every 60s)
fit-basecamp --run <task>        Run a specific task immediately
fit-basecamp --init <path>       Initialize a new knowledge base
fit-basecamp --install-launchd   Install macOS LaunchAgent for auto-start
fit-basecamp --uninstall-launchd Remove macOS LaunchAgent
fit-basecamp --status            Show knowledge bases and task status
fit-basecamp --help              Show this help
```

When running from source, use `node scheduler.js` or `npx fit-basecamp` instead
of `fit-basecamp`.

## How It Works

1. The scheduler reads `~/.fit/basecamp/scheduler.json` for task configs
2. For each due task, it invokes the `claude` CLI with `--print` mode
3. If a skill is set, its name is included in the prompt (Claude auto-discovers
   the SKILL.md file)
4. The claude CLI runs with `cwd` set to the target KB directory
5. Claude reads the KB's `CLAUDE.md` for context, executes the task, and writes
   results
6. State (last run times, status) is tracked in `~/.fit/basecamp/state.json`

## Skills

Skills are Claude Code-native `SKILL.md` files that are auto-discovered from
`.claude/skills/<name>/SKILL.md` inside each knowledge base. The default KB
ships with these skills:

| Skill                  | Directory              | Purpose                                        |
| ---------------------- | ---------------------- | ---------------------------------------------- |
| Sync Apple Mail        | `sync-apple-mail`      | Sync Apple Mail threads via SQLite             |
| Sync Apple Calendar    | `sync-apple-calendar`  | Sync Apple Calendar events via SQLite          |
| Extract Entities       | `extract-entities`     | Process synced data into knowledge graph notes |
| Draft Emails           | `draft-emails`         | Draft email responses using knowledge context  |
| Meeting Prep           | `meeting-prep`         | Prepare briefings for upcoming meetings        |
| Create Presentations   | `create-presentations` | Create slide decks as PDF                      |
| Document Collaboration | `doc-collab`           | Document creation and collaboration            |
| Organize Files         | `organize-files`       | File organization and cleanup                  |

## Requirements

- Claude CLI (`claude`) installed and authenticated
- macOS (for Apple Mail/Calendar sync and launchd)
- Node.js >= 18 (for running from source) or the standalone binary
- Deno >= 2.x (for building the standalone binary)

## License

Apache-2.0
