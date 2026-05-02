/**
 * Pipeline DAG — pull-based stage graph for fit-terrain.
 *
 * Each verb declares a terminal node; the executor walks the transitive
 * closure backwards from there, memoizing per run. Nodes are pure
 * functions of their declared dependencies; side-effects (writes,
 * uploads, cache flushes) live in sinks.
 *
 * Nodes:
 *   parse         ← storyPath
 *   entities      ← parse
 *   prose-keys    ← entities
 *   cache-lookup  ← prose-keys
 *   skeleton      ← entities
 *   enriched      ← skeleton, cache-lookup
 *   raw           ← entities, cache-lookup
 *   markdown      ← entities, cache-lookup
 *   pathway       ← entities
 *   datasets      ← parse
 *   validate      ← enriched, entities
 *   write         ← enriched, raw, markdown, pathway, datasets, validate
 *
 * Verb terminal-closure walks (the cost-shifting payoff of Phase D):
 *   check    → parse, entities, prose-keys, cache-lookup
 *   validate → ...above + skeleton, enriched, validate
 *   build    → all of the above + raw, markdown, pathway, datasets, write
 *
 * @module libterrain/pipeline
 */

import { readFile } from "fs/promises";
import { join } from "path";
import {
  validateLinks,
  validateHTML,
  renderDataset,
} from "@forwardimpact/libsyntheticrender";
import { collectProseKeys } from "@forwardimpact/libsyntheticgen";
import { loadSchemas } from "@forwardimpact/libsyntheticprose/pathway";
import { NullProseCacheSink } from "./sinks.js";

/** Names of the nodes the DAG knows about. Inspect verb takes one of these. */
export const STAGES = [
  "parse",
  "entities",
  "prose-keys",
  "cache-lookup",
  "skeleton",
  "enriched",
  "raw",
  "markdown",
  "pathway",
  "datasets",
  "validate",
  "write",
];

const FLUSH_EVERY = 25;

/**
 * Build the per-run node table. Each entry is `(deps, ctx) => output`.
 * `deps` is the materialized output of declared dependencies; `ctx`
 * carries pipeline collaborators and run-scoped state (logger, options).
 */
