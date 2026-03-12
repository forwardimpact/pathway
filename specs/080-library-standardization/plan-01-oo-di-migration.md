# Plan 01 — Migrate Non-Conforming Libraries to OO+DI

Three libraries need migration: libuniverse (large), libutil (medium),
libsupervise (small). Each migration follows the same sequence: extract classes,
inject dependencies via constructors, add factory functions, update call sites,
verify tests.

## Conformance audit

Current state of all 22 libraries against the standard pattern:

| Library | Status | Notes |
| --- | --- | --- |
| libagent | Compliant | AgentMind, AgentHands — full constructor DI |
| libcodegen | Compliant | CodegenBase hierarchy — injects fs, path, mustache, protoLoader |
| libconfig | Compliant | Config class + createConfig factory |
| libdoc | Compliant | DocsBuilder, DocsServer — comprehensive DI |
| libformat | Compliant | HtmlFormatter, TerminalFormatter + factories |
| libgraph | Compliant | GraphIndex via createGraphIndex factory |
| libharness | N/A | Test infrastructure — mocks and fixtures |
| libindex | Compliant | IndexBase, BufferedIndex — constructor DI |
| libllm | Compliant | LlmApi + createLlmApi factory |
| libmemory | Compliant | MemoryWindow — constructor DI |
| libpolicy | Compliant | Policy + createPolicy factory |
| libprompt | Compliant | PromptLoader + createPromptLoader factory |
| librc | Compliant | ServiceManager — full DI via deps object |
| librepl | Compliant | Repl — injects readline, process, os |
| libresource | Compliant | ResourceIndex + createResourceIndex factory |
| librpc | Compliant | Client, Server, Rpc classes + factories |
| libsecret | Exempt | Pure crypto utilities — stateless, no deps |
| libskill | Exempt | Pure functions by design |
| libstorage | Compliant | LocalStorage, S3Storage, SupabaseStorage + createStorage factory |
| libtelemetry | Compliant | Logger, Observer + factories |
| libtemplate | Compliant | TemplateLoader + createTemplateLoader factory |
| libtype | Exempt | Generated protobuf code |
| libui | Exempt | Functional DOM library |
| libutil | **Non-conforming** | Mixed classes + loose functions |
| libvector | Compliant | VectorProcessor — full constructor DI |
| libweb | Compliant | Middleware classes + factories |
| **libsupervise** | **Non-conforming** | Module-level logger singleton |
| **libuniverse** | **Non-conforming** | Procedural pipeline, module-level deps |

## Migration 1: libsupervise (small — ~1 hour)

### Problem

`SupervisionTree` creates a module-level logger:

```javascript
// libraries/libsupervise/src/tree.js line 11
const logger = createLogger("tree");
```

This logger is shared across all instances and cannot be replaced in tests.

### Changes

**tree.js** — Accept logger in constructor:

```javascript
class SupervisionTree {
  constructor(logDir, config = {}) {
    // BEFORE: uses module-level `logger`
    // AFTER:
    this.logger = config.logger || createLogger("tree");
    this.logDir = logDir;
    // ...
  }
}
```

Remove the module-level `const logger = createLogger("tree")` line.
Replace all bare `logger.xxx()` calls with `this.logger.xxx()`.

**Add factory function** to index.js:

```javascript
export function createSupervisionTree(logDir, config = {}) {
  const logger = config.logger || createLogger("tree");
  return new SupervisionTree(logDir, { ...config, logger });
}
```

**Update call sites** — `services/` and `bin/` files that construct
SupervisionTree. Pass logger explicitly or rely on the default.

**Verify**: `npm run test --workspace=libraries/libsupervise`

## Migration 2: libutil (medium — ~2 hours)

### Problem

Nine loose functions exported alongside five DI-compliant classes. The loose
functions cannot be mocked or replaced, and `createBundleDownloader` uses
dynamic imports to avoid circular dependencies with libtelemetry.

### Current exports

**Classes (already compliant):**
- `Finder(fs, logger, process)`
- `BundleDownloader(createStorageFn, finder, logger, extractor, process)`
- `ProcessorBase(logger, batchSize)`
- `Retry(config)`
- `TarExtractor` (stateless utility)

