---
name: manage-tasks
description: Create, update, list, and close tasks on per-person task boards in knowledge/Tasks/. Manages task lifecycle, extracts action items from other skills, and keeps boards current. Use when the user asks to add, update, or review tasks, or when chained from extract-entities or hyprnote-process.
---

# Manage Tasks

Manage per-person task boards in `knowledge/Tasks/`. Each person has a single
living document tracking open, in-progress, blocked, and recently completed
tasks. Task boards are the **canonical source** for task tracking — other notes
link to them rather than duplicating.

## Trigger

- The user asks to add, update, close, or list tasks.
- Chained from `extract-entities` or `hyprnote-process` with extracted action
  items.
- The user asks to see someone's task board or workload.
- Scheduled housekeeping (prune done items, flag overdue).

## Prerequisites

- `knowledge/Tasks/` directory exists.
- User identity configured in `USER.md`.

## Inputs

User-initiated: person name and task details from the request.

Chained from other skills, action items in this shape:

```
TASKS:
- Owner: {Full Name}
  Task: {Description — starts with a verb}
  Priority: high|medium|low
  Due: YYYY-MM-DD (if known)
  Source: meeting|email
  Source date: YYYY-MM-DD
  Project: {Project Name} (if applicable)
  Context: {brief context}
```

## Outputs

- `knowledge/Tasks/{Person Name}.md` — created or updated.

<do_confirm_checklist goal="Verify task board changes are clean and consistent">

- [ ] Task title is actionable and starts with a verb.
- [ ] Priority is set; medium-default omitted.
- [ ] Due date present only when there's a real deadline.
- [ ] Project link `[[Projects/Name]]` set when applicable.
- [ ] No duplicate tasks on the board.
- [ ] All backlinks use absolute paths `[[Folder/Name]]`.
- [ ] Context line is concise (1–2 lines max).
- [ ] New boards include all four sections.
- [ ] Housekeeping pruned `## Recently Done` to the last 14 days.

</do_confirm_checklist>

Board layout, entry format, conventions, and useful queries:
[references/format.md](references/format.md).

## Procedure

### 1. Resolve the person

Read `USER.md`, then resolve the target name to its canonical form:

```bash
ls knowledge/Tasks/
rg "{name}" knowledge/People/
```

If no board exists yet, create one (Step 4).

### 2. Read the current board

```bash
cat "knowledge/Tasks/{Person Name}.md"
```

Parse the existing entries to: avoid duplicates, understand current workload,
and find the right insertion point.

### 3. Perform the operation

Pick **add**, **update**, **close**, **list**, or **housekeeping** based on the
request.

#### Add

1. Check for duplicates. If a near-duplicate exists, update it instead.
2. Pick the section per the routing rules in
   [references/format.md](references/format.md#section-routing).
3. Append the entry at the **bottom** of that section using the format from
   `references/format.md`.
4. Verify any referenced Project note exists.

#### Update

Find the task by its bold title (fuzzy match OK). Apply changes:

- **Status change:** move the entire entry between sections.
- **Priority change:** update the `| {priority} |` segment.
- **Due date change:** update or add `| due YYYY-MM-DD |`.
- **Add context:** append to the indented line.

Use Edit for targeted modifications.

#### Close

Find the task, remove it from its section, and add to the **top** of
`## Recently Done` using the closed-task format in
[references/format.md](references/format.md#closed-task-format).

#### List

Run the queries in [references/format.md](references/format.md#useful-queries)
and present results grouped by person or project as the user's question
warrants.

#### Housekeeping (scheduled)

1. Prune entries older than 14 days from `## Recently Done`.
2. Flag overdue tasks (due in the past, still in `## Open` or `## In Progress`)
   — report to the user; do **not** auto-modify.
3. Merge duplicates on the same board.
4. Spot-check `[[People/]]`, `[[Projects/]]`, `[[Goals/]]` references point to
   existing notes.

### 4. Write updates

For a new board, create `knowledge/Tasks/{Person Name}.md` with all four
sections (template in
[references/format.md](references/format.md#board-structure)).

For an existing board, use Edit for targeted changes — never rewrite the whole
file.

### 5. Migrate open items (one-time)

When first setting up boards, scan source notes for `## Open items` sections:

```bash
rg -l "## Open items" knowledge/People/ knowledge/Projects/ knowledge/Goals/
```

Convert each item into a task entry on the relevant person's board. **Do not**
remove the original — it stays as the historical record; the board becomes the
living tracker.
