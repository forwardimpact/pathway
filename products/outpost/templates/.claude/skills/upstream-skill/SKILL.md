---
name: upstream-skill
description: Track changes made to skills in this installation and produce a changelog that can be included upstream. Use when skills have been modified, added, or removed locally and those changes should be contributed back to the monorepo.
---

# Upstream

Track changes to skills in this installation and produce a structured changelog
so improvements can be contributed back to the upstream monorepo.

## Trigger

- The user asks to prepare local skill changes for upstream contribution.
- Skills in `.claude/skills/` have been modified, added, or removed.
- The user wants to document what changed locally before syncing upstream.

## Prerequisites

- A working Outpost installation with `.claude/skills/`.
- Git available for change detection.

## Inputs

- `.claude/skills/*/SKILL.md` — current skill files.
- Git history — change detection.

## Outputs

- `.claude/skills/<skill>/CHANGELOG.md` — one per modified skill,
  reverse-chronological.

<do_confirm_checklist goal="Verify changelogs are upstream-ready">

- [ ] Every changed skill has a `CHANGELOG.md` in its directory.
- [ ] Each entry has **What**, **Why**, and **Details** sections.
- [ ] Descriptions are specific enough for an upstream maintainer to act on (not
      "updated SKILL.md" / "fixed stuff").
- [ ] New skills include a brief description of their purpose.
- [ ] Removed skills explain why they were removed.
- [ ] Dates come from git history, not guessed.
- [ ] No duplicate entries for the same change.

</do_confirm_checklist>

## Procedure

### 1. Identify changed skills

Use git to find skills added, modified, or deleted since the last changelog
entry (or since initial commit if no changelog exists):

```bash
# Latest changelog date for a skill (if any)
head -20 .claude/skills/<skill>/CHANGELOG.md 2>/dev/null

# All changes touching skills
git log --oneline --name-status -- '.claude/skills/'

# Changes since last documented date for one skill
git log --after="<last-entry-date>" --name-status -- '.claude/skills/<skill>/'
```

If no changelog exists for a skill, consider all commits that touched that
skill's directory.

### 2. Classify each change

| Type       | Description                                          |
| ---------- | ---------------------------------------------------- |
| `added`    | New skill that doesn't exist upstream                |
| `modified` | Existing skill updated (workflow, checklists, tools) |
| `removed`  | Skill deleted from the installation                  |
| `renamed`  | Skill directory or file renamed                      |

For modifications, diff the current file against the prior version:

```bash
git diff HEAD~N -- '.claude/skills/<skill>/SKILL.md'
git diff <commit> -- '.claude/skills/<skill>/SKILL.md'
```

### 3. Describe each change

Every entry must answer:

1. **What changed?** — the specific section or behaviour modified.
2. **Why?** — the problem encountered or improvement discovered in use.
3. **How?** — a summary of the actual change (not a full diff).

Good: "Added a safety check to Step 3 — agents were skipping validation when the
source directory was empty, causing silent failures."

Bad: "Updated SKILL.md" / "Fixed stuff" / "Changed line 42".

### 4. Write the changelog

For each changed skill, create or update `.claude/skills/<skill>/CHANGELOG.md`
using this format (newest first):

```markdown
# <skill> Changelog

Changes to this skill that should be considered for upstream inclusion in
the Forward Impact monorepo.

## <YYYY-MM-DD>

**What:** <one-line summary>

**Why:** <problem or improvement that motivated it>

**Details:**
<2–5 lines describing the specific changes>

---
```

For **new** skills, write a single `added` entry describing the skill's purpose.
For **removed** skills, the changelog is the last file remaining in the
directory and explains the removal.

Worked examples in [references/examples.md](references/examples.md).

## Notes

- This skill **documents only** — it does not push or merge anything.
- Per-skill changelogs are consumed by the **downstream** skill in the upstream
  monorepo.
- When in doubt about whether a change is upstream-worthy, include it; the
  upstream maintainer decides what to incorporate.
