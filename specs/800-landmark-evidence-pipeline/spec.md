# Spec 800 — Landmark Evidence Pipeline

## Problem

Landmark's evidence-based and manager-scoped views (`readiness`, `evidence`,
`health --manager`, `voice --manager`, `snapshot trend --manager`) either return
empty states or produce unscoped results against every known dataset — synthetic
and real alike. There are two independent root causes:

**1. Synthetic data gaps and a flawed manager-scoping design make Landmark
untestable and its manager-scoped features non-functional.**
A Landmark deep-test against BioNova synthetic data (211 engineers, 7 GetDX
snapshots, 12 820 GitHub events, 312 evidence records) revealed two gaps where
generated data and existing query logic do not match what Landmark needs. Web API
research against the real GetDX API confirmed that one of the gaps is not a
data-generation problem but a design error: the manager-scoping approach
references fields and join paths that do not exist in the GetDX API.

**2. The Guide evaluation pipeline described in
[spec 080](../080-landmark-product/spec.md) was never built.**
Spec 080 specified that Guide interprets GitHub artifacts against skill markers
and writes rows to `activity.evidence`. That pipeline does not exist. Guide is
conversational-only; `activity.evidence` is populated exclusively by the terrain
seed with `rationale: "synthetic"` as a placeholder. Every installation —
including production — has zero real evidence, and Landmark's core value
proposition (growth visible in work, not only in role) cannot be delivered.

Both root causes must be resolved together because the synthetic data fixes are
the test harness for the Guide pipeline: until synthetic data correctly exercises
all Landmark commands, there is no reliable way to verify that Guide-written
evidence produces correct output in those commands.

This spec also removes the initiative and scorecard feature from Landmark. Web
API research shows that GetDX initiatives reference software catalog scorecards
(SQL-checked quality levels for catalog entities — Bronze/Silver/Gold), not
snapshot factors. The `initiative impact` view assumes `scorecard_id` can be
joined to snapshot factor scores; this join has no basis in the GetDX data model
and always produces null deltas. The feature requires a new design before it can
be useful; that belongs in a separate spec.

---

## Personas and Jobs

| Persona | Job | How the gap blocks progress |
|---|---|---|
| Empowered Engineers | Find Growth Areas — check whether recent work shows visible progress toward the next level ([JTBD.md](../../JTBD.md)) | `readiness` and `evidence` return empty states; engineers cannot see whether their artifacts demonstrate marker progress |
| Engineering Leaders | Measure Engineering Outcomes — demonstrate engineering progress without making individuals feel surveilled ([JTBD.md](../../JTBD.md)) | `health --manager` returns all-org data; `voice --manager` returns nothing; leaders cannot scope analysis to their teams |

---

## Part 1 — Data and Design Gaps

### Gap 1 — Manager-scoped views use a join path that does not exist

`voice --manager`, `health --manager`, and `snapshot trend --manager` all scope
their results by looking up a manager's team in `getdx_teams` via
`manager_email`, then filtering scores or comments by `team_id`. Both halves of
this join path are absent from the real GetDX API:

- **`getdx_teams` has no `manager_email`.** The real `teams.list` endpoint
  returns only an opaque `manager_id` (a user identifier), not an email address.
  There is no endpoint that returns email-keyed team membership.

- **GetDX snapshot comments have no `team_id`.** The real
  `snapshots.driverComments.list` endpoint returns comments with only
  `email + snapshot_id + driver_name + text`. Comments are associated with a
  person and a snapshot, not with a team.

The correct source of truth for who reports to whom is `organization_people`,
which is populated from the roster and carries `manager_email` for each person.
Manager-scoped views must derive their scope from the roster, not from GetDX
team metadata:

- **`voice --manager`**: filter `getdx_snapshot_comments` by
  `email IN (direct reports of manager from organization_people)`.
- **`health --manager` and `snapshot trend --manager`**: resolve the manager's
  direct reports from `organization_people`, then identify which GetDX team IDs
  those people belong to in order to filter snapshot scores. The specific mapping
  mechanism is a design decision.

