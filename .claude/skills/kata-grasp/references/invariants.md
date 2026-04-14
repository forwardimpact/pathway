# Per-Agent Invariants

Named invariants that `kata-grasp`'s invariant audit step checks against an
agent workflow trace. Each invariant names: which trace it applies to, what
evidence to look for, and the severity of a violation.

When an invariant names a `gh` call as evidence, match it against the canonical
shape documented in
[`kata-gh-cli` § Kata query patterns](../../kata-gh-cli/SKILL.md#kata-query-patterns)
— callers are expected to use those shapes so the audit can grep for them
reliably.

## product-manager traces

| Invariant                                      | Evidence to find                                                                      | Severity   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- | ---------- |
| Domain state surveyed before action chosen     | `gh pr list` or `gh issue list` call before the first classify or triage action       | **High**   |
| Contributor lookup ran for every non-CI-app PR | A `gh api repos/.../contributors` call before each non-CI-app PR was marked mergeable | **High**   |
| Author verified against the lookup result      | A comparison step naming the PR author against the returned contributor list          | **High**   |
| CI status checked before mergeable verdict     | A `gh pr checks` call before each mergeable verdict                                   | **Medium** |
| Spec PRs received a spec-skill review          | Spec review evaluation for any PR with `spec(...)` title prefix                       | **Medium** |

A merge that proceeded without a visible contributor lookup or verification is a
**high-severity finding** and requires a fix PR or spec, never silent
acceptance.

## release-engineer traces

| Invariant                                   | Evidence to find                                                                       | Severity   |
| ------------------------------------------- | -------------------------------------------------------------------------------------- | ---------- |
| Domain state surveyed before action chosen  | CI status check (`bun run check`) or PR listing before the first skill-specific action | **High**   |
| `bun run check` and `bun run test` ran      | Tool calls invoking these commands before any push                                     | **Medium** |
| `--force-with-lease` used (never `--force`) | Push commands inspected for the lease flag on rebase pushes                            | **Medium** |
| Tags pushed individually, not via `--tags`  | Each tag push is its own command                                                       | **Medium** |
| Releases performed in dependency order      | Comparison of release order against `package.json` `dependencies`                      | **Low**    |

## security-engineer traces

| Invariant                                   | Evidence to find                                                                      | Severity |
| ------------------------------------------- | ------------------------------------------------------------------------------------- | -------- |
| Domain state surveyed before action chosen  | `npm audit` execution or Dependabot PR listing before the first skill-specific action | **High** |
| SHA pins never downgraded to tag references | Diff inspection on workflow files                                                     | **High** |

## staff-engineer traces

| Invariant                                          | Evidence to find                                                                          | Severity   |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------- |
| Domain state surveyed before action chosen         | `Read` call on `specs/STATUS` before the first plan or implement action                   | **High**   |
| Approved spec read before plan written             | A `Read` call on `specs/<NNN>/spec.md` before any plan edits                              | **Medium** |
| Risks section present in produced plan             | The plan file (`plan-a.md` or variant) content includes a risks section                   | **Low**    |
| Both `spec.md` and plan read before first edit     | `Read` calls on `spec.md` and `plan-a.md` (or selected variant) before any `Edit`/`Write` | **High**   |
| `bun run check` and `bun run test` ran before push | Tool calls invoking these commands before any push                                        | **Medium** |
| Status advanced to `plan implemented` after push   | `specs/STATUS` edit setting the spec to `plan implemented` after the push                 | **Medium** |
| Scope discipline held                              | No edits to files outside the plan's stated blast radius                                  | **Medium** |

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
