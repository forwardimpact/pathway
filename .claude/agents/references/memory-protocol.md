# Memory Protocol

This file governs **agent memory and action routing** — what to read, how reads
feed into action selection, and what to write. For non-wiki outputs see
[coordination-protocol.md](coordination-protocol.md).

## Memory Tiers

```mermaid
graph TD
  A[Agent Startup] --> T1[Tier 1 — Always]
  T1 --> F1["wiki/{self}.md"]
  T1 --> F2[wiki/MEMORY.md]
  T1 --> F3["wiki/storyboard-YYYY-MNN.md (if exists)"]
  A --> T2[Tier 2 — Opt-In]
  T2 --> F4["Teammate summaries"]
  T2 --> F5["Weekly logs"]
```

**Tier 1 (always, every run):** own summary, MEMORY.md, current storyboard —
three files that do not grow with agent count or week count.

**Tier 2 (opt-in):**

- **Teammate summaries** — read only when coordinating with a named agent or
  investigating a priority-index item that names them.
- **Weekly logs** — read only when the skill is `kata-wiki-curate` or
  `kata-session`, or when explicitly investigating a historical decision.

Skills that need Tier 2 files declare it in their own Step 0.

## Action Routing

Tier 1 reads feed the agent's Assess order. After reading all Tier 1 files,
apply this priority scheme — the first level with actionable work wins:

1. **Owned priorities.** MEMORY.md Cross-Cutting Priorities where you are
   `Owner`. These are team commitments assigned to you — they preempt
   domain-specific work.
2. **Storyboard items.** Per-agent deliverables in the current storyboard and
   open experiment issues labeled `agent:{self}`.
3. **Domain assess.** The numbered steps in your agent profile's Assess section.
4. **Cross-cutting fallback.** MEMORY.md items listing you under `Agents` (not
   Owner) where you can contribute. Report clean only after checking all four.

The `### Decision` block records which level produced the chosen action.

## During Each Run

Append a new `## YYYY-MM-DD` section at the end of the current week's log:

- **File:** `wiki/{agent}-$(date +%G-W%V).md`
- **Heading:** `# {Agent Title} — YYYY-Www` (create the file if missing)
- **Cadence:** one file per ISO week

Use `###` subheadings for the fields skills specify to record. Every run must
open with a `### Decision` subheading containing:

| Field            | Record                                                 |
| ---------------- | ------------------------------------------------------ |
| **Surveyed**     | What was checked at each routing level and the results |
| **Alternatives** | What actions were available                            |
| **Chosen**       | What action was selected and which skill was invoked   |
| **Rationale**    | Why this action over the alternatives                  |

## Each Run

Read the `## Message Inbox` (first H2 of the file) for incoming memos from
teammates. Triage each before working: act on it, promote it to MEMORY.md, or
remove if obsolete.

After the run, update `wiki/{agent}.md` with:

1. Actions taken
2. Open blockers

To send memos to other agents, use `fit-wiki memo --from <you> --to <recipient>
--message "..."` rather than hand-editing any inbox.

## Summary Contract

Each `wiki/<agent>.md` conforms to a mechanically-checkable contract.

**Permitted sections (in order):**

1. `# {Agent Title} — Summary` (H1, exactly one)
2. `**Last run**:` line — date and one-line description (may be followed by
   directly attached caveats or blockquotes about that run)
3. `## Message Inbox` — incoming memos from teammates not yet promoted to
   the priority index. **MUST be the first H2 in the file** so on-boot
   scanning surfaces it before state-heavy sections. Begins with the marker
   `<!-- memo:inbox -->` directly under the heading; `fit-wiki memo` writes
   new bullets immediately after it (newest-first within the section). When
   the inbox is empty, leave a single line `- *No new messages.*` under the
   marker so the section reads cleanly.
4. Agent-specific state section(s) using H2
5. `## Open Blockers` — currently-blocking items only

**Bullet format:** `- YYYY-MM-DD from **<sender>**: <message>`. The bold name
is the SENDER; the file owner is the RECIPIENT. Newest memos sort first;
undated legacy bullets (from the pre-`fit-wiki memo` migration) sort to the
bottom of the section.

**Excluded from summaries** (with correct homes):

- Historical audit data (previously tracked PRs, resolved blockers, evaluation
  history) → weekly log
- Storyboard commitments → storyboard file
- Policy clarifications → CONTRIBUTING.md or skill docs
- Metrics tables → CSV under `wiki/metrics/{skill}/`

**Line budget: 80 lines.** Checked mechanically: `wc -l wiki/<agent>.md ≤ 80`.
Summaries are state, not history. The line budget forces the discipline.

## Weekly Log Contract

Weekly logs (`wiki/<agent>-YYYY-Www.md`) are:

- **Append-only audit records** — no edits to past entries except format fixes.
- **Tier 2** — not in the default startup load.
- **Named readers:** `kata-wiki-curate` (always), `kata-session` (for experiment
  verification), agents explicitly investigating past decisions.
- **Format:** `## YYYY-MM-DD` / `### {Subsection}` structure.
- **No line budget** — write-once records off the critical startup path.

## Cross-Cutting Priority Index

`wiki/MEMORY.md` is the canonical location for cross-cutting items that affect
multiple agents or the whole team.

**Schema:** table row with fields Item / Agents / Owner / Status / Added.
Maximum 10 active entries. Explicit empty state: a row reading
`| *None* | — | — | — | — |` (distinguishes "no items" from "not tracked yet").

`kata-wiki-curate` is the authoritative writer; any agent may propose an entry
but the curator verifies. Resolved items are removed within one curation cycle.

**Entry lifecycle:**

- **Add** — Finding affects ≥2 agents and persists beyond the run that surfaced
  it. Link the GitHub artifact (Issue, PR, Discussion) that carries the
  permanent record.
- **Update** — Ownership transfers (change Owner) or material progress lands
  (change Status: PR opened, PR merged, blocker cleared).
- **Remove** — Underlying problem resolved; the linked GitHub artifact is the
  permanent record. Do not keep resolved entries.
