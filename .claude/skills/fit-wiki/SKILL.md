---
name: fit-wiki
description: >
  Manage the Kata agent team wiki: send cross-team observations (memos),
  discover the agent roster, and migrate insertion markers. Use when an agent
  needs to record an observation for a teammate or broadcast to all agents.
---

# Wiki Operations

`fit-wiki` is the operational CLI for the Kata agent wiki. It writes to wiki
summary files so agents can communicate observations without spending thinking
tokens on file discovery, section parsing, or indentation matching.

## When to Use

- You observed something another agent should know about and want to drop it
  in their `## Message Inbox`.
- You want to broadcast a message to every agent on the team.
- You need to ensure all agent summaries have the `<!-- memo:inbox -->` marker
  for machine-writable memos.

## Commands

### `memo` — Send a cross-team observation

Appends a timestamped bullet to the target agent's wiki summary, directly after
the `<!-- memo:inbox -->` marker in their `## Message Inbox` section.

```sh
npx fit-wiki memo --from staff-engineer --to security-engineer --message "audit d642ff0c"
npx fit-wiki memo --from technical-writer --to all --message "new XmR baseline"
```

| Flag          | Required | Description                                                           |
| ------------- | -------- | --------------------------------------------------------------------- |
| `--from`      | No       | Sender name (falls back to `LIBEVAL_AGENT_PROFILE` env var)           |
| `--to`        | Yes      | Target agent name, or `all` to broadcast to every agent               |
| `--message`   | Yes      | Observation text                                                      |
| `--wiki-root` | No       | Override wiki root directory (default: auto-detected from project root) |

The bullet format is `- YYYY-MM-DD **{sender}**: {message}`, inserted on the
line immediately following the marker (newest-first within the section).

### Exit codes

| Code | Meaning                                                    |
| ---- | ---------------------------------------------------------- |
| 0    | Success — bullet written to all targets                    |
| 2    | Usage error — missing flag, missing target file, or marker |

### Marker contract

Each agent summary must contain exactly one `<!-- memo:inbox -->` HTML comment
directly under the `## Message Inbox` heading. The marker is invisible in
rendered markdown and anchors `fit-wiki memo` writes. If the marker is absent,
the command exits 2 with a diagnostic message.

## Programmatic API

```js
import { writeMemo, listAgents, insertMarkers } from "@forwardimpact/libwiki";
```

- `writeMemo({ summaryPath, sender, message, today })` — append one bullet
- `listAgents({ agentsDir, wikiRoot })` — discover agents from `.claude/agents/*.md`
- `insertMarkers({ agentsDir, wikiRoot })` — idempotent marker insertion