function buildNodes(ctx) {
  const {
    dslParser,
    entityGenerator,
    proseGenerator,
    pathwayGenerator,
    renderer,
    validator,
    proseCacheSink,
    toolFactory,
    logger,
    options,
  } = ctx;

  return {
    parse: {
      deps: [],
      async run() {
        logger.info("pipeline", "Parsing terrain DSL");
        const source = await readFile(options.storyPath, "utf-8");
        return dslParser.parse(source);
      },
    },

    entities: {
      deps: ["parse"],
      run({ parse }) {
        if (parse.people === null) {
          return { domain: parse.domain, industry: parse.industry };
        }
        logger.info("pipeline", "Generating entity graph");
        return entityGenerator.generate(parse);
      },
    },

    "prose-keys": {
      deps: ["entities"],
      run({ entities }) {
        if (!entities.people) return new Map();
        return collectProseKeys(entities);
      },
    },

    "cache-lookup": {
      deps: ["prose-keys"],
      async run({ "prose-keys": proseKeys }) {
        const prose = new Map();
        const total = proseKeys.size;
        if (total === 0) return prose;

        const mode = proseGenerator.mode;
        if (mode !== "no-prose") {
          logger.info(
            "pipeline",
            `Resolving prose (${mode} mode, ${total} keys)`,
          );
        }
        let i = 0;
        for (const [key, context] of proseKeys) {
          i++;
          const value = await proseGenerator.generate(key, context);
          if (value) prose.set(key, value);
          if (mode !== "no-prose") {
            logger.info("prose", `[${i}/${total}] ${key}`);
            if (i % FLUSH_EVERY === 0) proseCacheSink.flush();
          }
        }
        if (mode !== "no-prose") proseCacheSink.flush();
        return prose;
      },
    },

    skeleton: {
      deps: ["entities", "cache-lookup"],
      run({ entities, "cache-lookup": prose }) {
        if (!entities.people) return { files: new Map(), linked: null };
        logger.info("render", "Rendering HTML (Pass 1: deterministic skeleton)");
        return renderer.renderSkeleton(entities, prose);
      },
    },

    enriched: {
      deps: ["skeleton", "cache-lookup", "entities"],
      async run({ skeleton, "cache-lookup": prose, entities }) {
        const out = new Map();
        if (!entities.people) return { files: out, linked: null };

        const enriched =
          skeleton.linked &&
          (await renderer.enrich(
            skeleton.files,
            skeleton.linked,
            proseGenerator,
            entities.domain,
          ));

        const source = enriched ?? skeleton.files;
        for (const [name, content] of source) {
          out.set(join("data/knowledge", name), content);
        }
        out.set(
          "data/knowledge/README.md",
          renderer.renderReadme(entities, prose),
        );
        out.set(
          "data/knowledge/ONTOLOGY.md",
          renderer.renderOntology(entities),
        );
        logger.info("render", `HTML: ${out.size} files`);
        return { files: out, linked: skeleton.linked };
      },
    },

    raw: {
      deps: ["entities", "cache-lookup"],
      run({ entities, "cache-lookup": prose }) {
        const files = new Map();
        const rawDocuments = new Map();
        if (!entities.people) return { files, rawDocuments };

        logger.info("render", "Rendering raw documents");
        const raw = renderer.renderRaw(entities, prose);
        for (const [path, content] of raw) {
          rawDocuments.set(path, content);
        }
        const activity = renderer.renderActivity(entities);
        for (const [name, content] of activity) {
          files.set(join("data/activity", name), content);
        }
        logger.info(
          "render",
          `Raw: ${raw.size} documents, ${activity.size} activity files`,
        );
        return { files, rawDocuments };
      },
    },

    markdown: {
      deps: ["entities", "cache-lookup"],
      run({ entities, "cache-lookup": prose }) {
        const files = new Map();
        if (!entities.people) return { files };
        logger.info("render", "Rendering markdown");
        const md = renderer.renderMarkdown(entities, prose);
        for (const [name, content] of md) {
          files.set(join("data/personal", name), content);
        }
        logger.info("render", `Markdown: ${md.size} files`);
        return { files };
      },
    },

    pathway: {
      deps: ["entities"],
      async run({ entities }) {
        const files = new Map();
        const hasPathwayStandard =
          entities.standard?.capabilities?.length > 0 &&
          typeof entities.standard.capabilities[0] === "object";
        if (!hasPathwayStandard || !options.schemaDir) return { files };

        logger.info("render", "Rendering pathway");
        const schemas = loadSchemas(options.schemaDir);
        const pathwayData = await pathwayGenerator.generate({
          standard: entities.standard,
          domain: entities.domain,
          industry: entities.industry,
          schemas,
        });
        const pathwayFiles = renderer.renderPathway(pathwayData);
        for (const [name, content] of pathwayFiles) {
          files.set(`data/pathway/${name}`, content);
        }
        logger.info("render", `Pathway: ${pathwayFiles.size} files`);
        return { files };
      },
    },

    datasets: {
      deps: ["parse"],
      async run({ parse }) {
        const files = new Map();
        if (!parse.datasets?.length || !toolFactory) return { files };

        logger.info("pipeline", `Generating ${parse.datasets.length} dataset(s)`);
        const datasets = new Map();
        for (const ds of parse.datasets) {
          const tool = toolFactory(ds.tool, { logger });
          try {
            await tool.checkAvailability();
          } catch (err) {
            logger.info(
              "pipeline",
              `Skipping dataset '${ds.id}': ${ds.tool} not available (${err.message})`,
            );
            continue;
          }
          const results = await tool.generate({
            ...ds.config,
            seed: parse.seed,
            name: ds.id,
          });
          for (const dataset of results) {
            datasets.set(dataset.name, dataset);
          }
        }

        logger.info("pipeline", `Rendering ${parse.outputs.length} dataset output(s)`);
        for (const out of parse.outputs) {
          const dataset = datasets.get(out.dataset);
          if (!dataset) {
            logger.info(
              "pipeline",
              `Skipping output '${out.dataset}': dataset not generated`,
            );
            continue;
          }
          const rendered = await renderDataset(dataset, out.format, out.config);
          for (const [path, content] of rendered) {
            files.set(path, content);
          }
        }
        return { files };
      },
    },

    validate: {
      deps: ["enriched", "entities"],
      run({ enriched, entities }) {
        const hasOrgBlocks = !!entities.people;
        const validation = hasOrgBlocks
          ? validator.validate(entities)
          : { checks: [], failures: 0, passed: true };

        logger.info(
          "validate",
          `${validation.checks.length} checks, ${validation.failures} failures`,
        );

        if (enriched.linked) {
          validateHtmlBlock(
            enriched.linked,
            entities,
            enriched.files,
            validation,
            logger,
          );
        }
        return validation;
      },
    },

    write: {
      deps: ["enriched", "raw", "markdown", "pathway", "datasets", "validate"],
      run({ enriched, raw, markdown, pathway, datasets, validate }) {
        const files = new Map();
        const only = options.only;
        const include = (type) => !only || only === type;

        if (include("html")) {
          for (const [k, v] of enriched.files) files.set(k, v);
        }
        if (include("pathway")) {
          for (const [k, v] of pathway.files) files.set(k, v);
        }
        if (include("raw")) {
          for (const [k, v] of raw.files) files.set(k, v);
        }
        if (include("markdown")) {
          for (const [k, v] of markdown.files) files.set(k, v);
        }
        for (const [k, v] of datasets.files) files.set(k, v);

        const rawDocuments = include("raw") ? raw.rawDocuments : new Map();
        return { files, rawDocuments, validate };
      },
    },
  };
}

