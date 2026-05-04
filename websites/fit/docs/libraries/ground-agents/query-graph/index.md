---
title: Query a Knowledge Graph
description: Traverse relationships in an RDF graph index with triple patterns and type-filtered subject listings -- without writing join logic or managing a SPARQL endpoint.
---

You need to find how two concepts relate -- which people belong to an
organization, which projects reference a capability, which resources share a
type. The relationships exist as RDF triples in a graph index, but you do not
want to write join logic or stand up a SPARQL endpoint to answer the question.
`fit-query` and `fit-subjects` give you triple-pattern queries and type-filtered
subject listings from the command line.

For the full workflow of building and populating the graph index from HTML
knowledge sources, see [Ground Agents in Context](/docs/libraries/ground-agents/).

## Prerequisites

- Node.js 18+
- `@forwardimpact/libgraph` installed:

```sh
npm install -g @forwardimpact/libgraph
```

- A populated graph index under `data/graphs/` (produced by
  `fit-process-graphs` during the ingestion pipeline)

## List all subjects by type

When you need to see every entity of a given type in the graph, use
`fit-subjects` with a prefixed type:

```sh
npx fit-subjects schema:Person
```

```text
https://acme.example/people/jane-doe	https://schema.org/Person
https://acme.example/people/john-smith	https://schema.org/Person
```

Each line is a tab-separated pair: the subject URI and its `rdf:type`. To list
all subjects regardless of type, omit the argument:

```sh
npx fit-subjects
```

```text
https://acme.example/people/jane-doe	https://schema.org/Person
https://acme.example/orgs/acme-hq	https://schema.org/Organization
https://acme.example/projects/ledger	https://schema.org/Project
```

Wildcards (`?`, `*`, `_`) are treated the same as omitting the argument --
all subjects are returned.

### Type synonyms

The graph index resolves type synonyms defined via `skos:altLabel` in the
ontology. If the ontology declares `Individual` as an alternate label for
`Person`, querying for `schema:Person` also returns entities typed as
`schema:Individual`. No extra flags are needed -- synonym resolution is
automatic.

## Query with a triple pattern

`fit-query` takes exactly three positional arguments -- subject, predicate,
object -- and returns the resource identifiers whose triples match the pattern.
Use `?` for any position you want to leave open:

```sh
npx fit-query "?" schema:worksFor "https://acme.example/orgs/acme-hq"
```

```text
common.Message.a1b2c3
common.Message.d4e5f6
```

The output is one resource identifier per line. Each identifier can be passed
to `fit-process-resources` or resolved through `libresource` to retrieve the
full context chunk.

### Find all properties of a subject

```sh
npx fit-query "https://acme.example/people/jane-doe" "?" "?"
```

```text
common.Message.a1b2c3
```

This returns every resource that contributed triples about that subject. To
see the actual triples, resolve the identifier through the resource index.

### Find entities by predicate

```sh
npx fit-query "?" schema:name "?"
```

```text
common.Message.a1b2c3
common.Message.d4e5f6
common.Message.g7h8i9
```

This lists every resource containing a `schema:name` predicate, regardless of
subject or value.

### Quoted literal values

When the object is a literal string rather than a URI, wrap it in double
quotes:

```sh
npx fit-query "?" schema:name "\"Jane Doe\""
```

```text
common.Message.a1b2c3
```

The outer shell quotes protect the inner double quotes that mark the value as
an RDF literal.

## Supported prefixes

The graph index recognizes these namespace prefixes out of the box:

| Prefix   | Namespace                                       |
| -------- | ----------------------------------------------- |
| `schema` | `https://schema.org/`                           |
| `rdf`    | `http://www.w3.org/1999/02/22-rdf-syntax-ns#`   |
| `rdfs`   | `http://www.w3.org/2000/01/rdf-schema#`         |
| `foaf`   | `http://xmlns.com/foaf/0.1/`                    |
| `fit`    | `https://www.forwardimpact.team/schema/rdf/`    |
| `ex`     | `https://example.invalid/`                      |

Use prefixed form (`schema:Person`) or full URIs
(`https://schema.org/Person`) interchangeably in any position.

## Filtering results

Both commands accept optional filters that constrain the returned identifiers:

| Filter       | Effect                                                   |
| ------------ | -------------------------------------------------------- |
| `prefix`     | Only return identifiers starting with the given string   |
| `limit`      | Cap the number of results                                |
| `max_tokens` | Stop returning results once the cumulative token count exceeds the budget |

When used programmatically through `GraphIndex.queryItems(pattern, filter)`,
pass the filter as the second argument:

```js
import { createGraphIndex, parseGraphQuery } from "@forwardimpact/libgraph";

const graph = createGraphIndex("graphs");
const pattern = parseGraphQuery("? schema:worksFor ?");
const results = await graph.queryItems(pattern, { limit: 5 });

for (const id of results) {
  console.log(String(id));
}
```

```text
common.Message.a1b2c3
common.Message.d4e5f6
common.Message.g7h8i9
common.Message.j0k1l2
common.Message.m3n4o5
```

## How the graph index is structured

The graph index stores triples in an N3 in-memory store backed by a JSONL file
at `data/graphs/index.jsonl`. On first access, the index loads the JSONL into
memory and populates the N3 store -- subsequent queries run entirely in memory.

An `ontology.ttl` file alongside the index captures SHACL shapes inferred from
the data. The ontology is regenerated when `fit-process-graphs` runs.

## Related

- [Ground Agents in Context](/docs/libraries/ground-agents/) -- the end-to-end
  workflow for building and querying the knowledge graph.
- [Resolve a Resource](/docs/libraries/ground-agents/resolve-resource/) --
  retrieve the full context chunk behind a resource identifier returned by
  `fit-query`.
- [Search Semantically](/docs/libraries/ground-agents/search-semantically/) --
  when you need ranked similarity rather than exact triple matching.
- [`@forwardimpact/libgraph` on npm](https://www.npmjs.com/package/@forwardimpact/libgraph)
  -- installation and changelog.
