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
npx fit-map init                        # Create ./data/pathway/ with starter standard data
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
npx fit-map activity seed               # Seed activity data from agent-aligned engineering standard
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
looking for a `data/` folder, then appends `/pathway`. Standard data must be in
`./data/pathway/` (not `./data/` directly).

Use `--data` to override, pointing to the `pathway` subdirectory directly:

```sh
npx fit-pathway discipline --list --data=./data/pathway
npx fit-pathway job software_engineering J060 --data=./custom-path/pathway
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
| `--track=<id>`   | Track ID (required)            |
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
npx fit-pathway questions --level=<id>
npx fit-pathway questions --maturity=<maturity>
npx fit-pathway questions --stats
```

**Interview options:**

| Option          | Description                     |
| --------------- | ------------------------------- |
| `--track=<id>`  | Track ID                        |
| `--type=<type>` | Interview type (e.g. `mission`) |

**Progress options:**

| Option              | Description                 |
| ------------------- | --------------------------- |
| `--track=<id>`      | Track ID                    |
| `--compare=<level>` | Compare with a target level |

**Questions options:**

| Option              | Description                  |
| ------------------- | ---------------------------- |
| `--skill=<id>`      | Filter by skill ID           |
| `--behaviour=<id>`  | Filter by behaviour ID       |
| `--capability=<id>` | Filter by capability ID      |
| `--level=<id>`      | Filter by level ID           |
| `--maturity=<id>`   | Filter by behaviour maturity |
| `--stats`           | Show question statistics     |

### Build and Development

```sh
npx fit-pathway dev                           # Run live development server
npx fit-pathway dev --port=8080               # Dev server on custom port
npx fit-pathway build --output=./public --url=https://example.com  # Static site
npx fit-pathway build --no-clean              # Skip cleaning output directory
npx fit-pathway update                        # Update local installation
```

| Option           | Description                                       |
| ---------------- | ------------------------------------------------- |
| `--port=<port>`  | Dev server port (default: 3000)                   |
| `--output=<dir>` | Static site output directory                      |
| `--url=<url>`    | Base URL for the built site                       |
| `--clean`        | Clean output directory before build (default: on) |

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

Conversational AI agent for agent-aligned engineering standards. Runs as a REPL;
subcommands are typed at the prompt with a leading `/` (e.g. `/status`).

```sh
npx fit-guide                            # Start interactive REPL session
echo "question" | npx fit-guide          # Pipe mode (single question, exit)
```

Inside the REPL:

```
❯ /init       # Initialize Guide configuration
❯ /login      # Authenticate with Anthropic
❯ /logout     # Clear stored credentials
❯ /status     # Check system readiness
❯ /version    # Show version
```

| Command    | Description                    |
| ---------- | ------------------------------ |
| `/init`    | Initialize Guide configuration |
| `/login`   | Authenticate with Anthropic    |
| `/logout`  | Clear stored credentials       |
| `/status`  | Check system readiness         |
| `/version` | Show version                   |

---

## fit-landmark

Engineering signal analysis layer. Combines GitHub artifact evidence with GetDX
snapshots. No LLM calls.

Most filters are passed as options (`--manager`, `--email`, `--skill`,
`--target`), not positional arguments. Only `marker` takes a positional skill
ID.

```sh
npx fit-landmark org show                                  # Full organization directory
npx fit-landmark org team --manager=alice@example.com      # Hierarchy under a manager
npx fit-landmark snapshot list                             # Available snapshots
npx fit-landmark snapshot show --snapshot=<id>             # Factor/driver scores
npx fit-landmark snapshot trend --item=<driver-id>         # Trend across snapshots
npx fit-landmark snapshot compare --snapshot=<id>          # Compare against benchmarks
npx fit-landmark marker task_completion                    # Marker definitions for a skill
npx fit-landmark evidence --email=alice@example.com        # Marker-linked evidence
npx fit-landmark readiness --email=alice@example.com --target=J060
npx fit-landmark timeline --email=alice@example.com        # Individual growth timeline
npx fit-landmark coverage --email=alice@example.com        # Evidence coverage metrics
npx fit-landmark practice --skill=task_completion          # Practice-pattern aggregates
npx fit-landmark practiced --manager=alice@example.com     # Evidenced vs derived capability
npx fit-landmark health --manager=alice@example.com        # Driver scores and evidence
npx fit-landmark voice --manager=alice@example.com         # Engineer voice from comments
npx fit-landmark initiative list                           # Active initiatives
npx fit-landmark initiative show --id=<initiative-id>      # Initiative detail
npx fit-landmark initiative impact                         # Impact on driver scores
```

| Command             | Description                         |
| ------------------- | ----------------------------------- |
| `org show`          | Full organization directory         |
| `org team`          | Hierarchy under a manager           |
| `snapshot list`     | List available snapshots            |
| `snapshot show`     | Factor/driver scores for a snapshot |
| `snapshot trend`    | Track item trend across snapshots   |
| `snapshot compare`  | Compare snapshot against benchmarks |
| `marker <skill>`    | Marker definitions for a skill      |
| `evidence`          | Marker-linked evidence              |
| `readiness`         | Promotion readiness checklist       |
| `timeline`          | Individual growth timeline          |
| `coverage`          | Evidence coverage metrics           |
| `practice`          | Practice-pattern aggregates         |
| `practiced`         | Evidenced vs derived capability     |
| `health`            | Driver scores and evidence          |
| `voice`             | Engineer voice from GetDX comments  |
| `initiative list`   | List active initiatives             |
| `initiative show`   | Initiative detail                   |
| `initiative impact` | Initiative impact on scores         |