/**
 * Validate HTML structure (link density, microdata) and merge results into
 * the validation block. Mutates `validation` in place.
 */
function validateHtmlBlock(htmlLinked, entities, files, validation, logger) {
  const linkValidation = validateLinks(htmlLinked, entities.domain);
  validation.checks.push({
    name: "link_density",
    passed: linkValidation.passed,
  });
  if (!linkValidation.passed) {
    validation.failures++;
    validation.passed = false;
    logger.error("validate", `Link validation: ${linkValidation.failures} failures`);
  }

  const orgFiles = new Map();
  for (const [path, content] of files) {
    if (path.startsWith("data/knowledge/") && path.endsWith(".html")) {
      orgFiles.set(path, content);
    }
  }
  const htmlValidation = validateHTML(orgFiles, entities.domain);
  for (const check of htmlValidation.checks) validation.checks.push(check);
  if (!htmlValidation.passed) {
    validation.failures += htmlValidation.failures;
    validation.passed = false;
    for (const c of htmlValidation.checks.filter((c) => !c.passed)) {
      logger.error("validate", c.message);
    }
  }
}

/**
 * Walk the DAG backwards from `terminal`, executing each node once and
 * memoizing its output. Returns the terminal node's output, the per-run
 * cache (so callers can read intermediate nodes), and the set of nodes
 * that ran (for verb-level assertions).
 *
 * @param {object} nodes - Node table from buildNodes
 * @param {string} terminal
 * @returns {Promise<{ output: any, cache: Map<string, any>, ran: Set<string> }>}
 */
async function execute(nodes, terminal) {
  if (!nodes[terminal]) {
    throw new Error(`Unknown stage '${terminal}'. Known: ${Object.keys(nodes).join(", ")}`);
  }
  const cache = new Map();
  const ran = new Set();

  async function visit(name) {
    if (cache.has(name)) return cache.get(name);
    const node = nodes[name];
    if (!node) throw new Error(`Unknown stage '${name}'`);
    const deps = {};
    for (const dep of node.deps) {
      deps[dep] = await visit(dep);
    }
    const out = await node.run(deps);
    cache.set(name, out);
    ran.add(name);
    return out;
  }

  const output = await visit(terminal);
  return { output, cache, ran };
}

