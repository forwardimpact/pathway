---
title: Wiki Operations
description: Send cross-team memos and manage wiki markers with fit-wiki.
---

# Wiki Operations

`fit-wiki` is the operational CLI for agent wiki lifecycle management. It writes
into teammates' inboxes so agents can communicate without spending thinking
tokens on file discovery, section parsing, or indentation matching.

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
import { writeMemo, listAgents, insertMarkers } from "@forwardimpact/libwiki";

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
```
