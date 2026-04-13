#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createCli } from "@forwardimpact/libcli";
import { createLogger } from "@forwardimpact/libtelemetry";
import { createGraphIndex, parseGraphQuery } from "@forwardimpact/libgraph";

const { version: VERSION } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const definition = {
  name: "fit-query",
  version: VERSION,
  description: "Query the graph index with a triple pattern",
  usage: "fit-query <subject> <predicate> <object>",
  globalOptions: {
    help: { type: "boolean", short: "h", description: "Show this help" },
    version: { type: "boolean", description: "Show version" },
    json: { type: "boolean", description: "Output help as JSON" },
  },
  examples: ['fit-query "?" rdf:type schema:Person'],
};

const cli = createCli(definition);
const logger = createLogger("query");

/**
 * Queries the graph index with a triple pattern
 * @returns {Promise<void>}
 */
async function main() {
  const parsed = cli.parse(process.argv.slice(2));
  if (!parsed) process.exit(0);

  if (parsed.positionals.length !== 3) {
    cli.usageError("expected 3 arguments: <subject> <predicate> <object>");
    process.exit(2);
  }

  const pattern = parseGraphQuery(parsed.positionals.join(" "));
  const graphIndex = createGraphIndex("graphs");

  const identifiers = await graphIndex.queryItems(pattern);

  for (const identifier of identifiers) {
    console.log(String(identifier));
  }
}

main().catch((error) => {
  logger.exception("main", error);
  cli.error(error.message);
  process.exit(1);
});
