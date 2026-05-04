---
title: Search for Related Content from a Product
description: Query the vector gRPC service for semantically related content without managing embeddings storage.
---

You need to find content related to a natural-language query from within a
product -- semantically, not by keyword. The vector service holds the embedding
index in memory, manages the embedding endpoint connection, and exposes a single
RPC: `SearchContent`. Your product sends text; the service returns ranked
resource identifiers. No embedding API calls, no vector storage, no scoring
logic in the product.

For the full setup including connecting to both the graph and vector services,
see [Ground Agents in Context](/docs/services/ground-agents/).

## Prerequisites

- Completed the
  [Ground Agents in Context](/docs/services/ground-agents/) guide --
  you have `@forwardimpact/librpc` and `@forwardimpact/libtype` installed, the
  vector service is running, and `createClient("vector")` connects successfully.
- A populated vector index at `data/vectors/index.jsonl`.

## Connect

```js
import { createClient, createTracer } from "@forwardimpact/librpc";
import { createLogger } from "@forwardimpact/libtelemetry";
import { vector } from "@forwardimpact/libtype";

const logger = createLogger("my-product");
const tracer = await createTracer("my-product");
const vectorClient = await createClient("vector", logger, tracer);
```

## Search with a single query

Pass one or more text strings to `SearchContent`. The service embeds each
string, scores the resulting vectors against the index using dot-product
similarity, and returns the ranked resource identifiers:

```js
const query = vector.TextQuery.fromObject({
  input: ["career progression for senior engineers"],
});

const result = await vectorClient.SearchContent(query);
console.log("Results:", result.identifiers?.length ?? 0);

for (const id of result.identifiers ?? []) {
  console.log(String(id));
}
```

Expected output (identifiers depend on your knowledge base):

```text
Results: 5
common.Message.a1b2c3d4
common.Message.e5f6g7h8
common.Message.i9j0k1l2
common.Message.m3n4o5p6
common.Message.q7r8s9t0
```

Identifiers are sorted by similarity score descending. The default limit
returns all matches above the threshold.

## Search with multiple queries

Pass several strings to score against the index in a single call. The service
embeds each string and keeps the highest score per item across all queries:

```js
const query = vector.TextQuery.fromObject({
  input: [
    "incident management",
    "on-call rotation",
  ],
});

const result = await vectorClient.SearchContent(query);
console.log("Results:", result.identifiers?.length ?? 0);
```

This avoids multiple round trips when the search intent spans several phrasings.

## Apply filters

Constrain results using the optional `filter` field:

```js
const query = vector.TextQuery.fromObject({
  input: ["architecture design patterns"],
  filter: {
    limit: "3",
    threshold: "0.6",
    prefix: "common.Message",
  },
});

const result = await vectorClient.SearchContent(query);
console.log("Top 3 results above 0.6 threshold:");

for (const id of result.identifiers ?? []) {
  console.log(String(id));
}
```

Expected output:

```text
Top 3 results above 0.6 threshold:
common.Message.a1b2c3d4
common.Message.e5f6g7h8
common.Message.i9j0k1l2
```

Available filter fields:

| Field        | Effect                                                      |
| ------------ | ----------------------------------------------------------- |
| `prefix`     | Only return identifiers starting with this string           |
| `limit`      | Cap the number of results                                   |
| `threshold`  | Minimum similarity score to include                         |
| `max_tokens` | Stop accumulating results when the token budget is exceeded |

All filter values are strings in the protobuf definition. The service parses
them internally. Filters apply in order: prefix, then scoring and threshold,
then limit, then token budget.

## Resolve identifiers to content

The service returns identifiers, not content. Resolve them through
`libresource`:

```js
import { createResourceIndex } from "@forwardimpact/libresource";

const resources = createResourceIndex("resources");
const ids = result.identifiers.map((id) => String(id));
const items = await resources.get(ids);

for (const item of items) {
  console.log(`--- ${item.id.type}.${item.id.name} ---`);
  console.log(item.content.substring(0, 150));
  console.log();
}
```

This two-step pattern keeps the vector service stateless: it scores and ranks;
the calling product resolves as much content as it needs.

## Verify

You have reached the outcome of this guide when:

- `SearchContent` with a single input string returns ranked resource
  identifiers.
- Passing multiple input strings returns results scored against all queries.
- Applying a `filter` with `limit` and `threshold` constrains the result set.
- Resolving returned identifiers through `libresource` produces the expected
  content.

## Related

- [Ground Agents in Context](/docs/services/ground-agents/) -- the end-to-end
  setup for connecting to both the graph and vector services.
- [Query the Graph](/docs/services/ground-agents/query-graph/) -- when you need
  exact relationship matching rather than ranked similarity.
- [Search Semantically](/docs/libraries/ground-agents/search-semantically/) --
  the library guide for querying the vector index directly without the gRPC
  service.
