---
name: kata-gh-cli
description: GitHub CLI usage for Kata agents running in GitHub Actions. Covers sandbox installation, CI runner quirks, and the repeated gh query patterns Kata skills use for PR triage, contributor lookup, trace downloads, and release operations. Generic gh reference included as appendix.
---

# GitHub CLI for Kata workflows

Canonical `gh` usage for Kata agents. By the time a skill invokes `gh`, the
workflow has already provisioned `GH_TOKEN` — the agent's concern is using `gh`
consistently, not authenticating it.

## When to use

- You are a Kata skill running inside a scheduled GitHub Actions workflow and
  need to read from or write to GitHub.
- You need the canonical shape for a cross-skill operation (e.g. contributor
  lookup) so your call matches what the `kata-grasp` invariant audit verifies.

For one-off interactive use outside CI, read `gh help` instead.

## Installation

Kata runners do not ship `gh`. Install from the pinned tarball:

```sh
bash .claude/skills/kata-gh-cli/scripts/install.sh [version]
```

Default version is `2.63.2`. Pass a version argument to override.

`apt-get install gh` often fails in sandboxed CI environments due to GPG key
issues. Always use the script above.

## CI runner quirks

**Proxied git remotes.** When the git remote uses a local proxy (e.g.
`http://local_proxy@127.0.0.1`), `gh` commands that infer the repo from the
remote may fail. Use `gh api` directly with explicit `{owner}/{repo}` paths
instead of the convenience commands.

**Check the active identity if something looks wrong.** `gh auth status` reports
who `gh` is acting as. If write operations are not landing under the expected
bot identity, stop and report — do not try to re-authenticate from inside the
skill.

## Kata query patterns

These are the canonical shapes Kata skills reuse. Match them exactly so the
`kata-grasp` invariant audit can verify the calls happened.

### List open PRs for triage

Used by `kata-product-classify` and `kata-release-readiness`.

```sh
gh pr list --state open --base main \
  --json number,title,author,headRefName,mergeable,mergeStateStatus
```

Narrow by author for Dependabot triage (used by `kata-security-update`):

```sh
gh pr list --author 'app/dependabot' --state open \
  --json number,title,headRefName
```

### Contributor trust lookup (top-20 gate)

Used by `kata-product-classify` before any external PR is marked mergeable. The
`kata-grasp` invariant audit verifies this call ran for every non-CI-app PR.

```sh
gh api repos/{owner}/{repo}/contributors \
  --jq '[.[] | select(.type == "User")] | .[0:20] | .[].login'
```

The `select(.type == "User")` filter excludes bot accounts from the top-20
ranking — a bot with high contribution volume must not gate human authors.

`app/forward-impact-ci` short-circuits the gate — skip the lookup for CI app PRs
and proceed directly to type classification.

### PR inspection

```sh
gh pr view <number> --json title,body,headRefName,files,commits,statusCheckRollup,mergeable,mergeStateStatus
gh pr checks <number>
gh pr diff <number>
```

### PR actions

```sh
# Comment (product-classify, security-update, release-readiness)
gh pr comment <number> --body "..."

# Merge
gh pr merge <number> --squash --auto           # external fix/bug PRs
gh pr merge <number> --merge --delete-branch   # agent-authored PRs

# Close with reason (security-update rejects policy violations)
gh pr close <number> --comment "..."
```

### List and view issues

Used by `kata-product-triage`.

```sh
gh issue list --state open --limit 50 \
  --json number,title,author,labels,createdAt
gh issue view <number> --json title,body,comments,labels,author
```

### Workflow run artifacts

Used by `kata-grasp` to download traces and `kata-release-review` to verify
publish runs.

```sh
# Find recent runs for a workflow on a branch
gh run list --branch main --limit 10 \
  --json name,conclusion,headBranch,event,databaseId

# Download a trace artifact
gh run download <run-id> --name combined-trace --dir /tmp/trace-<run-id>
gh run download <run-id> --name agent-trace --dir /tmp/trace-<run-id>

# Investigate a failed run
gh run view <run-id> --log-failed
```

### Release creation

Used by `kata-release-review`.

```sh
gh release create <tag> --title "<title>" --notes "<notes>"
```

## Generic reference

For `gh` operations not covered above, see
[`references/commands.md`](references/commands.md) for a quick reference card,
or run `gh help <command>`.
