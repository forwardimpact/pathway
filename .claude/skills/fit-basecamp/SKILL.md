---
name: fit-basecamp
description: >
  Work with the @forwardimpact/basecamp package. Use when checking agent status,
  waking agents, initializing or updating knowledge bases, or modifying the
  scheduler, build system, KB template, KB skills, or configuration.
---

# Basecamp Package

Personal knowledge system with scheduled Claude Code agents. No server, no
database — just plain files, markdown, and the `claude` CLI. Packaged as a
native macOS app bundle (`Basecamp.app`) with TCC-compliant process management.

## When to Use

**Operations and management:**

- Checking agent status and last decisions
- Waking a specific agent immediately
- Initializing a new knowledge base
- Updating a KB with the latest templates and skills
- Starting, stopping, or monitoring the scheduler daemon
- Validating agent/skill references

**Development and maintenance:**

- Modifying the scheduler logic (task execution, scheduling, state)
- Working with the build system (Deno compile, Swift build, app bundle)
- Adding or modifying KB template files (CLAUDE.md, USER.md)
- Adding or modifying KB skills (sync, extract, draft, etc.)
- Changing install/uninstall scripts
- Working with the Swift app launcher or status menu

---

## How It Works

### Scheduling

The scheduler polls configured tasks and evaluates whether each should wake:

- **Cron tasks** — the 5-field cron expression is matched against the current
  time; skipped if the agent already woke in the same minute
- **Interval tasks** — wakes when elapsed time since last wake exceeds the
  configured interval in minutes
- **Once tasks** — wakes exactly once when the scheduled time arrives

Tasks with `enabled: false` or an already-active agent are always skipped.
Stale agents left "active" from a previous daemon session are automatically
reset on startup.

### Task Execution

When a task wakes, the scheduler spawns a child process running
`claude --agent <name> --print` with the configured prompt. The process
inherits TCC attributes from the parent app bundle (via `posix_spawn` on macOS)
so agents can access Mail, Calendar, and other protected resources. Agent
status, exit code, and stderr are tracked in `state.json`.

### Knowledge Base Initialization

Running `--init <path>` copies the bundled template into the target directory:
`CLAUDE.md` (instructions), `USER.md` (identity), `.claude/skills/` (built-in
skills), and `.claude/settings.json` (permissions). Running `--update` on an
existing KB merges new files without overwriting user customizations — settings
permissions are reconciled rather than replaced.

---

## CLI Reference

### Operations

```sh
fit-basecamp                         # Wake due agents once and exit
fit-basecamp --daemon                # Run continuously (poll every 60s)
fit-basecamp --wake <agent>          # Wake a specific agent immediately
fit-basecamp --stop                  # Gracefully stop daemon and all running agents
fit-basecamp --status                # Show agent status and last decisions
fit-basecamp --validate              # Validate agent definitions exist
```

### Knowledge Base Management

```sh
fit-basecamp --init <path>           # Initialize a new knowledge base
fit-basecamp --update [path]         # Update KB with latest CLAUDE.md, agents, skills
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

---

## Architecture

### Process Tree (App Bundle)

```
Basecamp.app/Contents/MacOS/Basecamp      ← Swift launcher, TCC responsible
├── fit-basecamp --daemon                 ← Deno scheduler (posix_spawn)
│   └── claude --print ...                ← spawned via posix_spawn FFI
└── [status menu UI]                      ← AppKit menu bar, in-process
```

### Cache Directory

Synced data lives outside the KB:

```
~/.cache/fit/basecamp/
├── apple_mail/         # Synced email threads (.md)
├── apple_calendar/     # Synced calendar events (.json)
├── drafts/             # Email drafts (.md)
└── state/              # Runtime state (plain text files)
```

---

## Developing Basecamp

### Package Structure

```
products/basecamp/
  src/
    basecamp.js           # Main entry point and CLI (single-file, cross-platform)
    posix-spawn.js        # Deno FFI wrapper for posix_spawn (macOS)
  macos/
    Basecamp/             # Swift package: app launcher + status menu
      Package.swift
      Sources/
        main.swift        # App entry point, NSApplication lifecycle
        AppDelegate.swift # Manages scheduler process and status menu
        ProcessManager.swift # posix_spawn wrapper, child lifecycle
        StatusMenu.swift  # Status bar UI
        DaemonConnection.swift # Unix socket IPC with scheduler
    Info.plist            # App bundle metadata
    Basecamp.entitlements # TCC entitlements
  config/
    scheduler.json        # Default scheduler configuration
  pkg/
    build.js              # Build orchestrator (Deno + Swift + app)
    macos/                # macOS-specific build scripts and installer
  template/               # KB template (copied on --init)
    CLAUDE.md             # Claude Code instructions for KB
    USER.md               # User identity template
    .claude/
      settings.json       # Claude Code permissions
      skills/             # KB skills (built-in)
```

### Scheduler (`src/basecamp.js`)

Single-file CLI, no dependencies. Key functions:

- `shouldRun(task, taskState, now)` — Schedule evaluation
- `runTask(taskName, task, config, state)` — Task execution via posix_spawn
- `initKB(targetPath)` — Knowledge base initialization
- `cronMatches(expr, date)` — Cron expression matching
- `validate()` — Validate agent/skill references exist

### posix_spawn FFI (`src/posix-spawn.js`)

Deno FFI wrapper. Calls `responsibility_spawnattrs_setdisclaim` so child
processes inherit TCC attributes from the responsible binary (Basecamp.app).

### Swift Launcher (`macos/Basecamp/`)

- `AppDelegate.swift` — Manages ProcessManager and StatusMenu
- `ProcessManager.swift` — Spawns scheduler via posix_spawn, monitors child
- `StatusMenu.swift` — Status bar UI
- `DaemonConnection.swift` — Socket protocol (status, restart, run commands)

### Build System (`pkg/build.js`)

1. Compiles `src/basecamp.js` via `deno compile`
2. Builds Swift app launcher via `swift build`
3. Assembles `Basecamp.app` bundle (via `build-app.sh`)
4. Optionally creates macOS installer package (.pkg)

## Common Tasks

### Adding a New KB Skill

1. Create `template/.claude/skills/{skill-name}/SKILL.md`
2. Add YAML front matter with `name`, `description`, optional `compatibility`
3. Write the skill workflow (trigger, prerequisites, inputs, outputs, steps)
4. Update `template/CLAUDE.md` to list the new skill
5. If scheduled, add a default task entry to `config/scheduler.json`

### Modifying the Swift Launcher

- Source: `macos/Basecamp/Sources/`
- Bundle metadata: `macos/Info.plist`
- Entitlements: `macos/Basecamp.entitlements`
- Build: `just build-launcher` or
  `swift build -c release --package-path macos/Basecamp`

## Verification

```sh
fit-basecamp --status       # Check config and agent state
fit-basecamp --validate     # Verify agent/skill references exist
just build                  # Verify full build works
just build-app              # Verify app bundle assembles
```
