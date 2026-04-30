---
name: kata-documentation
description: >
  Write and review documentation in the websites/fit/ folder. Scheduled runs review
  one topic in depth for accuracy, audience purity, and staleness. Interactive
  runs write or update pages following documentation standards. Use when
  writing, editing, auditing, or reviewing documentation, or running scheduled
  documentation review.
---

# Documentation

Write effective documentation and systematically review it for accuracy. Two
modes of operation:

- **Scheduled review** — Pick one topic, go deep, verify against source code.
- **Interactive writing** — Write or update pages following the standards.

## When to Use

- Scheduled documentation review (one topic per run)
- Writing or updating pages in `websites/fit/`
- Auditing documentation accuracy against source code

## Checklists

<read_do_checklist goal="Load documentation standards before starting">

- [ ] Read [`references/standards.md`](references/standards.md) — audience
      rules, formatting conventions, terminology.
- [ ] Read [`references/source-of-truth.md`](references/source-of-truth.md) —
      which code/data backs each documentation claim.
- [ ] Identify the audience for every page touched — do not mix contributor
      content into user-facing pages or vice versa.
- [ ] Verify claims against source code, not against other documentation.

</read_do_checklist>

<do_confirm_checklist goal="Confirm documentation review is complete">

- [ ] Every CLI example on the page was executed and output verified.
- [ ] Every YAML example was checked against JSON schema.
- [ ] Audience purity confirmed (no audience mixing).
- [ ] Source of truth consulted and docs match current code.
- [ ] All cross-links resolve.
- [ ] `bunx fit-doc build` succeeds.
- [ ] Terminology matches conventions in `references/standards.md`.

</do_confirm_checklist>

## Scheduled Review

Each run covers **one topic** in depth.

### Topic areas

| Topic                    | What to review                                                             |
| ------------------------ | -------------------------------------------------------------------------- |
| `getting-started`        | `websites/fit/docs/getting-started/` — onboarding accuracy, CLI examples   |
| `guides`                 | `websites/fit/docs/guides/` — task accuracy, audience purity, completeness |
| `reference`              | `websites/fit/docs/reference/` — CLI synopsis, entity definitions, schema  |
| `internals`              | `websites/fit/docs/internals/` — architecture accuracy, code path validity |
| `product-pages`          | `websites/fit/{map,pathway,guide,outpost,landmark,summit}/` — overviews    |
| `root-docs`              | `CLAUDE.md`, `CONTRIBUTING.md`, `KATA.md`, `SECURITY.md`                   |
| `llms-txt-and-seo`       | `websites/fit/llms.txt`, `websites/fit/robots.txt`, sitemap completeness   |
| `cross-page-consistency` | Terminology, proficiency scales, field names across all pages              |

### Step 0: Read Memory

Read memory per the agent profile (your summary, the current week's log, and
teammates' summaries). Find last review dates per topic in the coverage map.

> **Writing under `.claude/`:** If this run edits files under `.claude/skills/`,
> follow [self-improvement.md](../../agents/references/self-improvement.md).

### Topic selection

1. Build coverage map — never-reviewed topics go first, then oldest.
2. Revisit threshold — if all topics covered within last 6 runs, revisit oldest.
3. Announce your pick and why before starting.
4. Go deep — read every page in the topic area, not just spot-check.

### Review process

1. Read every page in the topic area.
2. For each page, identify the source of truth (per
   [`references/source-of-truth.md`](references/source-of-truth.md)).
3. Read the actual source code/data and compare to documentation claims.
4. Check audience purity — flag contributor content in user-facing pages (per
   [`references/standards.md`](references/standards.md)).
5. Run CLI examples shown in docs, verify output matches.
6. Check YAML examples against JSON schemas in `products/map/schema/json/`.
7. Verify all internal cross-links resolve.
8. Run `bunx fit-doc build --src=websites/fit --out=dist` to confirm build.
9. Check `git log --oneline -20 -- <paths>` for recent code changes that may
   have invalidated docs.

### Review checklist

Run the DO-CONFIRM checklist at the top of this skill.

## Interactive Writing

### Writing a new page

1. **Identify the audience.** Determine which user group the page serves — this
   decides the section. See
   [`references/standards.md`](references/standards.md).
2. **Choose the section.** New to the product → Getting Started. Task to
   accomplish → Guides. Looking something up → Reference. Understanding the code
   → Internals.
3. **Research the source of truth.** Read the actual code and data before
   writing. Cross-reference
   [`references/source-of-truth.md`](references/source-of-truth.md).
4. **Write for the audience.** Strip content that belongs to a different
   audience.
5. **Verify accuracy.** Run CLI commands, check YAML against schemas, confirm
   entity names against `data/pathway/`.
6. **Add cross-links.** Guides → Reference for details. Getting Started → Guides
   for next steps. Internals → Reference for the user-facing model.
7. **Build and check.** Run `bunx fit-doc build --src=websites/fit --out=dist`.

### Updating existing pages

1. Read the page and its source of truth — check actual code, not just docs.
2. Check audience purity — move contributor content to Internals if needed.
3. Verify CLI examples. Run every command shown.
4. Verify YAML examples against `products/map/schema/json/`.
5. Check cross-links resolve.
6. Build and check.

## Output

Every review must produce both categories when applicable — incremental fixes on
a `fix/` branch and specs for structural findings on `spec/` branches. Branch
naming, commit conventions, and independence rules are defined in the agent
profile.

**Commit format:** `docs(website): {verb} {topic} documentation`

Verbs: `add` for new pages, `update` for changes, `fix` for corrections.

### Publishing changes

Commits are not visible until pushed. After committing on a branch:

1. **Push the branch** — `git push -u origin <branch>`
2. **Open a PR** — `gh pr create --title "<title>" --body "<body>"`

Each branch gets its own PR. Fix and spec branches are independent — push and PR
each one separately. Wiki changes follow the wiki curation skill's publishing
instructions.

## Memory: what to record

Append to the current week's log (see agent profile for the file path):

- **Topic reviewed** — Which topic and why selected
- **Coverage map** — Updated table of all topics with last review date
- **Findings summary** — What found, severity, disposition
  (fixed/spec'd/deferred)
- **Deferred work** — Issues needing follow-up with enough context to resume
- **Accuracy errors** — Specific docs that diverged from source code
- **Observations for teammates** — Callouts for agents whose work affects docs
- **Metrics** — Record at least one measurement to
  `wiki/metrics/{agent}/{domain}/` per the
  [`kata-metrics`](../kata-metrics/SKILL.md) protocol. If no CSV exists, create
  it with the header row. These feed XmR analysis in the storyboard meeting.

## Coordination Channels

This skill produces these non-wiki outputs (per
[coordination-protocol.md](../../agents/references/coordination-protocol.md)):

- **PR comment** — Doc-impact callouts on code PRs that change behaviour
  documented in `websites/fit/`.
- **Discussion** — Doc gaps that reflect an unsettled product question rather
  than a writing task.

If an inbound PR comment addressed to this agent is ambiguous, follow
[coordination-protocol.md § Inbound: unclear addressed comments](../../agents/references/coordination-protocol.md#inbound-unclear-addressed-comments).