export class Pipeline {
  /**
   * @param {object} deps
   * @param {import('@forwardimpact/libsyntheticgen').DslParser} deps.dslParser
   * @param {import('@forwardimpact/libsyntheticgen').EntityGenerator} deps.entityGenerator
   * @param {import('@forwardimpact/libsyntheticprose').ProseCache} deps.proseCache
   * @param {import('@forwardimpact/libsyntheticprose').ProseGenerator} deps.proseGenerator
   * @param {import('@forwardimpact/libsyntheticprose').PathwayGenerator} deps.pathwayGenerator
   * @param {import('@forwardimpact/libsyntheticrender').Renderer} deps.renderer
   * @param {import('@forwardimpact/libsyntheticrender').ContentValidator} deps.validator
   * @param {{ flush: () => void }} [deps.proseCacheSink]
   * @param {Function} [deps.toolFactory]
   * @param {object} deps.logger
   */
  constructor({
    dslParser,
    entityGenerator,
    proseCache,
    proseGenerator,
    pathwayGenerator,
    renderer,
    validator,
    proseCacheSink,
    toolFactory,
    logger,
  }) {
    if (!dslParser) throw new Error("dslParser is required");
    if (!entityGenerator) throw new Error("entityGenerator is required");
    if (!proseCache) throw new Error("proseCache is required");
    if (!proseGenerator) throw new Error("proseGenerator is required");
    if (!pathwayGenerator) throw new Error("pathwayGenerator is required");
    if (!renderer) throw new Error("renderer is required");
    if (!validator) throw new Error("validator is required");
    if (!logger) throw new Error("logger is required");

    this.dslParser = dslParser;
    this.entityGenerator = entityGenerator;
    this.proseCache = proseCache;
    this.proseGenerator = proseGenerator;
    this.pathwayGenerator = pathwayGenerator;
    this.renderer = renderer;
    this.validator = validator;
    this.proseCacheSink = proseCacheSink || new NullProseCacheSink();
    this.toolFactory = toolFactory || null;
    this.logger = logger;
  }

  /**
   * Execute the DAG up to `terminal` and shape a verb-friendly result.
   * Verbs walk only the transitive closure of their terminal node, so
   * `check` (terminal=`cache-lookup`) skips renderers, datasets, and I/O.
   *
   * @param {object} options
   * @param {string} options.storyPath - DSL source path
   * @param {string} options.terminal - Terminal stage name
   * @param {string|null} [options.only=null]
   * @param {string|null} [options.schemaDir=null]
   * @returns {Promise<{ stage: string, ran: Set<string>, output: any, files: Map<string,string>, rawDocuments: Map<string,string>, entities: object, validation: object, stats: object }>}
   */
  async run(options) {
    const { storyPath, terminal, only = null, schemaDir = null } = options;
    if (!terminal) throw new Error("terminal stage is required");

    const nodes = buildNodes({
      dslParser: this.dslParser,
      entityGenerator: this.entityGenerator,
      proseGenerator: this.proseGenerator,
      pathwayGenerator: this.pathwayGenerator,
      renderer: this.renderer,
      validator: this.validator,
      proseCacheSink: this.proseCacheSink,
      toolFactory: this.toolFactory,
      logger: this.logger,
      options: { storyPath, only, schemaDir },
    });

    const { output, cache, ran } = await execute(nodes, terminal);

    const entities = cache.get("entities") ?? {};
    const writeNode = cache.get("write");
    const files = writeNode?.files ?? new Map();
    const rawDocuments = writeNode?.rawDocuments ?? new Map();
    const validation =
      cache.get("validate") ?? { checks: [], failures: 0, passed: true };

    return {
      stage: terminal,
      ran,
      output,
      files,
      rawDocuments,
      entities,
      validation,
      stats: {
        prose: {
          ...this.proseCache.stats,
          generated: this.proseGenerator.stats.generated,
        },
        files: files.size,
        rawDocuments: rawDocuments.size,
      },
    };
  }
}
