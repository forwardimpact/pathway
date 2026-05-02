# release-engineer invariants

Referenced from [`invariants.md`](invariants.md).

| Invariant                                      | Evidence to find                                                                         | Severity   |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------- |
| Domain state surveyed before action chosen     | CI status check (`bun run check`) or `gh pr list` before the first skill-specific action | **High**   |
| Contributor lookup ran for every non-CI-app PR | A `gh api repos/.../contributors` call before each non-CI-app PR was marked mergeable    | **High**   |
| Author verified against the lookup result      | A comparison step naming the PR author against the returned contributor list             | **High**   |
| CI status checked before mergeable verdict     | A `gh pr checks` call before each mergeable verdict                                      | **Medium** |
| Phase PRs gated on approval signal             | `<phase>:approved` label OR APPROVED review present on any phase PR before merge         | **Medium** |
| `bun run check` and `bun run test` ran         | Tool calls invoking these commands before any push                                       | **Medium** |
| `--force-with-lease` used (never `--force`)    | Push commands inspected for the lease flag on rebase pushes                              | **Medium** |
| Tags pushed individually, not via `--tags`     | Each tag push is its own command                                                         | **Medium** |
| Releases performed in dependency order         | Comparison of release order against `package.json` `dependencies`                        | **Low**    |

A merge that proceeded without a visible contributor lookup or verification is a
**high-severity finding** and requires a fix PR or spec, never silent
acceptance.
