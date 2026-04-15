# Kata

> "What does the pattern of the Improvement Kata give us? A means for
> systematically and scientifically working toward a new desired condition, in a
> way that is appropriate for the unpredictability and uncertainty involved."
>
> — Mike Rother, _Toyota Kata_

Kata is the Forward Impact repo self-maintenance system: autonomous agents
running on GitHub Actions that keep the codebase secure, release-ready, and
steadily improving. The name comes from Toyota Kata — the improvement kata
pattern of _understand the direction_, _grasp the current condition_, _establish
the next target condition_, and _experiment toward it_. Kata agents grasp the
current condition (by analyzing execution traces of prior runs), establish
target conditions (via specs), and experiment toward them (via implementation).
Seven workflows — five individual agent runs, one daily team meeting, and one
on-demand coaching session — six agent personas, and nineteen skills form a
self-reinforcing PDSA cycle.

## Architecture

```mermaid
graph LR
    W["Workflows<br/>.github/workflows/"] --> A["Agents<br/>.claude/agents/"] --> S["Skills<br/>.claude/skills/"]
```

**Workflows** define schedule, trigger, and permissions. **Agents** define
persona, scope constraints, and skill composition. **Skills** define procedures,
checklists, and domain knowledge.

All workflows share two composite actions:

- `bootstrap/` — sets up Bun and installs dependencies.
- `kata-action/` — runs a task against an agent profile via `fit-eval`, captures
  the execution trace as NDJSON, and uploads it as an artifact.

## The PDSA Loop

Every workflow belongs to a phase of the **Plan-Do-Study-Act** cycle (after
Deming). Findings from Study always re-enter the loop as specs or fix PRs —
nothing is observed without a downstream action.

```mermaid
graph LR
    P["Plan"] --> D["Do"] --> S["Study"] --> A["Act"] --> P
```

- **Plan** — Turn approved `spec.md` (WHAT/WHY) into `design.md` (WHICH/WHERE)
  and then `plan-a.md` (HOW/WHEN) with steps, files, sequencing, and risks.
- **Do** — Execute plans via implementation PRs. Run scheduled workflows that
  harden, release, and maintain the codebase. Every run captures a full
  execution trace.
- **Study** — Analyze outputs from Do. Four streams: security posture audits,
  external feedback triage, documentation review (one topic deep per cycle), and
  trace analysis (one trace deep per cycle via grounded theory).
- **Act** — Convert findings into action. Trivial findings become fix PRs
  directly; structural findings become new `spec.md` documents entering the
  backlog. Fix PRs (`fix/` branches) and specs (`spec/` branches) are never
  mixed.

## Agents

Six agent personas, each with explicit scope constraints — when a finding
exceeds an agent's scope, it writes a spec rather than attempting the fix.

| Agent                 | Phase          | Purpose                                                                 |
| --------------------- | -------------- | ----------------------------------------------------------------------- |
| **staff-engineer**    | Plan, Do       | Own the full spec -> design -> plan -> implement arc for approved specs |
| **release-engineer**  | Do             | Keep PR branches merge-ready, repair trivial CI, cut releases           |
| **security-engineer** | Do, Study, Act | Patch dependencies, harden supply chain, enforce security policies      |
| **product-manager**   | Do, Study, Act | Triage issues and PRs, merge fix/bug/spec PRs, run evaluations          |
| **technical-writer**  | Study, Act     | Review docs for accuracy, curate wiki, fix staleness, spec gaps         |
| **improvement-coach** | Study          | Facilitate storyboard meetings and 1-on-1 coaching sessions             |

## Workflows

Seven workflows: five individual agent runs spanning 04–09 UTC, one daily team
meeting at 03:00 UTC, and one on-demand coaching session. Times respect ordering
constraints (team meeting before individual runs, security before product,
product before planning, planning before release). Off-minute schedules avoid
API load spikes. All support `workflow_dispatch`, use concurrency groups, and
have a 30-minute timeout. Individual agent workflows send a generic task prompt;
the agent's Assess section determines the actual action. The daily meeting and
coaching session send specific task prompts to the improvement coach as
facilitator.

| Workflow              | Schedule            | Agent                                    |
| --------------------- | ------------------- | ---------------------------------------- |
| **daily-meeting**     | Daily 03:00 UTC     | improvement-coach (facilitates 5 agents) |
| **coaching-session**  | `workflow_dispatch` | improvement-coach (facilitates 1 agent)  |
| **security-engineer** | Daily 04:07 UTC     | security-engineer                        |
| **technical-writer**  | Daily 05:37 UTC     | technical-writer                         |
| **product-manager**   | Daily 06:23 UTC     | product-manager                          |
| **staff-engineer**    | Daily 07:11 UTC     | staff-engineer                           |
| **release-engineer**  | Daily 08:43 UTC     | release-engineer                         |

