#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createCli } from "@forwardimpact/libcli";
import { createScriptConfig } from "@forwardimpact/libconfig";
import { createLlmApi } from "@forwardimpact/libllm";
import { createResourceIndex } from "@forwardimpact/libresource";
import { createStorage } from "@forwardimpact/libstorage";
import { createLogger } from "@forwardimpact/libtelemetry";
import { VectorIndex } from "@forwardimpact/libvector/index/vector.js";
import { VectorProcessor } from "@forwardimpact/libvector/processor/vector.js";

const { version: VERSION } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const definition = {
  name: "fit-process-vectors",
  version: VERSION,
  description: "Process resources into vector embeddings",
  options: {
    help: { type: "boolean", short: "h", description: "Show this help" },
    version: { type: "boolean", description: "Show version" },
    json: { type: "boolean", description: "Output help as JSON" },
  },
};

const cli = createCli(definition);
const logger = createLogger("vectors");

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
  const llm = createLlmApi(
    await config.llmToken(),
    undefined,
    config.llmBaseUrl(),
    config.embeddingBaseUrl(),
  );

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
