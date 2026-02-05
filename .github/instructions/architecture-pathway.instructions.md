---
applyTo: "apps/pathway/**"
---

# Pathway Architecture

## Package Structure

```
apps/pathway/
  bin/
    fit-pathway.js    # CLI entry point
  src/
    commands/         # CLI command handlers
    formatters/       # Entity → output (DOM/markdown)
    pages/            # Web app page handlers
    components/       # Reusable UI components
    lib/              # Shared utilities (router, state, render)
    css/              # Styles (layers, tokens, components)
    slides/           # Slide presentation handlers
  templates/          # Mustache templates for agent/skill output
```

## CLI

`npx fit-pathway <command>`

| Command     | Purpose                    |
| ----------- | -------------------------- |
| `serve`     | Start web server           |
| `site`      | Generate static site       |
| `init`      | Create data directory      |
| `skill`     | Browse skills              |
| `behaviour` | Browse behaviours          |
| `job`       | Generate job definitions   |
| `agent`     | Generate agent profiles    |
| `interview` | Generate interview sets    |
| `progress`  | Analyze career progression |
| `questions` | Browse interview questions |

## Formatter Layer

Single place for presentation logic:

```
src/formatters/{entity}/
  shared.js    # Helpers shared between outputs
  dom.js       # Entity → DOM elements
  markdown.js  # Entity → markdown string
```

**Rule**: Pages/commands pass raw entities to formatters—no transforms in views.

## Key Patterns

### Builder Pages

For discipline/grade/track selection:

```javascript
import { createBuilder } from "../components/builder.js";
```

### Reactive State

Component-local reactive state:

```javascript
import { createReactive } from "../lib/reactive.js";
const state = createReactive(initial);
state.subscribe((value) => updateUI(value));
```

### DOM Rendering

No innerHTML—use render helpers:

```javascript
import { div, h2, p, render } from "./lib/render.js";
```

### Global State

Shared data across pages:

```javascript
import { getState, setData, subscribe } from "./lib/state.js";
```

## Job Caching

Always use the cache for job derivation in pages:

```javascript
import { getOrCreateJob } from "@forwardimpact/model/job-cache";
const job = getOrCreateJob({ discipline, grade, track, skills, behaviours });
```

## Error Handling

Router wraps all pages with error boundary. Pages throw:

- `NotFoundError` — Entity not found
- `InvalidCombinationError` — Invalid discipline/track/grade combination

## Agent Output

Agent profiles: `.github/agents/{id}.agent.md` (VS Code Custom Agents)

Skill files: `.claude/skills/{skill-name}/SKILL.md` (Agent Skills Standard)

See templates in `templates/` directory.
