#!/usr/bin/env node

// fit-terrain CLI — run with --help for usage.

import { readFileSync } from "node:fs";
import { resolve, join, dirname } from "path";
import { mkdir, writeFile, readFile, readdir, mkdtemp, rm } from "fs/promises";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";
import { format } from "prettier";
import {
  createCli,
  formatHeader,
  formatError,
  formatBullet,
  SummaryRenderer,
} from "@forwardimpact/libcli";
import { createScriptConfig } from "@forwardimpact/libconfig";
import { createLogger } from "@forwardimpact/libtelemetry";
import { PromptLoader } from "@forwardimpact/libprompt";
import { TemplateLoader } from "@forwardimpact/libtemplate/loader";

import {
  createDslParser,
  createEntityGenerator,
  FakerTool,
  SyntheaTool,
  SdvTool,
} from "@forwardimpact/libsyntheticgen";
import {
  ProseEngine,
  PathwayGenerator,
} from "@forwardimpact/libsyntheticprose";
import {
  Renderer,
  ContentValidator,
  ContentFormatter,
  formatContent,
} from "@forwardimpact/libsyntheticrender";
import { Pipeline } from "../src/pipeline.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const { version: VERSION } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const definition = {
  name: "fit-terrain",
  version: VERSION,
  description: "Synthetic data generation pipeline",
  globalOptions: {
    generate: {
      type: "boolean",
      description: "Generate prose via LLM and update cache",
    },
    "no-prose": {
      type: "boolean",
      description: "Skip prose entirely (structural scaffolding only)",
    },
    strict: {
      type: "boolean",
      description: "Fail on cache miss (use with default cached mode)",
    },
    check: {
      type: "boolean",
      description:
        "Verify 100% prose cache hit and skip validation (implies --strict --dry-run)",
    },
    "dry-run": {
      type: "boolean",
      description: "Show what would be written without writing",
    },
    load: {
      type: "boolean",
      description: "Load raw documents to Supabase Storage",
    },
    only: {
      type: "string",
      description: "Render only one content type (html|pathway|raw|markdown)",
    },
    story: { type: "string", description: "Path to a custom story DSL file" },
    cache: { type: "string", description: "Path to prose cache file" },
    help: { type: "boolean", short: "h", description: "Show this help" },
    version: { type: "boolean", description: "Show version" },
    json: { type: "boolean", description: "Output help as JSON" },
  },
  examples: [
    "bunx fit-terrain",
    "bunx fit-terrain --generate",
    "bunx fit-terrain --strict",
    "bunx fit-terrain --check",
    "bunx fit-terrain --no-prose",
    "bunx fit-terrain --only=pathway",
  ],
  documentation: [
    {
      title: "Terrain Internals",
      url: "https://www.forwardimpact.team/docs/internals/terrain/index.md",
      description:
        "Synthetic data pipeline architecture, DSL parsing, entity generation, prose engine, and rendering.",
    },
  ],
};

const cli = createCli(definition);

/**
 * Resolve the LLM API client when running in generate mode.
 *
 * Uses the Anthropic SDK with the credential resolved by libconfig's
 * anthropicToken() (ANTHROPIC_API_KEY env var with OAuth fallback).
 * The wrapper bridges Anthropic's Messages API to the OpenAI-compatible
 * choices shape consumed by ProseEngine.
 *
 * @param {object} config
 * @returns {Promise<object>}
 */
async function resolveLlmApi(config) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const token = await config.anthropicToken();
  const model = config.LLM_MODEL || "claude-opus-4-7";
  const client = new Anthropic({ apiKey: token });

  return {
    async createCompletions({ messages, max_tokens }) {
      const systemMessages = messages.filter((m) => m.role === "system");
      const turnMessages = messages.filter((m) => m.role !== "system");
      const system = systemMessages.map((m) => m.content).join("\n\n");
      const response = await client.messages.create({
        model,
        max_tokens,
        system: system || undefined,
        messages: turnMessages,
      });
      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
      return { choices: [{ message: { content: text } }] };
    },
  };
}

/**
 * Write filesystem output files from the pipeline result.
 * @param {Map<string,string>} files
 * @param {string} monorepoRoot
 * @returns {Promise<number>} Number of files written.
 */
async function writeOutputFiles(files, monorepoRoot) {
  const generatedDirs = new Set();
  for (const relPath of files.keys()) {
    const parts = relPath.split("/");
    if (parts.length >= 2) {
      generatedDirs.add(join(monorepoRoot, parts[0], parts[1]));
    }
  }
  for (const dir of generatedDirs) {
    await rm(dir, { recursive: true, force: true });
  }

  for (const [relPath, content] of files) {
    const fullPath = join(monorepoRoot, relPath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content);
  }
  return files.size;
}

