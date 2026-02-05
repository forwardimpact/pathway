---
applyTo: "**"
---

# Common Tasks

> **Data-Driven Application**: All entity IDs (skills, disciplines, tracks,
> grades, behaviours) shown in examples are for illustration only. The actual
> available values depend on the YAML files in `apps/schema/examples/`. Always
> use `npx fit-pathway <entity> --list` to discover what's available.

## Add Skill

1. Add skill to the appropriate capability file
   `apps/schema/examples/capabilities/{capability_id}.yaml`
2. Add skill object to the `skills:` array with `id`, `name`, and `human:`
   section
3. Include level descriptions for all five levels
4. Reference skill in disciplines (coreSkills/supportingSkills/broadSkills)
5. Add questions to `apps/schema/examples/questions/skills/{skill_id}.yaml`
6. Optionally add `agent:` section for AI coding agent support
7. Run `npx fit-schema validate`

## Add or Modify Interview Questions

Questions live in `apps/schema/examples/questions/` with one file per
skill/behaviour.

### File Location

- Skills: `apps/schema/examples/questions/skills/{skill_id}.yaml`
- Behaviours: `apps/schema/examples/questions/behaviours/{behaviour_id}.yaml`

### Question Properties

| Property                  | Required | Description                                            |
| ------------------------- | -------- | ------------------------------------------------------ |
| `id`                      | Yes      | Format: `{abbrev}_{level_abbrev}_{number}`             |
| `text`                    | Yes      | The question text (second person, under 150 chars)     |
| `lookingFor`              | Yes      | 2-4 bullet points of good answer indicators            |
| `expectedDurationMinutes` | No       | Default: 5 for awareness/foundational, 8-10 for higher |
| `followUps`               | No       | 1-3 probing questions for deeper exploration           |

### Skill Level Progression Patterns

| Level        | Scope               | Question Pattern                                           |
| ------------ | ------------------- | ---------------------------------------------------------- |
| awareness    | Learning            | "What do you understand about X?"                          |
| foundational | Applying basics     | "How do you X in your work?"                               |
| working      | Handles complexity  | "Describe X you've done. What trade-offs?"                 |
| practitioner | Leads and mentors   | "How have you improved X in your team?"                    |
| expert       | Shapes org practice | "How have you shaped X standards across the organization?" |

### Behaviour Maturity Progression Patterns

| Maturity      | Scope                 | Question Pattern                              |
| ------------- | --------------------- | --------------------------------------------- |
| emerging      | Individual interest   | "What X have you noticed/tried?"              |
| developing    | Regular practice      | "Tell me about a time when X"                 |
| practicing    | Consistent, proactive | "How do you approach X?"                      |
| role_modeling | Influences team       | "How do you help others/foster X?"            |
| exemplifying  | Shapes org culture    | "How do you shape X across the organization?" |

### Adding Questions

1. Open `apps/schema/examples/questions/skills/{skill_id}.yaml` or
   `apps/schema/examples/questions/behaviours/{behaviour_id}.yaml`
2. Add question to appropriate level/maturity section
3. Follow ID convention: `{abbrev}_{level_abbrev}_{number}`
4. Run `npx fit-schema validate` to verify

### Browsing Questions

Use the questions CLI command to compare and analyse questions:

```sh
# See all practitioner-level skill questions
npx fit-pathway questions --level=practitioner

# See all role_modeling behaviour questions
npx fit-pathway questions --maturity=role_modeling

# Question count statistics
npx fit-pathway questions --stats

# Deep dive on a single skill (use actual skill ID from your installation)
npx fit-pathway questions --skill=<skill_id>

# Export as YAML for bulk editing
npx fit-pathway questions --level=practitioner --format=yaml > practitioner-questions.yaml
```

## Add Derivation Function

1. Add pure function to `apps/model/lib/derivation.js`
2. Add tests in `tests/model.test.js`
3. Document with JSDoc

## Add Agent Skill

1. Add `agent:` section to skill in
   `apps/schema/examples/capabilities/{capability_id}.yaml`
2. Include required fields: `name`, `description`, `useWhen`, `stages`
3. Define stage-specific guidance (`specify`, `plan`, `code`, `review`,
   `deploy`)
4. Each stage needs: `focus`, `activities[]`, `ready[]` (readiness criteria)
5. Run `npx fit-schema validate` to verify

Example structure:

```yaml
agent:
  name: skill-name-kebab-case
  description: Brief description of what this skill provides
  useWhen: Triggering conditions - when agents should use this skill
  stages:
    plan:
      focus: What to accomplish in the plan stage
      activities:
        - Identify requirements
        - Define approach
      ready:
        - Requirements documented
        - Approach validated
    code:
      focus: What to accomplish during implementation
      activities:
        - Implement feature
        - Write tests
      ready:
        - Implementation complete
        - Tests pass
```

## Add Tool Reference

1. Add `toolReferences:` array to skill in
   `apps/schema/examples/capabilities/{capability_id}.yaml`
2. Include required fields: `name`, `description`, `useWhen`
3. Optionally add `url` for tool documentation link
4. Run `npx fit-schema validate` to verify

Example:

```yaml
toolReferences:
  - name: Langfuse
    url: https://langfuse.com/docs
    description: LLM observability and evaluation platform
    useWhen: Instrumenting AI applications with tracing
  - name: pytest
    description: Python testing framework
    useWhen: Writing unit or integration tests for Python code
```

## Generate Agent Profile

Agent profiles are generated from discipline × track × stage combinations. Use
`npx fit-pathway agent --list` to see valid combinations.

