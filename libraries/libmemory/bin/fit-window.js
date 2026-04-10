#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createCli } from "@forwardimpact/libcli";
import { createServiceConfig } from "@forwardimpact/libconfig";
import { createClient, createTracer } from "@forwardimpact/librpc";
import { createLogger } from "@forwardimpact/libtelemetry";

const { version: VERSION } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const definition = {
  name: "fit-window",
  version: VERSION,
  description: "Fetch the memory window for a conversation as JSON",
  usage: "fit-window <resource_id> [model]",
  options: {
    help: { type: "boolean", short: "h", description: "Show this help" },
    version: { type: "boolean", description: "Show version" },
    json: { type: "boolean", description: "Output help as JSON" },
  },
  examples: ["fit-window common.Conversation.abc123"],
};

const cli = createCli(definition);
const logger = createLogger("cli");

/**
 * Fetches the memory window for a conversation as JSON
 * @returns {Promise<void>}
 */
async function main() {
  const parsed = cli.parse(process.argv.slice(2));
  if (!parsed) process.exit(0);

  const resourceId = parsed.positionals[0];
  if (!resourceId) {
    cli.usageError("expected argument: <resource_id>");
    process.exit(2);
  }

  const agentConfig = await createServiceConfig("agent");
  const model = parsed.positionals[1] || agentConfig.model;
  const config = await createServiceConfig("memory");
  const tracer = await createTracer("cli");
  const client = await createClient("memory", logger, tracer);

  const response = await client.callUnary("GetWindow", {
    resource_id: resourceId,
    model,
    max_tokens: config.max_tokens || 4096,
  });

  console.log(JSON.stringify(response, null, 2));
}

main().catch((error) => {
  logger.exception("main", error);
  cli.error(error.message);
  process.exit(1);
});