**Loose functions (non-compliant):**
- `updateEnvFile(filePath, key, value)`
- `generateHash(input)`
- `generateUUID()`
- `countTokens(text)`
- `createTokenizer()`
- `createBundleDownloader(prefix)`
- `execLine(command, args, options)`
- `parseJsonBody(request)`
- `waitFor(fn, options)`

### Changes

These functions are genuinely stateless — they don't hold state or need
injected collaborators. The standard pattern says pure stateless utilities
are acceptable as standalone exports. The fix is organizational, not
architectural:

1. **Keep pure stateless functions as-is** — `generateHash`, `generateUUID`,
   `countTokens`, `createTokenizer`, `parseJsonBody` are truly stateless. No
   migration needed.

2. **`execLine`** — Wraps `child_process.execSync`. Accept the exec function
   as an optional parameter for testability:

   ```javascript
   export function execLine(command, args, options = {}, execFn = execSync) {
     return execFn(/* ... */);
   }
   ```

3. **`waitFor`** — Polling utility. Accept a sleep/delay function as optional
   parameter:

   ```javascript
   export function waitFor(fn, options = {}, delayFn = setTimeout) {
     // ...
   }
   ```

4. **`updateEnvFile`** — File I/O utility. Accept fs as optional parameter:

   ```javascript
   export function updateEnvFile(filePath, key, value, fsFns = { readFileSync, writeFileSync }) {
     // ...
   }
   ```

5. **`createBundleDownloader`** — Resolve circular dependency. Currently uses
   `await import("@forwardimpact/libtelemetry")` dynamically. Fix by accepting
   logger as a parameter instead of importing it:

   ```javascript
   export function createBundleDownloader(prefix, logger = null) {
     const finder = new Finder(fs, logger, process);
     // ...
   }
   ```

6. **Add `createRetry` factory** if not already present.

**Verify**: `npm run test --workspace=libraries/libutil`

## Migration 3: libuniverse (large — ~6 hours)

### Problem

libuniverse is a procedural pipeline of ~20 exported functions. Key issues:

1. **ProseEngine** creates its own PromptLoader at module scope (line 16 of
   `engine/prose.js`).
2. **pipeline.js** calls functions directly instead of composing injected
   collaborators.
3. **Render functions** import templates and industry data at module scope.
4. **No DI seams** for fs, config, or LLM in most modules.

### Target architecture

```
CLI (fit-universe.js)         ← composition root: wires all deps
  └── Pipeline                ← orchestrator class
        ├── DslParser         ← wraps tokenizer + parser
        ├── EntityGenerator   ← wraps tier0 + entities + activity
        ├── ProseEngine       ← existing class, fix DI
        ├── PathwayGenerator  ← wraps pathway.js
        ├── Renderer          ← wraps html, markdown, raw, pathway renderers
        ├── ContentValidator  ← wraps validate.js
        └── ContentFormatter  ← wraps format.js (prettier)
```

### Phase 1: Fix ProseEngine DI

**engine/prose.js** — Move PromptLoader from module scope into constructor:

```javascript
class ProseEngine {
  constructor({ cachePath, mode, strict, llmApi, promptLoader, logger }) {
    this.cachePath = cachePath;
    this.mode = mode;
    this.strict = strict;
    this.llmApi = llmApi;
    this.promptLoader = promptLoader;   // was module-level
    this.logger = logger;               // was createLogger() inline
    this.cache = new Map();
    this.dirty = false;
  }
}
```

**Add factory:**

```javascript
export function createProseEngine(options) {
  const logger = createLogger("prose");
  const promptLoader = createPromptLoader(options.promptDir);
  return new ProseEngine({ ...options, promptLoader, logger });
}
```

Update pipeline.js to use the factory or pass deps explicitly.

### Phase 2: Extract DslParser

Wrap `tokenizer.js` and `parser.js` into a class:

```javascript
export class DslParser {
  constructor(tokenizer, parser) {
    this.tokenizer = tokenizer;
    this.parser = parser;
  }

  parse(source) {
    const tokens = this.tokenizer.tokenize(source);
    return this.parser.parse(tokens);
  }
}

export function createDslParser() {
  return new DslParser(tokenizer, parser);
}
```

### Phase 3: Extract EntityGenerator

Wrap `tier0.js`, `entities.js`, `activity.js`:

