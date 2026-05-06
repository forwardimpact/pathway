#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createCli } from "@forwardimpact/libcli";
import { createLogger } from "@forwardimpact/libtelemetry";
import { createScriptConfig } from "@forwardimpact/libconfig";
import { createStorage } from "@forwardimpact/libstorage";
import { VectorIndex } from "@forwardimpact/libvector/index/vector.js";

const { version: VERSION } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const definition = {
  name: "fit-search",
  version: VERSION,
  description: "Search vector index by embedding a query string",
  usage: "fit-search <query>",
  globalOptions: {
    help: { type: "boolean", short: "h", description: "Show this help" },
    version: { type: "boolean", description: "Show version" },
    json: { type: "boolean", description: "Output help as JSON" },
  },
  examples: ["fit-search 'career progression'"],
};

const cli = createCli(definition);
const logger = createLogger("search");

function createEmbeddingClient(token, baseUrl) {
  return {
    async createEmbeddings(input) {
      const res = await fetch(`${baseUrl}/v1/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ input, model: "default" }),
      });
      if (!res.ok) throw new Error(`Embedding request failed: ${res.status}`);
      return res.json();
    },
  };
}

/**
 * Searches vector index by embedding a query string
 * @returns {Promise<void>}
 */
async function main() {
  const parsed = cli.parse(process.argv.slice(2));
  if (!parsed) process.exit(0);

  const query = parsed.positionals.join(" ");
  if (!query) {
    cli.usageError("expected a query string");
    process.exit(2);
  }

  const config = await createScriptConfig("vectors");
  const storage = createStorage("vectors");
  const vectorIndex = new VectorIndex(storage);

  const llm = createEmbeddingClient(
    await config.anthropicToken(),
    config.embeddingBaseUrl(),
  );

  const embeddings = await llm.createEmbeddings([query]);
  const vectors = embeddings.data.map((d) => d.embedding);
  const results = await vectorIndex.queryItems(vectors, { limit: 10 });

  for (const identifier of results) {
    console.log(`${String(identifier)}\t${identifier.score?.toFixed(4) ?? ""}`);
  }
}

main().catch((error) => {
  logger.exception("main", error);
  cli.error(error.message);
  process.exit(1);
});
