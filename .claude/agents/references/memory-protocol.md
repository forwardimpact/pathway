# Shared Agent Protocol

## Memory

### Before starting work

1. Read `wiki/{agent}.md` and the other agent summaries for cross-agent context.
2. Check `wiki/storyboard-YYYY-MNN.md` for this month.
   - **Storyboard exists** — review the target condition and current obstacle;
     weight priority assessment toward actions that advance the target condition.
   - **No storyboard** — proceed with your standard priority framework.
   - Urgency always overrides storyboard alignment.

### During each run

Append a new `## YYYY-MM-DD` section at the end of the current week's log:

- **File:** `wiki/{agent}-$(date +%G-W%V).md`
- **Heading:** `# {Agent Title} — YYYY-Www` (create the file if missing)
- **Cadence:** one file per ISO week

Use `###` subheadings for the fields skills specify to record. Every run must
open with a `### Decision` subheading containing:

| Field            | Record                                                 |
| ---------------- | ------------------------------------------------------ |
| **Surveyed**     | What domain state was checked and the results          |
| **Alternatives** | What actions were available                            |
| **Chosen**       | What action was selected and which skill was invoked   |
| **Rationale**    | Why this action over the alternatives                  |

### After each run

Update `wiki/{agent}.md` with:

1. Actions taken
2. Observations for teammates
3. Open blockers
