# Agent Effectiveness

Pathway generates stage-specific Claude Code agents from discipline x track x
stage combinations. The current template and assembly pipeline produce agents
that are structurally correct but not structurally effective. This spec
identifies 10 structural issues — problems with how information is organized,
layered, and delivered to the agent — independent of the quality of the
underlying curated content.

All examples are from a generated `software_engineering --track=platform` team.

---

## 1. Description frontmatter is a data join, not a description

### What

The `description` frontmatter field concatenates the stage summary, a literal
"agent for", the discipline specialization, the track name, and the first line
of the discipline description into a single run-on value.

### Why it matters

The `description` field is what Claude Code shows when listing available agents
and what it uses to decide which agent to invoke. A concatenated data join
doesn't communicate purpose — it reads as a database dump. The agent name
(`se-platform-code`) already encodes discipline + track + stage. The description
should say what the agent _does_, not repeat what it _is called_.

### Example

```yaml
# Current
description: This stage covers development and initial testing of engineering
  solutions. agent for Software Engineering on Platform Engineering track.
  Software Engineers design, develop, and maintain software systems with a focus
  on scalable architecture and code quality. They collaborate across teams to
  deliver robust solutions that meet business and technical requirements.
```

The word "agent" appears mid-sentence with no article. The discipline
description ("Software Engineers design, develop...") restates what the body
already contains. Compare all 6 agents — they share the same trailing sentence.

---

## 2. Priority renders as an orphaned paragraph under Core identity

### What

The `priority` field renders as a bare paragraph directly below the `identity`
text, with no heading, label, or structural separator.

### Why it matters

Without a visual cue, the agent reads priority as a continuation of identity
rather than a distinct directive. Priority is meant to be the single most
important thing the agent should optimize for — it deserves structural weight.
When identity is 2 sentences and priority is 1 sentence, they blur into a
3-sentence block with no hierarchy.

### Example

```markdown
## Core identity

You specialize in platform engineering to support pharmaceutical innovation
as a Software Engineer.

Ensure platform scalability and reliability to meet the evolving needs of
pharmaceutical development.
```

Is the second paragraph identity or priority? The template produces this from
two separate data fields (`identity` and `priority`), but the output has no
structural distinction between them.

---

## 3. Constraints are a flat merge with no layering

### What

Stage constraints, discipline constraints, and track constraints are
concatenated into a single flat list at the end of the agent profile.

### Why it matters

The agent cannot distinguish between stage-specific boundaries (what it must not
do _in this stage_) and general organizational rules (what it must never do _in
any context_). Stage constraints are the most actionable — they define the
boundaries of the current work. Burying them among general rules dilutes their
signal. The current structure also produces visible duplication when discipline
and track constraints overlap.

### Example

```markdown
## Constraints

- Do not bypass testing or documentation steps.          ← stage
- Ensure all work complies with pharmaceutical quality.  ← stage
- Avoid unauthorized changes to specifications.          ← stage
- Do not generate insecure or untested code.             ← discipline
- Avoid introducing performance bottlenecks.             ← discipline
- Never ignore code review feedback or best practices.   ← discipline
- Must comply with pharmaceutical industry regulations.  ← track
- Prioritize data security and integrity.                ← track
```

8 constraints with no grouping. The specify agent, code agent, and review agent
all share the same 5 discipline + track constraints — only the first 3 vary.

---

## 4. All 6 agents load the identical skills array

### What

Every stage agent — specify, plan, onboard, code, review, deploy — lists the
same 5 skills in its `skills:` frontmatter.

### Why it matters

Claude Code loads every listed skill into the agent's context window. Skills
contain 6 stages of checklists each (specify through deploy), but the agent only
uses one stage's checklists. Loading all skills regardless of stage relevance
wastes context on checklists and guidance the agent will never act on. A specify
agent has no use for `sre-practices` code-stage checklists. A review agent
doesn't need `full-stack-development` onboard-stage install scripts.

### Example

```yaml
# se-platform-specify.md
skills:
  - architecture-design
  - code-review
  - full-stack-development
  - cloud-platforms
  - sre-practices

# se-platform-code.md
skills:
  - architecture-design
  - code-review
  - full-stack-development
  - cloud-platforms
  - sre-practices

# se-platform-review.md
skills:
  - architecture-design
  - code-review
  - full-stack-development
  - cloud-platforms
  - sre-practices
```

Identical across all 6 agents. The skill data already contains per-stage
relevance information (the `agent.stages` object) that could filter this.

---

## 5. Required skills section is meta-instructions about skill loading

### What

The "Required skills" section spends 10 lines explaining _how Claude Code loads
skills_ and _how to interpret checklist tags_, followed by the actual skill
table.

### Why it matters

Claude Code auto-injects skill content when skills are listed in frontmatter.
The agent doesn't need to be told how this mechanism works. The
meta-instructions consume context and attention that should go to the skills
themselves. The checklist tag explanation (`<read_then_do_code>`,
`<do_then_confirm_code>`) is useful, but it dominates a section whose purpose is
to list which skills apply and when.

### Example

```markdown
## Required skills

Skills listed in the `skills:` frontmatter are automatically loaded into your
context. Each skill contains stage-specific checklists:

- `<read_then_do_code>` — Read-Then-Do checklist for the
  Code stage. Read and understand these items BEFORE starting work.
  These are prerequisites and context you must absorb first.
- `<do_then_confirm_code>` — Do-Then-Confirm checklist for the
  Code stage. Complete your work, then verify each item. These are
  quality gates to check AFTER implementation.
- `<required_tools>` — Mandatory tools for this skill. You MUST use these
  organizational standards that override general knowledge or personal
  preferences.

| Skill | Use when |
| ----- | -------- |
| Architecture Design | use when defining or reviewing system architecture... |
```