The synthetic data must be updated to reflect this corrected model: the terrain
currently generates GetDX team records with `manager_id` and no `manager_email`,
which matches the real API. The fix is not to add `manager_email` to generated
team records (the real API doesn't have it) but to ensure the synthetic
`organization_people` rows carry accurate `manager_email` values that the
corrected query logic can use.

**Success criteria:**
- `fit-landmark voice --manager athena@bionova.example` returns only comments
  from engineers whose `manager_email` is Athena in `organization_people`.
- `fit-landmark health --manager athena@bionova.example` returns driver rows
  scoped to Athena's direct reports, not all-org data.

### Gap 2 — No `markers:` blocks in generated pathway capability YAML

`readiness`, `evidence`, and `fit-landmark marker <skill>` require `markers`
arrays under each skill proficiency in the capability YAML. The synthetic pathway
renderer generates `proficiencyDescriptions`, `readChecklist`, and
`confirmChecklist` but no `markers` blocks. All three commands return empty
states regardless of evidence volume.

Marker definitions are installation-specific by design (spec 080,
§Starter Data Philosophy). The synthetic data must include at least
representative markers for the skills it generates evidence for so those commands
have criteria to evaluate against. The markers do not need to be exhaustive —
they need to be sufficient to exercise the Landmark commands.

**Success criteria:**
- `fit-landmark marker data_integration` lists at least one marker.
- `fit-landmark readiness --email actaeon@bionova.example` (J060, a level below
  the highest defined) produces a non-empty checklist.

### Initiative and scorecard feature removal

The `initiative list`, `initiative show`, and `initiative impact` commands must
be removed from Landmark. GetDX initiatives reference software catalog
scorecards — a distinct GetDX product area where SQL checks evaluate whether
catalog entities (services, repositories) meet quality levels (Bronze/Silver/Gold).
This is unrelated to snapshot factor scores. The `initiative impact` view joins
`initiative.scorecard_id` against snapshot score `item_id`s; these are different
ID spaces that will never match, so the computed delta is always null.

The correct model for initiative impact — if the feature is to be built — is a
new design decision. It is excluded from this spec.

**Success criterion:** `fit-landmark initiative` returns a "not available"
message or is removed from the CLI entirely. No initiative-related commands
produce output based on the broken join.

---

## Part 2 — Guide Activity Marker Evaluation Pipeline

### What to build

A batch evaluation capability that allows Guide to interpret activity artifacts
against skill markers from the engineering standard, writing structured evidence
rows to `activity.evidence` that Landmark can present.

This is the pipeline spec 080 described but did not implement:

```
Activity artifacts → Map (activity tables)
                            │
                     Guide evaluates
                     (grounded in engineering standard)
                            │
                     activity.evidence
                            │
                     Landmark presents
```

### Activity source abstraction

Activity data in Map is not homogeneous. Today it includes GitHub artifacts (pull
requests, code reviews, pushes). Anticipated future sources include GitHub
Copilot activity and Claude Code activity. Each source type has different
structure, different signal density, and different relevance to skill markers —
for example, a pull request carries a title, description, diff context, and
review thread, while a Copilot activity record carries completion-level telemetry.
An evaluation function written for one source type cannot be applied to another
without either producing incorrect matches or requiring the function to know about
every source type that will ever exist.

The evaluation pipeline must treat activity sources as pluggable. A **source
adapter** is the contract boundary: it knows how to retrieve unscored artifacts
for one source type and how to present each artifact to Guide in a form that
carries enough context for marker evaluation. The evaluation logic — how Guide
reads markers and decides whether an artifact demonstrates one — is source-
agnostic and must not be duplicated per source. New source adapters must be
addable without modifying the evaluation logic or the evidence write path.

This spec ships the GitHub artifact adapter only. Future adapters (Copilot,
Claude Code) plug in via the same interface without changes to evaluation or
output.

GetDX survey data is explicitly excluded from marker evaluation. Survey responses
cannot be traced back to a verifiable work artifact, making any evidence row
derived from them unauditable. This exclusion applies to all GetDX data types
(snapshot scores, comments, self-assessments).

### Engineering standard grounding

Guide must never free-associate markers. Every evidence row it writes must cite a
`skill_id` and `marker_text` that exist verbatim in the organization's
engineering standard. The authoritative source for that standard is the pathway
data (capability YAML files), which defines skills, proficiency levels, and the
`markers` array under each proficiency.

Before evaluating any artifact, Guide must load the markers defined for the
relevant engineer's discipline, level, and track from the standard. Only markers
retrieved from that load may appear in evidence rows.

The current engineering standard access interface (`svcpathway`) does not expose
a method that returns markers for a given engineer profile. Adding that capability
is in scope for this spec. The interface must return, for a given
`(discipline, level, track)` triple, the set of marker texts grouped by skill and
proficiency level that the engineer is expected to demonstrate.

### Batch scope

Evaluation must be triggerable over a defined scope:

| Scope | Description |
|---|---|
| Person | All unscored artifacts for one engineer |
| Team | All unscored artifacts for a manager's direct reports |
| Organisation | All unscored artifacts across the whole roster |

The query that identifies unscored artifacts (artifacts with no corresponding
evidence rows) already exists in Map's activity query layer. It currently
supports person-scoped retrieval only. Team-scoped and org-scoped retrieval are
not supported and must be added as part of this spec.

Evaluation must also be schedulable for continuous delivery — runnable on a
recurring cadence without manual invocation — so that new artifacts are evaluated
as they arrive without operator intervention. The mechanism for scheduling is a
design decision.

Evaluation is idempotent: an artifact that already has evidence rows is not
re-evaluated, so running evaluation twice over the same scope produces no
duplicate rows.

### Evidence output contract

Each evaluated artifact produces one or more evidence rows. Guide must honour the
`activity.evidence` schema:

| Column | Requirement | Meaning |
|---|---|---|
| `artifact_id` | FK to `github_artifacts`, required | The artifact that was evaluated |
| `skill_id` | From engineering standard, required | Skill the marker belongs to |
| `level_id` | From engineering standard, required | Proficiency level the marker targets |
| `marker_text` | Verbatim from engineering standard, required | Marker text exactly as defined |
| `matched` | Boolean, required | Whether the artifact demonstrates the marker |
| `rationale` | Non-null, required | Guide's reasoning (one to three sentences) |

The migration defines `rationale` as nullable (`TEXT` with no `NOT NULL`
constraint). Guide must always provide rationale; evidence rows written without
rationale are invalid. Whether enforcing this requires a schema migration is a
design decision.

`matched: false` rows are valid and must be written. They document what was
checked and not found. Landmark uses `matched: false` rows in two ways: in
coverage calculations (any evidence row, regardless of match, counts the artifact
as interpreted) and in `evidence` command output (displayed as unmatched items
alongside matched ones). They do not contribute positively to `readiness`
checklists, which only count `matched: true` rows against marker criteria.

### What is excluded from this spec

| Exclusion | Reason |
|---|---|
| Additional source adapters (Copilot, Claude Code) | Future specs; interface defined here |
| GetDX survey evaluation | Unauditable — cannot be traced to a verifiable artifact |
| GetDX initiative and scorecard features | Requires new design; scorecard IDs and snapshot factor IDs are different namespaces |
| Changes to Landmark presentation layer | Already ships per spec 080 |
| Changes to `activity.evidence` schema columns | Schema is correct; nullability constraint is a design decision |
| Marker authoring tooling | Installations author markers manually; workflow unchanged |

---

## Success Criteria

| # | Criterion | How to verify |
|---|---|---|
| 1 | `voice --manager` scoped to team | `fit-landmark voice --manager athena@bionova.example` returns only comments from engineers whose `manager_email` is Athena in `organization_people` |
| 2 | `health --manager` scoped to team | `fit-landmark health --manager athena@bionova.example` returns driver rows for Athena's direct reports, not all-org data |
| 3 | `readiness` produces checklists | `fit-landmark readiness --email actaeon@bionova.example` (J060 engineer) returns a non-empty marker checklist |
| 4 | `marker <skill>` lists markers | `fit-landmark marker data_integration` lists at least one marker |
| 5 | Initiative commands removed or gated | `fit-landmark initiative list` does not produce output derived from the broken scorecard join |
| 6 | Guide writes evidence with rationale | After running `fit-guide evaluate --email actaeon@bionova.example`, `activity.evidence` contains rows for Actaeon with non-null `rationale` |
| 7 | Evidence is standard-grounded | Every `skill_id` + `marker_text` pair in evidence rows written by Guide matches an entry returned by the engineering standard interface for Actaeon's profile `(software_engineering, J060)` |
| 8 | Evaluation is idempotent | Running `fit-guide evaluate --email actaeon@bionova.example` twice produces the same evidence row count both times |
| 9 | Evaluation coverage increases Landmark output | After criterion 6 completes, `fit-landmark coverage --email actaeon@bionova.example` reports a higher interpreted-artifact percentage than the baseline 1.5% observed with synthetic-only evidence |

---

## Scope

**In scope:**

| Package | What changes |
|---|---|
| `libraries/libsyntheticrender` | Pathway capability renderer (Gap 2 — add markers blocks) |
| `products/landmark` | Remove `initiative` command group; fix manager-scoped queries in `voice`, `health`, `snapshot` to scope via `organization_people` instead of `getdx_teams` |
| `products/map/src/activity/queries` | Fix comment and score queries to scope by roster manager_email; extend unscored-artifact query to support team and org scope |
| `products/map/supabase/functions` | Schedulable evaluation trigger |
| `products/guide` | Batch evaluation command; source adapter interface; GitHub artifact adapter; Pathway standard grounding |
| `services/pathway` (or the MCP layer above it) | New method returning markers for a given `(discipline, level, track)` profile |
| Synthetic data (BioNova story) | Verify all remaining Landmark commands produce non-empty, correctly scoped output after fixes |

**Out of scope:** Additional source adapters; GetDX survey evaluation; GetDX
initiative and scorecard features; Landmark presentation layer changes;
`activity.evidence` column additions.
