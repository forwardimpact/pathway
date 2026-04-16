# 510 — Guide Getting-Started Gaps

## Problem

An engineer following the
[Getting Started: Engineers](../../website/docs/getting-started/engineers/index.md)
guide for the Guide product cannot reach a working end-to-end conversation. Three
independent defects combine to produce a silent failure: the agent receives
questions, calls the LLM, and returns planner-stage output that looks like a
real answer — but no tools are dispatched, no framework data is retrieved, and
the response is generic filler.

The defects were found by walking the documented steps exactly as written on
2026-04-16 against a clean `fit-map init` dataset. Each was isolated,
diagnosed, and confirmed independently.

## Evidence

### 1. `fit-process-tools` is not documented

The getting-started guide documents three processing commands (lines 142–146):

```
npx fit-process-agents
npx fit-process-resources
npx fit-process-graphs
```

`fit-process-tools` is absent. Without it, the tool resource index
(`data/resources/tool.ToolFunction.*.json`) is empty. The agent service has no
tool definitions to present to the LLM, so the LLM never generates tool calls.

**Observed behaviour:** The planner agent produces an execution plan as markdown
text ("Let me retrieve the ontology now") but the tool service logs show zero
`CallTool` requests. The response looks like an answer but contains no framework
data.

**After running `fit-process-tools --proto-root ./generated`:** 14 tool
resources were created and the agent began dispatching tool calls
(`get_ontology`, `pathway_list_jobs`, etc.).

The `--proto-root ./generated` flag is also undocumented. The tool processor
defaults to `process.cwd()` and looks for `proto/{package}.proto`
(`libraries/libtool/src/processor/tool.js:136–142`). Proto files live in
`generated/proto/` after codegen, not at the working directory root.

### 2. `fit-guide init` omits `SERVICE_PATHWAY_URL` from `.env`

The init command generates service URLs for 8 services on ports 3001–3008
(`products/guide/bin/fit-guide.js:152–162`):

```javascript
const serviceUrls = {
  SERVICE_WEB_URL: "http://localhost:3001",
  SERVICE_AGENT_URL: "grpc://localhost:3002",
  SERVICE_MEMORY_URL: "grpc://localhost:3003",
  SERVICE_LLM_URL: "grpc://localhost:3004",
  SERVICE_VECTOR_URL: "grpc://localhost:3005",
  SERVICE_GRAPH_URL: "grpc://localhost:3006",
  SERVICE_TOOL_URL: "grpc://localhost:3007",
  SERVICE_TRACE_URL: "grpc://localhost:3008",
};
```

The pathway service is absent from this list. It falls back to the libconfig
default of port 3000 (`libraries/libconfig/src/config.js`), but no other
service knows to reach it there. When the tool service dispatches a
`pathway_list_jobs` call, the gRPC connection hangs indefinitely — no timeout,
no error, just silence.

The pathway service IS defined in the starter `config.json`
(`products/guide/starter/config.json`) and its 6 tool endpoints
(`pathway_list_jobs`, `pathway_describe_job`, etc.) are registered in the
starter tool configuration. The `.env` generation simply does not include it.

**Observed behaviour:** `tail data/logs/tool/current` showed `ListJobs` sent at
05:25:44 with no follow-up log entry. `tail data/logs/pathway/current` showed
only the `Listening` message — the request never arrived. The CLI hung until
killed.

**After adding `SERVICE_PATHWAY_URL=grpc://localhost:3000` to `.env`:** pathway
tool calls completed and returned framework data (job definitions, skill
matrices, progression diffs).

### 3. `fit-guide init` skips config file creation when `config/` exists

The init command checks for the `config/` directory
(`products/guide/bin/fit-guide.js:196–200`):

```javascript
try {
  await fs.access(configDir);
  process.stdout.write(
    formatBullet("config/ already exists, skipping starter copy.", 0) + "\n",
  );
} catch {
  await fs.cp(starterDir, configDir, { recursive: true });
```

The monorepo ships `config/` with tracked `.example.*` files
(`config.example.json`, `tools.example.yml`, `agents/*.agent.example.md`). The
directory exists, so the starter copy is skipped entirely. The live files
(`config.json`, `tools.yml`, `agents/*.agent.md`) are gitignored and never
created.

This affects both internal contributors (whose `config/` always exists from the
repository) and external users (whose `config/` may exist from a prior partial
init or from another product's init).

**Observed behaviour:** `fit-guide init` printed
`config/ already exists, skipping starter copy.` and exited. `config/config.json`
did not exist. Services failed to start without it.

### 4. Starter researcher agent lacks pathway tools

The starter researcher agent definition
(`products/guide/starter/agents/researcher.agent.md:5–12`) lists 8 tools:

```yaml
tools:
  - get_ontology
  - get_subjects
  - query_by_pattern
  - search_content
  - list_sub_agents
  - run_sub_agent
  - list_handoffs
  - run_handoff
```

The starter `config.json` defines 6 pathway tool endpoints
(`pathway_list_jobs`, `pathway_describe_job`, `pathway_list_agent_profiles`,
`pathway_describe_agent_profile`, `pathway_describe_progression`,
`pathway_list_job_software`). None appear in the researcher's tool list.

**Observed behaviour:** Even after issues 1–3 were fixed, the researcher agent
only called graph tools (`get_subjects` with `type="schema:Discipline"`) which
returned empty results because the graph has no framework entities. Pathway
tools — which serve the actual framework data — were never called because the
agent didn't know they existed.

**After adding the 6 pathway tools to the researcher agent:** the agent called
`pathway_list_jobs` and returned real job definitions from the starter data.

## Scope

### Affected

- `products/guide/bin/fit-guide.js` — the `runInit()` function (`.env`
  generation and config copy logic)
- `products/guide/starter/agents/researcher.agent.md` — tool list
- `website/docs/getting-started/engineers/index.md` — Guide processing steps
  section

### Excluded

- The graph processing pipeline (empty graph is expected for a fresh install
  with no HTML knowledge base content)
- Planner agent prompt tuning (the planner correctly delegates to researcher;
  the issue is the researcher lacks the right tools)
- Runtime timeout / error handling for unreachable services (desirable but
  separate concern)

## Success Criteria

1. After running all documented processing steps (including the newly documented
   `fit-process-tools`), `data/resources/` contains `tool.ToolFunction.*.json`
   entries for every tool endpoint defined in the starter `config.json`.
2. `fit-guide init` generates a `SERVICE_PATHWAY_URL` entry in `.env`.
3. `fit-guide init` creates `config/config.json`, `config/tools.yml`, and
   `config/agents/*.agent.md` even when `config/` already exists (by merging
   missing files rather than skipping the entire directory).
4. The getting-started guide documents `fit-process-tools` as a required
   processing step, including the proto root argument needed for npm installs.
5. The starter researcher agent definition includes all pathway tool names that
   are defined in the starter `config.json` tool endpoints.
