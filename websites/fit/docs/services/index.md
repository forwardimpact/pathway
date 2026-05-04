---
title: Service Guides
description: Guides for platform builders — from per-product infrastructure to shared gRPC services for knowledge graphs, vector search, standard queries, trace collection, and agent tools.
layout: product
toc: false
---

## Ground Agents in Context

<div class="grid">

<a href="/docs/services/ground-agents/">

### Traverse Knowledge and Search Semantically

Products that query relationships and search content without per-product
stores — shared graph and vector gRPC services.

</a>

<a href="/docs/services/ground-agents/query-graph/">

### Answer Relationship Questions from a Product

Answer relationship questions from any product — triple patterns against the
shared graph service, no join logic.

</a>

<a href="/docs/services/ground-agents/search-content/">

### Search for Related Content from a Product

Find semantically related content from any product — shared vector service, no
embeddings storage to manage.

</a>

</div>

## Integrate with the Engineering Standard

<div class="grid">

<a href="/docs/services/integrate-standard/">

### Query the Engineering Standard from Any Product

Products that access derived roles and profiles without embedding derivation
logic — shared pathway gRPC service.

</a>

<a href="/docs/services/integrate-standard/fetch-profile/">

### Fetch a Derived Role or Agent Profile

Get a derived role or agent profile without reimplementing derivation — pass
coordinates to the pathway service, receive Turtle RDF.

</a>

</div>

## Keep Service Contracts Typed

<div class="grid">

<a href="/docs/services/typed-contracts/">

### Expose Backend Services as Agent Tools

Every gRPC endpoint becomes an agent tool from a single configuration file —
no per-endpoint integration code.

</a>

<a href="/docs/services/typed-contracts/add-service/">

### Add a Service to the MCP Surface

A new gRPC service becomes agent-accessible with one registration — no
integration code.

</a>

</div>

## Prove Agent Changes

<div class="grid">

<a href="/docs/services/prove-changes/">

### Collect Trace Spans from Any Product

Products that emit trace spans without managing storage — shared trace gRPC
service with a single collection point.

</a>

<a href="/docs/services/prove-changes/send-spans/">

### Send Spans from a Product

Trace spans emitted and immediately queryable — without managing storage
infrastructure.

</a>

</div>

Looking for library-level utilities? See [Library Guides](/docs/libraries/).
For product workflows, see [Product Guides](/docs/products/).
