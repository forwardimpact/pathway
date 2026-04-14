# Part 01 -- Workflow Consolidation and Agent Profiles

## Scope

Delete ten kata workflow files, create six agent-centered workflow files, and
rewrite the Workflows section in all six agent profiles to an Assess section.

## Step 1: Create six new workflow files

Create each file from the template below, customizing per-agent. The template
preserves every structural element from the existing workflows: `on.schedule`,
`on.workflow_dispatch` with `task-amend`, `concurrency`, `permissions`, `jobs`
with `timeout-minutes: 30`, the `ci-app` token step, `actions/checkout`,
`./.github/actions/bootstrap`, and the `kata-action` step.

### Schedule design

Ordering constraints from the spec:

1. Security before product
2. Product before planning
3. Planning before release
4. All producers before improvement coach

Chosen schedule (all daily unless noted, off-minute staggering):

| Workflow                | Schedule                                | Rationale                                                   |
| ----------------------- | --------------------------------------- | ----------------------------------------------------------- |
| `security-engineer.yml` | Daily 04:07 UTC                         | First in chain. Same minute as old security-audit.          |
| `product-manager.yml`   | Daily 08:13 UTC + Mon/Wed/Fri 05:17 UTC | After security. Keeps both existing schedules.              |
| `staff-engineer.yml`    | Daily 07:11 UTC                         | After product. Single daily run replaces plan+implement.    |
| `release-engineer.yml`  | Daily 06:23 UTC + Tue/Thu/Sat 09:37 UTC | After staff for release-review slots. Keeps both schedules. |
| `technical-writer.yml`  | Mon/Thu 05:37 UTC + Wed/Sat 03:47 UTC   | Unchanged aggregate of doc-review + wiki-curate.            |
| `improvement-coach.yml` | Wed/Sat 10:47 UTC                       | Last. Unchanged.                                            |

Note on ordering constraints:

- The release-engineer daily schedule (06:23) runs before staff-engineer
  (07:11), but this is acceptable because release-readiness only prepares PRs
  (rebase, lint fix) -- it does not require staff-engineer's output. The
  Tue/Thu/Sat 09:37 slot for release-review runs after staff-engineer,
  satisfying the "planning before release" constraint for actual release cuts.

- The product-manager daily run (08:13) runs AFTER staff-engineer (07:11). This
  is unchanged from the current system where plan-specs (07:11) ran before the
  daily product-manager (08:13). The spec's "product before planning" constraint
  is satisfied on Mon/Wed/Fri when the 05:17 product-manager run precedes the
  07:11 staff-engineer run. On other days, the ordering is reversed but this
  matches the pre-existing schedule. With agent-centered workflows, this matters
  less because the staff-engineer reads `specs/STATUS` directly rather than
  depending on product-manager output from the same day.

### Per-workflow details

#### `.github/workflows/security-engineer.yml`

```yaml
name: "Kata: Security Engineer"

on:
  schedule:
    - cron: "7 4 * * *"
  workflow_dispatch:
    inputs:
      task-amend:
        description: "Additional text appended to the task prompt for steering"
        required: false
        type: string

concurrency:
  group: security-engineer
  cancel-in-progress: true

permissions:
  contents: write

jobs:
  assess:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - name: Generate installation token
        id: ci-app
        uses: actions/create-github-app-token@f8d387b68d61c58ab83c6c016672934102569859 # v3
        with:
          app-id: ${{ secrets.CI_APP_ID }}
          private-key: ${{ secrets.CI_APP_PRIVATE_KEY }}

      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6
        with:
          token: ${{ steps.ci-app.outputs.token }}
          submodules: true

      - uses: ./.github/actions/bootstrap

      - name: Assess and act
        uses: ./.github/actions/kata-action
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GH_TOKEN: ${{ steps.ci-app.outputs.token }}
          CLAUDE_CODE_USE_BEDROCK: "0"
        with:
          app-id: ${{ secrets.CI_APP_ID }}
          task-text: Assess your domain and act on the highest-priority finding.
          agent-profile: "security-engineer"
          model: "opus"
          max-turns: "200"
          task-amend: ${{ inputs.task-amend }}
```

