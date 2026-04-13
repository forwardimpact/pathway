#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createCli } from "@forwardimpact/libcli";
import { createResourceIndex } from "@forwardimpact/libresource";
import { createLogger } from "@forwardimpact/libtelemetry";

import { createGraphIndex } from "@forwardimpact/libgraph";
import { GraphProcessor } from "@forwardimpact/libgraph/processor/graph.js";

const { version: VERSION } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const definition = {
  name: "fit-process-graphs",
  version: VERSION,
  description: "Process resources into RDF graphs",
  globalOptions: {
    help: { type: "boolean", short: "h", description: "Show this help" },
    version: { type: "boolean", description: "Show version" },
    json: { type: "boolean", description: "Output help as JSON" },
  },
};

const cli = createCli(definition);
const logger = createLogger("graphs");

/**
 * Processes resources into RDF graphs
 * @returns {Promise<void>}
 */
async function main() {
  const parsed = cli.parse(process.argv.slice(2));
  if (!parsed) process.exit(0);

  const resourceIndex = createResourceIndex("resources");
  const graphIndex = createGraphIndex("graphs");

  const processor = new GraphProcessor(graphIndex, resourceIndex, logger);

  const actor = "cld:common.System.root";

  // Process resources into RDF graphs (content only)
  await processor.process(actor);
}

main().catch((error) => {
  logger.exception("main", error);
  cli.error(error.message);
  process.exit(1);
});
