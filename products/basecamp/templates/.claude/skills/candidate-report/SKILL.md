---
name: candidate-report
description: >
  Generate an A4 single-page HTML candidate assessment report benchmarked
  against the agent-aligned engineering standard. Use when the user asks you to
  create a candidate report, one-pager, or visual assessment for a hiring
  manager.
---

# Candidate Report

Generate a polished, single-page A4 HTML report that benchmarks a candidate
against a specific role in the agent-aligned engineering standard. The report is
designed for hiring managers and pod leads who need a quick visual summary
before deciding whether to invest interview time.

## Trigger

- User asks to create a candidate report, one-pager, or visual assessment
- User asks to generate a report for a hiring manager about a candidate
- User provides a CV and asks for a formatted assessment

## Prerequisites

- `@forwardimpact/pathway` CLI installed (`bunx fit-pathway --help`)
- Playwright for PDF output
  (`bun install playwright && bunx playwright install chromium`)
- Candidate must have a `brief.md` in `knowledge/Candidates/{Name}/`

## Inputs

1. **Candidate name** — used to locate `knowledge/Candidates/{Name}/brief.md`
2. **Target role** — discipline, level, and track (e.g.
   `software_engineering J070 forward_deployed`)
3. **Recipient** — who the report is for (pod lead, hiring manager)
4. **CV file** — optional; if no `screening.md` exists, read the CV directly

If the user doesn't specify a target role, infer it from:

- The candidate's `brief.md` (look for Req field -> Role file ->
  discipline/level/track)
- The role file linked in the vendor pipeline or role files in
  `knowledge/Roles/`
- Ask the user if it can't be inferred

## Outputs

- `drafts/{Recipient}-{CandidateSurname}-Report.html` — the A4 one-pager
- Optionally: PDF via `scripts/render-pdf.mjs`

## Workflow

### Step 1 — Gather candidate evidence

Read all available files for the candidate:

```
knowledge/Candidates/{Name}/brief.md        # Required
knowledge/Candidates/{Name}/screening.md    # If exists (from screen-cv)
knowledge/Candidates/{Name}/interview-*.md  # If exists (from assess-interview)
knowledge/Candidates/{Name}/CV.pdf or CV.md # Raw CV if needed
```

If a `screening.md` exists, use its skill ratings and behaviour assessments as
the primary source — they are already agent-aligned engineering
standard-calibrated. If not, you will need to do the mapping yourself in Step 3.

Also search the knowledge graph broadly for context:

```bash
rg "{Candidate Name}" knowledge/
```

### Step 2 — Load the agent-aligned engineering standard benchmark

Use the `fit-pathway` CLI to get the full role definition:

```bash
bunx fit-pathway job {discipline} {level} --track={track}
```

This returns:

- **Skill matrix** — every skill with its expected proficiency level
- **Behaviour profile** — each behaviour with its expected maturity
- **Expectations** — impact scope, autonomy, influence, complexity
- **Role summary** — what success looks like at this level

Extract the key data points you need:

- Core skills grouped by capability area (Delivery, AI, Business, Docs, ML)
- Behaviour names and expected maturity levels
- The level label and experience range

### Step 3 — Benchmark the candidate

Map candidate evidence against each agent-aligned engineering standard skill and
behaviour.

**Skill assessment (from CV or screening.md):**

| Rating      | Criteria                                           | Pill class |
| ----------- | -------------------------------------------------- | ---------- |
| **Met**     | Evidence meets or exceeds the expected proficiency | `p-p`      |
| **Partial** | Some evidence but below expected level             | `p-a`      |
| **Gap**     | No evidence, or clearly below expected             | `p-g`      |
| **Unknown** | Cannot assess from available evidence              | `p-u`      |

Apply the **two-level scepticism rule** from the screen-cv skill: default two
levels below CV claims unless concrete, quantified evidence is provided.

**Behaviour assessment:**

Map a 0-100% bar width based on evidence strength:

- 60-100%: Positive signal (use `var(--green)`)
- 30-59%: Partial signal (use `var(--amber)`)
- 10-29%: Weak/unknown (use `var(--s300)`)
- 0-9%: Gap (use `var(--red)`)