**Decisions:**

- `permissions: contents: write` -- union of `read` (audit) and `write`
  (update).
- `concurrency: group: security-engineer` -- single group replaces separate
  `security-audit` and `security-update` groups.
- Schedule becomes daily instead of split Tue/Fri + Mon/Thu. The agent decides
  whether to audit or update on each run.
- Job name `assess` (was `audit` or `triage`).
- No `fetch-depth: 0` -- neither existing security workflow used it.

#### `.github/workflows/product-manager.yml`

```yaml
name: "Kata: Product Manager"

on:
  schedule:
    - cron: "13 8 * * *"
    - cron: "17 5 * * 1,3,5"
  workflow_dispatch:
    inputs:
      task-amend:
        description: "Additional text appended to the task prompt for steering"
        required: false
        type: string

concurrency:
  group: product-manager
  cancel-in-progress: true

permissions:
  contents: write

jobs:
  assess:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - name: Generate installation token
        id: ci-app
        uses: actions/create-github-app-token@f8d387b68d61c58ab83c6c016672934102569859 # v3
        with:
          app-id: ${{ secrets.CI_APP_ID }}
          private-key: ${{ secrets.CI_APP_PRIVATE_KEY }}

      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6
        with:
          fetch-depth: 0
          token: ${{ steps.ci-app.outputs.token }}
          submodules: true

      - uses: ./.github/actions/bootstrap

      - name: Assess and act
        uses: ./.github/actions/kata-action
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GH_TOKEN: ${{ steps.ci-app.outputs.token }}
          CLAUDE_CODE_USE_BEDROCK: "0"
        with:
          app-id: ${{ secrets.CI_APP_ID }}
          task-text: Assess your domain and act on the highest-priority finding.
          agent-profile: "product-manager"
          model: "opus"
          max-turns: "200"
          task-amend: ${{ inputs.task-amend }}
```

**Decisions:**

- Already a single workflow. Schedule, permissions, `fetch-depth: 0` unchanged.
- Task text changes from specific triage instruction to generic assess prompt.
- Concurrency group unchanged (`product-manager`).

#### `.github/workflows/staff-engineer.yml`

```yaml
name: "Kata: Staff Engineer"

on:
  schedule:
    - cron: "11 7 * * *"
  workflow_dispatch:
    inputs:
      task-amend:
        description: "Additional text appended to the task prompt for steering"
        required: false
        type: string

concurrency:
  group: staff-engineer
  cancel-in-progress: true

permissions:
  contents: write

jobs:
  assess:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - name: Generate installation token
        id: ci-app
        uses: actions/create-github-app-token@f8d387b68d61c58ab83c6c016672934102569859 # v3
        with:
          app-id: ${{ secrets.CI_APP_ID }}
          private-key: ${{ secrets.CI_APP_PRIVATE_KEY }}

      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6
        with:
          token: ${{ steps.ci-app.outputs.token }}
          submodules: true

      - uses: ./.github/actions/bootstrap

      - name: Assess and act
        uses: ./.github/actions/kata-action
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GH_TOKEN: ${{ steps.ci-app.outputs.token }}
          CLAUDE_CODE_USE_BEDROCK: "0"
        with:
          app-id: ${{ secrets.CI_APP_ID }}
          task-text: Assess your domain and act on the highest-priority finding.
          agent-profile: "staff-engineer"
          model: "opus"
          max-turns: "0"
          task-amend: ${{ inputs.task-amend }}
```

**Decisions:**

- Single daily run at 07:11 UTC replaces plan-specs (07:11) + implement-plans
  (07:53). Agent decides whether to plan or implement.
- `max-turns: "0"` (unlimited) -- carried from implement-plans which used `"0"`.
  Planning is light; implementation needs unlimited turns.
- No `fetch-depth: 0` -- neither existing staff workflow used it.
- Concurrency group `staff-engineer` replaces `plan-specs` and
  `implement-plans`.

