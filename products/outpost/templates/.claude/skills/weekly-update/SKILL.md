---
name: weekly-update
description: Generate or refresh a weekly priorities document. Pulls from task boards, recent activity, and calendar to create a point-in-time snapshot. Use when the user asks to update their weekly, prep for the week, or on a Monday morning schedule.
---

# Weekly Update

Generate or refresh a weekly priorities document in
`knowledge/Weeklies/{Person Name}/`. Each weekly is a point-in-time snapshot —
created at the start of the week, updated as priorities shift, and closed out
with a retrospective at end-of-week.

## Trigger

- The user asks to update their weekly or prep for the week.
- Monday mornings (scheduled).
- The user asks to review someone's weekly.
- End-of-week to fill in accomplishments and retrospective.

## Prerequisites

- `knowledge/Weeklies/` exists.
- `knowledge/Tasks/{Person Name}.md` exists (see `manage-tasks`).
- Calendar data in `~/.cache/fit/outpost/apple_calendar/`.
- User identity configured in `USER.md`.

## Inputs

- `knowledge/Tasks/{Person Name}.md` — current task board.
- `knowledge/People/{Person Name}.md` — recent activity, context.
- `knowledge/Goals/*.md` — active goals (for linking priorities).
- `knowledge/Priorities/*.md` — strategic pillars (for the focus statement).
- `~/.cache/fit/outpost/apple_calendar/*.json` — week's events.
- Previous weekly (if any) — continuity and carry-forward.

## Outputs

- `knowledge/Weeklies/{Person Name}/{YYYY}-W{WW}.md`.

<do_confirm_checklist goal="Verify the weekly snapshot is accurate before
saving">

- [ ] ISO week number and date range are correct.
- [ ] Focus statement reflects the actual week (not generic).
- [ ] Priorities pulled from the task board (not invented), capped at 5–7.
- [ ] Key meetings pulled from calendar; attendees resolved to `[[People/Name]]`
      where known.
- [ ] Blockers match the task board's `## Blocked` section.
- [ ] Carry-forward items from the previous week are included.
- [ ] All backlinks use absolute paths.
- [ ] Retrospective is filled only at end-of-week.

</do_confirm_checklist>

Document layout, conventions, and date helpers:
[references/template.md](references/template.md).

## Procedure

### 1. Pick the target

Read `USER.md` for identity. Default the target to the current user; otherwise,
the person the user named. Compute the current ISO week and the Monday–Friday
range — see the date helpers in
[references/template.md](references/template.md#date-helpers-macos).

Check whether a weekly exists for this week:

```bash
ls "knowledge/Weeklies/{Person Name}/" 2>/dev/null
```

- **No file:** new (start-of-week).
- **File present:** update (mid-week or end-of-week).

### 2. Gather context

**Task board:**

```bash
cat "knowledge/Tasks/{Person Name}.md"
```

- `## In Progress` → top priorities.
- `## Open` with `high` priority or near due dates → candidate priorities.
- `## Blocked` → blockers section.
- `## Recently Done` items completed this week → accomplishments.

**Recent activity:** `cat "knowledge/People/{Person Name}.md"` — `## Activity`
for this week's entries.

**Calendar:** read events in the Mon–Fri range. Capture title, attendees
(resolve to `[[People/Name]]`), day, and agenda. Filter out all-day
placeholders, declined, and cancelled events.

**Previous weekly:** `ls "knowledge/Weeklies/{Person Name}/" | sort | tail -1`.
Carry forward any unchecked priorities and ongoing themes.

### 3. Generate or update

#### New weekly (start of week)

1. **Focus:** synthesize from highest-priority tasks and key meetings — one
   sentence.
2. **Priorities:** in-progress first, then `high` open, then near-due, then
   carry-forward. Cap at 5–7.
3. **Key Meetings:** `**{Day}**: {title} with [[People/Name]] — {purpose}`.
4. **Blockers:** from the board, naming who is needed.
5. **Accomplishments / Retrospective:** leave empty (or pre-fill anything
   completed Monday morning).

#### Mid-week update

Re-read the board for changes. Mark completed `[x]`. Append new priorities.
Update blockers. Add accomplishments as they happen. Do **not** touch the
retrospective.

#### End-of-week update

Mark all completed priorities `[x]`. Fill accomplishments from the full week.
Write a brief retrospective: went well / didn't go as planned / carry forward.
Note unchecked priorities — they carry to next week.

### 4. Write

For a new file, ensure the directory exists:

```bash
mkdir -p "knowledge/Weeklies/{Person Name}"
```

Use the template in [references/template.md](references/template.md). Save to
`knowledge/Weeklies/{Person Name}/{YYYY}-W{WW}.md`.

For an existing file, use Edit for targeted updates; do not rewrite.

### 5. Cross-reference

If new priorities aren't on the task board, add them to the board (the board is
canonical, the weekly references it). If blockers were resolved, update the
board accordingly.