/**
 * Handle raw documents: load to Supabase, write locally, or skip (dry-run).
 * @param {object} result
 * @param {object} args
 * @param {string} monorepoRoot
 * @returns {Promise<{ rawWritten: number, rawLoaded: number, loadErrors: number }>}
 */
async function handleRawDocuments(result, args, monorepoRoot) {
  const stats = { rawWritten: 0, rawLoaded: 0, loadErrors: 0 };
  if (result.rawDocuments.size === 0) return stats;

  if (args.load) {
    const loadResult = await loadRawToSupabase(result.rawDocuments);
    stats.rawLoaded = loadResult.loaded;
    stats.loadErrors = loadResult.errors.length;
  } else if (!args.dryRun) {
    await writeRawLocally(result.rawDocuments, monorepoRoot);
    stats.rawWritten = result.rawDocuments.size;
  }

  const evidence = result.entities.activity?.evidence;
  if (evidence && !args.dryRun && !args.load) {
    const evidencePath = join(monorepoRoot, "data/activity/evidence.json");
    await mkdir(dirname(evidencePath), { recursive: true });
    const formatted = await formatContent(
      evidencePath,
      JSON.stringify(evidence, null, 2),
    );
    await writeFile(evidencePath, formatted);
  }

  return stats;
}

/**
 * Load raw documents to Supabase Storage.
 * @param {Map<string,string>} rawDocuments
 * @param {object} config
 */
async function loadRawToSupabase(rawDocuments) {
  let createClient;
  try {
    ({ createClient } = await import("@supabase/supabase-js"));
  } catch {
    throw new Error(
      "--load requires @supabase/supabase-js. Install with: bun add @supabase/supabase-js",
    );
  }
  const url = process.env.MAP_SUPABASE_URL;
  const key = process.env.MAP_SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new Error(
      "MAP_SUPABASE_URL is not set. Run `fit-map activity start` and export the URL it prints.",
    );
  }
  if (!key) {
    throw new Error(
      "MAP_SUPABASE_SERVICE_ROLE_KEY is not set. Run `just env-secrets` to generate it.",
    );
  }
  const { loadToSupabase } = await import("../load.js");
  const supabase = createClient(url, key);
  const loadResult = await loadToSupabase(supabase, rawDocuments);
  if (loadResult.errors.length > 0) {
    process.stderr.write(
      formatError(`${loadResult.errors.length} errors:`) + "\n",
    );
    for (const err of loadResult.errors) {
      process.stderr.write(formatBullet(err, 1) + "\n");
    }
  }
  return loadResult;
}

/**
 * Write raw documents to local filesystem.
 * @param {Map<string,string>} rawDocuments
 * @param {string} monorepoRoot
 */
async function writeRawLocally(rawDocuments, monorepoRoot) {
  for (const [storagePath, content] of rawDocuments) {
    const fullPath = join(monorepoRoot, "data/activity/raw", storagePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content);
  }
}

/**
 * Print the validation block via the summary renderer. Exits 1 on failure.
 * @param {object} result
 * @param {SummaryRenderer} summary
 */
function printValidation(result, summary) {
  const items = result.validation.checks.map((check) => ({
    label: check.name,
    description: check.passed
      ? "\u2713"
      : `\u2717 ${check.message ?? "failed"}`,
  }));
  process.stdout.write("\n");
  summary.render({
    title: formatHeader("Validation"),
    items,
    ok: result.validation.passed,
  });

  if (!result.validation.passed) {
    process.stderr.write(
      "\n" +
        formatError(`${result.validation.failures} validation failures`) +
        "\n",
    );
    process.exit(1);
  }
}

/**
 * Print the consolidated summary of write/prose stats.
 * @param {object} result
 * @param {SummaryRenderer} summary
 * @param {{ filesWritten: number, rawWritten: number, rawLoaded: number }} writeStats
 * @param {boolean} ok - Overall command success (gates summary at LOG_LEVEL=error)
 */
function printSummary(result, summary, writeStats, ok) {
  const items = [];
  if (writeStats.filesWritten > 0) {
    items.push({
      label: "Files",
      description: `${writeStats.filesWritten} written`,
    });
  }
  if (writeStats.rawWritten > 0) {
    items.push({
      label: "Raw documents",
      description: `${writeStats.rawWritten} written to data/activity/raw/`,
    });
  }
  if (writeStats.rawLoaded > 0) {
    items.push({
      label: "Raw documents",
      description: `${writeStats.rawLoaded} loaded to Supabase Storage`,
    });
  }

  const { hits, generated, misses } = result.stats.prose;
  const proseTotal = hits + generated + misses;
  if (proseTotal > 0) {
    const rate = Math.round((hits / proseTotal) * 100);
    items.push({
      label: "Prose",
      description: `${hits} hits, ${generated} generated, ${misses} misses (${rate}% hit rate)`,
    });
  }

  if (items.length === 0) return;
  process.stdout.write("\n");
  summary.render({ title: formatHeader("Summary"), items, ok });
}

