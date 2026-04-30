# Workflow Template: Scheduled Agent

Generate one workflow file per agent. Replace Mustache-style placeholders with
the user's configuration.

## Placeholders

| Placeholder        | Example                                   |
| ------------------ | ----------------------------------------- |
| `{{AGENT_TITLE}}`  | `Product Manager`                         |
| `{{AGENT_NAME}}`   | `product-manager`                         |
| `{{CRON_ENTRIES}}` | Three `- cron:` lines from `schedules.md` |
| `{{MODEL}}`        | `claude-opus-4-7[1m]`                     |
| `{{WIKI}}`         | `"true"` or `"false"`                     |

## Template

```yaml
name: "Agent: {{AGENT_TITLE}}"

on:
  schedule:
    {{CRON_ENTRIES}}
  workflow_dispatch:
    inputs:
      task-amend:
        description: "Additional text appended to the task prompt"
        required: false
        type: string

permissions:
  contents: write

jobs:
  kata:
    runs-on: ubuntu-latest
    steps:
      - uses: forwardimpact/kata-action-agent@v1
        with:
          app-id: ${{ secrets.KATA_APP_ID }}
          app-private-key: ${{ secrets.KATA_APP_PRIVATE_KEY }}
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          agent-profile: "{{AGENT_NAME}}"
          model: "{{MODEL}}"
          wiki: "{{WIKI}}"
          task-text: >-
            Assess the current state of your domain and act on the
            highest-priority finding.
          task-amend: ${{ inputs.task-amend }}
```

## Notes

- **Cron entries** come from `schedules.md`. Agents with only a night shift
  (security-engineer, technical-writer) get one cron line; agents with all three
  shifts get three.
- **File name** follows `agent-{name}.yml` (e.g., `agent-product-manager.yml`).
- The `permissions: contents: write` block restricts `GITHUB_TOKEN`. The App
  token carries all other permissions via its installation settings.
- If wiki is disabled, set `wiki: "false"` -- the action skips wiki checkout and
  sync.
- If model is the default (`claude-opus-4-7[1m]`), the `model:` line can be
  omitted since the action defaults to it.