## Skills

All Kata skills use the `kata-` prefix. Each owns exactly one PDSA phase (or
none for utilities). Reading an agent's skill list reveals its phase coverage.

**Plan**

- `kata-design` — specs -> architectural design documents (max 200 lines)
- `kata-plan` — designs -> executable plans

**Do**

- `kata-implement` — execute plans step by step
- `kata-security-update` — Dependabot triage, vulnerability fixes
- `kata-release-readiness` — rebase, lint fix
- `kata-release-review` — version bumps, tagging, publish verification

**Study**

- `kata-security-audit` — seven-area security review
- `kata-product-triage` — issue classification
- `kata-product-classify` — PR mergeability gate
- `kata-product-evaluation` — user testing sessions
- `kata-documentation` — one topic deep per run
- `kata-wiki-curate` — agent memory hygiene
- `kata-trace` — go and see the work agents did via trace analysis and grounded
  theory

**Act**

- `kata-spec` — write specs capturing WHAT/WHY

**Utility**

- `kata-gh-cli` — GitHub CLI patterns for CI
- `kata-review` — grade a single artifact (leaf skill, never spawns sub-agents)
- `kata-ship` — rebase, push, open PR, merge a feature branch

## Trust Boundary

The product manager is the sole external merge point. All other merge paths
operate on trusted sources (our agents, Dependabot).

```mermaid
graph TD
    EXT["External PR"] --> PM["Product Manager<br/>trust + CI gate"]
    ISS["External Issue"] --> PM
    PM -- "merge fix/bug/spec" --> CB["Codebase (main)"]
    style PM fill:#a855f7,stroke:#7c3aed,color:#fff
    CB -- "approved spec" --> TA["Trusted Agents<br/>plan + implement"]
    TA --> CB
    SE["Security Engineer"] -- "Dependabot" --> CB
    RE["Release Engineer"] -- "rebase + release" --> CB
```

| External PR type | What merges                     | Who implements                        |
| ---------------- | ------------------------------- | ------------------------------------- |
| `fix` / `bug`    | Contributor's code (small)      | The external contributor              |
| `spec`           | Specification document only     | Trusted agents, never the contributor |
| Everything else  | Nothing — requires human review | N/A                                   |

Top-7 contributors pass the trust gate. CI app PRs (`forward-impact-ci`) are
trusted by identity. Even a compromised top contributor cannot inject code
through the autonomous pipeline — specs merge only the document, not code.

## Design Principles

- **PDSA over pipeline.** Findings from Study always re-enter the loop.
- **Fix-or-spec discipline.** Mechanical fixes and structural improvements never
  share a PR.
- **Explicit scope constraints.** Each agent knows what it must _not_ do.
- **Trace-driven observability.** Every workflow captures a trace. The
  improvement coach must quote specific evidence — no speculation.
- **Least privilege.** Read-only workflows use `contents: read`. Write workflows
  use scoped per-run installation tokens.
- **Main branch CI repair.** See CONTRIBUTING.md for the release engineer's
  direct-to-`main` exception.

## Shared Memory

Agents share persistent memory via the **GitHub wiki** at `wiki/`. Cloned on
demand and synced by `just wiki-pull` (on `SessionStart`) and `just wiki-push`
(on `Stop`).

Each agent maintains two file types:

- **Summary** (`<agent>.md`) — latest state: coverage, backlog, blockers,
  teammate observations.
- **Weekly log** (`<agent>-<YYYY>-W<VV>.md`) — one file per agent per week,
  keyed by ISO week-year.

Every scheduled run reads the summary and current week's log before acting,
appends findings to the log, and updates the summary at the end. Entry-point
skills must include a read step and a "Memory: what to record" section.
Sub-skills and utility skills are exempt.

## Metrics

Agents record time-series data to `wiki/metrics/{agent}/{domain}/{YYYY}.csv`
after each run. The `kata-metrics` skill defines the CSV schema (six fields:
date, metric, value, unit, run, note), storage convention, and metric design
guidance. Each entry-point skill carries a `references/metrics.md` suggesting
domain-specific metrics.

Metrics serve the coaching cycle: the team storyboard meeting (see Workflows
table) uses metric data to answer "what is the actual condition now?" with
numbers rather than narratives. Process behavior charts (XmR) built from the
time series distinguish stable processes from those reacting to special causes.