#### `.github/workflows/release-engineer.yml`

```yaml
name: "Kata: Release Engineer"

on:
  schedule:
    - cron: "23 6 * * *"
    - cron: "37 9 * * 2,4,6"
  workflow_dispatch:
    inputs:
      task-amend:
        description: "Additional text appended to the task prompt for steering"
        required: false
        type: string

concurrency:
  group: release-engineer
  cancel-in-progress: true

permissions:
  contents: write

jobs:
  assess:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - name: Generate installation token
        id: ci-app
        uses: actions/create-github-app-token@f8d387b68d61c58ab83c6c016672934102569859 # v3
        with:
          app-id: ${{ secrets.CI_APP_ID }}
          private-key: ${{ secrets.CI_APP_PRIVATE_KEY }}

      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6
        with:
          fetch-depth: 0
          token: ${{ steps.ci-app.outputs.token }}
          submodules: true

      - uses: ./.github/actions/bootstrap

      - name: Assess and act
        uses: ./.github/actions/kata-action
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GH_TOKEN: ${{ steps.ci-app.outputs.token }}
          CLAUDE_CODE_USE_BEDROCK: "0"
        with:
          app-id: ${{ secrets.CI_APP_ID }}
          task-text: Assess your domain and act on the highest-priority finding.
          agent-profile: "release-engineer"
          model: "opus"
          max-turns: "200"
          task-amend: ${{ inputs.task-amend }}
```

**Decisions:**

- Merges release-readiness (daily 06:23) and release-review (Tue/Thu/Sat 09:37)
  into one file with both cron lines.
- `fetch-depth: 0` -- both existing workflows use it.
- Concurrency group `release-engineer` replaces `release-readiness` and
  `release-review`.
- `permissions: contents: write` -- both used write.

#### `.github/workflows/technical-writer.yml`

```yaml
name: "Kata: Technical Writer"

on:
  schedule:
    - cron: "37 5 * * 1,4"
    - cron: "47 3 * * 3,6"
  workflow_dispatch:
    inputs:
      task-amend:
        description: "Additional text appended to the task prompt for steering"
        required: false
        type: string

concurrency:
  group: technical-writer
  cancel-in-progress: true

permissions:
  contents: write

jobs:
  assess:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - name: Generate installation token
        id: ci-app
        uses: actions/create-github-app-token@f8d387b68d61c58ab83c6c016672934102569859 # v3
        with:
          app-id: ${{ secrets.CI_APP_ID }}
          private-key: ${{ secrets.CI_APP_PRIVATE_KEY }}

      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6
        with:
          fetch-depth: 0
          token: ${{ steps.ci-app.outputs.token }}
          submodules: true

      - uses: ./.github/actions/bootstrap

      - name: Assess and act
        uses: ./.github/actions/kata-action
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GH_TOKEN: ${{ steps.ci-app.outputs.token }}
          CLAUDE_CODE_USE_BEDROCK: "0"
        with:
          app-id: ${{ secrets.CI_APP_ID }}
          task-text: Assess your domain and act on the highest-priority finding.
          agent-profile: "technical-writer"
          model: "opus"
          max-turns: "200"
          task-amend: ${{ inputs.task-amend }}
```

**Decisions:**

- Merges doc-review (Mon/Thu 05:37) and wiki-curate (Wed/Sat 03:47) into one
  file with both cron lines.
- `fetch-depth: 0` -- doc-review uses it; wiki-curate does not. Use the broader
  setting for safety.
- Concurrency group `technical-writer` replaces `doc-review` and `wiki-curate`.

#### `.github/workflows/improvement-coach.yml`

