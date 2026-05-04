---
title: Service Guides
description: Task-oriented guides for platform builders — integrating with shared gRPC services for knowledge graphs, vector search, engineering standard queries, trace collection, and agent tool exposure.
layout: product
toc: false
---

## Ground Agents in Context

<div class="grid">

<a href="/docs/services/ground-agents/">

### Traverse Knowledge and Search Semantically

Connect to the graph and vector services so products query relationships and
search content without standing up per-product stores.

</a>

<a href="/docs/services/ground-agents/query-graph/">

### Answer Relationship Questions from a Product

Query the graph service using triple patterns to answer relationship questions
without writing join logic.

</a>

<a href="/docs/services/ground-agents/search-content/">

### Search for Related Content from a Product

Query the vector service for semantically related content without managing
embeddings storage.

</a>

</div>

## Integrate with the Engineering Standard

<div class="grid">

<a href="/docs/services/integrate-standard/">

### Query the Engineering Standard from Any Product

Connect to the pathway service so products access derived roles and profiles
without embedding derivation logic.

</a>

<a href="/docs/services/integrate-standard/fetch-profile/">

### Fetch a Derived Role or Agent Profile

Get a derived entity from the pathway service without reimplementing the
derivation.

</a>

</div>

## Keep Service Contracts Typed

<div class="grid">

<a href="/docs/services/typed-contracts/">

### Expose Backend Services as Agent Tools

Set up the MCP service so every gRPC endpoint becomes an agent tool from a
single configuration file.

</a>

<a href="/docs/services/typed-contracts/add-service/">

### Add a Service to the MCP Surface

Register a new backend service as agent tools in the MCP server without writing
integration code.

</a>

</div>

## Prove Agent Changes

<div class="grid">

<a href="/docs/services/prove-changes/">

### Collect Trace Spans from Any Product

Connect to the trace service so products send spans to a shared store without
managing their own storage.

</a>

<a href="/docs/services/prove-changes/send-spans/">

### Send Spans from a Product

Emit trace spans to the trace service and verify they are queryable without
managing storage.

</a>

</div>

Looking for library-level utilities? See [Library Guides](/docs/libraries/).
For product workflows, see [Product Guides](/docs/products/).
