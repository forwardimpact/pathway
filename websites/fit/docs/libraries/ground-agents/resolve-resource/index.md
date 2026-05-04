---
title: Resolve a Resource
description: Give agents rich, typed context from a resource identifier — provenance, access control, and RDF content instead of raw files.
---

You have a resource identifier -- returned by `fit-query`, `fit-search`, or an
index lookup -- and you need to retrieve the actual content behind it. Passing
a raw file path to an agent loses provenance, ignores access control, and
leaves the consumer guessing the content type. `@forwardimpact/libresource`
resolves identifiers into typed resources with structured content, stable
identifiers, and policy-controlled access.

For the full workflow of ingesting knowledge sources and building the resource
index, see [Ground Agents in Context](/docs/libraries/ground-agents/).

## Prerequisites

- Node.js 18+
- `@forwardimpact/libresource` installed:

```sh
npm install @forwardimpact/libresource
```

- A populated resource index under `data/resources/` (produced by
  `fit-process-resources` during the ingestion pipeline)

## Create a resource index

The `createResourceIndex` factory builds an index backed by local storage:

```js
import { createResourceIndex } from "@forwardimpact/libresource";

const resourceIndex = createResourceIndex("resources");
```

The string argument is the storage prefix -- it maps to the `data/resources/`
directory by default. An optional second argument accepts a custom policy
instance; when omitted, a permissive default policy is used.

## Resolve identifiers to resources

The `get` method accepts an array of identifier strings and returns typed
resource objects:

```js
const ids = ["common.Message.a1b2c3", "common.Message.d4e5f6"];
const resources = await resourceIndex.get(ids);

for (const res of resources) {
  console.log(`${res.id} (${res.role}): ${res.content.slice(0, 80)}...`);
}
```

```text
common.Message.a1b2c3 (system): <https://acme.example/people/jane-doe> a schema:...
common.Message.d4e5f6 (system): <https://acme.example/orgs/acme-hq> a schema:Org...
```

Each returned resource carries:

| Field     | Type   | Description                                                |
| --------- | ------ | ---------------------------------------------------------- |
| `id`      | `Identifier` | Typed identifier with `type`, `name`, and optional `parent` |
| `role`    | string | Message role (`system`, `user`, `assistant`)                |
| `content` | string | RDF serialization (Turtle format) of the entity's triples  |

Missing identifiers are silently skipped -- the result array may be shorter
than the input.

## Enforce access control

Pass an actor identifier as the second argument to `get`. The resource index
evaluates the configured policy before returning results:

```js
const resources = await resourceIndex.get(ids, "agent:technical-writer");
```

If the policy denies access, the call throws an `"Access denied"` error. When
no actor is provided, the policy check is skipped entirely.

## Discover and check resources

Three methods help you navigate the index without loading full content:

```js
// Check whether a specific resource exists
const exists = await resourceIndex.has("common.Message.a1b2c3");

// Find all resources whose ID starts with a prefix
const messageIds = await resourceIndex.findByPrefix("common.Message");

// List every resource in the index
const allIds = await resourceIndex.findAll();
```

Both `findByPrefix` and `findAll` return `Identifier` objects, not full
resources. Pass them to `get` to load content.

## Process HTML into resources

The ingestion pipeline converts HTML knowledge sources into typed `Message`
resources using `fit-process-resources`:

```sh
npx fit-process-resources --base https://acme.example/
```

The command reads HTML files from the `data/knowledge/` directory, extracts
schema.org microdata as RDF triples, groups them by entity, and stores each
entity as a `common.Message` resource in `data/resources/`.

When the same entity appears in multiple HTML files, the processor merges
triples using RDF union semantics -- no duplicates, no data loss. The merged
resource carries the union of all triples observed across files.

### How identifiers are generated

Each resource identifier is deterministic. The processor hashes the entity's
IRI to produce the `name` component:

```text
Entity IRI: https://acme.example/people/jane-doe
Identifier: common.Message.a1b2c3
Storage:    data/resources/common.Message.a1b2c3.json
```

Re-processing the same HTML files produces the same identifiers, so the
pipeline is idempotent.

### Content format

The `content` field of each stored resource is a Turtle-format RDF
serialization of the entity's triples. Type assertions (`rdf:type`) are
sorted first for consistent downstream processing:

```turtle
<https://acme.example/people/jane-doe> a schema:Person ;
    schema:name "Jane Doe" ;
    schema:worksFor <https://acme.example/orgs/acme-hq> .
```

This content is what the graph processor reads when building the graph index,
and what the vector processor reads when generating embeddings.

## Typical retrieval flow

A common pattern chains index lookup, resolution, and consumption:

```js
import { createGraphIndex, parseGraphQuery } from "@forwardimpact/libgraph";
import { createResourceIndex } from "@forwardimpact/libresource";

const graph = createGraphIndex("graphs");
const resources = createResourceIndex("resources");

// 1. Query the graph for matching identifiers
const pattern = parseGraphQuery("? schema:worksFor ?");
const ids = await graph.queryItems(pattern, { limit: 5 });

// 2. Resolve identifiers to full resources
const chunks = await resources.get(ids.map(String), "agent:outpost");

// 3. Use the content
for (const chunk of chunks) {
  console.log(chunk.content);
}
```

The graph answers "which entities match?" and the resource index answers "what
do those entities contain?" -- each library owns one step.

## Related

- [Ground Agents in Context](/docs/libraries/ground-agents/) -- the end-to-end
  workflow for ingesting knowledge and building the retrieval pipeline.
- [Query a Graph](/docs/libraries/ground-agents/query-graph/) -- find
  identifiers by relationship pattern before resolving them here.
- [Look Up Context](/docs/libraries/ground-agents/lookup-context/) -- find
  identifiers by prefix or structural filter.
- [`@forwardimpact/libresource` on npm](https://www.npmjs.com/package/@forwardimpact/libresource)
  -- installation and changelog.
