# Services

The packages under `services/` are simple, dependency-free microservices that
back products — exposing domain capabilities over gRPC (and MCP) for
composition by any product. Agent-friendly interfaces, observable operations,
and protocol bridges that let agents consume backend functionality natively.

## Mandate

When building a product feature that requires graph queries, vector search,
pathway derivation, trace collection, or MCP tool exposure, use the
corresponding service. Do not embed service-level logic in products.

This rule lives next to the other invariants in
[CONTRIBUTING.md](../CONTRIBUTING.md#read-do).

## Catalog

Three capability categories. Every service appears in exactly one.

The tables below are generated from each service's `package.json`
(`forwardimpact.capability` + `description`). To regenerate after editing a
service: `bun run context:fix`. CI fails the build if the catalog drifts.

### Agent Capability

What products expose to agents — derivation endpoints that turn raw data into
agent-consumable answers.

<!-- BEGIN:capability:agent-capability -->

| Service     | Capability                                                                             |
| ----------- | -------------------------------------------------------------------------------------- |
| **pathway** | Engineering standard queries over gRPC — career paths and agent profiles for products. |

<!-- END:capability:agent-capability -->

### Agent Retrieval

How agents fetch and shape context — graph traversal and vector similarity
search exposed over gRPC.

<!-- BEGIN:capability:agent-retrieval -->

| Service    | Capability                                                                   |
| ---------- | ---------------------------------------------------------------------------- |
| **graph**  | Simple RDF knowledge graph over gRPC for products.                           |
| **vector** | Simple vector similarity search over gRPC — semantic retrieval for products. |

<!-- END:capability:agent-retrieval -->

### Agent Infrastructure

How services run, communicate, and observe themselves — protocol bridges,
span collection, and operational tooling.

<!-- BEGIN:capability:agent-infrastructure -->

| Service   | Capability                                                                        |
| --------- | --------------------------------------------------------------------------------- |
| **mcp**   | Unified MCP server — exposes gRPC backend services as agent-consumable tools.     |
| **trace** | OpenTelemetry span ingestion and storage over gRPC — observable agent operations. |

<!-- END:capability:agent-infrastructure -->

## I need to…

Common needs that map directly to a single service. Generated from each
service's `package.json` (`forwardimpact.needs`); regenerate with
`bun run context:fix`.

<!-- BEGIN:needs -->

| I need to…                                               | Service   |
| -------------------------------------------------------- | --------- |
| Collect and store OpenTelemetry spans over gRPC          | `trace`   |
| Expose backend services as MCP tools over HTTP           | `mcp`     |
| Expose RDF knowledge graphs over gRPC                    | `graph`   |
| Serve engineering standard queries to products over gRPC | `pathway` |
| Serve vector similarity search to products over gRPC     | `vector`  |

<!-- END:needs -->

## Per-service detail

Every service has a `README.md` that documents its gRPC methods, configuration,
and dependencies. Open the service directory for depth.

## Adding a service

Same shape as every other service here:

- `package.json` — `@forwardimpact/svc<name>`, ESM, with `description`,
  `keywords`, and `forwardimpact: { capability, needs }` (capability is one of
  `agent-capability`, `agent-retrieval`, `agent-infrastructure`; needs is an
  array of "I need to…" phrases unique across the monorepo).
- `server.js` — entry point following the standard bootstrap sequence.
- `index.js` — service implementation.
- `proto/<name>.proto` — gRPC service definition (unless MCP-only).
- `test/` — `*.test.js` files.
- Run `bun run context:fix` to regenerate the tables above. Update any consuming
  product to import from the new service.