```yaml
name: "Kata: Improvement Coach"

on:
  schedule:
    - cron: "47 10 * * 3,6"
  workflow_dispatch:
    inputs:
      task-amend:
        description: "Additional text appended to the task prompt for steering"
        required: false
        type: string

concurrency:
  group: improvement-coach
  cancel-in-progress: true

permissions:
  contents: write

jobs:
  assess:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - name: Generate installation token
        id: ci-app
        uses: actions/create-github-app-token@f8d387b68d61c58ab83c6c016672934102569859 # v3
        with:
          app-id: ${{ secrets.CI_APP_ID }}
          private-key: ${{ secrets.CI_APP_PRIVATE_KEY }}

      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6
        with:
          fetch-depth: 0
          token: ${{ steps.ci-app.outputs.token }}
          submodules: true

      - uses: ./.github/actions/bootstrap

      - name: Assess and act
        uses: ./.github/actions/kata-action
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GH_TOKEN: ${{ steps.ci-app.outputs.token }}
          CLAUDE_CODE_USE_BEDROCK: "0"
        with:
          app-id: ${{ secrets.CI_APP_ID }}
          task-text: Assess your domain and act on the highest-priority finding.
          agent-profile: "improvement-coach"
          model: "opus"
          max-turns: "200"
          task-amend: ${{ inputs.task-amend }}
```

**Decisions:**

- Already a single workflow. Schedule unchanged.
- Task text changes from specific grasp instruction to generic assess prompt.
- Concurrency group unchanged (`improvement-coach`).

## Step 2: Delete ten old workflow files

Delete these files:

- `.github/workflows/security-audit.yml`
- `.github/workflows/security-update.yml`
- `.github/workflows/plan-specs.yml`
- `.github/workflows/implement-plans.yml`
- `.github/workflows/release-readiness.yml`
- `.github/workflows/release-review.yml`
- `.github/workflows/doc-review.yml`
- `.github/workflows/wiki-curate.yml`

The existing `product-manager.yml` and `improvement-coach.yml` are replaced
in-place (same filename) in Step 1.

## Step 3: Rewrite agent profiles -- Workflows to Assess

Replace the `## Workflows` section in each agent profile with an `## Assess`
section containing a numbered priority framework. The framework tells the agent
how to survey its domain and pick the highest-priority action.

Also add a `### Decision` subsection to the Memory instructions that specifies
the four required fields for decision logging.

### security-engineer.md

Replace the `## Workflows` section (lines 25-38) with:

```markdown
## Assess

Survey your domain and act on the highest-priority finding:

1. **Critical vulnerabilities?** Run `npm audit` and check GitHub security
   advisories. If critical or high findings exist, patch immediately using the
   `kata-security-update` skill.
2. **Open Dependabot PRs?** List open Dependabot PRs. If any exist, triage and
   merge/close using the `kata-security-update` skill.
3. **No urgent patches?** Audit the least-recently-covered topic area from the
   coverage map in `wiki/security-engineer.md` using the `kata-security-audit`
   skill:
   - **Trivial fix** (dependency bump, SHA pin, lint fix) -> batch into one
     `fix/security-audit-YYYY-MM-DD` PR from `main`
   - **Structural finding** (requires design) -> write spec using `kata-spec`
     skill on its own `spec/security-<name>` branch from `main`
   - Every PR on an independent branch from `main` -- never combine fixes and
     specs, never branch from another audit branch
4. **Nothing actionable?** Report clean state in the weekly log.
```

Add to the Memory bullet in Constraints:

```markdown
  Use `### Decision` with four fields: **Surveyed** (what domain state was
  checked), **Alternatives** (what actions were available), **Chosen** (what
  action was selected and which skill was invoked), **Rationale** (why this
  action over the alternatives).
```

### technical-writer.md

Replace the `## Workflows` section (lines 29-44) with:

