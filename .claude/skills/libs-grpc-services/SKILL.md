---
name: libs-grpc-services
description: >
  Use when building or testing a gRPC service, configuring service startup
  settings, adding structured logging or distributed tracing, generating or
  consuming Protocol Buffer types, or mocking infrastructure dependencies in
  unit tests.
---

# gRPC Services and Service Infrastructure

## When to Use

- Building or modifying gRPC service implementations and handlers
- Configuring services at startup with environment-specific settings
- Adding structured logging, tracing, or performance monitoring
- Writing unit tests for services with mocked dependencies

## Libraries

| Library      | Capabilities                                                         | Key Exports                                                                                            |
| ------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| librpc       | Build gRPC servers and clients, create service factories             | `Server`, `Client`, `createClient`, `createGrpc`, `Rpc`                                                |
| libconfig    | Load settings from files and environment for services, CLIs, scripts | `createServiceConfig`, `createExtensionConfig`, `createScriptConfig`, `Config`                         |
| libtelemetry | Structured RFC 5424 logging, distributed trace spans, observability  | `Logger`, `createLogger`, `Observer`, `createObserver`                                                 |
| libtype      | Generated Protocol Buffer types and namespaces                       | `agent`, `common`, `memory`, `graph`, `tool`                                                           |
| libharness   | Test doubles for all infrastructure dependencies                     | `createMockConfig`, `createMockStorage`, `createMockLogger`, `createMockLlmClient`, `createMockGrpcFn` |

## Decision Guide

- **librpc Server vs Client** — `Server` for implementing service handlers that
  respond to requests. `Client` / `createClient` for calling other services.
- **libconfig `createServiceConfig` vs `createExtensionConfig` vs
  `createScriptConfig`** — `createServiceConfig` for long-running daemons (gRPC
  services). `createExtensionConfig` for plugins and extensions.
  `createScriptConfig` for CLI tools and one-off scripts.
- **libtelemetry Logger vs Observer** — `Logger` for structured log lines
  (always use instead of `console.log`). `Observer` for distributed trace spans
  across service boundaries with timing via `observe()`.
- **Always use `logger.info` for operational output** — sends to stderr, keeps
  stdout clean for data. `logger.debug` only prints when `DEBUG=<domain>` is
  set. This is the standard pattern for all CLI tools and services across the
  monorepo.

## Composition Recipes

### Recipe 1: Create a new gRPC service

```javascript
import { createServiceConfig } from "@forwardimpact/libconfig";
import { createLogger } from "@forwardimpact/libtelemetry";
import { Server, createGrpc } from "@forwardimpact/librpc";

const config = createServiceConfig("my-service");
const logger = createLogger("my-service");

const grpc = createGrpc(proto, MyServiceImpl);
const server = new Server([grpc], config);
await server.start();
```

### Recipe 2: Call another service

```javascript
import { createClient } from "@forwardimpact/librpc";
import { createLogger } from "@forwardimpact/libtelemetry";

const logger = createLogger("caller");
const client = createClient(logger);
const response = await client.request(message);
```

### Recipe 3: Test a service handler

```javascript
import {
  createMockConfig,
  createMockStorage,
  createMockLogger,
  createMockGrpcFn,
  createMockLlmClient,
} from "@forwardimpact/libharness";

const config = createMockConfig("test-service");
const storage = createMockStorage();
const logger = createMockLogger();
const llmClient = createMockLlmClient({ completionResponse: { content: "Hello" } });

// Test handler directly with mock gRPC call
const call = createMockGrpcFn({ resourceId: "test:123" });
await handler(call, callback);
```

## DI Wiring

### librpc

```javascript
// Server — accepts services and config
const server = new Server(services, config);

// createClient — accepts logger
const client = createClient(logger);
```

### libconfig

```javascript
// Factory functions return config object — no constructor injection
const config = createServiceConfig("service-name");
const config = createExtensionConfig("extension-name");
const config = createScriptConfig("script-name");
```

### libtelemetry

```javascript
// createLogger — factory, returns Logger instance
const logger = createLogger("domain");

// Observer — accepts logger
const observer = createObserver(logger);
```

### libtype

```javascript
// Generated types — use fromObject() for creation
import { agent, common } from "@forwardimpact/libtype";
const request = agent.Request.fromObject({ content: "Hello" });
const resourceId = common.ResourceId.fromObject({ type: "conversation", id: "abc" });
```

### libharness

```javascript
// All mocks are factory functions — no constructor injection needed
const config = createMockConfig("test");
const storage = createMockStorage();
const logger = createMockLogger();
const llmClient = createMockLlmClient(overrides);
const memoryClient = createMockMemoryClient(overrides);
const agentClient = createMockAgentClient(overrides);
const grpcFn = createMockGrpcFn(requestData);
```
