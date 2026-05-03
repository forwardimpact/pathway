# Co-Aligned Teams of Humans & Coding Agents

This is the design manifest for creating aligned coding agents. It draws on two
well-publicized ideas:

1. **Jobs To Be Done** (Christensen, Moesta) — agents align to the progress
   each persona seeks in specific circumstances, not to feature lists. See
   [JTBD.md](JTBD.md).
2. **The Checklist Manifesto** (Gawande) — complex work fails not from ignorance
   but from inattention under load. Structured instructions ensure existing
   knowledge is consistently applied — by humans and agents alike.

Together they answer _what_ agents align to (the jobs) and _how_ alignment
holds under load (the layered instruction architecture). The more expert the
contributor, the more this matters: beginners follow procedures because they
must; experts skip them because they think they don't need to.

## The Layers

Instructions span seven layers, ascending from most general (every contributor,
every run) to most specific (one pause point). Each layer has one job. A defect
in one layer is a different class of problem from a defect in another, and trace
attribution depends on the separation.

0. **System prompt** — harness mechanics: turns, tool calls, completion
   signalling.
1. **CLAUDE.md** — project identity: goal, users, products, distribution, doc
   map.
2. **CONTRIBUTING.md** — contribution standards: invariants, technical rules,
   quality gates, git, security. **JTBD.md** — jobs each persona hires products
   to do.
3. **Agent profile** — persona, voice, skill routing, scope constraints.
4. **Skill procedure (SKILL.md)** — decision-making, sequencing, rationale.
5. **Skill references (`references/`)** — data the procedure consults:
   templates, worked examples, invariant tables, lookup data.
6. **Checklists** — binary verification at pause points, no explanation. In
   SKILL.md (domain) or CONTRIBUTING.md (universal).

L4/L5/L6 share a skill folder but serve different concerns: L4 is _procedural_,
L5 is _declarative_, L6 is _verificational_. Trace attribution requires the
separation — "wrong procedure" is a different class of defect from "stale data"
or "missing verification."

### Tagging for Progressive Discovery

Jobs and checklists are distributed across the codebase — Big Hires in JTBD.md,
Little Hires in product READMEs, checklists in SKILL.md files and
CONTRIBUTING.md. Semantic tags (`<jobs>`, `<read_do_checklist>`,
`<do_confirm_checklist>`) make them discoverable without knowing where they live:

```sh
rg '<jobs '                 # Big Hires in JTBD.md, Little Hires near the code
rg '<read_do_checklist'     # Entry gates — read each item, then do it
rg '<do_confirm_checklist'  # Exit gates — do from memory, then confirm
```

- Tag attributes (`user`, `goal`) make search results self-describing —
  each match shows purpose without opening the file.
- Keep the full opening tag on one line within 74 characters so `rg`
  output stays coherent.

### Layer Rules

