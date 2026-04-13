#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createCli } from "@forwardimpact/libcli";
import { createLogger } from "@forwardimpact/libtelemetry";
import { createServiceConfig } from "@forwardimpact/libconfig";
import { createLlmApi } from "@forwardimpact/libllm";

const { version: VERSION } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const definition = {
  name: "fit-completion",
  version: VERSION,
  description: "Send a completion request to the LLM API",
  usage: "echo '{\"messages\":[...]}' | fit-completion",
  globalOptions: {
    help: { type: "boolean", short: "h", description: "Show this help" },
    version: { type: "boolean", description: "Show version" },
    json: { type: "boolean", description: "Output help as JSON" },
  },
  examples: ["echo '{\"messages\":[...]}' | fit-completion"],
};

const cli = createCli(definition);
const logger = createLogger("completion");

/**
 * Sends a completion request to the LLM API
 * Reads a JSON memory window from stdin
 * @returns {Promise<void>}
 */
async function main() {
  const parsed = cli.parse(process.argv.slice(2));
  if (!parsed) process.exit(0);

  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const input = Buffer.concat(chunks).toString().trim();
  if (!input) {
    cli.usageError("expected JSON input on stdin");
    process.exit(2);
  }

  const window = JSON.parse(input);
  const agentConfig = await createServiceConfig("agent");

  const llm = createLlmApi(
    await agentConfig.llmToken(),
    agentConfig.model,
    agentConfig.llmBaseUrl(),
    agentConfig.embeddingBaseUrl(),
  );

  const response = await llm.createCompletions(window);
  console.log(JSON.stringify(response, null, 2));
}

main().catch((error) => {
  logger.exception("main", error);
  cli.error(error.message);
  process.exit(1);
});
