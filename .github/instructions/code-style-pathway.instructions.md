---
applyTo: "apps/pathway/**/*.js"
---

# Pathway Code Style

## Formatter Organization

```
src/formatters/{entity}/
  shared.js    # Helpers used by both DOM and markdown
  dom.js       # Entity → DOM elements
  markdown.js  # Entity → markdown string
```

**Rule**: All presentation logic lives in formatters. Pages and commands pass
raw entities—no transforms in views.

## Component Pattern

Reusable UI components in `src/components/`:

```javascript
/**
 * Create a skill card component
 * @param {Skill} skill - The skill to display
 * @param {Object} options - Display options
 * @returns {HTMLElement}
 */
export function createSkillCard(skill, options = {}) {
  return article(
    { class: "card skill-card" },
    header({ class: "card__header" }, h3(skill.name)),
    div({ class: "card__body" }, p(skill.description)),
  );
}
```

## Reactive State

Use `createReactive` for component-local state:

```javascript
import { createReactive } from "../lib/reactive.js";

const selectedGrade = createReactive(null);
selectedGrade.subscribe((grade) => updateDisplay(grade));
```

## DOM Rendering

Never use innerHTML. Use render helpers:

```javascript
import { div, h2, p, ul, li, render } from "../lib/render.js";

render(
  container,
  div({ class: "skills" }, h2("Skills"), ul(skills.map((s) => li(s.name)))),
);
```

## Page Structure

Pages export a `render` function and optionally a `cleanup`:

```javascript
/**
 * Render the skill detail page
 * @param {HTMLElement} container - Target container
 * @param {Object} params - Route parameters
 */
export function render(container, params) {
  // ... render page content
}

export function cleanup() {
  // ... cleanup subscriptions
}
```

## CLI Command Pattern

Commands in `src/commands/`:

```javascript
/**
 * Execute the skill command
 * @param {Object} data - Loaded data
 * @param {Object} args - Command arguments
 * @returns {string} Output
 */
export function execute(data, args) {
  if (args.list) return formatSkillList(data.skills);
  if (args.id) return formatSkillDetail(data.skills, args.id);
  return formatSkillSummary(data.skills);
}
```

## CSS Class Names

Use BEM-style naming:

```css
.card {
}
.card__header {
}
.card__body {
}
.card--highlighted {
}
```

See `css-architecture.instructions.md` for CSS layer details.