**Level calibration:**

Estimate the candidate's realistic level based on the evidence. Choose a 5-level
window for the gauge that centres around the candidate and target levels.

**Coverage counters:**

Count the total skills assessed into each bucket: Gap, Partial, Unknown, Met.

### Step 4 — Determine verdict

Choose one of three verdict classes based on the overall assessment:

| Verdict              | Class             | When to use                                                         |
| -------------------- | ----------------- | ------------------------------------------------------------------- |
| Proceed              | `verdict-proceed` | Candidate benchmarks at or above target level                       |
| Proceed with Caution | `verdict-caution` | Mixed signals; viable for scoped role or needs interview to resolve |
| Pass                 | `verdict-pass`    | Clear misalignment with role requirements                           |

Write a one-line verdict headline and a brief detail sentence.

### Step 5 — Build the HTML report

1. Read the CSS from `references/report.css`
2. Read the template from `references/report-template.html`
3. Replace all `{{PLACEHOLDER}}` tokens with candidate-specific data
4. Inline the CSS into the `<style>` block (required for PDF rendering)

**Template sections to populate:**

| Section           | Source                                                  |
| ----------------- | ------------------------------------------------------- |
| Header            | Candidate name, title, org, location from brief.md      |
| Verdict           | Step 4 output                                           |
| Snapshot          | 5-6 key facts (experience, education, source, stack)    |
| Strengths         | 3-5 bullet points — what the candidate brings           |
| Level gauge       | Estimated vs target level from Step 3                   |
| Benchmark grid    | Top skills per capability area with pills — from Step 3 |
| Behaviours        | Bar chart items — from Step 3                           |
| Coverage counters | Gap/Partial/Unknown/Met counts                          |
| Recommendation    | 2-4 actionable next steps                               |
| Footer            | Author name and role from USER.md                       |

**A4 fit rules:**

The report MUST fit on a single A4 page (210mm x 297mm). To stay within budget:

- Snapshot: max 6 `<dt>`/`<dd>` pairs
- Strengths: max 5 `<li>` items, keep each to one sentence
- Benchmark grid: show 4-6 rows per capability area (prioritise skills with
  notable gaps or strengths; omit "Unknown" skills if space is tight)
- Combine small capability areas (e.g. Docs + ML into one block)
- Recommendation: max 4 `<li>` items
- Test with browser print preview (Ctrl+P) — if it overflows, cut content

### Step 6 — Write the output

Write the completed HTML to:

```
drafts/{Recipient}-{CandidateSurname}-Report.html
```

Where `{Recipient}` is the first name of the person the report is for.

### Step 7 — Optional PDF conversion

If the user asks for a PDF, or if you think it would be helpful:

```bash
node .claude/skills/candidate-report/scripts/render-pdf.mjs \
  /tmp/candidate-report.html \
  ~/Desktop/{CandidateSurname}-Report.pdf
```

First copy the HTML to `/tmp/candidate-report.html`, then run the script.
Requires Playwright — if not installed, tell the user to run:

```bash
bun install playwright && bunx playwright install chromium
```

## Quality Checklist

Before delivering the report, verify:

- [ ] Standard data was loaded via `bunx fit-pathway job` (not guessed)
- [ ] All skill ratings are evidence-based, not assumed
- [ ] Two-level scepticism rule was applied to CV claims
- [ ] Coverage counters add up to the total skill count
- [ ] Verdict class matches the overall assessment
- [ ] Report fits on a single A4 page (check print preview)
- [ ] CSS is inlined in the `<style>` block
- [ ] Footer shows the correct author name and role
- [ ] No sensitive personal data included (health, politics, etc.)
- [ ] Report is written as if the candidate will read it (per KB ethics rules)

## File Structure

```
.claude/skills/candidate-report/
├── SKILL.md                          # This file
├── references/
│   ├── report.css                    # A4 stylesheet (deterministic)
│   └── report-template.html          # HTML skeleton with {{placeholders}}
└── scripts/
    └── render-pdf.mjs                # Playwright A4 PDF renderer
```
