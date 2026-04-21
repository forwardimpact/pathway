import { Server } from "@forwardimpact/librpc";
import { createServiceConfig } from "@forwardimpact/libconfig";
import { VectorIndex } from "@forwardimpact/libvector/index/vector.js";
import { createStorage } from "@forwardimpact/libstorage";
import { createTracer } from "@forwardimpact/librpc";
import { createLogger } from "@forwardimpact/libtelemetry";

import { VectorService } from "./index.js";

const config = await createServiceConfig("vector");

// Initialize observability
const logger = createLogger("vector");
const tracer = await createTracer("vector");

// Direct HTTP embedding client (replaces gRPC llm service)
const embeddingBaseUrl =
  process.env.EMBEDDING_BASE_URL || "http://localhost:8080";

async function createEmbeddings(input) {
  const res = await fetch(`${embeddingBaseUrl}/v1/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, model: "default" }),
  });
  if (!res.ok) throw new Error(`Embedding request failed: ${res.status}`);
  return res.json();
}

// Initialize vector index
const vectorStorage = createStorage("vectors");
const vectorIndex = new VectorIndex(vectorStorage);

const service = new VectorService(config, vectorIndex, createEmbeddings);
const server = new Server(service, config, logger, tracer);

await server.start();
