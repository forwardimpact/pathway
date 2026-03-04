---
name: upstream-skill
description: Track changes made to skills in this installation and produce a changelog that can be included upstream. Use when skills have been modified, added, or removed locally and those changes should be contributed back to the monorepo.
---

# Upstream

Track changes made to skills in this installation and produce a structured
changelog so improvements can be contributed back to the upstream monorepo.

## Trigger

Run this skill when:

- The user asks to prepare local skill changes for upstream contribution
- Skills in `.claude/skills/` have been modified, added, or removed
- The user wants to document what changed in the local installation
- Before syncing with the upstream monorepo

## Prerequisites

- A working Basecamp installation with `.claude/skills/` directory
- Git available for detecting changes

## Inputs

- `.claude/skills/*/SKILL.md` — current skill files in this installation
- Git history — to detect what changed and when

## Outputs

- `.claude/skills/CHANGELOG.md` — structured changelog of all local skill changes

---

## Process

### Step 1: Identify Changed Skills

Use git to find all skill files that have been added, modified, or deleted since
the last changelog entry (or since initial commit if no changelog exists).

```bash
# Find the date of the last changelog entry (if any)
head -20 .claude/skills/CHANGELOG.md 2>/dev/null

# List changed skill files since last documented change
git log --oneline --name-status -- '.claude/skills/'
```

If `.claude/skills/CHANGELOG.md` already exists, read the most recent entry date
and only look at changes after that date:

```bash
git log --after="<last-entry-date>" --name-status -- '.claude/skills/'
```

If no changelog exists, consider all commits that touched `.claude/skills/`.

### Step 2: Classify Each Change

For every changed skill file, determine the type of change:

| Type        | Description                                           |
| ----------- | ----------------------------------------------------- |
| `added`     | New skill created that doesn't exist upstream          |
| `modified`  | Existing skill updated (workflow, checklists, tools)   |
| `removed`   | Skill deleted from the installation                    |
| `renamed`   | Skill directory or file renamed                        |

For **modified** skills, read the current file and the previous version to
identify what specifically changed:

```bash
# Show diff for a specific skill
git diff HEAD~N -- '.claude/skills/<skill-name>/SKILL.md'

# Or compare against a specific commit/date
git log --oneline -- '.claude/skills/<skill-name>/'
git diff <commit> -- '.claude/skills/<skill-name>/SKILL.md'
```

### Step 3: Describe Each Change

For every changed skill, write a clear description that an upstream maintainer
can act on. Each entry must answer:

1. **What changed?** — The specific section or behaviour that was modified
2. **Why?** — The problem encountered or improvement discovered during use
3. **How?** — A summary of the actual change (not a full diff)

Good descriptions:

- "Added a safety check to Step 3 — agents were skipping validation when the
  source directory was empty, causing silent failures"
- "Rewrote the Entity Extraction section to process files in batches of 10
  instead of all at once — large inboxes caused context window overflow"
- "New skill: `process-hyprnote` — transcribes and extracts entities from
  Hyprnote meeting recordings"

Bad descriptions:

- "Updated SKILL.md" (too vague)
- "Fixed stuff" (no context)
- "Changed line 42" (not meaningful to upstream)

### Step 4: Write the Changelog

Create or update `.claude/skills/CHANGELOG.md` with the following format:

```markdown
# Skill Changelog

Changes to skills in this installation that should be considered for upstream
inclusion in the Forward Impact monorepo.

## <YYYY-MM-DD>

### <skill-name> (added|modified|removed)

**What:** <one-line summary of the change>

**Why:** <the problem or improvement that motivated it>

**Details:**
<2-5 lines describing the specific changes made>

---
```

Entries are in **reverse chronological order** (newest first). Group changes
from the same date under a single date heading.

### Step 5: Review the Changelog

After writing, read the changelog back and verify:

- [ ] Every changed skill has an entry
- [ ] Each entry has What, Why, and Details sections
- [ ] Descriptions are specific enough for an upstream maintainer to act on
- [ ] New skills include a brief description of their purpose
- [ ] Removed skills explain why they were removed
- [ ] No duplicate entries for the same change
- [ ] Dates are accurate (from git history, not guessed)

## Example Output

```markdown
# Skill Changelog

Changes to skills in this installation that should be considered for upstream
inclusion in the Forward Impact monorepo.

## 2026-03-01

### track-candidates (modified)

**What:** Added gender field extraction for diversity tracking

**Why:** Recruitment pipeline lacked diversity metrics — pool composition was
invisible without structured gender data.

**Details:**
- Added Gender field to candidate brief template (Woman / Man / —)
- Added extraction rules: pronouns, gendered titles, culturally unambiguous names
- Added explicit note that field has no bearing on hiring decisions
- Updated quality checklist to include gender field verification

### process-hyprnote (added)

**What:** New skill for processing Hyprnote meeting recordings

**Why:** Meeting notes were being lost — Hyprnote captures transcriptions but
they weren't being integrated into the knowledge base.

**Details:**
- Reads transcription files from `~/.cache/fit/basecamp/hyprnote/`
- Extracts people, decisions, and action items
- Creates meeting notes in `knowledge/Meetings/`
- Links attendees to `knowledge/People/` entries

---

## 2026-02-15

### extract-entities (modified)

**What:** Increased batch size from 5 to 10 files per run

**Why:** Processing was too slow for large inboxes — 5 files per batch meant
dozens of runs to catch up after a week of email.

**Details:**
- Changed batch size constant from 5 to 10 in Step 1
- Added a note about context window limits for batches > 15

---
```

## Notes

- This skill only **documents** changes — it does not push or merge anything
- The changelog is consumed by the **downstream** skill in the upstream monorepo
- Keep descriptions actionable: an upstream maintainer should be able to
  understand and apply each change without access to this installation
- When in doubt about whether a change is upstream-worthy, include it — the
  upstream maintainer will decide what to incorporate