```markdown
## Assess

Survey your domain and act on the highest-priority finding:

1. **Stale or inaccurate documentation?** Check the coverage map in
   `wiki/technical-writer.md` for the least-recently-reviewed topic area. If a
   topic has not been reviewed in the current cycle, review it using the
   `kata-documentation` skill:
   - **Trivial fix** (typo, stale example, broken link) -> branch from `main` as
     `fix/doc-review-YYYY-MM-DD`, fix, commit, push, open PR. Batch related
     fixes into one PR.
   - **Structural finding** (requires design) -> branch from `main` as
     `spec/docs-<name>`, write spec using `kata-spec` skill, push, open PR.
   - Every PR must branch directly from `main` -- never combine fixes and specs,
     never branch from another review branch.
2. **Wiki curation due?** Check the curation state in
   `wiki/technical-writer.md`. If any curation area is stale, follow the
   `kata-wiki-curate` skill. After committing wiki changes, push the wiki
   submodule and the monorepo wiki pointer update.
3. **Nothing actionable?** Report clean state in the weekly log.
```

Add to the Memory bullet in Constraints:

```markdown
  Use `### Decision` with four fields: **Surveyed** (what domain state was
  checked), **Alternatives** (what actions were available), **Chosen** (what
  action was selected and which skill was invoked), **Rationale** (why this
  action over the alternatives).
```

### release-engineer.md

Replace the `## Workflows` section (lines 24-37) with:

```markdown
## Assess

Survey your domain and act on the highest-priority finding:

1. **Main branch CI red?** Check CI status on `main`. If failing from trivial
   issues, fix with `bun run check:fix` and push directly to `main`. You are the
   **only** agent allowed to push to `main`, and only for mechanical fixes. If
   failures persist after `check:fix`, stop and report.
2. **Open PRs needing rebase or CI fix?** List open PRs. If any have merge
   conflicts or trivial CI failures, follow the `kata-release-readiness` skill.
   Do not review code, approve, or merge PRs.
3. **Unreleased changes on main?** Check for unreleased commits since the last
   tag. If changes exist, follow the `kata-release-review` skill. Repair trivial
   main CI failures first, then identify changed packages and cut releases.
4. **Nothing actionable?** Report clean state in the weekly log.
```

Add to the Memory bullet in Constraints:

```markdown
  Use `### Decision` with four fields: **Surveyed** (what domain state was
  checked), **Alternatives** (what actions were available), **Chosen** (what
  action was selected and which skill was invoked), **Rationale** (why this
  action over the alternatives).
```

### staff-engineer.md

Replace the `## Workflows` section (lines 35-47) with:

```markdown
## Assess

Survey your domain and act on the highest-priority finding:

1. **Active implementation in progress?** Check `specs/STATUS` for any spec at
   `active`. If one exists, resume implementation using the `kata-implement`
   skill.
2. **Planned spec awaiting implementation?** Check `specs/STATUS` for specs at
   `planned`. If any exist, select the one with the lowest ID and implement it
   using the `kata-implement` skill. Advance status through
   `planned -> active -> done`.
3. **Approved spec awaiting plan?** Check `specs/STATUS` for specs at `review`
   that have no `plan-a.md`. If any exist, use the `kata-plan` skill to turn the
   spec into an execution-ready plan. Push the plan on its existing `spec/`
   branch.
4. **Nothing actionable?** Report clean state in the weekly log.
```

Add to the Memory bullet in Constraints:

```markdown
  Use `### Decision` with four fields: **Surveyed** (what domain state was
  checked), **Alternatives** (what actions were available), **Chosen** (what
  action was selected and which skill was invoked), **Rationale** (why this
  action over the alternatives).
```

### product-manager.md

Replace the `## Workflows` section (lines 29-48) with:

```markdown
## Assess

Survey your domain and act on the highest-priority finding:

1. **Open PRs awaiting triage?** List open PRs. If any exist, follow the
   `kata-product-classify` skill to classify and merge those that pass all gates.
   For `spec` PRs, also apply the `kata-spec` skill's review process; for PRs
   that include a plan, apply the `kata-plan` skill's review process.
2. **Open issues awaiting triage?** List open issues. If any exist, follow the
   `kata-product-triage` skill. Then act on the triage report:
   - **Trivial fix/bug** -> make the fix on a `fix/<short-name>` branch from
     `main`, run checks, open a PR
   - **Product-aligned** -> use the `kata-spec` skill to write a spec
   - **Out of scope** -> comment and label per the templates
3. **Product evaluation due?** When supervising a `fit-eval supervise` relay,
   follow the `kata-product-evaluation` skill. Brief the agent, observe the
   session, capture feedback, and create issues per Step 4 of that skill.
4. **Nothing actionable?** Report clean state in the weekly log.
```

