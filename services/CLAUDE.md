# Services

Conventions when working under `services/`. Services are the internal
microservices that back products — they are never consumed directly by external
users. External access goes through product CLIs and the MCP server; individual
gRPC services are implementation details.

## Audience

The primary audience is **internal contributors** working on service backends.
Unlike products and libraries, services are not published to npm for direct
consumption. External users reach service functionality indirectly through
product CLIs and the MCP server.

## Architecture

All services except `mcp` expose a gRPC interface defined in `proto/`. The MCP
service exposes an HTTP/SSE interface using `@modelcontextprotocol/sdk` and
delegates to the gRPC services as a client. Service topology is defined in
`config/config.json` under `init.services`.

Each service follows the same structure:

- **`server.js`** — entry point. Creates config, logger, tracer, service
  instance, and server, then calls `server.start()`.
- **`index.js`** — service implementation. Exports the service class (gRPC) or
  factory function (MCP).
- **`proto/*.proto`** — gRPC service definition (all services except `mcp`).
- **`test/`** — tests, run with `bun test test/*.test.js`.

### Service catalog

| Service     | Package                       | Role                                       |
| ----------- | ----------------------------- | ------------------------------------------ |
| **graph**   | `@forwardimpact/svcgraph`     | Graph query over RDF triples               |
| **vector**  | `@forwardimpact/svcvector`    | Vector similarity search                   |
| **pathway** | `@forwardimpact/svcpathway`   | Pathway derivation from agent-aligned data |
| **trace**   | `@forwardimpact/svctrace`     | OpenTelemetry span storage                 |
| **mcp**     | `@forwardimpact/svcmcp`       | Unified MCP server fronting gRPC services  |

## `package.json` metadata

Every service carries metadata the catalog generator in
[README.md](README.md) consumes:

- **`description`** — capability-led, one sentence. Becomes the row in the
  catalog.
- **`keywords`** — 4–6 lowercase tokens; last is always `agent`.
- **`forwardimpact.capability`** — one of `agent-capability`,
  `agent-retrieval`, or `agent-infrastructure`.
- **`forwardimpact.needs`** — array of "I need to…" phrases unique across the
  monorepo.

After editing, regenerate: `bun run context:fix`.

## Shared infrastructure

Services use a common set of libraries:

- **`libconfig`** — `createServiceConfig(name)` loads config from
  `config/config.json` and environment variables.
- **`librpc`** — `Server` hosts a gRPC service; `createClient(name)` connects
  to a peer; `createTracer(name)` sets up distributed tracing.
- **`libtelemetry`** — `createLogger(name)` creates a structured logger.

## `server.js` conventions

Every `server.js` follows the same sequence:

1. `createServiceConfig(name)` — load config.
2. `createLogger(name)` and `createTracer(name)` — set up observability.
3. Initialize domain dependencies (indexes, clients, data loaders).
4. Construct service instance, wrap in `Server`, call `start()`.

The shebang is `#!/usr/bin/env node`. The `bin` entry in `package.json` is
`fit-svc<name>` (e.g. `fit-svcgraph`), but services are normally started via
`config/config.json` using `node --watch services/<name>/server.js`.

## Running services

Services are managed together. Use the init system defined in
`config/config.json`:

```sh
just guide        # start all services
just guide-stop   # stop all services
```

For a single service during development:

```sh
node --watch services/<name>/server.js
```

## Proto definitions

gRPC services define their interface in `proto/<name>.proto`. After editing a
proto file, regenerate bindings:

```sh
just codegen
```

## No external documentation

Services have no published skills, no `--help` linking rules, and no
fully-qualified documentation URLs. They are internal to the monorepo. Each
service carries its own `README.md` for contributor context.
