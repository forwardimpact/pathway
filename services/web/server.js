import { serve } from "@hono/node-server";

import { createServiceConfig } from "@forwardimpact/libconfig";
import { createLogger } from "@forwardimpact/libtelemetry";

import { createWebService } from "./index.js";

// Initialize observability
const logger = createLogger("web");

// Service configuration with defaults
const config = await createServiceConfig("web", { auth_enabled: false });

const app = await createWebService(config, logger);

serve(
  {
    fetch: app.fetch,
    port: config.port,
    hostname: config.host,
  },
  () => {
    logger.debug("Server", "Listening", {
      uri: `${config.host}:${config.port}`,
    });
  },
);
