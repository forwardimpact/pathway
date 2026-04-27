---
title: "Getting Started: Pathway for Engineers"
description: "Browse career paths, generate AI agent teams, and explore job definitions from the CLI and web app."
---

Pathway is your interface to the engineering framework. Browse job definitions,
explore career progression, and generate AI agent teams matched to your role.

## Prerequisites

- Node.js 18+
- npm

## Install

```sh
npm install @forwardimpact/pathway
```

## Initialize framework data

If your organization hasn't provided a framework data bundle, bootstrap starter
data to explore with:

```sh
npx fit-map init
```

This creates `./data/pathway/` with a complete starter framework. If your
organization distributes a framework bundle, follow their installation
instructions instead — typically a one-line `curl | bash` install script that
places data at `~/.fit/data/pathway/`.

### Data directory resolution

The CLI resolves the data directory by walking upward from the current working
directory looking for a `data/pathway/` folder. To override, use the `--data`
flag:

```sh
npx fit-pathway discipline --list --data=./my-data/pathway
```

## Browse your job definition

Use the Pathway CLI to explore the engineering framework your organization has
defined.

```sh
npx fit-pathway discipline --list    # See available disciplines
npx fit-pathway level --list         # See available levels
npx fit-pathway track --list         # See available tracks
```

Generate a complete job definition by combining a discipline, level, and
optional track:

```sh
npx fit-pathway job software_engineering J040 --track=platform
```

This produces a full view of the skills, behaviours, and expectations for that
role.

## Generate agent teams

Create AI agent definitions matched to your role's skill profile:

```sh
npx fit-pathway agent software_engineering --track=platform --output=./agents
```

This generates a set of `.agent.md` files and a `skills/` directory. Each agent
file defines a persona with specific capabilities. The skills directory contains
`SKILL.md` files that agents use as operational context — the same skill
definitions humans reference, formatted for AI consumption.

Copy the output into your project's `.claude/` or equivalent agent configuration
directory.

---

## Next steps

- [Pathway product page](/pathway/) — web app features, CLI commands, and static
  site generation
- [Agent teams](/docs/guides/agent-teams/) — configure and customize generated
  agents
- [Career paths](/docs/guides/career-paths/) — understand progression and skill
  development
