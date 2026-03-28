# 140: Automated Dependabot Triage Workflow

## Problem

Dependabot opens PRs weekly for both npm packages and GitHub Actions. These PRs
accumulate because triage requires a human to remember to run the
`dependabot-triage` skill manually. The skill itself is comprehensive — it
evaluates 8 policy checks, merges clean PRs, fixes minor violations, and closes
bad ones — but it sits idle until someone invokes it.

The gap is not the triage logic but the trigger. A scheduled GitHub Actions
workflow can close this gap by launching Claude Code on a timer and letting the
existing skill do the work.

## Why

- **PRs go stale.** Dependabot opens new PRs weekly. Without regular triage,
  they pile up, creating merge conflicts and security exposure from unpatched
  dependencies.
- **Human trigger is unreliable.** The skill exists but depends on someone
  remembering to run it. Automating the trigger makes triage consistent.
- **The skill already works.** No new triage logic is needed. The
  `dependabot-triage` skill handles policy evaluation, CI checks, merging,
  fixing, and closing. The workflow just needs to invoke it.
- **Reduced toil.** Routine dependency updates (patch/minor bumps that pass all
  checks) should not require human attention. The workflow handles them
  automatically and only leaves genuinely ambiguous cases for review.

## What

A single GitHub Actions workflow file that:

1. **Runs on a schedule** — every 3 days via `cron`, with manual
   `workflow_dispatch` as a fallback.
2. **Installs Claude Code** — uses `npm install -g @anthropic-ai/claude-code` in
   the runner.
3. **Launches a Claude Code session** — runs `claude` with a prompt that
   triggers the `dependabot-triage` skill to process all open Dependabot PRs.
4. **Authenticates with GitHub** — uses a GitHub token with sufficient
   permissions to read PRs, merge, close, create branches, and push commits.
5. **Authenticates with Anthropic** — uses an API key secret to power the Claude
   session.

The workflow does not modify the existing skill, add new triage logic, or change
any repository code. It is a pure automation trigger.

## Scope

### In scope

- New workflow file: `.github/workflows/dependabot-triage.yml`
- Documentation of required secrets and permissions
- Cron schedule configuration

### Out of scope

- Changes to the `dependabot-triage` skill itself
- Changes to `dependabot.yml` configuration
- Changes to any other workflow files
- New libraries, products, or scripts

## Required Secrets

| Secret              | Purpose                                           |
| ------------------- | ------------------------------------------------- |
| `ANTHROPIC_API_KEY` | Authenticates Claude Code with the Anthropic API  |
| `GH_TOKEN`         | GitHub PAT or fine-grained token for PR operations |

The built-in `GITHUB_TOKEN` is insufficient because Claude Code needs to create
branches, push commits, create PRs, merge PRs, and close PRs — operations that
require a PAT when the actor is a workflow. Using `GITHUB_TOKEN` would also
prevent triggering downstream CI on PRs created by the workflow (GitHub prevents
recursive workflow triggers from `GITHUB_TOKEN`).

## Permissions Model

The `GH_TOKEN` (PAT) needs:

- **Pull requests**: read and write (list, merge, close, comment, create)
- **Contents**: read and write (fetch branches, push fix branches)
- **Actions**: read (check CI status via `gh pr checks`)

The workflow itself declares minimal `permissions:` at the job level since the
PAT provides the actual authorization.
