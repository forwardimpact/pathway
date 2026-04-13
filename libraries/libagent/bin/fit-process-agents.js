#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createCli } from "@forwardimpact/libcli";
import { createResourceIndex } from "@forwardimpact/libresource";
import { createStorage } from "@forwardimpact/libstorage";
import { createLogger } from "@forwardimpact/libtelemetry";

import { AgentProcessor } from "../src/processor/agent.js";

const { version: VERSION } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const definition = {
  name: "fit-process-agents",
  version: VERSION,
  description:
    "Process agent configurations from config/agents/*.agent.md and generate Agent resources",
  globalOptions: {
    help: { type: "boolean", short: "h", description: "Show this help" },
    version: { type: "boolean", description: "Show version" },
    json: { type: "boolean", description: "Output help as JSON" },
  },
};

const cli = createCli(definition);
const logger = createLogger("agents");

/**
 * Process agent configurations and generate Agent resources
 * @returns {Promise<void>}
 */
async function main() {
  const parsed = cli.parse(process.argv.slice(2));
  if (!parsed) process.exit(0);

  const configStorage = createStorage("config");
  const resourceIndex = createResourceIndex("resources");

  const agentProcessor = new AgentProcessor(
    resourceIndex,
    configStorage,
    logger,
  );
  await agentProcessor.process();
}

main().catch((error) => {
  logger.exception("main", error);
  cli.error(error.message);
  process.exit(1);
});
