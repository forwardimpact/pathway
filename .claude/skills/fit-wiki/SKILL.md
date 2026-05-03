---
name: fit-wiki
description: >
  Manage the Kata agent team wiki: send cross-team memos, discover the agent
  roster, and migrate insertion markers. Use when an agent needs to drop a
  memo in a teammate's Message Inbox or broadcast to the whole team.
---

# Wiki Operations

`fit-wiki` is the operational CLI for the Kata agent wiki. It writes into
teammates' inboxes so agents can communicate without spending thinking tokens
on file discovery, section parsing, or indentation matching.

## When to Use

- You have a memo for a teammate and want it to land in their
  `## Message Inbox` so they read it on their next boot.
- You want to broadcast a memo to every other agent on the team.
- You need to ensure all agent summaries have the `<!-- memo:inbox -->` marker
  for machine-writable memos.

## Commands

### `memo` — Send a cross-team memo

Appends a timestamped bullet to the target agent's `## Message Inbox`,
directly after the `<!-- memo:inbox -->` marker.

```sh
npx fit-wiki memo --from staff-engineer --to security-engineer --message "audit d642ff0c"
npx fit-wiki memo --from technical-writer --to all --message "new XmR baseline"
```

| Flag          | Required | Description                                                            |
| ------------- | -------- | ---------------------------------------------------------------------- |
| `--from`      | No       | Sender name (falls back to `LIBEVAL_AGENT_PROFILE` env var)            |
| `--to`        | Yes      | Target agent name, or `all` to broadcast (sender is skipped)           |
| `--message`   | Yes      | Memo text                                                              |
| `--wiki-root` | No       | Override wiki root directory (default: auto-detected from project root) |

The bullet format is `- YYYY-MM-DD from **{sender}**: {message}`, inserted on
the line immediately following the marker (newest-first within the section).

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

## Documentation

- [Wiki Operations](https://www.forwardimpact.team/docs/libraries/wiki-operations/index.md) —
  how to use `fit-wiki` to send memos and manage wiki markers.
