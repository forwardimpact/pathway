# libconfig

<!-- BEGIN:description — Do not edit. Generated from package.json. -->

Environment-aware application settings — services and CLIs load configuration
without custom plumbing.

<!-- END:description -->

## Getting Started

```js
import { createConfig, createServiceConfig } from '@forwardimpact/libconfig';

const config = await createServiceConfig('myservice', { port: 3000 });
```

## Bootstrap

A product's `init` verb hands its starter material to `bootstrapProject`,
which writes `config/config.json` and `.env` under namespace-scoped
ownership semantics. Same-key-same-value writes are no-ops; same-key-
different-value writes refuse without explicit overwrite intent, so two
products with disjoint top-level namespaces can converge against the same
target directory.

```js
import { bootstrapProject } from '@forwardimpact/libconfig';

await bootstrapProject({
  target,                              // absolute path; defaults to process.cwd()
  fragment: {                          // top-level keys are product-owned namespaces; {} or omitted is allowed
    'product.guide': { systemPrompt: '…' },
    'service.mcp':   { systemPrompt: '…' },
  },
  env: {                               // .env entries; {} or omitted is allowed
    SERVICE_SECRET: '…',
    MCP_TOKEN:      '…',
  },
  overwrites: {                        // explicit overwrite intent, partitioned per file
    config: ['product.guide'],         // top-level namespace names (single segment)
    env:    ['MCP_TOKEN'],             // bare keys
  },
});
```

- **Entry point** — `bootstrapProject({ target, fragment, env, overwrites })`.
  Returns `void` on success; throws a refusal `Error` whose `cause` carries
  `{ kind, path, overwriteSurface }` when a write conflicts and the caller
  did not signal overwrite intent.
- **Namespace declaration** — the top-level keys of `fragment` are the
  namespaces the product owns. Cross-namespace writes never collide;
  within a namespace, any leaf disagreement refuses at the top-level.
- **Overwrite intent** — pass `overwrites.config: [topLevelKey]` (single-
  segment names) or `overwrites.env: [bareKey]` to opt in to replacing
  a conflicting value. The refusal message names both the conflicting key
  and the surface so the caller's CLI can render a greppable diagnostic.
- **`.env` primitives** — `bootstrapProject` delegates per-key `.env`
  writes to `@forwardimpact/libsecret`'s `updateEnvFile`, which preserves
  comment lines, the trailing newline, and mode `0o600`.

`bootstrapProject` always materialises `target/config/config.json` (writing
`{}` when fragment is empty and the file is absent) so subsequent reader
invocations anchor locally rather than upward-walking into an ancestor
`config/`. `.env` is created only when at least one entry is supplied; an
empty `env` against an existing `.env` is a no-op.
