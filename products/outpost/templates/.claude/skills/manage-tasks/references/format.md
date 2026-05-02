# Task Board Format

Reference data for `manage-tasks`.

## Board structure

Each task board is a markdown file with four sections, always present (even if
empty), in this order:

```markdown
# {Person Name}

## In Progress

## Open

## Blocked

## Recently Done
```

## Task entry

```markdown
- [ ] **{Task title}** | {priority} | due {YYYY-MM-DD} | [[Projects/Name]] → [[Goals/Name]]
  {Context line with source info and backlinks.}
```

### Conventions

- **Priorities:** `high` | `medium` | `low`. Omit when medium (the default).
- **Due dates:** include only when there is a real deadline. Format
  `due YYYY-MM-DD`.
- **Goal link:** append `→ [[Goals/Name]]` only when the task clearly serves a
  specific Goal — not every task needs one.
- **Titles are the ID:** keep them unique within a board. No task IDs.
- **Recently Done:** keep the last 14 days; older entries are pruned during
  housekeeping.

## Closed-task format

Closed entries drop priority, due date, project link, and context:

```markdown
- [x] **{Task title}** | completed {YYYY-MM-DD}
```

## Section routing

- Default add target: `## Open`.
- Move to `## In Progress` when the user says "I'm working on" / "started".
- Move to `## Blocked` when the user describes a wait condition; include what's
  needed and from whom in the context line.
- Move to `## Recently Done` when closed.

## Useful queries

```bash
# All open / in-progress tasks
rg "^- \[ \] \*\*" knowledge/Tasks/

# Tasks for a specific project
rg "Projects/{Name}" knowledge/Tasks/

# High priority tasks
rg "\| high \|" knowledge/Tasks/

# Find every due date — compare against today to spot overdue
rg "due 20[0-9]{2}-[0-9]{2}-[0-9]{2}" knowledge/Tasks/

# Blocked tasks with their context
rg -A1 "^- \[ \]" knowledge/Tasks/ | rg -B1 "Waiting on"
```
