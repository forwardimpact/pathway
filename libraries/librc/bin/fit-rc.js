#!/usr/bin/env node
/**
 * Service manager CLI (s6-rc equivalent).
 * Communicates with svscan daemon via Unix socket.
 */
import { readFileSync } from "node:fs";
import { createCli } from "@forwardimpact/libcli";
import { createInitConfig } from "@forwardimpact/libconfig";
import { createLogger } from "@forwardimpact/libtelemetry";

import { ServiceManager, sendCommand, waitForSocket } from "../src/index.js";

const { version: VERSION } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const definition = {
  name: "fit-rc",
  version: VERSION,
  description: "Service manager for Forward Impact",
  commands: [
    { name: "start", args: "[service]", description: "Start services" },
    { name: "stop", args: "[service]", description: "Stop services" },
    { name: "status", args: "[service]", description: "Show service status" },
    { name: "restart", args: "[service]", description: "Restart services" },
  ],
  options: {
    help: { type: "boolean", short: "h", description: "Show this help" },
    silent: {
      type: "boolean",
      short: "s",
      description: "Suppress info/debug output",
    },
    version: { type: "boolean", description: "Show version" },
    json: { type: "boolean", description: "Output help as JSON" },
  },
  examples: ["fit-rc start", "fit-rc stop agent", "fit-rc status"],
};

const cli = createCli(definition);
const parsed = cli.parse(process.argv.slice(2));
if (!parsed) process.exit(0);

const { values, positionals } = parsed;
const [command, serviceName] = positionals;

const baseLogger = createLogger("rc");
const isSilent = values.silent;
const logger = {
  debug: (...a) => !isSilent && baseLogger.debug(...a),
  info: (...a) => !isSilent && baseLogger.info(...a),
  error: (...a) => baseLogger.error(...a),
  exception: (...a) => baseLogger.exception(...a),
};

if (!command) {
  cli.usageError("no command specified");
  process.exit(2);
}

const config = await createInitConfig();
const manager = new ServiceManager(config, logger, {
  sendCommand,
  waitForSocket,
});

switch (command) {
  case "start":
    await manager.start(serviceName);
    break;
  case "stop":
    await manager.stop(serviceName);
    break;
  case "status":
    await manager.status(serviceName);
    break;
  case "restart":
    await manager.stop(serviceName);
    await manager.start(serviceName);
    break;
  default:
    cli.usageError(`unknown command "${command}"`);
    process.exit(2);
}

process.exit(0);
