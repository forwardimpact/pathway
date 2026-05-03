---
title: Wiki Operations
description: Send cross-team memos, refresh storyboard charts, and sync the wiki with fit-wiki.
---

`fit-wiki` is the operational CLI for agent wiki lifecycle management. It
handles cross-team memos, storyboard chart maintenance, and wiki git
lifecycle — so agents can focus on domain work instead of file plumbing.

## Getting Started

```sh
npx fit-wiki --help
npx fit-wiki memo --from staff-engineer --to security-engineer --message "audit d642ff0c"
```

## Sending a Memo

The `memo` command appends a timestamped bullet to a teammate's wiki
summary, directly after the `<!-- memo:inbox -->` marker in their
`## Message Inbox` section.

```sh
# Single target
npx fit-wiki memo --from technical-writer --to staff-engineer --message "check baseline"

# Broadcast to all agents
npx fit-wiki memo --from technical-writer --to all --message "new XmR baseline"
```

### Options

| Flag          | Required | Description                                                            |
| ------------- | -------- | ---------------------------------------------------------------------- |
| `--from`      | No       | Sender name (falls back to `LIBEVAL_AGENT_PROFILE` env var)            |
| `--to`        | Yes      | Target agent name, or `all` to broadcast                               |
| `--message`   | Yes      | Observation text                                                       |
| `--wiki-root` | No       | Override wiki root directory (default: auto-detected from project root) |

### Bullet Format

Each memo is inserted as a single markdown bullet directly after the marker:

```markdown
- 2026-05-02 from **staff-engineer**: audit d642ff0c
```

Newest memos appear first within the section. Multi-line messages are collapsed
to a single line.

## Refreshing Storyboards

The `refresh` command scans a storyboard markdown file for
`<!-- xmr:metric:path -->` / `<!-- /xmr -->` marker pairs and regenerates each
block with the current XmR chart, latest value, status, and signals from the
referenced CSV.

```sh
npx fit-wiki refresh wiki/storyboard-2026-M05.md
```

The command is idempotent — running it twice produces the same output. Files
without markers are left unchanged. Use this after recording metrics with
`npx fit-xmr record` to keep the storyboard's Current Condition section current.

## Initializing the Wiki

The `init` command bootstraps a wiki working tree for a Kata installation. It
clones the repository's wiki into `./wiki/` and creates
`wiki/metrics/<skill>/` directories for each kata skill.

```sh
npx fit-wiki init
```

Idempotent — safe to run on an already-initialized wiki. Authenticates using
ambient GitHub credentials (`GITHUB_TOKEN` or `GH_TOKEN`).

## Syncing the Wiki

The `push` and `pull` commands replace shell-script plumbing with portable npm
commands.

```sh
# Pull remote changes (e.g. in SessionStart hook)
npx fit-wiki pull

# Commit and push local changes (e.g. in Stop hook)
npx fit-wiki push
```

`push` is a no-op when no local changes exist. On push conflicts, local state
wins. `pull` exits non-zero with a diagnostic message on conflict.

Both commands are designed for use in Claude Code hooks and GitHub Actions
post-run steps.

## The Marker Contract

Each agent summary must contain exactly one `<!-- memo:inbox -->` HTML comment
directly under the `## Message Inbox` heading:

```markdown
## Message Inbox

<!-- memo:inbox -->

- 2026-05-02 from **staff-engineer**: audit d642ff0c
```

The marker is invisible in rendered markdown and anchors all `fit-wiki memo`
writes. If the marker is absent, the command exits 2 with a diagnostic.

## Programmatic API

```js
import {
  writeMemo,
  listAgents,
  insertMarkers,
  scanMarkers,
  renderBlock,
  WikiRepo,
  listSkills,
} from "@forwardimpact/libwiki";

// Append a single memo
const result = writeMemo({
  summaryPath: "wiki/staff-engineer.md",
  sender: "technical-writer",
  message: "audit d642ff0c",
  today: "2026-05-02",
});

// Discover all agents
const agents = listAgents({
  agentsDir: ".claude/agents",
  wikiRoot: "wiki",
});

// Ensure all summaries have the marker (idempotent)
const migration = insertMarkers({
  agentsDir: ".claude/agents",
  wikiRoot: "wiki",
});

// Scan storyboard for XmR marker pairs
const blocks = scanMarkers(storyboardText);

// Render one XmR chart block
const lines = renderBlock({
  metric: "findings",
  csvPath: "wiki/metrics/kata-spec/2026.csv",
  projectRoot: "/path/to/project",
});
```
