# libharness

Shared test fixtures, mocks, and assertion helpers for the monorepo. Imported by
`*.test.js` files across libraries, products, and services so test code stays
consistent and test authors stop reinventing the same helpers.

Runner-independent: the mock primitive `spy()` does not depend on either
`node:test` or `bun:test`, so the suite runs under both. See spec 650.

## Usage

```js
import {
  // Mock primitive (replaces node:test's mock.fn)
  spy,
  // Config / storage / logger / fs
  createMockConfig,
  createMockStorage,
  createSilentLogger,
  createMockFs,
  // gRPC / RPC
  createMockGrpcFn,
  MockMetadata,
  createMockObserverFn,
  createMockTracer,
  createMockAuthFn,
  // Clients
  createMockMemoryClient,
  createMockLlmClient,
  createMockAgentClient,
  createMockVectorClient,
  createMockGraphClient,
  createMockToolClient,
  // Infra
  createMockSupabaseClient,
  createMockS3Client,
  createTurtleHelpers,
  createMockProcess,
  withSilentConsole,
  createMockQueries,
  // Agent-aligned engineering standard fixtures (pathway data)
  createTestStandard,
  createTestLevel,
  createTestSkill,
  createTestDiscipline,
  createTestTrack,
  createTestBehaviour,
  createTestCapability,
  createTestDriver,
  createTestPerson,
  createTestRoster,
  createTestEvidenceRow,
  // libeval stream/message helpers
  createToolUseMsg,
  createTextBlockMsg,
  createTestTrace,
  collectStream,
  stripAnsi,
  writeLines,
  createMockAgentQuery,
  // Assertions
  assertThrowsMessage,
  assertRejectsMessage,
  createDeferred,
  // Caching
  memoizeAsync,
  memoizeOnSubject,
} from "@forwardimpact/libharness";
```

The full export list lives in `src/index.js`. Subpath entries
`@forwardimpact/libharness/fixture` and `@forwardimpact/libharness/mock` remain
for narrower imports.

## When to extend libharness

Before adding a helper locally in a test file, check `src/index.js`. If the
helper doesn't exist and would be reused across two or more files, add it to
libharness in the same PR instead of inlining. See
[CONTRIBUTING.md](../../CONTRIBUTING.md) READ-DO and DO-CONFIRM checklists for
the enforced policy and `scripts/check-libharness.mjs` for the pre-commit guard
that flags inline reimplementations.

## `spy` vs `node:test`'s `mock.fn`

`spy()` matches `mock.fn`'s shape exactly:

```js
const fn = spy((x) => x * 2);
fn(5);
fn.mock.calls[0].arguments; // [5]
fn.mock.calls[0].result;    // 10
fn.mock.callCount();        // 1
fn.mock.resetCalls();
fn.mock.mockImplementation((x) => x + 1);
```

Prefer `spy` over `node:test`'s `mock.fn` — `spy` works under both `bun test`
(the default runner) and `node --test`.
