# 140: Implementation Plan

## Approach

Add a single workflow file that installs Claude Code on a schedule and runs it
with a prompt that activates the `dependabot-triage` skill. No other files
change.

## New File

### `.github/workflows/dependabot-triage.yml`

```yaml
name: Dependabot Triage

on:
  schedule:
    # Every 3 days at 06:00 UTC (Mon, Thu, Sun pattern across weeks)
    - cron: "0 6 */3 * *"
  workflow_dispatch: # Manual trigger for testing or on-demand triage

permissions:
  contents: read

jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6

      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Install Claude Code
        run: npm install -g @anthropic-ai/claude-code

      - name: Configure Git identity
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

      - name: Triage Dependabot PRs
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
          CLAUDE_CODE_USE_BEDROCK: "0"
        run: |
          claude --print --allowedTools "Bash,Read,Glob,Grep,Write,Edit" \
            "/dependabot-triage"
```

## Design Decisions

### Why `claude --print`

The `--print` flag runs Claude Code in non-interactive mode — it accepts the
prompt, executes the task, prints the output, and exits. This is the correct
mode for CI where there is no interactive terminal.

### Why `--allowedTools`

Explicitly listing allowed tools avoids interactive permission prompts that would
hang the CI runner. The triage skill needs `Bash` (for `gh` CLI commands, `npm
audit`, `git` operations), `Read`/`Glob`/`Grep` (for inspecting workflow files
and policy documents), and `Write`/`Edit` (for fixing policy violations on fix
branches).

### Why `npm ci` before Claude Code

The workspace must be fully installed so that Claude Code can run `npm audit`,
`npm ls`, and other npm commands during triage. The `npm ci` step also ensures
the lock file is present for audit checks.

### Why a PAT instead of `GITHUB_TOKEN`

Two reasons:

1. **Recursive trigger prevention.** GitHub does not trigger workflows on events
   created by `GITHUB_TOKEN`. When Claude Code creates a fix PR, CI must run on
   that PR. A PAT allows this.
2. **Cross-branch operations.** The triage skill creates fix branches, pushes
   commits, and creates PRs. While `GITHUB_TOKEN` can technically do some of
   this with `contents: write`, the combination of merge + close + create-PR +
   push requires a PAT for reliability.

### Why every 3 days

Dependabot opens PRs weekly. Running every 3 days ensures each PR is triaged
within a few days of creation without burning excessive CI minutes. The
`workflow_dispatch` trigger allows immediate triage when needed.

### Why `/dependabot-triage` as the prompt

Claude Code's skill system recognizes slash-command invocations. The
`dependabot-triage` skill's frontmatter and instructions are comprehensive
enough that a simple invocation triggers the full workflow — list PRs, evaluate
policies, take action, report.

## Secrets Setup

### 1. Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com/) and create an
   API key (or use an existing one).
2. In the GitHub repository, go to **Settings > Secrets and variables >
   Actions**.
3. Click **New repository secret**.
4. Name: `ANTHROPIC_API_KEY`, Value: the API key (starts with `sk-ant-`).

The key needs access to Claude Sonnet or Opus. Triage sessions typically use
moderate token counts (reading PR diffs, policy files, running commands), so
cost per run should be modest.

### 2. GitHub PAT

1. Go to **GitHub Settings > Developer settings > Fine-grained personal access
   tokens** (or use a classic PAT).
2. Create a token scoped to the `forwardimpact/monorepo` repository with these
   permissions:
   - **Contents**: Read and write
   - **Pull requests**: Read and write
   - **Actions**: Read
   - **Metadata**: Read (granted by default)
3. In the GitHub repository, go to **Settings > Secrets and variables >
   Actions**.
4. Click **New repository secret**.
5. Name: `GH_TOKEN`, Value: the token.

**Token expiry:** Fine-grained tokens have a maximum lifetime (typically 1
year). Set a calendar reminder to rotate before expiry.

**Alternative — GitHub App:** For longer-lived automation, create a GitHub App
with the same permissions, install it on the repository, and use
`actions/create-github-app-token` to generate short-lived tokens in the
workflow. This avoids PAT expiry concerns but adds setup complexity.

## Files

| File                                        | Action |
| ------------------------------------------- | ------ |
| `.github/workflows/dependabot-triage.yml`   | Create |

## Verification

1. Push the workflow file to `main`.
2. Go to **Actions > Dependabot Triage** and click **Run workflow** (manual
   dispatch).
3. Confirm the job installs Claude Code, runs the triage prompt, and correctly
   evaluates open Dependabot PRs.
4. Verify that merged PRs are squash-merged, fix PRs trigger CI, and closed PRs
   have policy violation comments.
5. Wait for the next scheduled run and confirm it executes automatically.