Add to the Memory bullet in Constraints:

```markdown
  Use `### Decision` with four fields: **Surveyed** (what domain state was
  checked), **Alternatives** (what actions were available), **Chosen** (what
  action was selected and which skill was invoked), **Rationale** (why this
  action over the alternatives).
```

### improvement-coach.md

Replace the `## Workflow` section (lines 27-41) with:

```markdown
## Assess

Survey your domain and act on the highest-priority finding:

1. **High-severity audit failures from prior runs?** Check
   `wiki/improvement-coach.md` for unaddressed high-severity invariant failures.
   If any exist, fix them directly or write a spec.
2. **Unanalyzed traces available?** Use the run selection algorithm from the
   `kata-grasp` skill to find the least-recently-analyzed workflow. If an
   unanalyzed trace exists, grasp it:
   - Use the `kata-grasp` skill to observe a single trace, audit named
     invariants, and produce findings via grounded theory.
   - **Trivial fix** (mechanical, obvious, low risk) -> branch from `main` as
     `fix/coach-<name>`, fix, commit, push, open PR. Batch related fixes into
     one PR when they share a root cause.
   - **Improvement** (requires design, touches multiple files) -> branch from
     `main` as `spec/<name>`, write spec using `kata-spec` skill, push, open PR.
     Each distinct improvement gets its own branch and PR.
   - Every PR must branch directly from `main` -- never from another fix or spec
     branch.
3. **Nothing actionable?** Report clean state in the weekly log.
```

Note: The improvement coach profile uses `## Workflow` (singular) currently.
Change this heading to `## Assess`.

Add to the Memory bullet in Constraints:

```markdown
  Use `### Decision` with four fields: **Surveyed** (what domain state was
  checked), **Alternatives** (what actions were available), **Chosen** (what
  action was selected and which skill was invoked), **Rationale** (why this
  action over the alternatives).
```

## Blast Radius

### Created

- `.github/workflows/security-engineer.yml`
- `.github/workflows/technical-writer.yml`
- `.github/workflows/release-engineer.yml`
- `.github/workflows/staff-engineer.yml`

### Modified

- `.github/workflows/product-manager.yml` (task-text, job name)
- `.github/workflows/improvement-coach.yml` (task-text, job name)
- `.claude/agents/security-engineer.md` (Workflows -> Assess, Memory addition)
- `.claude/agents/technical-writer.md` (Workflows -> Assess, Memory addition)
- `.claude/agents/release-engineer.md` (Workflows -> Assess, Memory addition)
- `.claude/agents/staff-engineer.md` (Workflows -> Assess, Memory addition)
- `.claude/agents/product-manager.md` (Workflows -> Assess, Memory addition)
- `.claude/agents/improvement-coach.md` (Workflow -> Assess, Memory addition)

### Deleted

- `.github/workflows/security-audit.yml`
- `.github/workflows/security-update.yml`
- `.github/workflows/plan-specs.yml`
- `.github/workflows/implement-plans.yml`
- `.github/workflows/release-readiness.yml`
- `.github/workflows/release-review.yml`
- `.github/workflows/doc-review.yml`
- `.github/workflows/wiki-curate.yml`

## Verification

- Count workflow files: `ls .github/workflows/kata-*.yml` should return 0;
  `ls .github/workflows/{security-engineer,product-manager,staff-engineer,release-engineer,technical-writer,improvement-coach}.yml`
  should return 6.
- Each workflow file has `name:` containing "Kata" (for trace discovery).
- Each agent profile has `## Assess` and no `## Workflows` or `## Workflow`.
- Each agent profile Memory section includes `### Decision` instructions.
- `bun run check` passes.
- `bun run test` passes.