```sh
# Generate default agent
npx fit-pathway agent <discipline> --track=<track> --output=./agents

# Generate stage-specific agent
npx fit-pathway agent <discipline> --track=<track> --stage=plan --output=./agents

# Generate all stage variants
npx fit-pathway agent <discipline> --track=<track> --all-stages --output=./agents

# Preview without writing files (outputs to console)
npx fit-pathway agent <discipline> --track=<track> --stage=plan

# List available combinations
npx fit-pathway agent --list
```

## Add Agent Discipline or Track

1. Add configuration to `apps/schema/examples/disciplines/agent.yaml` or
   `apps/schema/examples/tracks/agent.yaml`
2. Ensure `id` matches the corresponding human definition
3. Include required fields (see existing entries for examples)
4. Run `npx fit-schema validate` to verify

## CLI Usage

Two CLIs are provided:

| CLI           | Package                  | Purpose                             |
| ------------- | ------------------------ | ----------------------------------- |
| `fit-schema`  | `@forwardimpact/schema`  | Schema validation, index generation |
| `fit-pathway` | `@forwardimpact/pathway` | Web app, entity browsing, agents    |

### Schema Commands (`fit-schema`)

```sh
npx fit-schema validate          # Validate all data files
npx fit-schema generate-index    # Generate _index.yaml for browser
npx fit-schema validate:shacl    # Validate SHACL ontology
```

### Pathway Commands (`fit-pathway`)

The CLI follows consistent patterns across all commands:

| Mode    | Pattern                        | Description                         |
| ------- | ------------------------------ | ----------------------------------- |
| Summary | `npx fit-pathway <command>`    | Concise overview with stats         |
| List    | `npx fit-pathway <cmd> --list` | IDs only, one per line (for piping) |
| Detail  | `npx fit-pathway <cmd> <id>`   | Full entity details                 |

### Getting Started

```sh
npx fit-pathway init                       # Create ./data/ with example data
npx fit-pathway serve                      # Serve web app at http://localhost:3000
npx fit-pathway serve --port=8080          # Custom port
npx fit-pathway site --output=./site       # Generate static site
```

### Entity Commands

```sh
# Summary view (default)
npx fit-pathway discipline
npx fit-pathway grade
npx fit-pathway track
npx fit-pathway behaviour
npx fit-pathway skill
npx fit-pathway driver
npx fit-pathway stage
npx fit-pathway tool

# List IDs for piping (discover available entities)
npx fit-pathway skill --list
npx fit-pathway tool --list
npx fit-pathway job --list | head -5

# Detail view (use actual IDs from your installation)
npx fit-pathway skill <skill_id>
npx fit-pathway discipline <discipline_id>
npx fit-pathway tool <tool_name>

# Agent SKILL.md output (for skills with agent section)
npx fit-pathway skill <skill_id> --agent
```

### Composite Commands

Job, interview, and progress commands take discipline and grade as positional
arguments. Track is optional via `--track=<track>`. Use
`npx fit-pathway <entity> --list` to discover available values.

```sh
# Job definition
npx fit-pathway job                                    # Summary
npx fit-pathway job --list                             # All valid combinations
npx fit-pathway job <discipline> <grade>               # Full specification
npx fit-pathway job <discipline> <grade> --track=<track>
npx fit-pathway job <discipline> <grade> --track=<track> --checklist=code

# Interview questions
npx fit-pathway interview <discipline> <grade>
npx fit-pathway interview <discipline> <grade> --track=<track> --type=short

# Career progression
npx fit-pathway progress <discipline> <grade>
npx fit-pathway progress <discipline> <from_grade> --track=<track> --compare=<to_grade>
```

### Questions Commands

```sh
# Summary
npx fit-pathway questions

# Filter and browse (level/maturity names are fixed in the model)
npx fit-pathway questions --level=practitioner
npx fit-pathway questions --maturity=role_modeling
npx fit-pathway questions --skill=<skill_id>
npx fit-pathway questions --behaviour=<behaviour_id>
npx fit-pathway questions --capability=<capability>
npx fit-pathway questions --stats

# Export
npx fit-pathway questions --list
npx fit-pathway questions --format=yaml > questions.yaml
```

### Tool Commands

Tools are aggregated from `toolReferences` within skills.

```sh
# Summary (top tools by usage)
npx fit-pathway tool

# List tool names for piping
npx fit-pathway tool --list

# Detail view (shows description and which skills use it)
npx fit-pathway tool <tool_name>

# JSON output
npx fit-pathway tool --json
npx fit-pathway tool <tool_name> --json
```

### Agent Commands

Agent commands use `--track` as an option (not positional).

```sh
# Summary
npx fit-pathway agent

# List combinations (discover what's available)
npx fit-pathway agent --list

# Generate files (use actual discipline and track IDs)
npx fit-pathway agent <discipline>
npx fit-pathway agent <discipline> --track=<track>
npx fit-pathway agent <discipline> --track=<track> --output=./agents

# Stage variants (plan, code, review)
npx fit-pathway agent <discipline> --track=<track> --stage=plan
npx fit-pathway agent <discipline> --track=<track> --all-stages
```

### JSON Output

```sh
npx fit-pathway skill --json
npx fit-pathway job <discipline> <grade> --json
npx fit-pathway job <discipline> <grade> --track=<track> --json
```

## NPM Scripts (Root)

- `npm run validate` — Validate data files via fit-schema
- `npm run validate:shacl` — Validate SHACL ontology
- `npm run generate-index` — Generate browser index files
- `npm start` — Start local web app at http://localhost:3000/
- `npm run check` — Run format, lint, test, and SHACL validation
- `npm run test` — Run unit tests
- `npm run test:e2e` — Run Playwright E2E tests
