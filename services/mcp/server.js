import { createServiceConfig } from "@forwardimpact/libconfig";
import { createClient, createTracer } from "@forwardimpact/librpc";
import { createLogger } from "@forwardimpact/libtelemetry";

import { createMcpService } from "./index.js";

const config = await createServiceConfig("mcp");
const logger = createLogger("mcp");
const tracer = await createTracer("mcp");

const graphClient = await createClient("graph", logger, tracer);
const vectorClient = await createClient("vector", logger, tracer);
const pathwayClient = await createClient("pathway", logger, tracer);

const service = createMcpService({
  config,
  logger,
  graphClient,
  vectorClient,
  pathwayClient,
});

await service.start();