## Authentication

Workflows authenticate via the **GitHub App** (`forward-impact-ci`), not a PAT.
Each run generates a short-lived installation token (1-hour expiry) via
`actions/create-github-app-token` — no long-lived secrets to rotate. The token
generates before `actions/checkout` so the checkout token triggers downstream
workflows.

## Accountability

Cross-agent accountability runs through the `kata-trace` skill's invariant
audit. Domain agents verify their own per-agent invariants against their own
traces during 1-on-1 coaching sessions facilitated by the improvement coach —
e.g., that the product manager ran a contributor lookup before marking any
non-CI-app PR mergeable. The canonical invariant list lives in
`.claude/skills/kata-trace/references/invariants.md`. High-severity audit
failures must result in a fix PR or spec.

## Authoring Best Practices

Lessons from trace analysis of agent workflow runs.

### Instruction layering

Agent instructions span five layers, each owning a distinct concern:

1. **libeval system prompt** — relay mechanics (how turns work, completion)
2. **workflow task** — this run (which product, scenario, success criteria)
3. **agent profile** — who you are (persona, voice, skill routing, constraints)
4. **skills** — how to do it (procedures, templates, domain knowledge)
5. **checklists** — did you do it (yes/no verification at pause points)

Layers 4 and 5 coexist in the same file (SKILL.md) but serve fundamentally
different purposes. Skill instructions are _procedural_ — they teach, explain,
and guide decisions. Checklists are _verificational_ — each item is a binary
assertion that a prior step was completed, with no explanation of how.

Rules:

- No layer restates another's content. When two layers mention the same tool,
  use voice to separate them: layer 1 describes what a tool is ("ToolX sends a
  message to ThingY"), layer 4 directs when to use it ("Use ToolX to deliver the
  quarterly finance report to ThingY").
- Agents follow the most specific layer. A skill that provides a complete
  procedure makes system-level tool descriptions invisible — tools not named in
  the skill procedure will not be used regardless of what layer 1 says.
- Tasks name skills — they don't copy steps. Shared procedures belong in skills;
  per-run details belong in tasks.
- Profiles define boundaries; skills define steps; checklists verify steps.
- A checklist item must never teach how to do something — that belongs in the
  skill procedure above it. If a checklist item needs explanation, the procedure
  is incomplete.

### Skill structure

SKILL.md is read on every run — aim for ~200 lines or fewer. Move supporting
material into co-located subdirectories:

```text
.claude/skills/<skill-name>/
  SKILL.md                     <- core instructions (always loaded)
  scripts/<name>.sh|.mjs       <- executable automation
  references/<name>.md         <- templates, examples, data tables
```

SKILL.md holds the decision-making procedure. `scripts/` holds repeatable
commands the agent runs verbatim. `references/` holds content the agent reads on
demand. Some skills are entirely instructional with nothing to extract — that's
fine. Entry-point skills include tagged checklists as verification gates (see
below).

### Checklists

Checklists are the lowest instruction layer — they verify that higher layers
were followed without restating them. Two tagged types serve as gates at natural
pause points:

- **`<read_do_checklist>`** — Entry gate. Read each item, then do it.
- **`<do_confirm_checklist>`** — Exit gate. Do from memory, then confirm every
  item before crossing a boundary.

The boundary between skill procedure and checklist is strict: if the agent needs
the checklist item to _learn_ what to do, the item belongs in the procedure. If
the agent already knows what to do and the item only confirms it was done, it
belongs in the checklist. Duplicating procedural guidance into checklist items
bloats the document and creates contradiction risk when one copy is updated
without the other.

Keep checklists short (5–9 items), action-oriented, and free of explanation.
Entry-point skills embed domain-specific checklists; universal checklists live
in CONTRIBUTING.md. See [CHECKLISTS.md](CHECKLISTS.md) for design rules, type
selection, and authoring guidance.

### Recursion-safe self-review

Skills requiring independent review of their output must spawn a fresh sub-agent
targeting a **leaf skill** (`kata-review`) whose process never spawns further
sub-agents. This prevents infinite recursion. Defense-in-depth: the parent's
review step also tells the sub-agent "do not invoke this skill."

### Shared patterns

Use identical wording for shared structural elements (memory instructions,
prerequisites, section headings) across all agents and skills. Inconsistent
wording correlated with agents skipping steps in trace analysis.

### SDK caveat

`resume()` does not persist `permissionMode` across resume boundaries — always
pass all session configuration again when calling `resume()`.
