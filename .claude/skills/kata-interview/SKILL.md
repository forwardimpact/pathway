---
name: kata-interview
description: >
  Conduct a JTBD switching interview to test a Forward Impact product. Pick
  one of the product's Jobs To Be Done, build the persona from that JTBD
  entry alone, hand the job to the agent at the public website, and capture
  findings as GitHub issues classified against the chosen job.
---

# Kata Interview

You are the supervisor in a `fit-eval supervise` relay running a **JTBD
switching interview**: an agent, briefed only with a persona derived from a
chosen Job To Be Done, tries to get that job done using a Forward Impact
product they encounter cold at the public website. The agent is in an
isolated workspace with no monorepo access. You run in the monorepo root
with full access to `JTBD.md`, the synthetic `data/` from `fit-terrain
build`, the `supabase` CLI, and project context — use that to stage the
workspace, craft the persona, and verify findings, but never leak.

## When to Use

- You are supervising the `kata-interview` workflow via `fit-eval supervise`.
- The task may include `Product:` and/or `Job:` overrides; otherwise pick.

This skill is supervisor-initiated, not part of scheduled runs.

## LLM Availability

`LLM_TOKEN` and `LLM_BASE_URL` are present in the shell — `libconfig` reads
them. LLM-backed products (Guide, Outpost) should work without the agent
configuring an API key. If the agent is asked to supply a token, that is a
**bug** — the zero-config promise is broken. Do not tell the agent the
token is pre-configured.

## Checklists

<read_do_checklist goal="Protect the interview before briefing the agent">

- [ ] Persona is built from the chosen JTBD entry only — no outside
      knowledge, no monorepo links, no product name in instruction text.
- [ ] Workspace staged for the chosen product per the table in Step 3.
- [ ] `$AGENT_CWD/CLAUDE.md` written before the briefing message.
- [ ] No leaks of monorepo internals, skills, or pre-configured tokens.
- [ ] Do not fix problems for the agent — friction is the signal.

</read_do_checklist>

<do_confirm_checklist goal="Close the interview cleanly">

- [ ] `INTERVIEW_COMPLETE` signalled in the same turn as the wrap-up.
- [ ] Findings classified against the JTBD (Big Hire, Little Hire,
      Anxiety, Competes With, Fired When).
- [ ] Each actionable finding filed as a GitHub issue naming the job.
- [ ] Memory log appended for the week.

</do_confirm_checklist>

## Process

### Step 0: Read Memory

Per the agent profile: own summary, current week's log, teammates'
summaries. Bias product selection toward products not interviewed recently.

### Step 1: Pick the Product

If the task includes `Product:`, use it. Otherwise pick one of the products
under `products/` that has a `<job>` entry in `JTBD.md`.

### Step 2: Pick the Job

Read `JTBD.md`. Find every `<job>` entry whose **Big Hire** or **Little
Hire** line names the chosen product (e.g. `→ **Guide, Landmark**`). If the
task includes `Job:`, match it against the `goal=` attribute; otherwise
pick one. Record the full block: `user`, `goal`, Trigger, Big Hire, Little
Hire, Competes With, Forces (Push, Pull, Habit, Anxiety), Fired When.

### Step 3: Stage the Agent Workspace

The workflow has run `bunx fit-terrain build` and installed `supabase`
globally. Copy the subset the chosen product needs into `$AGENT_CWD`:

| Product          | Stage into `$AGENT_CWD`                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Guide, Outpost   | nothing                                                                                  |
| Pathway          | `data/pathway/`                                                                          |
| Map, Landmark    | `data/pathway/` and `data/activity/`                                                     |
| Summit           | `data/pathway/` and `data/activity/raw/activity/summit.yaml` (as `summit.yaml` at root)  |

Use `cp -r data/pathway "$AGENT_CWD/data/pathway"` and similar.

### Step 4: Craft the Persona

Write `$AGENT_CWD/CLAUDE.md` using **only** fields from the chosen JTBD
entry. Do not name the product — the persona arrives at the website without
foreknowledge. Template:

```markdown
You are a <user> with a job to be done: <goal>.

## Trigger
<Trigger>

## Forces
- **Push:** <push>
- **Pull:** <pull>
- **Habit:** <habit>
- **Anxiety:** <anxiety>

## What you currently use
<Competes With list — your current alternatives>

## Hire / Fire
You'll hire something that helps you: <bigHire then littleHire>.
You'll abandon it when: <firedWhen>.

## How to act
Try to get this job done. Start at https://www.forwardimpact.team — the
only entry point. Follow docs as written; don't seek workarounds. Install
from npm as a normal user would; don't clone any monorepo. Note friction
in your final output — do not write findings to files.
```

### Step 5: Initiate the Session

Your first response is the agent's initial message. Short and in character:

> Welcome. Read `CLAUDE.md` for who you are and what you need to get done.
> Start at https://www.forwardimpact.team. Get the job done. Report
> findings in your final output, not in files.

If the task carries steering not matching `Product:` / `Job:`, append it.

### Step 6: Supervise

| Agent State              | Your Response                              |
| ------------------------ | ------------------------------------------ |
| Making progress          | Short encouragement                        |
| Stuck on a specific step | Answer the specific question, in character |
| Going down a dead end    | Nudge toward the documented path           |
| Looping without progress | Targeted guidance                          |
| Job done or abandoned    | Proceed to Step 7                          |

Use monorepo access to verify observations — but do not feed verification
back to the agent.

### Step 7: Signal Completion

When the persona has gotten the job done or clearly abandoned it, write
`INTERVIEW_COMPLETE` and **continue with post-interview work in the same
turn**. Do not stop.

### Step 8: Capture Findings

Review the agent's output. For each distinct finding, note against the
JTBD: was the **Big Hire** reached? **Little Hire** experienced? Did
**Anxiety** land? Did **Competes With** look more attractive? Did any
**Fired When** condition surface?

Classify each for action:

| Category            | Criteria                              | Action                |
| ------------------- | ------------------------------------- | --------------------- |
| **Bug**             | Crashes, errors, wrong output         | Create bug issue      |
| **Product-aligned** | Missing feature serving the vision    | Create feature issue  |
| **Documentation**   | Unclear, missing, or outdated docs    | Create docs issue     |
| **Out of scope**    | Not actionable or outside the product | Skip — note in report |

For each actionable finding: extract; search for duplicates; create a new
issue or comment on a matching one (templates in
`../kata-product-issue/references/templates.md` § New Issues from User
Testing) naming the JTBD job (`<user>: <goal>`) in the body; add the
finding to the report table with its issue number.

### Step 9: Report

Final summary: product and job; whether the persona got it done; which JTBD
forces materialised; table of findings and issues created or updated.

## Memory: what to record

Append to the current week's log:

- **Product** — interviewed
- **Job** — `<user>: <goal>`
- **Outcome** — done / abandoned / partial
- **Forces observed** — Push/Pull/Habit/Anxiety/Competes/Fired
- **Issues created or updated** — numbers and categories
- **Metrics** — at least one measurement to `wiki/metrics/{skill}/` per the
  [`kata-metrics`](../kata-metrics/SKILL.md) protocol. See
  `references/metrics.md`.
