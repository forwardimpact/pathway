---
applyTo: "apps/pathway/**"
---

# Pathway Tasks

## Web App

```sh
npx fit-pathway dev                # Start at http://localhost:3000
npx fit-pathway dev --port=8080    # Custom port
npx fit-pathway build              # Generate static site to ./public/
```

## Entity Browsing

| Mode    | Pattern                        | Description                 |
| ------- | ------------------------------ | --------------------------- |
| Summary | `npx fit-pathway <command>`    | Concise overview with stats |
| List    | `npx fit-pathway <cmd> --list` | IDs for piping              |
| Detail  | `npx fit-pathway <cmd> <id>`   | Full entity details         |

```sh
# Browse skills
npx fit-pathway skill
npx fit-pathway skill --list
npx fit-pathway skill <skill_id>

# Browse tools (aggregated from skills)
npx fit-pathway tool
npx fit-pathway tool <tool_name>
```

## Job Generation

```sh
npx fit-pathway job --list                              # Valid combinations
npx fit-pathway job <discipline> <grade>                # Trackless job
npx fit-pathway job <discipline> <grade> --track=<track>
npx fit-pathway job <discipline> <grade> --checklist=code
```

## Agent Generation

```sh
npx fit-pathway agent --list                            # Valid combinations
npx fit-pathway agent <discipline>                      # Preview
npx fit-pathway agent <discipline> --track=<track>
npx fit-pathway agent <discipline> --track=<track> --output=./agents
npx fit-pathway agent <discipline> --track=<track> --all-stages
```

## Interview Preparation

```sh
npx fit-pathway interview <discipline> <grade>
npx fit-pathway interview <discipline> <grade> --track=<track>
npx fit-pathway interview <discipline> <grade> --type=short
```

## Career Progression

```sh
npx fit-pathway progress <discipline> <grade>
npx fit-pathway progress <discipline> <from_grade> --compare=<to_grade>
```

## Questions

```sh
npx fit-pathway questions
npx fit-pathway questions --level=practitioner
npx fit-pathway questions --skill=<skill_id>
npx fit-pathway questions --stats
```

## Adding New Pages

1. Create page in `src/pages/{page}.js`
2. Export `render(container, params)` and optionally `cleanup()`
3. Register route in `src/lib/router.js`
4. Use formatters from `src/formatters/` for presentation

## Adding New Commands

1. Create command in `src/commands/{command}.js`
2. Export `execute(data, args)` returning output string
3. Register in `src/commands/index.js`
4. Add help text in CLI entry point
