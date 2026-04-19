# Plan 260: Improvement Coach Context Efficiency

**Prerequisite:** Design approved — PR #420 merged to main (commit `46df86a0`).

## Approach

Two markdown insertions — one in the improvement-coach agent profile, one in
CONTRIBUTING.md. No code, no new files, no tests. The intervention is
instructional: tell the agent what to read before it reaches for the expensive
tool. The convention in CONTRIBUTING.md establishes the pattern for all agent
profiles; the profile change applies it specifically to the improvement coach.

**Why instruction over mechanism:** The agent already has access to the right
context (CLAUDE.md is loaded). The problem is decision-making, not capability.
Adding a ranked hierarchy of context sources costs nothing and is immediately
verifiable through trace observation.

**Success criteria mapping:** The spec defines three measurable outcomes —
sessions within 50 turns, initial context <20K tokens, no quality regression.
Both insertions target the first two (reducing wasted turns and tokens by
redirecting the agent to loaded context). The third (quality) is preserved by
the positive-list design — Explore remains available for legitimate uses.

## Steps

### Step 1: Add Context Hierarchy to improvement-coach profile

**File:** `.claude/agents/improvement-coach.md`

**Action:** Insert a new `## Context Hierarchy` section between the existing
`## Voice` section (ending with the "Sign every GitHub comment..." line) and
`## Constraints` section. The insertion point is the blank line between the two
sections — replace it with the new section bracketed by blank lines.

**Spec deviation note:** The spec's Design section suggested a
`### Step 0: Establish Context` inside the Process section. The approved design
(design.md § Key Decisions) moved this to a dedicated `## Context Hierarchy`
section between Voice and Constraints, because the problem occurs during initial
orientation before any skill step runs.

**Content to insert** (between `## Voice` and `## Constraints`):

```markdown
## Context Hierarchy

Before launching any exploration, exhaust context sources in order:

1. **System prompt** — already loaded. Contains session configuration, tool
   descriptions, and CLAUDE.md content.
2. **CLAUDE.md** — already loaded. Comprehensive system documentation: products,
   architecture, distribution model, domain concepts, documentation map. Read it
   for architectural and structural questions.
3. **Direct file reads** — Use Read, Glob, and Grep tools for specific lookups:
   finding a file by path, checking current content, searching for a symbol.
4. **Explore subagent** — last resort. Only warranted for:
   - Specific implementation details not covered in CLAUDE.md or system docs
   - Pattern searches spanning many files where Grep alone is insufficient
   - Questions requiring reading and synthesizing multiple source files

An Explore subagent costs 40-70K tokens. Steps 1-3 are effectively free. When
tempted to launch Explore, first check whether the answer is already in context.
```

**Why this placement:** The design chose a dedicated section between Voice and
Constraints because the problem occurs before any skill is invoked — during
initial session orientation. This ensures the agent internalizes the hierarchy
at profile load, not mid-skill.

### Step 2: Add Agent Context Efficiency convention to CONTRIBUTING.md

**File:** `CONTRIBUTING.md`

**Action:** Insert a new `### Agent Context Efficiency` subsection under
`## Core Rules`, between the `### Invariants` subsection (ending with the
`- **No frameworks** —` bullet) and `### READ-DO`. The insertion point is the
blank line between the two sections — replace it with the new section bracketed
by blank lines.

**Content to insert** (between `### Invariants` and `### READ-DO`):

```markdown
### Agent Context Efficiency

Agents operate under token and turn budgets. Context that is already loaded
should not be re-fetched through expensive subagents.

When writing agent profiles, follow the **read first, explore second** pattern:

1. **Instruct agents to read loaded context first** — CLAUDE.md provides
   comprehensive system documentation and is injected into every session. Most
   architectural questions are answered there.
2. **Specify when exploration is appropriate** — Explore subagents cost 40-70K
   tokens per invocation. Reserve them for specific searches that cannot be
   answered by reading known files.
3. **Rank context sources explicitly** — List the escalation order in the agent
   profile so the agent knows where to look before reaching for the next tier.

The improvement-coach profile's Context Hierarchy section is the reference
implementation of this pattern.
```

**Why after Invariants:** Invariants are architectural non-negotiables. Agent
Context Efficiency is a contributor convention — it sits at the same level of
authority within Core Rules but is about agent authoring rather than code
structure. Placing it before the checklists keeps rules together before the
procedural gates.

### Step 3: Verify formatting

Run `bun run check` to confirm both files pass Prettier and lint rules. Prettier
is configured for `.md` files with `proseWrap: always` (see `.prettierrc`), so
it will validate markdown formatting. After Prettier passes, manually verify
that blank lines separate the new sections from their neighbours — Prettier
enforces line width but not all heading-spacing conventions.

### Step 4: Cross-reference and success criteria verification

Confirm that:

- The improvement-coach profile's Context Hierarchy implements the
  CONTRIBUTING.md convention (ranked context sources, positive list of Explore
  uses)
- The CONTRIBUTING.md convention names the improvement-coach profile as the
  reference implementation
- No other agent profiles are modified (out of scope per spec)
- The changes are verifiable against the spec's success criteria through
  existing trace infrastructure: turn count (<50), token consumption for initial
  context (<20K), and analysis quality (no regression) — all measurable in the
  improvement-coach's next coaching cycle without new tooling

## Blast Radius

| Action   | File                                  |
| -------- | ------------------------------------- |
| Modified | `.claude/agents/improvement-coach.md` |
| Modified | `CONTRIBUTING.md`                     |
| Created  | None                                  |
| Deleted  | None                                  |

Two files, two insertions. No existing content is moved or deleted.

## Ordering and Dependencies

Steps 1 and 2 are independent — either can be done first. Step 3 depends on both
being complete. Step 4 is a read-only verification after steps 1-2.

## Risks

1. **CONTRIBUTING.md merge conflict.** High-traffic file. Other branches may
   touch the Core Rules section. Mitigation: the insertion is a self-contained
   new subsection between two existing ones — conflicts are structurally limited
   to adjacent-line changes in Invariants or READ-DO.

2. **Agent non-compliance.** The intervention is instructional, not mechanical.
   If the model ignores the hierarchy, token waste continues. Mitigation: the
   improvement-coach's own coaching cycle (kata-trace + kata-storyboard) will
   detect continued Explore overuse in subsequent traces and can escalate to a
   follow-up spec.

3. **Scope creep into other agent profiles.** The spec explicitly scopes this to
   the improvement-coach. Other profiles should adopt the convention
   independently in future work. The plan does not touch them.

## Libraries Used

None. Both changes are documentation/instruction changes to markdown files. No
shared libraries are consumed.

## Execution

Single `staff-engineer` agent, sequential execution. The plan is small enough
(two markdown insertions + formatting check) that decomposition provides no
benefit. Estimated implementation: <15 minutes, well within a single session.

**Routing note:** CONTRIBUTING.md falls under `technical-writer` territory per
kata-plan convention. However, the CONTRIBUTING.md change is a single subsection
that codifies an agent-authoring pattern — it is architecturally motivated and
tightly coupled to the agent profile change (which is infrastructure). Splitting
into two parts for two agents would add coordination overhead that exceeds the
work itself. The `staff-engineer` executes both as a single unit.
