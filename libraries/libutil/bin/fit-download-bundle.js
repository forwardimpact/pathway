#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createCli } from "@forwardimpact/libcli";
import { createScriptConfig } from "@forwardimpact/libconfig";
import { createStorage } from "@forwardimpact/libstorage";
import { createLogger } from "@forwardimpact/libtelemetry";
import { createBundleDownloader, execLine } from "@forwardimpact/libutil";

const { version: VERSION } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const definition = {
  name: "fit-download-bundle",
  version: VERSION,
  description: "Download generated code bundle from remote storage",
  globalOptions: {
    help: { type: "boolean", short: "h", description: "Show this help" },
    version: { type: "boolean", description: "Show version" },
    json: { type: "boolean", description: "Output help as JSON" },
  },
};

const cli = createCli(definition);
const logger = createLogger("generated");

/**
 * Downloads generated code bundle from remote storage.
 * Used in containerized deployments to fetch pre-generated code.
 * @returns {Promise<void>}
 */
async function main() {
  const parsed = cli.parse(process.argv.slice(2));
  if (!parsed) process.exit(0);

  await createScriptConfig("download-bundle");
  const downloader = createBundleDownloader(createStorage, logger);
  await downloader.download();

  // If additional arguments provided, execute them after download
  execLine(0, { spawn, process });
}

main().catch((error) => {
  logger.exception("main", error);
  cli.error(error.message);
  process.exit(1);
});