**Common filters:**

| Option              | Description                         |
| ------------------- | ----------------------------------- |
| `--manager=<email>` | Filter by manager email             |
| `--email=<email>`   | Filter by person email              |
| `--skill=<id>`      | Filter by skill ID                  |
| `--target=<level>`  | Readiness target level              |
| `--snapshot=<id>`   | Snapshot ID for `snapshot show`     |
| `--item=<id>`       | Driver/item ID for `snapshot trend` |
| `--id=<id>`         | Entity ID for `initiative show`     |

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

| Option                | Description                                    |
| --------------------- | ---------------------------------------------- |
| `--add=<person>`      | Add a hypothetical person                      |
| `--remove=<person>`   | Remove a team member                           |
| `--move=<person>`     | Move a member between teams                    |
| `--to=<team>`         | Destination team for `--move`                  |
| `--promote=<person>`  | Promote a member to the next level             |
| `--focus=<cap>`       | Filter the diff to one capability              |
| `--allocation=<frac>` | Allocation fraction for `--add` on a project   |
| `--project=<id>`      | Use a project team instead of a reporting team |

**Shared options** (apply to coverage, risks, growth):

| Option                  | Description                                         |
| ----------------------- | --------------------------------------------------- |
| `--evidenced`           | Include practiced capability from Map evidence      |
| `--lookback-months=<n>` | Lookback window for practice patterns (default: 12) |
| `--project=<id>`        | Use a project team instead of a reporting team      |
| `--audience=<level>`    | Privacy audience: engineer, manager, director       |

**growth-only options:**

| Option       | Description                                   |
| ------------ | --------------------------------------------- |
| `--outcomes` | Weight recommendations by GetDX driver scores |

**compare options:**

| Option               | Description                                   |
| -------------------- | --------------------------------------------- |
| `--left-project`     | Treat the first team as a project             |
| `--right-project`    | Treat the second team as a project            |
| `--audience=<level>` | Privacy audience: engineer, manager, director |

**trajectory options:**

| Option           | Description                                    |
| ---------------- | ---------------------------------------------- |
| `--quarters=<n>` | Number of quarters to show (default: 4)        |
| `--evidenced`    | Include practiced capability from Map evidence |

**Global options:**

| Option            | Description                                         |
| ----------------- | --------------------------------------------------- |
| `--roster=<path>` | Path to summit.yaml                                 |
| `--data=<path>`   | Path to Map data directory                          |
| `--format=<fmt>`  | Output format: text, json, markdown (default: text) |

---

## fit-terrain

Synthetic data generation from a terrain DSL file. Monorepo-only — invoke with
`bunx`.

```sh
bunx fit-terrain                      # Use cached prose (default)
bunx fit-terrain --generate           # Generate prose via LLM
bunx fit-terrain --no-prose           # Structural scaffolding only
bunx fit-terrain --strict             # Fail on cache miss
bunx fit-terrain --load               # Load raw docs to storage
bunx fit-terrain --only=pathway       # Render only one content type
bunx fit-terrain --dry-run            # Show what would be written
bunx fit-terrain --story=path         # Custom story DSL file
bunx fit-terrain --cache=path         # Custom prose cache file
```

| Option           | Description                                                 |
| ---------------- | ----------------------------------------------------------- |
| `--generate`     | Call LLM to produce new prose                               |
| `--no-prose`     | Skip prose, structural output only                          |
| `--strict`       | Fail if prose cache is missing keys                         |
| `--load`         | Load generated docs into storage                            |
| `--only=<type>`  | Render a single content type (html, pathway, raw, markdown) |
| `--dry-run`      | Preview without writing files                               |
| `--story=<path>` | Path to custom story DSL file                               |
| `--cache=<path>` | Path to custom prose cache file                             |

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

Documentation site builder. Monorepo-only — invoke with `bunx`.

```sh
bunx fit-doc build --src=websites/fit --out=dist    # Build static site
bunx fit-doc serve --src=websites/fit               # Development server
bunx fit-doc serve --src=websites/fit --port=8080   # Custom port
bunx fit-doc build --src=websites/fit --out=dist --base-url=https://example.com  # With base URL
```

**Global options** (apply to both `build` and `serve`):

| Option        | Description                          |
| ------------- | ------------------------------------ |
| `--src=<dir>` | Source directory (default: `public`) |
| `--out=<dir>` | Output directory (default: `dist`)   |

**Command-specific options:**

| Option             | Description                                         |
| ------------------ | --------------------------------------------------- |
| `--base-url=<url>` | Base URL for sitemap, canonical links, and llms.txt |
| `--port=<port>`    | Dev server port (default: 3000) — `serve` only      |
| `--watch`, `-w`    | Watch for changes and rebuild — `serve` only        |

---

## Related Documentation

- [Guides](/docs/guides/) -- Task-oriented usage walkthroughs
- [Core Model](/docs/reference/model/) -- Entity definitions and derivation
- [YAML Schema](/docs/reference/yaml-schema/) -- File format reference
