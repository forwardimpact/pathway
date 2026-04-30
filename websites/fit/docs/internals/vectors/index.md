---
title: Vector Processing Internals
description: "Embedding pipeline — TEI installation, native and supervised operation, batch processing, index format, and query-time architecture."
---

## Pipeline

The vector pipeline converts knowledge resources into embeddings for semantic
search. Guide's `SearchContent` tool queries these embeddings at runtime.

```
data/resources/*.json  ──>  TEI (BAAI/bge-small-en-v1.5)  ──>  data/vectors/index.jsonl
                                                                       │
                                                            services/vector (gRPC)
                                                                       │
                                                              Guide SearchContent
```

Two separate concerns use TEI:

| Concern             | When                  | Who calls TEI                         |
| ------------------- | --------------------- | ------------------------------------- |
| **Batch indexing**  | `fit-process-vectors` | CLI → TEI `/v1/embeddings`            |
| **Query embedding** | Runtime search        | vector service → TEI `/v1/embeddings` |

Both read `EMBEDDING_BASE_URL` from `.env` (default `http://localhost:8090`).
Authentication is not required for local TEI.

---

## TEI (Text Embeddings Inference)

TEI is a Rust binary from HuggingFace that serves embedding models over HTTP. It
must be running before batch processing or query-time search will work.

### Installation

Install once via Cargo:

```sh
just tei-install
```

Or manually:

```sh
cargo install --git https://github.com/huggingface/text-embeddings-inference \
  --features candle text-embeddings-router
```

The first startup downloads the `BAAI/bge-small-en-v1.5` model (~130 MB) to
`~/.cache/huggingface/`.

### Running Natively

Run TEI in the foreground — useful for one-off batch processing or when you want
direct control:

```sh
just tei-start
```

This runs `text-embeddings-router` on port 8090 and blocks the terminal. Stop
with Ctrl-C. Equivalent to:

```sh
text-embeddings-router --model-id BAAI/bge-small-en-v1.5 --port 8090 --json-output
```

### Running Under fit-rc

For supervised operation, add a TEI entry to `config/config.json` under
`init.services`. The base config created by `fit-guide init` does not include
TEI — add the entry manually:

```json
{
  "name": "tei",
  "command": "text-embeddings-router --model-id BAAI/bge-small-en-v1.5 --port 8090 --json-output",
  "optional": true
}
```

Once registered, fit-rc keeps TEI alive alongside the other services:

```sh
bunx fit-rc start              # Starts all services including TEI
bunx fit-rc start tei          # Start TEI only
bunx fit-rc status tei         # Check TEI status
bunx fit-rc stop tei           # Stop TEI
```

Because the service is marked `optional`, fit-rc skips it with a warning if
`text-embeddings-router` is not installed.

### Docker

`docker-compose.yml` defines a `tei` container using the HuggingFace CPU image.
It listens on port 8080 inside the Docker network (`tei.local:8080`), accessible
only to other containers. This is intended for containerized deployments, not
local development.

### Health Check

```sh
curl http://localhost:8090/health
```

Returns 200 when TEI is ready to serve requests.

---

## Batch Processing

Resources must exist before vectors can be generated. The full processing chain
is:

```sh
just process                   # export-standard → process-resources → process-graphs → process-vectors
```

To process only vectors (when resources already exist):

```sh
just process-vectors
# or directly:
bunx fit-process-vectors
```

Without TEI, use `just process-fast` to skip the vector step.

### Processing Steps

1. Load all resource identifiers from `data/resources/`.
2. Filter out conversations (`common.Conversation.*`) and tool functions
   (`tool.ToolFunction.*`).
3. Skip resources already present in the vector index (incremental).
4. Batch remaining resources and POST to TEI `/v1/embeddings`.
5. Write each embedding to `data/vectors/index.jsonl`.

---

## Index Format

Each line in `data/vectors/index.jsonl` is a self-contained JSON record:

```json
{
  "id": "common.Message.a4663ad1",
  "identifier": {
    "type": "common.Message",
    "name": "a4663ad1",
    "parent": "",
    "subjects": ["https://example.com/id/person/alice"],
    "tokens": 120
  },
  "vector": [-0.048, -0.039, ...]
}
```

- **Dimensions:** 384 (bge-small-en-v1.5)
- **Normalization:** Pre-normalized, so cosine similarity reduces to dot product
- **Search:** `VectorIndex.queryItems()` computes dot products with SIMD-style
  loop unrolling, filters by prefix and token budget, returns ranked identifiers

---

## Components

| Component             | Location                             | Role                                                 |
| --------------------- | ------------------------------------ | ---------------------------------------------------- |
| `VectorProcessor`     | `libraries/libvector/src/processor/` | Batch embedding pipeline (extends `ProcessorBase`)   |
| `VectorIndex`         | `libraries/libvector/src/index/`     | JSONL-backed index with dot-product search           |
| `fit-process-vectors` | `libraries/libvector/bin/`           | CLI for batch processing                             |
| `fit-search`          | `libraries/libvector/bin/`           | CLI for ad-hoc similarity search                     |
| vector service        | `services/vector/`                   | gRPC service that loads the index and serves queries |

---

## Troubleshooting

**TEI not reachable** — Check `curl http://localhost:8090/health`. Verify
`EMBEDDING_BASE_URL` in `.env` matches the port TEI is running on.

**No resources to process** — Run `just process-resources` first. The vector
processor reads from `data/resources/`.

**Empty vector index** — Resources with empty or null content are skipped.
Verify `data/resources/` contains files with non-empty content fields.

**Model download stalls** — The first TEI startup downloads the model from
HuggingFace. Check network access and `~/.cache/huggingface/` for partial
downloads.
