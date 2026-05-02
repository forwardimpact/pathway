# Per-Agent Invariants

Named invariants that `kata-trace`'s invariant audit step checks against an
agent workflow trace. Each invariant names: which trace it applies to, what
evidence to look for, and the severity of a violation.

When an invariant names a `gh` call as evidence, match it against the `gh`
commands documented in each skill's Process section — callers are expected to
use those shapes so the audit can grep for them reliably.

## product-manager traces

| Invariant                                               | Evidence to find                                                                       | Severity   |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------- |
| Domain state surveyed before action chosen              | `gh pr list` or `gh issue list` call before the first review or triage action          | **High**   |
| Spec quality reviewed before label applied              | `kata-spec` review evaluation before any `gh pr edit --add-label spec:approved` call   | **Medium** |
| Spec written for needs-spec issue when no PRs to review | `kata-spec` invocation when survey finds `needs-spec` issues and zero pending spec PRs | **Medium** |

## release-engineer traces

Full table at
[`invariants-release-engineer.md`](invariants-release-engineer.md).

## security-engineer traces

| Invariant                                   | Evidence to find                                                                      | Severity |
| ------------------------------------------- | ------------------------------------------------------------------------------------- | -------- |
| Domain state surveyed before action chosen  | `npm audit` execution or Dependabot PR listing before the first skill-specific action | **High** |
| SHA pins never downgraded to tag references | Diff inspection on workflow files                                                     | **High** |

## staff-engineer traces

| Invariant                                          | Evidence to find                                                                                                                     | Severity   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Domain state surveyed before action chosen         | Phase derivation from `main` (`git ls-tree`/`git show main:specs/NNN/...`) or `gh pr list` before the first plan or implement action | **High**   |
| Approved spec read before plan written             | A `Read` call on `specs/<NNN>/spec.md` before any plan edits                                                                         | **Medium** |
| Risks section present in produced plan             | The plan file (`plan-a.md` or variant) content includes a risks section                                                              | **Low**    |
| Both `spec.md` and plan read before first edit     | `Read` calls on `spec.md` and `plan-a.md` (or selected variant) before any `Edit`/`Write`                                            | **High**   |
| `bun run check` and `bun run test` ran before push | Tool calls invoking these commands before any push                                                                                   | **Medium** |
| Implementation PR title references spec id         | PR title contains `(#NNN)` or "implements spec NNN" so `kata-release-merge` can apply `plan:implemented` on merge                    | **Medium** |
| Scope discipline held                              | No edits to files outside the plan's stated blast radius                                                                             | **Medium** |

## technical-writer traces

| Invariant                                  | Evidence to find                                                                       | Severity   |
| ------------------------------------------ | -------------------------------------------------------------------------------------- | ---------- |
| Domain state surveyed before action chosen | `Read` calls on agent summaries or coverage map before the first skill-specific action | **High**   |
| Source of truth consulted before findings  | `Read` calls on source code/data files before documentation edits                      | **Medium** |
| `bunx fit-doc build` ran before push       | Tool call invoking the build command before any push                                   | **Medium** |
| Coverage map updated in memory             | Wiki write containing coverage map table                                               | **Low**    |
| All agent summaries read before curation   | `Read` calls on each `wiki/<agent>.md` before any wiki edits                           | **Medium** |
| Current week logs read for each agent      | `Read` calls on `wiki/<agent>-YYYY-Www.md` files                                       | **Medium** |

## improvement-coach traces

| Invariant                                  | Evidence to find                                                                                             | Severity |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | -------- |
| Domain state surveyed before action chosen | Workflow run listing (`gh run list`) or run selection check before the first grasp or act-on-findings action | **High** |

## Cross-cutting invariants

Apply to every agent trace; full table at
[`invariants-cross-cutting.md`](invariants-cross-cutting.md).

## Orchestrator traces

Apply to combined traces from `fit-eval facilitate` / `fit-eval supervise`;
queries and table at [`invariants-orchestrator.md`](invariants-orchestrator.md).
