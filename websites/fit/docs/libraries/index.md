---
title: Library Guides
description: Task-oriented guides for engineers and platform builders — wiki-backed agent memory, XmR analysis, agent surfaces, knowledge infrastructure, typed contracts, service lifecycle, and agent evaluations.
layout: product
toc: false
---

## Operate a Predictable Agent Team

Engineers

<div class="grid">

<a href="/docs/libraries/wiki-operations/persistent-memory/">

### Give Agent Teams Persistent Memory and Trustworthy Metrics

Set up wiki-backed memory for an agent team, record metrics with XmR control
charts, and verify that agents act on real changes instead of noise.

</a>

<a href="/docs/libraries/wiki-operations/">

### Send a Memo or Update a Storyboard

Send a message to a teammate, refresh storyboard charts, or sync wiki state --
without managing the wiki infrastructure yourself.

</a>

<a href="/docs/libraries/xmr-analysis/">

### Chart a Metric and Check Variation

Chart a metric over time and see whether the latest point is within expected
variation -- using `fit-xmr` to compute natural process limits and apply
Wheeler's detection rules.

</a>

</div>

## Enable Agents on Every Surface

Builders

<div class="grid">

<a href="/docs/libraries/agent-surfaces/">

### Give Agents and Humans the Same Interface

Build a CLI and a web UI that share one presenter, one contract, and one
formatter so capabilities work on both surfaces without separate integrations.

</a>

<a href="/docs/libraries/agent-surfaces/add-capability/">

### Add a Capability to Both Surfaces

Write a presenter, register a CLI command and a web route, and gain the feature
on terminal and browser at once.

</a>

</div>

## Ground Agents in Context

Builders

<div class="grid">

<a href="/docs/libraries/ground-agents/">

### Give Agents Typed, Retrievable Knowledge

Set up knowledge infrastructure so agents can answer relationship questions,
look up context, and find related content -- using libresource, libgraph,
libindex, and libvector without external engines.

</a>

<a href="/docs/libraries/ground-agents/query-graph/">

### Query a Knowledge Graph

Traverse relationships in an RDF graph index with triple patterns and
type-filtered subject listings.

</a>

<a href="/docs/libraries/ground-agents/lookup-context/">

### Look Up Context Fast

Filter and scan a JSONL-backed index without loading everything into memory --
using prefix, limit, and token-budget filters.

</a>

<a href="/docs/libraries/ground-agents/resolve-resource/">

### Resolve a Resource

Get a rich, typed context chunk from a resource identifier -- with provenance,
access control, and RDF content.

</a>

<a href="/docs/libraries/ground-agents/search-semantically/">

### Search Semantically

Score a natural-language query against a vector index and get ranked results in
memory -- without standing up a vector database.

</a>

</div>

## Integrate with the Engineering Standard

Builders

<div class="grid">

<a href="/docs/libraries/integrate-standard/">

### Turn Standard Definitions into Queryable Data

Load engineering standard YAML once with `@forwardimpact/libskill`, then derive
skill matrices, behaviour profiles, and agent configurations programmatically.

</a>

<a href="/docs/libraries/integrate-standard/derive-profile/">

### Derive a Skill Matrix or Agent Profile

Turn a discipline, level, and track into a skill matrix or agent profile without
parsing YAML by hand.

</a>

</div>

## Keep Service Contracts Typed

Builders

<div class="grid">

<a href="/docs/libraries/typed-contracts/">

### Keep Types Synced with Proto Definitions

Set up the codegen pipeline so proto changes flow through to JavaScript types,
MCP tools, and service endpoints -- one source of truth from definition to
runtime.

</a>

<a href="/docs/libraries/typed-contracts/expose-tool/">

### Expose a Proto Method as an Agent Tool

Register a new gRPC method as an MCP tool by adding one config entry -- no glue
code, no hand-written schema.

</a>

<a href="/docs/libraries/typed-contracts/ship-endpoint/">

### Ship a Service Endpoint

Create a gRPC service or call an existing one with `librpc` -- typed contracts,
automatic authentication, retries, and health checks.

</a>

</div>

## Keep Services Running and Visible

Builders

<div class="grid">

<a href="/docs/libraries/service-lifecycle/">

### Manage Service Lifecycle from One Interface

Set up supervision and observability so services stay running and problems
surface before they escalate -- using `fit-rc`, `libsupervise`, and
`libtelemetry`.

</a>

<a href="/docs/libraries/service-lifecycle/manage-service/">

### Start, Stop, or Check a Service

Manage a service without remembering its specific incantation -- use `fit-rc` to
start, stop, restart, check status, and read logs through one interface.

</a>

<a href="/docs/libraries/service-lifecycle/add-observability/">

### Add Observability

Add a log line or trace span without configuring a logging framework -- use
`libtelemetry` to produce structured, machine-readable output.

</a>

</div>

## Prove Agent Changes

Builders

<div class="grid">

<a href="/docs/libraries/agent-collaboration/">

### Prove Agent Changes

Generate a complete eval dataset from a DSL file, run evaluations and
facilitated sessions, and analyze the resulting traces -- reproducible evidence
from definition to finding.

</a>

<a href="/docs/libraries/agent-evaluations/">

### Run an Eval

Set up an agent-as-judge eval with `fit-eval supervise`, wire it into CI, and
read the trace to see whether agent changes improved outcomes.

</a>

<a href="/docs/libraries/trace-analysis/">

### Analyze Traces

See exactly what an agent did during a run -- download traces, query turns,
filter by tool or error, and measure token cost with `fit-trace`.

</a>

<a href="/docs/libraries/agent-collaboration/generate-dataset/">

### Generate an Eval Dataset

Produce a complete evaluation dataset from a single DSL file -- the pipeline
parses, generates entities, resolves prose, renders output, and validates the
result.

</a>

</div>

Looking for product workflows like authoring standards, agent teams, or landmark
quickstart? See [Product Guides](/docs/products/).