/**
 * Wire all pipeline dependencies and create a Pipeline instance.
 * @param {object} opts
 * @returns {Pipeline}
 */
function createPipeline(opts) {
  const { logger, mode, cachePath, llmApi, promptDir, templateDir } = opts;
  const promptLoader = new PromptLoader(promptDir);
  const templateLoader = new TemplateLoader(templateDir);

  const dslParser = createDslParser();
  const entityGenerator = createEntityGenerator(logger);
  const proseEngine = new ProseEngine({
    cachePath,
    mode,
    strict: opts.strict,
    llmApi,
    promptLoader,
    logger,
  });
  const pathwayGenerator = new PathwayGenerator(proseEngine, logger);
  const renderer = new Renderer(templateLoader, logger);
  const validator = new ContentValidator(logger);
  const formatter = new ContentFormatter(format, logger);

  const execFileFn = promisify(execFile);

  /**
   * Create a tool instance by name.
   * @param {string} name
   * @param {object} deps
   * @returns {object}
   */
  function toolFactory(name, deps) {
    switch (name) {
      case "faker":
        return new FakerTool({ logger: deps.logger });
      case "synthea":
        return new SyntheaTool({
          logger: deps.logger,
          syntheaJar:
            process.env.SYNTHEA_JAR || "synthea-with-dependencies.jar",
          execFileFn,
          fsFns: {
            readFile,
            readdir,
            mkdtemp: (prefix) => mkdtemp(join(tmpdir(), prefix)),
            rm,
          },
        });
      case "sdv":
        return new SdvTool({
          logger: deps.logger,
          execFileFn,
          fsFns: { writeFile, rm },
        });
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  return new Pipeline({
    dslParser,
    entityGenerator,
    proseEngine,
    pathwayGenerator,
    renderer,
    validator,
    formatter,
    toolFactory,
    logger,
  });
}

async function main() {
  const parsed = cli.parse(process.argv.slice(2));
  if (!parsed) process.exit(0);

  const { values } = parsed;

  if (values.check) {
    values.strict = true;
    values["dry-run"] = true;
  }

  const config = await createScriptConfig("terrain", {
    LLM_MODEL: "claude-opus-4-7",
  });

  const mode = values["no-prose"]
    ? "no-prose"
    : values.generate
      ? "generate"
      : "cached";

  const llmApi = mode === "generate" ? await resolveLlmApi(config) : null;

  const monorepoRoot = resolve(__dirname, "../../..");
  const schemaDir = join(monorepoRoot, "products/map/schema/json");
  const cachePath =
    values.cache || join(monorepoRoot, "data", "synthetic", "prose-cache.json");

  const libsyntheticproseDir = dirname(
    fileURLToPath(import.meta.resolve("@forwardimpact/libsyntheticprose")),
  );
  // libsyntheticrender's main entry is src/index.js but the published
  // templates/ tree lives at the package root — walk up one level.
  const libsyntheticrenderPackageRoot = dirname(
    dirname(
      fileURLToPath(import.meta.resolve("@forwardimpact/libsyntheticrender")),
    ),
  );

  const pipeline = createPipeline({
    logger: createLogger("terrain"),
    mode,
    cachePath,
    strict: !!values.strict,
    llmApi,
    promptDir: join(libsyntheticproseDir, "prompts"),
    templateDir: join(libsyntheticrenderPackageRoot, "templates"),
  });

  const result = await pipeline.run({
    storyPath:
      values.story || join(monorepoRoot, "data", "synthetic", "story.dsl"),
    only: values.only || null,
    schemaDir,
  });

  const writeStats = { filesWritten: 0, rawWritten: 0, rawLoaded: 0 };
  if (!values["dry-run"]) {
    writeStats.filesWritten = await writeOutputFiles(
      result.files,
      monorepoRoot,
    );
  }

  const rawStats = await handleRawDocuments(
    result,
    { load: values.load, dryRun: values["dry-run"] },
    monorepoRoot,
  );
  writeStats.rawWritten = rawStats.rawWritten;
  writeStats.rawLoaded = rawStats.rawLoaded;

  const summary = new SummaryRenderer({ process });
  const ok = result.validation.passed && result.stats.prose.misses === 0;
  if (!values.check) {
    printValidation(result, summary);
  }
  printSummary(result, summary, writeStats, ok);
}

const logger = createLogger("terrain");

main().catch((err) => {
  logger.exception("main", err);
  cli.error(err.message);
  process.exit(1);
});