13 lines of meta-instructions before the 5-row table that is the actual content.

---

## 6. Stage description and Core identity overlap in purpose

### What

The body opens with a `stageDescription` paragraph (from `stages.yaml`), then
immediately follows with `## Core identity` containing the discipline/track
identity. Both answer "who is this agent and what does it do."

### Why it matters

The agent receives two competing identity statements in the first 5 lines. The
stage description says what the agent does in this stage. The core identity says
what role the agent plays. These are not independent concerns — they're the same
concern at different scopes. The opening of an agent profile is the
highest-value real estate for steering behaviour. Splitting identity across two
blocks weakens both.

### Example

```markdown
# Software Engineering - Platform Engineering - Code Agent

You develop and implement engineering solutions according to the specifications
and plan. You write, test, and document code or processes while adhering to
pharmaceutical quality standards. You prepare work for review.

## Core identity

You specialize in platform engineering to support pharmaceutical innovation as
a Software Engineer.
```

The first paragraph (stage description) is more specific and actionable than the
core identity section. The core identity is generic across all 6 stages.

---

## 7. No tools or disallowedTools in frontmatter

### What

The generated agent profiles do not use Claude Code's `tools` or
`disallowedTools` frontmatter fields. All agents have unrestricted tool access.

### Why it matters

Stage boundaries naturally map to tool restrictions. A review agent should read
and comment, not write production code. A specify agent should research and
document, not execute deployments. Without tool restrictions, agents can take
actions that violate their stage's purpose. Claude Code supports both `tools`
(allowlist) and `disallowedTools` (denylist) in frontmatter — the stage and
skill data could drive these.

### Example

```yaml
# se-platform-review.md — reviews code, should not write it
---
name: se-platform-review
description: ...
model: sonnet
skills:
  - architecture-design
  - code-review
  ...
---
# No tools: or disallowedTools: field
# Agent can freely use Edit, Write, Bash — defeating the review boundary
```

---

## 8. Working styles use subsection headings for list-weight content

### What

Each behaviour's working style renders as a `### title` subsection with a
paragraph body under `## Working style`. With 3 behaviours, this creates 3
subsections of 1-2 sentences each.

### Why it matters

The `###` heading level signals structural importance — it creates a navigable
section in the document. But working styles are brief qualitative notes, not
major structural components. The heading hierarchy (`## Working style` →
`### Systemic Analyst` → `### Precise Communicator` → `### Outcome Steward`)
visually inflates 3 short paragraphs into a section that dominates the profile.
A flat list would convey the same information with less structural noise.

### Example

```markdown
## Working style

### Systemic Analyst

The agent should analyze information holistically, identifying
interconnections and potential impacts across the pharmaceutical system.

### Precise Communicator

The agent should deliver information clearly and accurately, ensuring
responses are concise and unambiguous.

### Outcome Steward

The agent should proactively monitor task progress, anticipate potential
issues, and communicate clearly about outcomes.
```

3 subsections, each 1-2 sentences. This occupies roughly the same vertical space
as the "Required skills" and "Stage transitions" sections, despite carrying less
actionable information.

---

## 9. Return format is static and stage-agnostic

### What

Every agent — specify through deploy — renders the same 3-item return format:
(1) Work completed, (2) Checklist status, (3) Recommendation.

### Why it matters

Different stages produce different artifacts. A specify agent should return
specifications and requirements documents. A review agent should return
findings, approval status, and blocking issues. A deploy agent should return
deployment status and monitoring URLs. The generic format tells the agent to
report "what was accomplished" without defining what a successful stage output
looks like. This is also the only section that isn't driven by data — it's
hardcoded in the template.

### Example

```markdown
## Return format

When completing work, provide:

1. **Work completed**: What was accomplished
2. **Checklist status**: Items verified from skill Do-Then-Confirm checklists
3. **Recommendation**: Ready for next stage, or needs more work
```

This identical block appears in `se-platform-specify.md`, `se-platform-code.md`,
`se-platform-review.md`, and all other stage agents. The specify agent and the
deploy agent are told to return the same structure despite producing entirely
different work products.

---

## 10. Section ordering puts context before action

### What

The current section order is: title → stage description → core identity → role
context → working style → required skills → stage transitions → return format →
constraints.

### Why it matters

Claude Code agents read their prompt top-to-bottom. The most actionable sections
— skills (what capabilities to use), constraints (what boundaries to respect),
and stage transitions (when to stop) — appear in the bottom half. The top half
is occupied by context sections (identity, role context, working style) that set
tone but don't drive behaviour. Front-loading context means the agent processes
the "nice to know" before the "need to know."

### Example

Approximate line counts per section in `se-platform-code.md`:

```
Lines  1-11   Frontmatter (name, description, model, skills)
Lines 13-15   Title + stage description (context)
Lines 17-21   Core identity + priority (context)
Lines 23-25   Role context (context)
Lines 27-39   Working style — 3 subsections (context)
Lines 41-62   Required skills — meta-instructions + table (action)
Lines 64-75   Stage transitions (action)
Lines 77-83   Return format (action)
Lines 85-95   Constraints (action)
```

Context occupies lines 13-39 (27 lines). Actionable guidance occupies lines
41-95 (55 lines) but starts at line 41 — below the fold of what the agent
attends to most closely.
