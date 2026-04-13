#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createCli } from "@forwardimpact/libcli";
import { createScriptConfig } from "@forwardimpact/libconfig";
import { createResourceIndex } from "@forwardimpact/libresource";
import { createStorage } from "@forwardimpact/libstorage";
import { createLogger } from "@forwardimpact/libtelemetry";

import { ToolProcessor } from "@forwardimpact/libtool/processor/tool.js";

const { version: VERSION } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const definition = {
  name: "fit-process-tools",
  version: VERSION,
  description:
    "Process tool endpoint configurations and generate tool resources",
  globalOptions: {
    "proto-root": {
      type: "string",
      short: "p",
      description: "Proto root directory (default: cwd)",
    },
    help: { type: "boolean", short: "h", description: "Show this help" },
    version: { type: "boolean", description: "Show version" },
    json: { type: "boolean", description: "Output help as JSON" },
  },
};

const cli = createCli(definition);
const logger = createLogger("tools");

/**
 * Process tool endpoint configurations and generate tool resources
 * @returns {Promise<void>}
 */
async function main() {
  const parsed = cli.parse(process.argv.slice(2));
  if (!parsed) process.exit(0);

  await createScriptConfig("tools");

  const configStorage = createStorage("config", "local");
  const resourceIndex = createResourceIndex("resources");

  const toolProcessor = new ToolProcessor(
    resourceIndex,
    configStorage,
    parsed.values["proto-root"] || process.cwd(),
    logger,
  );
  await toolProcessor.process();
}

main().catch((error) => {
  logger.exception("main", error);
  cli.error(error.message);
  process.exit(1);
});