```javascript
export class EntityGenerator {
  constructor(rngFactory, logger) {
    this.rngFactory = rngFactory;
    this.logger = logger;
  }

  generate(ast) {
    const rng = this.rngFactory(ast.seed);
    const entities = buildEntities(ast, rng);
    const activity = generateActivity(entities, rng);
    return { ...entities, activity };
  }
}

export function createEntityGenerator(logger) {
  return new EntityGenerator(createSeededRNG, logger);
}
```

The internal `buildEntities` and `generateActivity` remain as pure functions
called by the class — they are stateless builders that take data in and return
data out.

### Phase 4: Extract Renderer

Wrap all render functions behind a single class with method dispatch:

```javascript
export class Renderer {
  constructor(templateLoader, logger) {
    this.templateLoader = templateLoader;
    this.logger = logger;
  }

  renderHtml(entities, prose) { /* delegates to html.js logic */ }
  renderMarkdown(entities, prose) { /* delegates to markdown.js logic */ }
  renderRaw(entities) { /* delegates to raw.js logic */ }
  renderPathway(pathwayData) { /* delegates to pathway.js render logic */ }
}
```

### Phase 5: Extract PathwayGenerator

```javascript
export class PathwayGenerator {
  constructor(proseEngine, promptLoader, logger) {
    this.proseEngine = proseEngine;
    this.promptLoader = promptLoader;
    this.logger = logger;
  }

  async generate(entities, options) {
    // Wraps current generatePathwayData() logic
  }
}
```

### Phase 6: Extract ContentValidator and ContentFormatter

```javascript
export class ContentValidator {
  constructor(logger) {
    this.logger = logger;
  }
  validate(entities) { /* wraps validateCrossContent() */ }
}

export class ContentFormatter {
  constructor(prettierFn, logger) {
    this.prettierFn = prettierFn;
    this.logger = logger;
  }
  async format(files) { /* wraps formatFiles() */ }
}
```

### Phase 7: Create Pipeline orchestrator

```javascript
export class Pipeline {
  constructor({
    dslParser,
    entityGenerator,
    proseEngine,
    pathwayGenerator,
    renderer,
    validator,
    formatter,
    logger,
  }) {
    // assign all deps
  }

  async run(source, options) {
    const ast = this.dslParser.parse(source);
    const entities = this.entityGenerator.generate(ast);
    // ... orchestrate stages as current runPipeline() does
    return { files, rawDocuments, entities, validation };
  }
}
```

### Phase 8: Update composition root

**bin/fit-universe.js** becomes the composition root:

```javascript
const logger = createLogger("universe");
const llmApi = createLlmApi();
const promptLoader = createPromptLoader(promptDir);
const templateLoader = createTemplateLoader(templateDir);

const pipeline = new Pipeline({
  dslParser: createDslParser(),
  entityGenerator: createEntityGenerator(logger),
  proseEngine: new ProseEngine({ cachePath, mode, strict, llmApi, promptLoader, logger }),
  pathwayGenerator: new PathwayGenerator(proseEngine, promptLoader, logger),
  renderer: new Renderer(templateLoader, logger),
  validator: new ContentValidator(logger),
  formatter: new ContentFormatter(prettier, logger),
  logger,
});

const result = await pipeline.run(source, options);
```

### Phase 9: Update exports

**index.js** — Export classes and factories. Remove bare function exports.
Keep `parseUniverse` as a convenience alias for `createDslParser().parse()` if
external consumers depend on it, but prefer the class API.

### Phase 10: Update tests

Existing tests use function calls. Update to construct classes with mock deps:

```javascript
const parser = new DslParser(mockTokenizer, mockParser);
const result = parser.parse(source);
```

**Verify**: `npm run test --workspace=libraries/libuniverse`

## Migration order

| Order | Library | Size | Risk | Dependencies |
| --- | --- | --- | --- | --- |
| 1 | libsupervise | Small | Low | No downstream consumers change |
| 2 | libutil | Medium | Medium | Many consumers — verify all workspaces |
| 3 | libuniverse | Large | Medium | Only fit-universe CLI consumes it |

## Verification

After all migrations:

```sh
npm run check          # format, lint, test, SHACL across all packages
npm run test           # unit tests
npm run test:e2e       # E2E tests
```

Every library constructor must accept all collaborators as parameters. No
module-level singletons remain. Every library with classes has at least one
`createXxx` factory function.
