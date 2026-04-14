# Plan A -- Spec 450: Agent-Centered Workflows

## Approach

Collapse ten task-specific workflows into six agent-centered workflows, add an
Assess section to each agent profile replacing the current Workflows section,
add decision-quality invariants, and update KATA.md.

The key design decision is: **each new workflow uses a generic assessment-first
task prompt** instead of a task-specific one. The agent profile's Assess section
replaces the workflow's task text as the decision-making mechanism. The
`kata-action` composite is unchanged.

### Rationale

The current system has two problems the spec identifies: (1) workflows
pre-decide what agents do, preventing them from assessing and pivoting, and (2)
same-agent workflows create scheduling rigidity. The fix is mechanical --
consolidate YAML files, rewrite the Workflows section in agent profiles to an
Assess section with a priority framework, and add accountability via invariants.

No code changes. No library changes. This is purely workflow configuration,
agent profile prose, documentation, and invariant additions.

### Risks

1. **Workflow name changes break trace discovery.** The `find-runs.sh` script
   matches on `workflowName` containing "kata" (case-insensitive). New workflow
   `name:` fields must include "Kata" to remain discoverable. Verified: the plan
   uses `name: "Kata: <Agent Name>"` for all six workflows.

2. **Concurrency group names change.** Each workflow uses a concurrency group
   matching its purpose. The new workflows need a single concurrency group per
   agent (e.g., `security-engineer`) instead of per-task groups (e.g.,
   `security-audit`, `security-update`). This is a feature, not a risk -- it
   prevents the same agent from running two jobs simultaneously.

3. **Invariant section headings change.** The invariants file uses
   `<agent> / <workflow-name> traces` headings. With consolidated workflows,
   these headings must change to `<agent>` with subsections for the skills that
   previously had their own workflow. The improvement coach's trace selection
   still works because `find-runs.sh` uses `workflowName`, which will now be
   `"Kata: Security Engineer"` etc.

4. **SHA inventory references workflow filenames.** The `sha-inventory.md` file
   lists which workflows use each action. Filenames change, so this file must be
   updated.

5. **Permissions must be the union of merged workflows.** When two workflows
   merge, the new workflow needs the broader permission. For security-engineer:
   `security-audit` uses `contents: read` but `security-update` uses
   `contents: write`. The merged workflow needs `contents: write`.

6. **Schedule design.** The spec requires ordering constraints (security before
   product, product before planning, planning before release, coach last) and
   off-minute staggering. The plan designs specific cron expressions respecting
   these constraints.

## Execution

Three parts, strictly sequential (each depends on the prior):

- **Part 01** -- Workflow consolidation and agent profiles (staff-engineer)
- **Part 02** -- KATA.md and invariants update (staff-engineer)
- **Part 03** -- SHA inventory update (staff-engineer)

Parts 02 and 03 depend on Part 01 for the finalized workflow filenames and
schedule. All three parts are small enough that a single staff-engineer agent
can execute them sequentially in one session.

## Libraries Used

No shared libraries are consumed. This spec is entirely configuration, prose,
and documentation changes.

## Parts

| Part               | Summary                                 | Files                                                        |
| ------------------ | --------------------------------------- | ------------------------------------------------------------ |
| [01](plan-a-01.md) | Workflow consolidation + agent profiles | 16 workflow files (10 deleted, 6 created) + 6 agent profiles |
| [02](plan-a-02.md) | KATA.md and invariants update           | KATA.md + invariants.md                                      |
| [03](plan-a-03.md) | SHA inventory update                    | sha-inventory.md                                             |
