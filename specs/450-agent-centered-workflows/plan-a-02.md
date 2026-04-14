# Part 02 -- KATA.md and Invariants Update

Depends on Part 01 (finalized workflow names and schedules).

## Scope

Update `KATA.md` to reflect six workflows instead of ten, and update
`invariants.md` to restructure existing invariants under agent-level headings
and add one decision-quality invariant per agent.

## Step 1: Update KATA.md

### 1a: Opening paragraph

Change:

```
Ten scheduled workflows, six agent personas, and sixteen skills form a
self-reinforcing PDSA cycle.
```

To:

```
Six scheduled workflows, six agent personas, and sixteen skills form a
self-reinforcing PDSA cycle.
```

### 1b: Workflows section heading and description

Change:

```markdown
## Workflows

Ten scheduled workflows span 03-11 UTC. Times respect dependencies (plans before
implementation, rebase before merge, merge before release) and same-agent
workflows never overlap. Off-minute schedules avoid API load spikes. All support
`workflow_dispatch`, use concurrency groups, and have a 30-minute timeout.
```

To:

```markdown
## Workflows

Six scheduled workflows -- one per agent -- span 03-11 UTC. Each agent wakes on
schedule, surveys its domain, and picks the highest-priority action from its full
skill set. Times respect ordering constraints (security before product, product
before planning, planning before release, all producers before the improvement
coach). Off-minute schedules avoid API load spikes. All support
`workflow_dispatch`, use concurrency groups, and have a 30-minute timeout.
```

### 1c: Workflows table

Replace the ten-row table with a six-row table:

```markdown
| Workflow                | Phase          | Schedule                                 | Agent             |
| ----------------------- | -------------- | ---------------------------------------- | ----------------- |
| **security-engineer**   | Do, Study      | Daily 04:07 UTC                          | security-engineer |
| **product-manager**     | Do, Study, Act | Daily 08:13 UTC + Mon/Wed/Fri 05:17 UTC  | product-manager   |
| **staff-engineer**      | Plan, Do       | Daily 07:11 UTC                          | staff-engineer    |
| **release-engineer**    | Do             | Daily 06:23 UTC + Tue/Thu/Sat 09:37 UTC  | release-engineer  |
| **technical-writer**    | Study, Act     | Mon/Thu 05:37 UTC + Wed/Sat 03:47 UTC    | technical-writer  |
| **improvement-coach**   | Study -> Act   | Wed/Sat 10:47 UTC                        | improvement-coach |
```

### 1d: Authentication section

Change:

```
`security-audit` uses `GITHUB_TOKEN` for checkout (preserving least
privilege) and a separate App token for API access.
```

To:

```
All agent workflows authenticate via App tokens. The security-engineer workflow
previously used `GITHUB_TOKEN` for checkout when it was a read-only audit; now
that audit and update are consolidated, it uses the App token for both.
```

Note: The old `security-audit` workflow used `permissions: contents: read` and
did not need the App token for checkout. The consolidated `security-engineer`
workflow uses `permissions: contents: write` and the App token for checkout,
matching the pattern of all other agent workflows.

## Step 2: Update invariants.md

### 2a: Restructure existing invariants under agent headings

The current file uses `<agent> / <workflow-name> traces` headings. Replace these
with agent-level headings. Each agent gets one `## <agent>` section. Existing
skill-specific invariants move under `### <skill-name>` subheadings within the
agent section.

Current headings to replace:

- `## product-manager / product-backlog traces` -> `## product-manager` with
  `### product-classify invariants`
- `## release-engineer / release-readiness traces` -> `## release-engineer` with
  `### release-readiness invariants`
- `## release-engineer / release-review traces` -> add
  `### release-review invariants` under `## release-engineer`
- `## security-engineer / security-update traces` -> `## security-engineer` with
  `### security-update invariants`
- `## staff-engineer / plan-specs traces` -> `## staff-engineer` with
  `### plan invariants`
- `## staff-engineer / implement-plans traces` -> add `### implement invariants`
  under `## staff-engineer`
- `## technical-writer / doc-review traces` -> `## technical-writer` with
  `### documentation invariants`
- `## technical-writer / wiki-curate traces` -> add `### wiki-curate invariants`
  under `## technical-writer`

### 2b: Add one decision-quality invariant per agent

Add a `### Decision-quality` subheading at the top of each agent's section
(before the skill-specific invariants) with one invariant:

```markdown
### Decision-quality

| Invariant                                    | Evidence to find                                                                                                    | Severity |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------- |
| Agent surveyed domain state before acting    | Tool calls assessing domain state (listed below) appear in the trace before the first skill-specific action         | **High** |
```

Then specify what "surveyed domain state" means for each agent:

**security-engineer:**

> Evidence: `npm audit` or `gh api` (security advisories) call, or
> `gh pr list --author 'app/dependabot'` call, or `Read` of
> `wiki/security-engineer.md` coverage map -- at least one before the first
> skill invocation.

**product-manager:**

> Evidence: `gh pr list` or `gh issue list` call before the first
> classify/triage/merge action.

**staff-engineer:**

> Evidence: `Read` call on `specs/STATUS` before the first plan or implement
> action.

**release-engineer:**

> Evidence: CI status check (e.g., `bun run check`, `bun run test`, or
> `gh pr list`) or `git log` / `git tag` comparison before the first
> rebase/release action.

**technical-writer:**

> Evidence: `Read` of `wiki/technical-writer.md` coverage/curation map before
> the first documentation or wiki action.

**improvement-coach:**

> Evidence: `Read` of `wiki/improvement-coach.md` or run of the `find-runs.sh`
> script / `gh run list` before the first trace download.

The full text of each agent's decision-quality invariant table row includes the
agent-specific evidence in the "Evidence to find" cell.

### 2c: Add explanatory text after the invariant intro

After the existing intro paragraph, add:

```markdown
Decision-quality invariants verify that each agent surveyed its domain before
choosing an action. When a single workflow consolidates multiple skills (e.g.,
the security-engineer workflow covers both audit and update), the agent must
demonstrate assessment before committing to a specific skill. Skill-specific
invariants continue to verify execution quality within each skill.
```

## Blast Radius

### Modified

- `KATA.md` (workflow count, table, description, authentication note)
- `.claude/skills/kata-grasp/references/invariants.md` (restructured headings,
  six new decision-quality invariants)

### Created / Deleted

None.

## Verification

- `KATA.md` says "Six scheduled workflows" and the table has exactly 6 rows.
- `invariants.md` has exactly 6 `## <agent>` sections.
- Each agent section has a `### Decision-quality` subsection with one invariant.
- Existing skill-specific invariants are preserved under renamed subheadings.
- `bun run check` passes.
- `bun run test` passes.
