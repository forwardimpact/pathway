# 460 — Rewrite Reference Lifecycle page after stages removal

**Status:** draft **Author:** Technical Writer **Created:** 2026-04-14

## Problem

Spec 420 removed stages as a first-class entity from the pathway product, data
schema, and CLI. The Reference Lifecycle page
(`website/docs/reference/lifecycle/index.md`) was written when stages were
entities defined in `stages.yaml` with their own JSON schema. It describes:

1. **Six named stages as entities** with dedicated YAML definitions, handoffs,
   constraints, and checklists — `stages.yaml` and `stages.schema.json` no
   longer exist.

2. **Stage-specific agent generation** via `--stage` flag — the agent command no
   longer accepts `--stage` (spec 420 removed it; confirmed
   `ERR_PARSE_ARGS_UNKNOWN_OPTION`).

3. **Checklist derivation from stage x skill matrix** — checklists are now flat
   fields within skill agent sections (`agent.focus`, `agent.readChecklist`,
   `agent.confirmChecklist`), not derived from a stage entity.

4. **Multi-agent workflows by lifecycle stage** — agents are now one per
   discipline x track, not one per discipline x track x stage.

The page's conceptual content (lifecycle phases, handoffs, constraints) still
has value. But the entity-based framing is structurally stale and will confuse
users who look for `stages.yaml` or `--stage` options.

Additionally, the fit-pathway CLI has some undeclared options in its command
handlers that reference stage-era features. The `questions` handler expects
`--level`, `--maturity`, and `--stats` — none are declared in the CLI definition
and all throw parse errors. These are either dead code or missing registrations
from the spec 420 migration. (Note: `--skills`/`--tools` on `job` and `--output`
on `agent` were verified as properly registered and functional.)

## Proposed solution

### Option A: Reframe as conceptual reference (recommended)

Rewrite the Lifecycle page to describe lifecycle phases as **conceptual
guidance** rather than **entity definitions**:

- Remove all references to `stages.yaml`, stage schemas, and stage entity YAML.
- Reframe handoffs, constraints, and checklists as conceptual workflow guidance
  embedded in skill agent sections.
- Update the "Stages and Agents" section to reflect one-agent-per-track model.
- Remove mermaid diagrams showing stage-specific agent handoffs.
- Cross-link to the Authoring Frameworks guide for how skills define checklists.

### Option B: Remove the page entirely

If lifecycle phases are no longer a user-facing concept post spec 420, remove
the page and its card from the Reference index. Update cross-links from Core
Model and Agent Teams guides.

### Cleanup: fit-pathway phantom CLI options

Regardless of lifecycle page choice, audit and resolve the undeclared options in
fit-pathway command handlers:

| Command     | Undeclared options           | Disposition                     |
| ----------- | ---------------------------- | ------------------------------- |
| `questions` | --level, --maturity, --stats | Register or remove from handler |

These were documented in the CLI Reference and caused user-facing errors; the
documentation was fixed in PR #368 but the handler code still references them.

## Scope

- `website/docs/reference/lifecycle/index.md` — rewrite or remove
- `website/docs/reference/index.md` — update lifecycle card if reframing
- `website/docs/reference/model/index.md` — update lifecycle cross-link
- `products/pathway/bin/fit-pathway.js` — register or clean up undeclared
  options
- `products/pathway/src/commands/job.js` — verify option references
- `products/pathway/src/commands/questions.js` — verify option references
- `products/pathway/src/commands/agent.js` — verify option references

## Out of scope

- Spec 420 implementation progress (separate spec, actively in progress)
- fit-landmark and fit-guide CLI Reference content (added in PR #368)
- Core Model levels table (fixed to J040/J060 in PR #368)
