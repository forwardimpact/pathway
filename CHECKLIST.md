# Writing Instructions

> "The volume and complexity of what we know has exceeded our individual ability
> to deliver its benefits correctly, safely, or reliably."
>
> — Atul Gawande, _The Checklist Manifesto_

This is the design manifesto for instructions in this repository — how to write
them, where to put them, how long they should be, and how to verify they were
followed. It applies equally to humans and autonomous agents: both face the same
failure modes under load, and benefit from the same countermeasures. Agents
follow instructions literally — a human reads "verify CI passes" and checks the
status page, an agent needs the exact command — which makes precision even more
important when agents share the page.

## Why Instructions Fail

Complex work fails not from ignorance but from inattention under load. Skilled
contributors skip steps they know by heart. A monorepo with multiple products,
autonomous agents, and dozens of contributors is exactly this environment.

Gawande's finding across surgery, aviation, and construction: **the biggest
gains came not from new knowledge but from ensuring existing knowledge was
consistently applied.**

Two root causes recur:

1. **Errors of omission.** Under pressure, people skip steps they know.
   Instructions externalize memory.
2. **Errors of assumption.** Each contributor assumes someone else handled the
   prerequisite. Instructions make handoffs explicit.

The insight is counterintuitive: the more expert the team, the more instructions
help. Beginners follow procedures because they must. Experts skip them because
they think they don't need to — and that is when errors creep in.

## The Layers

Instructions span seven layers, ascending from most general (every contributor,
every run) to most specific (one pause point). Each layer has one job. A defect
in one layer is a different class of problem from a defect in another, and trace
attribution depends on the separation.

0. **System prompt** — harness mechanics: turns, tool calls, completion
   signalling. Loaded once per session by whichever harness is driving the model
   — Claude Code's own system prompt when a contributor runs `claude`, libeval's
   system prompt when an agent workflow runs.
1. **CLAUDE.md** — project identity: goal, users, products, distribution, doc
   map. Auto-loaded via `settingSources: ["project"]`. **JTBD.md** — jobs each
   persona hires products to do. Referenced from CLAUDE.md § Users; read on
   demand.
2. **CONTRIBUTING.md** — contribution standards: invariants, technical rules,
   quality gates, git, security. Referenced by L1; read on demand.
3. **Agent profile** — persona, voice, skill routing, scope constraints.
   Auto-loaded every run.
4. **Skill procedure (SKILL.md)** — decision-making, sequencing, rationale.
   Auto-loaded per skill.
5. **Skill references (`references/`)** — data the procedure consults:
   templates, worked examples, invariant tables, lookup data. Read on demand.
6. **Checklists** — binary verification at pause points, no explanation. In
   SKILL.md (domain) or CONTRIBUTING.md (universal).

L4/L5/L6 share a skill folder but serve different concerns: L4 is _procedural_,
L5 is _declarative_, L6 is _verificational_. L5 earns its own slot because a
defective template is a different class of problem from a defective procedure —
trace attribution must separate "wrong procedure" from "stale data" from
"missing verification". CONTRIBUTING.md likewise spans layers: invariants are
L2; its universal READ-DO and DO-CONFIRM checklists are L6.

### Layer rules

