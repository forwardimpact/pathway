---
name: libs-storage
description: >
  Use when storing files to local or cloud backends, reading or writing JSONL
  indexes, managing typed resources with access control, evaluating
  authorization policies, querying RDF knowledge graphs with triple patterns,
  serializing SHACL shapes, or computing vector similarity with dot products.
---

# Storage

## When to Use

- Storing files or structured data to filesystem or cloud storage
- Building searchable collections with filtering and JSONL indexes
- Managing typed resources with access control policies
- Querying knowledge graphs with RDF triple patterns
- Computing vector similarity for semantic search

## Libraries

| Library     | Capabilities                                                | Key Exports                                            |
| ----------- | ----------------------------------------------------------- | ------------------------------------------------------ |
| libstorage  | Store files to local, S3, or Supabase backends; parse JSONL | `createStorage`, `fromJsonLines`, `toJsonLines`        |
| libindex    | JSONL-backed indexes with filtering and buffered writes     | `IndexBase`, `BufferedIndex`                           |
| libresource | Typed resources with authorization and identity resolution  | `ResourceIndex`, `createResourceIndex`, `toIdentifier` |
| libpolicy   | Access control policy evaluation                            | `Policy`, `createPolicy`                               |
| libgraph    | RDF triple storage, pattern queries, SHACL serialization    | `createGraphIndex`, `RDF_PREFIXES`, `ShaclSerializer`  |
| libvector   | Cosine similarity via dot product calculation               | `calculateDotProduct`                                  |

## Decision Guide

- **libstorage vs libindex** — `createStorage` for raw file operations
  (get/put/list/delete). `IndexBase` for structured records stored as JSONL with
  filtering logic.
- **libindex vs libresource** — `IndexBase` for simple JSONL collections where
  you control the schema. `ResourceIndex` for typed entities that need access
  control and policy evaluation.
- **libgraph vs libvector** — `createGraphIndex` for relationship queries (who
  reports to whom, what skills belong to a capability). `calculateDotProduct`
  for computing cosine similarity between embedding vectors.
- **libpolicy** — always used through `ResourceIndex`, rarely accessed directly.
  Only use `Policy` directly when building custom authorization flows outside
  the resource system.
- **BufferedIndex** — use instead of `IndexBase` for high-volume write workloads
  that benefit from periodic flushing.

## Composition Recipes

### Recipe 1: Store and retrieve typed resources

```javascript
import { createStorage } from "@forwardimpact/libstorage";
import { createResourceIndex } from "@forwardimpact/libresource";
import { createPolicy } from "@forwardimpact/libpolicy";

const storage = createStorage(config);
const policy = await createPolicy(storage);
const resourceIndex = await createResourceIndex(storage, policy);

await resourceIndex.save(resource);
const result = await resourceIndex.get("conversation:abc123", actor);
```

### Recipe 2: Build a knowledge graph

```javascript
import { createStorage } from "@forwardimpact/libstorage";
import { createGraphIndex, RDF_PREFIXES } from "@forwardimpact/libgraph";

const storage = createStorage(config);
const graphIndex = await createGraphIndex(storage, "knowledge");

await graphIndex.addTriple(subject, predicate, object);
const results = await graphIndex.query(
  `${RDF_PREFIXES.schema}Person`,
  `${RDF_PREFIXES.schema}name`,
  "?",
);
```

### Recipe 3: Compute vector similarity

```javascript
import { calculateDotProduct } from "@forwardimpact/libvector";

// Compare two normalized embedding vectors (cosine similarity)
// Higher-level vector indexing and search are handled by the vector service;
// libvector provides the core similarity primitive
const similarity = calculateDotProduct(vectorA, vectorB);
```

## DI Wiring

### libstorage

```javascript
// createStorage — factory, returns backend based on config
const storage = createStorage(config);

// JSONL utilities — pure functions, no DI
import { fromJsonLines, toJsonLines } from "@forwardimpact/libstorage";
```

### libindex

```javascript
// IndexBase — accepts storage and prefix
class UserIndex extends IndexBase {
  constructor(storage) {
    super(storage, "users");
  }
}

// BufferedIndex — accepts storage, prefix, and options
const index = new BufferedIndex(storage, "logs", { flushInterval: 5000 });
```

### libresource

```javascript
// ResourceIndex — factory accepts storage and policy
const index = await createResourceIndex(storage, policy);

// toIdentifier — pure function
import { toIdentifier } from "@forwardimpact/libresource";
const id = toIdentifier("conversation:abc123");
```

### libpolicy

```javascript
// Policy — factory accepts storage
const policy = await createPolicy(storage);
```

### libgraph

```javascript
// createGraphIndex — factory accepts storage and prefix
const index = await createGraphIndex(storage, "knowledge");
```

### libvector

```javascript
// calculateDotProduct — pure function, no DI
import { calculateDotProduct } from "@forwardimpact/libvector";
const similarity = calculateDotProduct(vectorA, vectorB);
```
