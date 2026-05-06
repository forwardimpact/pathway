#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createCli } from "@forwardimpact/libcli";
import { createScriptConfig } from "@forwardimpact/libconfig";
import { createResourceIndex } from "@forwardimpact/libresource";
import { createStorage } from "@forwardimpact/libstorage";
import { createLogger } from "@forwardimpact/libtelemetry";
import { VectorIndex } from "@forwardimpact/libvector/index/vector.js";
import { VectorProcessor } from "@forwardimpact/libvector/processor/vector.js";

// `bun build --compile` injects FIT_PROCESS_VECTORS_VERSION via --define,
// eliminating the readFileSync branch in the compiled binary (which would
// ENOENT against the bunfs virtual mount). Source execution falls through.
const VERSION =
  process.env.FIT_PROCESS_VECTORS_VERSION ||
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
    .version;

const definition = {
  name: "fit-process-vectors",
  version: VERSION,
  description: "Process resources into vector embeddings",
  globalOptions: {
    help: { type: "boolean", short: "h", description: "Show this help" },
    version: { type: "boolean", description: "Show version" },
    json: { type: "boolean", description: "Output help as JSON" },
  },
};

const cli = createCli(definition);
const logger = createLogger("vectors");

function createEmbeddingClient(token, baseUrl) {
  return {
    async createEmbeddings(input) {
      const headers = { "Content-Type": "application/json" };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(`${baseUrl}/v1/embeddings`, {
        method: "POST",
        headers,
        body: JSON.stringify({ input, model: "default" }),
      });
      if (!res.ok) throw new Error(`Embedding request failed: ${res.status}`);
      return res.json();
    },
  };
}

/**
 * Processes resources into vector embeddings
 * @returns {Promise<void>}
 */
async function main() {
  const parsed = cli.parse(process.argv.slice(2));
  if (!parsed) process.exit(0);

  const config = await createScriptConfig("vectors");

  const vectorStorage = createStorage("vectors");

  const resourceIndex = createResourceIndex("resources");
  const vectorIndex = new VectorIndex(vectorStorage);
  let embeddingToken = null;
  try {
    embeddingToken = await config.anthropicToken();
  } catch {
    // auth is optional for local TEI
  }
  const llm = createEmbeddingClient(embeddingToken, config.embeddingBaseUrl());

  const processor = new VectorProcessor(
    vectorIndex,
    resourceIndex,
    llm,
    logger,
  );

  const actor = "common.System.root";

  // Process content representation
  await processor.process(actor);
}

main().catch((error) => {
  logger.exception("main", error);
  cli.error(error.message);
  process.exit(1);
});