- No layer restates another. When two layers mention the same tool, separate by
  voice: L0 describes ("ToolX sends a message to ThingY"), L4 directs ("Use
  ToolX to deliver the report to ThingY").
- Contributors follow the most specific layer — a complete skill procedure makes
  system-level tool descriptions invisible.
- CLAUDE.md orients (what, who, where); CONTRIBUTING.md governs (invariants,
  quality commands, policies); domain procedures live in skills.
- Profiles define boundaries; procedures define steps; references supply data;
  checklists verify steps.
- A reference is declarative, not procedural — prescribing steps belongs in
  SKILL.md.
- A checklist item must never teach. If an item needs explanation, the procedure
  above it is incomplete.

### Skill Structure

Move supporting material out of SKILL.md into co-located subdirectories.
SKILL.md holds the procedure (always loaded); `scripts/<name>.sh|.mjs` holds
commands run verbatim; `references/<name>.md` holds on-demand content
(templates, examples, data tables). Purely instructional skills with nothing to
extract are fine.

## Length and Loading

Auto-loaded layers consume context on every run; keep them tight so contributors
spend tokens on the task, not boilerplate. Limits enforced by
`scripts/check-instructions.mjs`:

| Layer                    | Target      | Loaded           |
| ------------------------ | ----------- | ---------------- |
| L1 CLAUDE.md & JTBD.md   | ≤ 192 lines | auto / on demand |
| L2 CONTRIBUTING.md       | ≤ 256 lines | on demand        |
| L3 Agent profile         | ≤ 64 lines  | auto (every run) |
| L4 SKILL.md              | ≤ 192 lines | auto (per skill) |
| L5 Skill reference file  | ≤ 128 lines | on demand        |
| L6 Checklist (per block) | ≤ 9 items   | auto (per skill) |

Same principle across layers: keep the main file to its concern; push supporting
material into references or linked docs. L6 is gated by item count, not lines —
wrapped-line length is a formatting artifact, not cognitive load.

## Checklists (L6)

Checklists are the most specific instructional layer. They verify that higher
layers were followed — they do not restate them. Two types serve as gates at
natural pause points; using the wrong type at the wrong moment undermines the
checklist's purpose.

### READ-DO — Entry Gates

**Read each item, then do it.** Use before work begins — when the contributor
needs to internalize constraints before writing the first line.

Use READ-DO when:

- Steps are sequential or form principles that must all be held in mind.
- Missing any single item would send the work in the wrong direction.

### DO-CONFIRM — Exit Gates

**Do from memory, then pause and confirm every item.** Use at natural pause
points — before a commit, merge, or release.

Use DO-CONFIRM when:

- A work phase is complete and the contributor needs to verify completeness.
- Items are independent checks, not sequential steps.
- Skilled contributors should work fluidly, not be interrupted mid-flow.

### The Distinction Matters

A READ-DO used post-hoc is too late — the damage is done. A DO-CONFIRM forced on
every micro-step fragments flow and gets ignored.

| Moment                   | Type       | Purpose                      |
| ------------------------ | ---------- | ---------------------------- |
| Before starting work     | READ-DO    | Load constraints into memory |
| Before crossing boundary | DO-CONFIRM | Verify nothing was missed    |

### Procedure/Checklist Boundary

The boundary is strict: if a contributor needs an item to _learn_ what to do, it
belongs in the procedure (L4); if it only confirms a known step was done, it
belongs in the checklist (L6). Duplicating procedural guidance into checklists
bloats the document and risks contradiction.

Entry-point skills embed domain-specific checklists; universal checklists
(applicable to every contribution) live in CONTRIBUTING.md.

### Properties of Good Checklists

Drawing from Gawande's findings, effective checklists share these properties:

1. **Goal statement.** Every checklist begins with a stated goal — the outcome
   it protects. Without a goal, compliance becomes mechanical box-checking.

2. **5–9 items.** This reflects working memory limits. Beyond 9 items,
   contributors skip entries or treat the list as bureaucratic formality. If a
   checklist exceeds 9 items, split it or question whether every item earns its
   place.

3. **Precise.** Each item is a single, unambiguous action or verification. Vague
   items ("ensure quality") give the illusion of rigor while checking nothing.
   Two contributors should interpret each item the same way.

4. **Killer items only.** Every item must address a failure mode that has
   actually occurred or is highly likely to occur. Include steps that are easy
   to miss and consequential when missed. A list full of obvious steps wastes
   attention on things no one forgets.

5. **Action or verification, never explanation.** A checklist item is a verb
   phrase, not a paragraph. If it needs explanation, the contributor needs
   training — not a longer checklist.

6. **One checklist, one moment.** Each checklist is tied to a single pause point
   in a specific workflow. A checklist that covers multiple moments will be too
   long and too vague. The pause point must be natural — a moment where stopping
   is already expected. If the pause point is artificial, the list gets skipped.

7. **Tested and revised.** A checklist is a living document. Use it, observe
   what still goes wrong, revise. Remove items that never catch errors; add
   items for new failure modes. A stale checklist trains contributors to treat
   checklists as noise.

8. **Owned.** Every checklist has a clear owner — a person or process
   responsible for keeping it current. An unowned checklist decays into
   irrelevance.

### Tagging Convention

Wrap each checklist in a semantic tag that encodes its type and states its goal:

```
<read_do_checklist goal="Internalize constraints before writing code">

- [ ] First constraint to internalize before starting.
- [ ] Second constraint.

</read_do_checklist>
```

```
<do_confirm_checklist goal="Verify completeness before committing">

- [ ] First verification to confirm before proceeding.
- [ ] Second verification.

</do_confirm_checklist>
```

Tags serve three purposes:

1. **Unambiguous type.** The tag name declares READ-DO or DO-CONFIRM — no
   interpretation needed.
2. **Structural boundary.** Separates the checklist from surrounding prose so it
   cannot dissolve into advisory text and lose its forcing-function quality.
3. **Discovery.** Standardized tags enable codebase-wide search:

```sh
rg '<read_do_checklist'     # all entry gates
rg '<do_confirm_checklist'  # all exit gates
```

The `goal` attribute makes results self-describing — each match shows type and
protected outcome without opening the file. Keep the full opening tag on one
line (≤ 80 chars) so `rg` returns the goal in a single match; the formatter
will wrap longer lines.

### Placement

Both types belong **at the top** of the instruction section — READ-DO first,
then DO-CONFIRM. The DO-CONFIRM is _used_ at the end, but seeing it before
starting shapes how you work. Exception: mid-procedure pause points place the
DO-CONFIRM at the pause point.

## Jobs To Be Done (L1)

Each entry in [JTBD.md](JTBD.md) follows a fixed structure. Every element is
required.

- **User** — persona hiring the product (`##` heading).
- **Outcome** — high-level progress sought (`###` heading).
- **Trigger** — a specific moment that creates the job, not a role description.
- **Jobs** — "Help me {progress}." statements, each pointing to a product
  (→ **Product**). Two per outcome.
- **Competes With** — what currently gets hired instead.
- **Forces** — four forces governing adoption:
  - **Push** — what makes the status quo painful.
  - **Pull** — what makes the new solution attractive.
  - **Habit** — current behavior resisting change.
  - **Anxiety** — fear blocking adoption.
- **Fired When** — condition under which the product gets abandoned.
