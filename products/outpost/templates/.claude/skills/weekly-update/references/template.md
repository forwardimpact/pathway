# Weekly Document Template

Reference template for `weekly-update`. Each weekly is a point-in-time snapshot
stored at `knowledge/Weeklies/{Person Name}/{YYYY}-W{WW}.md`.

```markdown
# {YYYY}-W{WW} — {Person Name}

> {Focus statement: one sentence summarizing the week's theme}

## Priorities

- [ ] Priority one — [[Projects/Name]] → [[Goals/Goal Name]]
- [ ] Priority two
- [x] Completed priority

## Key Meetings

- **Monday**: Meeting title with [[People/Name]] — purpose
- **Wednesday**: Meeting title — purpose

## Blockers

- Waiting on X from [[People/Name]]

## Accomplishments

- Completed X
- Shipped Y

## Retrospective

- **Went well:** ...
- **Didn't go as planned:** ...
- **Carry forward:** ...
```

## Conventions

- **Week numbers:** ISO 8601 (e.g. `2026-W08`).
- **Priorities:** Top 3–7 items pulled from the task board. Append
  `→ [[Goals/Goal Name]]` only when the task clearly serves that goal — not
  every task needs a link.
- **Key Meetings:** Substantive meetings only. Skip recurring standups.
- **Retrospective:** Filled at end-of-week only.
- **Backlinks:** Always absolute — `[[People/Name]]`, `[[Projects/Name]]`,
  `[[Goals/Name]]`, `[[Tasks/Name]]`.

## Date helpers (macOS)

```bash
date +%G-W%V          # Current ISO week
date -v-mon +%Y-%m-%d # Monday of current week
date -v+fri +%Y-%m-%d # Friday of current week
```
