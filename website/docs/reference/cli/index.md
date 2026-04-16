---
title: CLI Reference
description: Commands, arguments, and options for all Forward Impact CLI tools.
---

> **Availability:** `fit-pathway`, `fit-map`, `fit-basecamp`, `fit-guide`,
> `fit-landmark`, `fit-summit`, and `fit-rc` are published to npm and can be
> installed standalone. `fit-doc` and `fit-terrain` are monorepo-only tools that
> require a full checkout of the
> [monorepo](https://github.com/forwardimpact/monorepo).

## fit-map

Data validation, index generation, and activity management.

```sh
npx fit-map init                        # Create ./data/pathway/ with starter framework data
npx fit-map validate                    # Validate all data (JSON Schema + referential integrity)
npx fit-map validate --shacl            # Validate RDF/SHACL syntax
npx fit-map validate --data=PATH        # Validate a specific data directory
npx fit-map generate-index              # Generate _index.yaml files for browser loading
npx fit-map export                      # Render base entities to HTML microdata
npx fit-map export --output=PATH        # Export to a specific directory
npx fit-map people validate <file>      # Validate people CSV/YAML without importing
npx fit-map people push <file>          # Push people from CSV/YAML to database
npx fit-map activity start              # Start Supabase activity stack
npx fit-map activity stop               # Stop activity stack
npx fit-map activity status             # Show activity stack status
npx fit-map activity migrate            # Run database migrations
npx fit-map activity transform <type>   # Transform activity data
npx fit-map activity verify             # Verify activity data
npx fit-map activity seed               # Seed activity data from framework
npx fit-map getdx sync                  # Extract and transform GetDX snapshots
```

| Option          | Description                      |
| --------------- | -------------------------------- |
| `--shacl`       | Include RDF/SHACL syntax checks  |
| `--data=<path>` | Use a specific data directory    |
| `--url=<url>`   | Supabase URL for remote commands |

---

## fit-pathway

### Data Directory Resolution

By default, `fit-pathway` walks upward from the current working directory
looking for a `data/` folder, then appends `/pathway`. Framework data must be in
`./data/pathway/` (not `./data/` directly).

Use `--data` to override, pointing to the `pathway` subdirectory directly:

```sh
npx fit-pathway discipline --list --data=./data/pathway
npx fit-pathway job software_engineering L3 --data=./custom-path/pathway
```

### Entity Browsing

All entity commands support three output modes:

| Mode    | Pattern                        | Description                 |
| ------- | ------------------------------ | --------------------------- |
| Summary | `npx fit-pathway <command>`    | Concise overview with stats |
| List    | `npx fit-pathway <cmd> --list` | IDs for piping              |
| Detail  | `npx fit-pathway <cmd> <id>`   | Full entity details         |

Entity commands: `discipline`, `level`, `track`, `behaviour`, `driver`, `skill`,
`tool`.

**Global options** (apply to all fit-pathway commands):

| Option          | Description                  |
| --------------- | ---------------------------- |
| `--data=<path>` | Path to data directory       |
| `--json`        | Output as JSON               |
| `--list`        | Output IDs only (for piping) |
| `--version`     | Show version number          |
| `--help`        | Show help message            |

```sh
npx fit-pathway skill --list          # List all skill IDs
npx fit-pathway skill <id>            # Show skill details
npx fit-pathway skill <id> --agent    # Output as agent SKILL.md format
npx fit-pathway tool --list           # List tools derived from skill toolReferences
```

### Job Generation

```sh
npx fit-pathway job                                       # Summary with stats
npx fit-pathway job --track=<track>                       # Summary filtered by track
npx fit-pathway job --list                                # Valid combinations
npx fit-pathway job --list --track=<track>                # Combinations for a track
npx fit-pathway job <discipline> <level>                  # Trackless job
npx fit-pathway job <discipline> <level> --track=<track>  # With track
npx fit-pathway job <discipline> <level> --skills         # Skill IDs only
npx fit-pathway job <discipline> <level> --tools          # Tool names only
```

**Arguments:**

- `<discipline>` -- Discipline ID (e.g. `software_engineering`)
- `<level>` -- Level ID (e.g. `J060`)

**Options:**

| Option         | Description                              |
| -------------- | ---------------------------------------- |
| `--track=<id>` | Track ID (e.g. `platform`)               |
| `--list`       | List valid discipline/level combinations |
| `--skills`     | Output skill IDs only                    |
| `--tools`      | Output tool names only                   |

### Agent Generation

```sh
npx fit-pathway agent --list                                         # Valid combinations
npx fit-pathway agent <discipline> --track=<track>                   # Preview
npx fit-pathway agent <discipline> --track=<track> --output=./agents # Write files
npx fit-pathway agent <discipline> --track=<track> --skills          # Skill IDs only
npx fit-pathway agent <discipline> --track=<track> --tools           # Tool names only
```

**Arguments:**

- `<discipline>` -- Discipline ID

**Options:**

| Option           | Description                    |
| ---------------- | ------------------------------ |
| `--track=<id>`   | Track ID                       |
| `--output=<dir>` | Write agent files to directory |
| `--list`         | List valid combinations        |
| `--skills`       | Output skill IDs only          |
| `--tools`        | Output tool names only         |

### Interview, Progress, and Questions

```sh
npx fit-pathway interview <discipline> <level>
npx fit-pathway interview <d> <l> --track=<t> --type=mission

npx fit-pathway progress <discipline> <level>
npx fit-pathway progress <d> <l> --compare=<to_level>

npx fit-pathway questions
npx fit-pathway questions --skill=<id>
npx fit-pathway questions --behaviour=<id>
npx fit-pathway questions --capability=<id>
npx fit-pathway questions --role=<role>
```

**Interview options:**

| Option          | Description                     |
| --------------- | ------------------------------- |
| `--track=<id>`  | Track ID                        |
| `--type=<type>` | Interview type (e.g. `mission`) |

**Progress options:**

| Option              | Description                 |
| ------------------- | --------------------------- |
| `--compare=<level>` | Compare with a target level |

**Questions options:**

| Option              | Description            |
| ------------------- | ---------------------- |
| `--skill=<id>`      | Filter by skill ID     |
| `--behaviour=<id>`  | Filter by behaviour ID |
| `--capability=<id>` | Filter by capability   |
| `--role=<role>`     | Filter by role         |

### Build and Development

```sh
npx fit-pathway dev                           # Run live development server
npx fit-pathway dev --port=8080               # Dev server on custom port
npx fit-pathway build --output=./public --url=https://example.com  # Static site
npx fit-pathway update                        # Update local installation
```

| Option           | Description                     |
| ---------------- | ------------------------------- |
| `--port=<port>`  | Dev server port (default: 3000) |
| `--output=<dir>` | Static site output directory    |
| `--url=<url>`    | Base URL for the built site     |

---

## fit-basecamp

Personal operations center: calendar sync, meeting briefings, and background AI
agents.

```sh
fit-basecamp                         # Wake due agents once and exit
fit-basecamp daemon                  # Run continuously (poll every 60s)
fit-basecamp wake <agent>            # Wake a specific agent immediately
fit-basecamp stop                    # Gracefully stop daemon and agents
fit-basecamp status                  # Show agent status and last decisions
fit-basecamp validate                # Validate agent definitions exist
fit-basecamp init <path>             # Initialize a new knowledge base
fit-basecamp update [path]           # Update KB with latest templates
```

| Command         | Description                                |
| --------------- | ------------------------------------------ |
| `daemon`        | Run continuously, polling every 60 seconds |
| `wake <agent>`  | Wake a specific agent by name              |
| `stop`          | Graceful shutdown of daemon and agents     |
| `status`        | Display agent status and last decisions    |
| `validate`      | Check that agent definitions exist         |
| `init <path>`   | Initialize a new knowledge base at path    |
| `update [path]` | Update existing KB with latest templates   |

---

## fit-guide

Conversational AI agent for engineering frameworks.

```sh
npx fit-guide                            # Start interactive REPL session
npx fit-guide status                     # Check system readiness
npx fit-guide init                       # Generate secrets, .env, and config
echo "question" | npx fit-guide          # Pipe mode (single question, exit)
npx fit-guide --streaming                # Use streaming agent endpoint
```

| Command  | Description                        |
| -------- | ---------------------------------- |
| _(none)_ | Interactive REPL session           |
| `status` | Check system readiness             |
| `init`   | Generate secrets, .env, and config |

| Option        | Description                      |
| ------------- | -------------------------------- |
| `--data`      | Path to framework data directory |
| `--streaming` | Use streaming agent endpoint     |
| `--json`      | Output as JSON                   |

---

## fit-landmark

Engineering signal analysis layer. Combines GitHub artifact evidence with GetDX
snapshots. No LLM calls.

```sh
npx fit-landmark org show                         # Show organization directory
npx fit-landmark org team <email>                  # Show hierarchy under a manager
npx fit-landmark snapshot list                     # List available snapshots
npx fit-landmark snapshot show                     # Show snapshot factor/driver scores
npx fit-landmark snapshot trend                    # Show snapshot trends over time
npx fit-landmark marker <skill>                    # Show evidence markers for a skill
npx fit-landmark evidence <email>                  # Show evidence for a person
npx fit-landmark readiness <email>                 # Show promotion readiness
npx fit-landmark timeline <email>                  # Show activity timeline
npx fit-landmark coverage <team>                   # Show team coverage
npx fit-landmark practice <email>                  # Show practice patterns
npx fit-landmark practiced <email>                 # Show practiced capabilities
npx fit-landmark health <team>                     # Show team health metrics
npx fit-landmark voice <team>                      # Show team voice (comments)
npx fit-landmark initiative <team>                 # Show team initiative patterns
```

| Command      | Description                            |
| ------------ | -------------------------------------- |
| `org`        | Organization directory and hierarchy   |
| `snapshot`   | GetDX snapshot listing, scores, trends |
| `marker`     | Evidence markers for skills            |
| `evidence`   | Evidence portfolio for a person        |
| `readiness`  | Promotion readiness assessment         |
| `timeline`   | Activity timeline for a person         |
| `coverage`   | Team capability coverage               |
| `practice`   | Practice patterns for a person         |
| `practiced`  | Practiced capabilities for a person    |
| `health`     | Team health metrics                    |
| `voice`      | Team voice from comments               |
| `initiative` | Team initiative patterns               |

---

## fit-summit

Team capability analysis. Deterministic, no LLM calls.

```sh
npx fit-summit roster                                        # Show current roster
npx fit-summit validate                                      # Validate roster file
npx fit-summit coverage <team>                               # Capability coverage
npx fit-summit coverage <team> --evidenced                   # Include practiced capability
npx fit-summit risks <team>                                  # Structural risks
npx fit-summit growth <team>                                 # Growth opportunities
npx fit-summit what-if <team> --add 'Jane, senior, backend'  # Add scenario
npx fit-summit what-if <team> --remove 'Bob'                 # Remove scenario
npx fit-summit what-if <team> --promote 'Alice'              # Promote scenario
npx fit-summit compare <team1> <team2>                       # Compare teams
npx fit-summit trajectory <team>                             # Capability over time
```

| Command      | Description                                    |
| ------------ | ---------------------------------------------- |
| `roster`     | Show current roster                            |
| `validate`   | Validate roster file                           |
| `coverage`   | Show capability coverage for a team            |
| `risks`      | Identify structural risks in team composition  |
| `growth`     | Show growth opportunities aligned to team gaps |
| `what-if`    | Simulate roster changes                        |
| `compare`    | Compare two teams' coverage and risks          |
| `trajectory` | Show team capability over time                 |

**Arguments:**

- `<team>` -- Team identifier

**what-if options:**

| Option               | Description                        |
| -------------------- | ---------------------------------- |
| `--add=<person>`     | Add a hypothetical person          |
| `--remove=<person>`  | Remove a team member               |
| `--move=<person>`    | Move a member between teams        |
| `--to=<team>`        | Destination team for `--move`      |
| `--promote=<person>` | Promote a member to the next level |
| `--focus=<cap>`      | Filter the diff to one capability  |

**Shared options** (apply to coverage, risks, growth, what-if):

| Option                  | Description                                         |
| ----------------------- | --------------------------------------------------- |
| `--evidenced`           | Include practiced capability from Map evidence      |
| `--lookback-months=<n>` | Lookback window for practice patterns (default: 12) |
| `--project=<id>`        | Use a project team instead of a reporting team      |
| `--audience=<level>`    | Privacy audience: engineer, manager, director       |

**Global options:**

| Option            | Description                                         |
| ----------------- | --------------------------------------------------- |
| `--roster=<path>` | Path to summit.yaml                                 |
| `--data=<path>`   | Path to Map data directory                          |
| `--format=<fmt>`  | Output format: text, json, markdown (default: text) |

---

## fit-terrain

Synthetic data generation from a terrain DSL file.

```sh
npx fit-terrain                      # Use cached prose (default)
npx fit-terrain --generate           # Generate prose via LLM
npx fit-terrain --no-prose           # Structural scaffolding only
npx fit-terrain --strict             # Fail on cache miss
npx fit-terrain --load               # Load raw docs to storage
npx fit-terrain --only=pathway       # Render only one content type
npx fit-terrain --dry-run            # Show what would be written
npx fit-terrain --story=path         # Custom story DSL file
npx fit-terrain --cache=path         # Custom prose cache file
```

| Option           | Description                         |
| ---------------- | ----------------------------------- |
| `--generate`     | Call LLM to produce new prose       |
| `--no-prose`     | Skip prose, structural output only  |
| `--strict`       | Fail if prose cache is missing keys |
| `--load`         | Load generated docs into storage    |
| `--only=<type>`  | Render a single content type        |
| `--dry-run`      | Preview without writing files       |
| `--story=<path>` | Path to custom story DSL file       |
| `--cache=<path>` | Path to custom prose cache file     |

---

## fit-rc

Service stack supervisor for Guide. Manages microservices in dependency order.

```sh
npx fit-rc start              # Start all services
npx fit-rc stop               # Graceful shutdown
npx fit-rc restart            # Restart all services
npx fit-rc status             # Show service status
npx fit-rc start <service>   # Start up to a specific service
```

| Command   | Description                         |
| --------- | ----------------------------------- |
| `start`   | Start services in dependency order  |
| `stop`    | Graceful shutdown of all services   |
| `restart` | Stop and restart all services       |
| `status`  | Show running status of each service |

| Option           | Description       |
| ---------------- | ----------------- |
| `-s`, `--silent` | Suppress output   |
| `-h`, `--help`   | Show help message |

---

## fit-doc

Documentation site builder.

```sh
npx fit-doc build --src=website --out=dist    # Build static site
npx fit-doc serve --src=website               # Development server
npx fit-doc serve --src=website --port=8080   # Custom port
npx fit-doc build --src=website --out=dist --base-url=https://example.com  # With base URL
```

| Option             | Description                         |
| ------------------ | ----------------------------------- |
| `--src=<dir>`      | Source directory                    |
| `--out=<dir>`      | Output directory (build only)       |
| `--base-url=<url>` | Base URL for absolute links         |
| `--port=<port>`    | Dev server port (default: 3000)     |
| `--watch`, `-w`    | Watch for changes (serve mode only) |

---

## Related Documentation

- [Guides](/docs/guides/) -- Task-oriented usage walkthroughs
- [Core Model](/docs/reference/model/) -- Entity definitions and derivation
- [YAML Schema](/docs/reference/yaml-schema/) -- File format reference