- No layer restates another. When two layers mention the same tool, separate by
  voice: L0 describes ("ToolX sends a message"), L4 directs ("Use ToolX to
  deliver the report").
- Contributors follow the most specific layer — a complete skill procedure makes
  system-level tool descriptions invisible.
- CLAUDE.md orients (what, who, where); CONTRIBUTING.md governs (invariants,
  quality commands, policies); domain procedures live in skills.
- Profiles define boundaries; procedures define steps; references supply data;
  checklists verify steps.
- A checklist item must never teach. If an item needs explanation, the procedure
  above it is incomplete.

## L0 — System Prompt

Loaded once per session by the harness — Claude Code's own prompt for
interactive runs or `libeval` prompt for agent workflows.

### Properties of Good System Prompts

1. **Mechanics only.** Turns, tool calls, completion signalling. No domain
   knowledge, no project context.
2. **Harness-specific.** Each runtime supplies its own; contributors never edit
   these directly.
3. **Invisible downstream.** The most specific layer overrides — a system prompt
   should never compete with a skill procedure.

## L1 — Project Identity (CLAUDE.md)

Auto-loaded via `settingSources: ["project"]`. Orients every contributor on
every run.

### Properties of Good Project Identity

1. **Orients, doesn't govern.** Answers what, who, where. Rules and policies
   belong in L2.
2. **Navigation hub.** Points to everything, restates nothing. A link is cheaper
   than a duplicate.
3. **Stable.** Changes rarely — frequent churn means content belongs elsewhere.
4. **Budget-conscious.** Every line loads on every run. If a section is only
   relevant to one workflow, push it to L2 or L4.
5. **Surfaces the tagging conventions.** Includes a section that briefly
   explains checklists and jobs, and how to discover them (`rg '<jobs '`,
   `rg '<read_do_checklist'`).

## L2 — Contribution Standards & Jobs

CONTRIBUTING.md and JTBD.md are read on demand, not auto-loaded. One governs
how contributors work; the other captures what progress each persona seeks.

### Properties of Good Contribution Standards

1. **Rules, not procedures.** What to do and what not to do — step-by-step
   sequencing belongs in L4.
2. **Universal scope.** Every item applies to every contribution. Workflow-
   specific rules belong in the skill that owns that workflow.
3. **Verifiable.** Each rule should be checkable — by a human, a script, or a
   checklist item. Aspirational guidance that can't be verified drifts.

### JTBD Entry Structure

Each entry in [JTBD.md](JTBD.md) follows a fixed structure. Every element is
required.

- **User** — persona hiring the product (`##` heading).
- **Goal** — high-level progress sought (`###` heading).
- **Trigger** — a specific moment that creates the job, not a role description.
- **Jobs** — "Help me {progress}." statements, each pointing to the product,
  service or library hired (→ **Thing**). Two or three per goal.
- **Competes With** — what currently gets hired instead; semicolon-delimited.
- **Forces** — four forces: **Push** (status quo pain), **Pull** (desired
  future state, not features), **Habit** (current behavior resisting change),
  **Anxiety** (fear blocking adoption).
- **Fired When** — conditions under which the product gets abandoned; include
  at least one environmental shift beyond product failure.

### Properties of Good JTBD Entries

Drawing from Christensen and Moesta's methodology:

1. **Progress, not features.** "Help me make staffing decisions I can defend" is
   a job. "Help me run what-if staffing scenarios" is a feature request wearing
   job syntax. If removing the product arrow makes the statement meaningless,
   the job is too solution-shaped.

2. **Trigger is a moment, not a role.** "Starting the third project that needs
   the same plumbing" is a moment. "Building systems consumed by both humans and
   agents" is a role description. A good trigger answers "what just happened?"

3. **Competing hires include nonconsumption.** Every Competes With list must
   include a "hire nothing" option. Nonconsumption is usually the real
   incumbent.

4. **Pull describes a desired future, not a feature list.** "Confidence that a
   staffing change strengthens the team" is a future state. "System-level team
   views and what-if scenarios" is a feature list.

5. **Forces are asymmetric.** One force often dominates. If all four feel
   equally weighted, the analysis was filled in from a template rather than
   reconstructed from a decision story.

6. **Fired When includes the world, not just the product.** Products get
   abandoned when the environment shifts — a reorg, a budget cut, a tool ban.

7. **Field-validated, not desk-authored.** JTBD entries are hypotheses until
   confirmed by customer struggle stories. An entry that surprises the product
   team is more likely correct than one that confirms existing assumptions.

### Tagging Convention

**Big Hires** live in [JTBD.md](JTBD.md) — the full entry structure above,
one per persona-outcome pair. **Little Hires** can live anywhere — product
READMEs, skill files, design docs — capturing narrower jobs closer to the code
that serves them. Wrap both in a semantic tag for discoverability:

```markdown
<jobs user="Leadership" goal="Staff Teams to Succeed">

**Trigger:** A post-mortem surfaces the same skill gap that caused the last
incident.

**Jobs:**
- Help me spot capability gaps before someone gets set up to fail. → **Summit**

</jobs>
```

## L3 — Agent Profile

Auto-loaded every run. Defines the agent's persona, voice, skill routing, and
scope constraints.

### Properties of Good Agent Profiles

1. **Boundaries, not steps.** Defines scope and persona — task procedures belong
   in L4.
2. **One persona per profile.** Mixing personas creates ambiguity about voice,
   scope, and accountability.
3. **Minimal.** Every line loads on every run. Include scope constraints and
   skill routing; push everything else to L4 or L5.

## L4 — Skill Procedure (SKILL.md)

Auto-loaded per skill invocation. The procedure is the complete instruction set
for one domain.

### Properties of Good Skill Procedures

1. **Complete for its domain.** A contributor following only the procedure
   produces correct output — no tribal knowledge required.
2. **Imperative voice.** Directs action ("Use X to do Y"), not describes
   capability ("X can be used to do Y").
3. **Decision-making, not data.** Sequencing, rationale, and judgment calls.
   Push templates, examples, and data tables to L5.
4. **Self-contained at invocation.** Auto-loaded, no external reads required to
   begin work. References are consulted mid-procedure, not prerequisites.

## L5 — Skill References

Read on demand when the procedure calls for them. Co-located in
`references/<name>.md` or `scripts/<name>.sh|.mjs`.

### Properties of Good References

1. **Declarative, not procedural.** Templates, worked examples, invariant
   tables, lookup data. Prescribing steps belongs in L4.
2. **Independently correct.** A stale reference is a different defect class from
   a wrong procedure — trace attribution requires the separation.
3. **On-demand only.** Never auto-loaded. If a reference is always needed, its
   content should move into the procedure.

## L6 — Checklists

Binary verification at pause points. Two types gate natural pause points; using
the wrong type at the wrong moment undermines the checklist's purpose.

**READ-DO — Entry Gates.** Read each item, then do it. Use before work begins —
when the contributor needs to internalize constraints before the first line.
Steps are sequential; missing any one sends work in the wrong direction.

**DO-CONFIRM — Exit Gates.** Do from memory, then pause and confirm every item.
Use at natural pause points — before a commit, merge, or release. Items are
independent checks; skilled contributors work fluidly, not interrupted mid-flow.

| Moment                   | Type       | Purpose                      |
| ------------------------ | ---------- | ---------------------------- |
| Before starting work     | READ-DO    | Load constraints into memory |
| Before crossing boundary | DO-CONFIRM | Verify nothing was missed    |

The boundary with L4 is strict: if a contributor needs an item to _learn_ what
to do, it belongs in the procedure; if it only confirms a known step was done,
it belongs in the checklist.

### Properties of Good Checklists

Drawing from Gawande's findings:

1. **Goal statement.** Every checklist begins with a stated goal — the outcome
   it protects. Without a goal, compliance becomes mechanical box-checking.

2. **5–7 items.** Working memory limits. Beyond 7 items, contributors skip
   entries or treat the list as formality.

3. **Precise.** Each item is a single, unambiguous action or verification. Two
   contributors should interpret each item the same way.

4. **Killer items only.** Every item addresses a failure mode that has actually
   occurred or is highly likely. A list full of obvious steps wastes attention.

5. **Action or verification, never explanation.** A verb phrase, not a
   paragraph. If it needs explanation, the contributor needs training.

6. **One checklist, one moment.** Tied to a single pause point. The pause point
   must be natural — artificial ones get skipped.

7. **Tested and revised.** Use it, observe what still goes wrong, revise. A
   stale checklist trains contributors to treat checklists as noise.

### Tagging Convention

Wrap each checklist in a semantic tag encoding its type and goal:

```markdown
<read_do_checklist goal="Internalize constraints before writing code">

- [ ] First constraint to internalize before starting.
- [ ] Second constraint.

</read_do_checklist>
```

```markdown
<do_confirm_checklist goal="Verify completeness before committing">

- [ ] First verification to confirm before proceeding.
- [ ] Second verification.

</do_confirm_checklist>
```

## Length and Loading

Auto-loaded layers consume context on every run; keep them tight. Limits
enforced by `scripts/check-instructions.mjs`:

| Layer                        | Target      | Loaded           |
| ---------------------------- | ----------- | ---------------- |
| L1 CLAUDE.md                 | ≤ 192 lines | auto             |
| L2 CONTRIBUTING.md & JTBD.md | ≤ 256 lines | on demand        |
| L3 Agent profile             | ≤ 64 lines  | auto (every run) |
| L4 SKILL.md                  | ≤ 192 lines | auto (per skill) |
| L5 Skill reference file      | ≤ 128 lines | on demand        |
| L6 Checklist (per block)     | ≤ 9 items   | auto (per skill) |

L6 is gated by item count, not lines — wrapped-line length is a formatting
artifact, not cognitive load.
