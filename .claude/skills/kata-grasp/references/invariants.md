# Per-Agent Invariants

Named invariants that `kata-grasp`'s invariant audit step checks against an
agent workflow trace. Each invariant names: which trace it applies to, what
evidence to look for, and the severity of a violation.

When an invariant names a `gh` call as evidence, match it against the canonical
shape documented in
[`kata-gh-cli` § Kata query patterns](../../kata-gh-cli/SKILL.md#kata-query-patterns)
— callers are expected to use those shapes so the audit can grep for them
reliably.

## Decision quality (all agents)

Every agent runs an Assess phase before acting. These invariants verify that the
agent surveyed its domain state before choosing an action.

| Invariant                                       | Evidence to find                                                                                 | Severity |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------- |
| security-engineer surveyed domain before acting | `npm audit` or Dependabot PR listing in the trace before invoking a security skill               | **High** |
| product-manager surveyed domain before acting   | Open PR listing or open issue listing in the trace before invoking a product skill               | **High** |
| release-engineer surveyed domain before acting  | `bun run check` against main or open PR listing in the trace before invoking a release skill     | **High** |
| staff-engineer surveyed domain before acting    | `specs/STATUS` read in the trace before invoking a planning or implementation skill              | **High** |
| technical-writer surveyed domain before acting  | Wiki summary reads or coverage map check in the trace before invoking a documentation/wiki skill | **High** |
| improvement-coach surveyed domain before acting | Workflow artifact listing or coverage map check in the trace before invoking the grasp skill     | **High** |
| Decision log recorded                           | Wiki write containing a `### Decision` section with Surveyed, Alternatives, Chosen, Rationale    | **High** |

An agent that acts without a visible domain survey is a **high-severity
finding** — the Assess phase was skipped, defeating autonomous prioritization.

## product-manager traces

| Invariant                                      | Evidence to find                                                                      | Severity   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- | ---------- |
| Contributor lookup ran for every non-CI-app PR | A `gh api repos/.../contributors` call before each non-CI-app PR was marked mergeable | **High**   |
| Author verified against the lookup result      | A comparison step naming the PR author against the returned contributor list          | **High**   |
| CI status checked before mergeable verdict     | A `gh pr checks` call before each mergeable verdict                                   | **Medium** |
| Spec PRs received a spec-skill review          | Spec review evaluation for any PR with `spec(...)` title prefix                       | **Medium** |

A merge that proceeded without a visible contributor lookup or verification is a
**high-severity finding** and requires a fix PR or spec, never silent
acceptance.

## release-engineer traces (readiness)

| Invariant                                   | Evidence to find                                            | Severity   |
| ------------------------------------------- | ----------------------------------------------------------- | ---------- |
| `bun run check` and `bun run test` ran      | Tool calls invoking these commands before any push          | **Medium** |
| `--force-with-lease` used (never `--force`) | Push commands inspected for the lease flag on rebase pushes | **Medium** |

## release-engineer traces (release)

| Invariant                                  | Evidence to find                                                  | Severity   |
| ------------------------------------------ | ----------------------------------------------------------------- | ---------- |
| Tags pushed individually, not via `--tags` | Each tag push is its own command                                  | **Medium** |
| Releases performed in dependency order     | Comparison of release order against `package.json` `dependencies` | **Low**    |

## security-engineer traces

| Invariant                                   | Evidence to find                  | Severity |
| ------------------------------------------- | --------------------------------- | -------- |
| SHA pins never downgraded to tag references | Diff inspection on workflow files | **High** |

## staff-engineer traces (planning)

| Invariant                              | Evidence to find                                                        | Severity   |
| -------------------------------------- | ----------------------------------------------------------------------- | ---------- |
| Approved spec read before plan written | A `Read` call on `specs/<NNN>/spec.md` before any plan edits            | **Medium** |
| Risks section present in produced plan | The plan file (`plan-a.md` or variant) content includes a risks section | **Low**    |

## staff-engineer traces (implementation)

| Invariant                                          | Evidence to find                                                                          | Severity   |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------- |
| Both `spec.md` and plan read before first edit     | `Read` calls on `spec.md` and `plan-a.md` (or selected variant) before any `Edit`/`Write` | **High**   |
| Status advanced to `active` before implementation  | `specs/STATUS` edit setting the spec to `active` before the first edit                    | **Medium** |
| `bun run check` and `bun run test` ran before push | Tool calls invoking these commands before any push                                        | **Medium** |
| Status advanced to `done` after final push         | `specs/STATUS` edit setting the spec to `done` after the push                             | **Medium** |
| Scope discipline held                              | No edits to files outside the plan's stated blast radius                                  | **Medium** |

## technical-writer traces (documentation)

| Invariant                                 | Evidence to find                                                  | Severity   |
| ----------------------------------------- | ----------------------------------------------------------------- | ---------- |
| Source of truth consulted before findings | `Read` calls on source code/data files before documentation edits | **Medium** |
| `bunx fit-doc build` ran before push      | Tool call invoking the build command before any push              | **Medium** |
| Coverage map updated in memory            | Wiki write containing coverage map table                          | **Low**    |

## technical-writer traces (wiki)

| Invariant                                | Evidence to find                                             | Severity   |
| ---------------------------------------- | ------------------------------------------------------------ | ---------- |
| All agent summaries read before curation | `Read` calls on each `wiki/<agent>.md` before any wiki edits | **Medium** |
| Current week logs read for each agent    | `Read` calls on `wiki/<agent>-YYYY-Www.md` files             | **Medium** |
