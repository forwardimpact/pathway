/**
 * Pipeline node table — pure stage definitions for fit-terrain.
 *
 * Each node declares dependencies and a `run(deps)` function. Nodes are
 * pure functions of their declared inputs; side-effects (writes, uploads,
 * cache flushes) live in sinks. Kept separate from pipeline.js so the
 * graph definitions don't crowd the executor and Pipeline class.
 *
 * @module libterrain/nodes
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

const FLUSH_EVERY = 25;

/**
 * Build the per-run node table. Each entry is `(deps, ctx) => output`.
 * `deps` is the materialized output of declared dependencies; `ctx`
 * carries pipeline collaborators and run-scoped state (logger, options).
 */
export function buildNodes(ctx) {
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
          const value = await proseGenerator.generatePlain(key, context);
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
        logger.info(
          "render",
          "Rendering HTML (Pass 1: deterministic skeleton)",
        );
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

        logger.info(
          "pipeline",
          `Generating ${parse.datasets.length} dataset(s)`,
        );
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

        logger.info(
          "pipeline",
          `Rendering ${parse.outputs.length} dataset output(s)`,
        );
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
    logger.error(
      "validate",
      `Link validation: ${linkValidation.failures} failures`,
    );
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
