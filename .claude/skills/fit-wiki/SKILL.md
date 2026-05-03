---
name: fit-wiki
description: >
  Manage the Kata agent team wiki: send cross-team memos, refresh storyboard
  XmR charts, bootstrap and sync the wiki. Use when an agent needs to
  communicate with teammates, update storyboard metrics, or sync wiki state.
---

# Wiki Operations

`fit-wiki` is the operational CLI for the Kata agent wiki. It handles cross-team
memos, storyboard chart maintenance, and wiki git lifecycle — so agents can
focus on domain work instead of file plumbing.

## When to Use

- You have a memo for a teammate and want it to land in their
  `## Message Inbox` so they read it on their next boot.
- You want to broadcast a memo to every other agent on the team.
- You need to regenerate XmR chart blocks in a storyboard markdown file.
- You need to bootstrap a wiki working tree for a new Kata installation.
- You need to sync wiki changes to/from the remote repository.

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

### `refresh` — Regenerate storyboard XmR charts

Scans a storyboard markdown file for `<!-- xmr:metric:path -->` /
`<!-- /xmr -->` marker pairs and regenerates each block with the current XmR
chart, latest value, status, and signals from the referenced CSV.

```sh
npx fit-wiki refresh wiki/storyboard-2026-M05.md
```

Idempotent — running it twice produces the same output. No-op on files without
markers. Use this after recording metrics to keep the storyboard's Current
Condition section up to date.

### `init` — Bootstrap a wiki working tree

Clones the repository's wiki into `./wiki/` and creates
`wiki/metrics/<skill>/` directories for each kata skill in the installation.

```sh
npx fit-wiki init
```

| Flag           | Required | Description                                       |
| -------------- | -------- | ------------------------------------------------- |
| `--wiki-root`  | No       | Override wiki root directory (default: wiki)       |
| `--skills-dir` | No       | Override skills directory (default: .claude/skills) |

Idempotent — safe to run on an already-initialized wiki.

### `push` — Push wiki changes to remote

Commits local wiki changes and pushes to the remote. No-op when no local
changes exist. Resolves push conflicts in favor of local state.

```sh
npx fit-wiki push
```

Designed for use in Claude Code hooks (`Stop` → `npx fit-wiki push`) and
GitHub Actions post-run steps.

### `pull` — Pull remote wiki changes

Fetches and rebases local wiki state onto the remote. Exits non-zero with a
diagnostic message on conflict.

```sh
npx fit-wiki pull
```

Designed for use in Claude Code hooks (`SessionStart` → `npx fit-wiki pull`).

### Exit codes

| Code | Meaning                                                    |
| ---- | ---------------------------------------------------------- |
| 0    | Success                                                    |
| 1    | Pull conflict — local divergence detected                  |
| 2    | Usage error — missing flag, missing target file, or marker |

### Marker contract

Each agent summary must contain exactly one `<!-- memo:inbox -->` HTML comment
directly under the `## Message Inbox` heading. The marker is invisible in
rendered markdown and anchors `fit-wiki memo` writes. If the marker is absent,
the command exits 2 with a diagnostic message.

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
```

- `writeMemo({ summaryPath, sender, message, today })` — append one bullet
- `listAgents({ agentsDir, wikiRoot })` — discover agents from `.claude/agents/*.md`
- `insertMarkers({ agentsDir, wikiRoot })` — idempotent marker insertion
- `scanMarkers(text)` — find `<!-- xmr:... -->` marker pairs in markdown
- `renderBlock({ metric, csvPath, projectRoot })` — render one XmR chart block
- `new WikiRepo({ wikiDir, parentDir })` — git wrapper for wiki operations
- `listSkills({ skillsDir })` — discover kata skills from `.claude/skills/`

## Documentation

- [Wiki Operations](https://www.forwardimpact.team/docs/libraries/wiki-operations/index.md) —
  how to use `fit-wiki` to send memos, refresh storyboards, and sync the wiki.
