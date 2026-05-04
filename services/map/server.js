#!/usr/bin/env node
import { Server, createClient, createTracer } from "@forwardimpact/librpc";
import { createServiceConfig } from "@forwardimpact/libconfig";
import { createLogger } from "@forwardimpact/libtelemetry";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { MapService } from "./index.js";

const config = await createServiceConfig("map");
const logger = createLogger("map");
const tracer = await createTracer("map");

const supabaseUrl = config.supabaseUrl || process.env.SUPABASE_URL;
const supabaseKey = config.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "svcmap requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or the equivalents in service config).",
  );
}
const supabase = createSupabaseClient(supabaseUrl, supabaseKey, {
  db: { schema: "activity" },
});

// svcmap depends on svcpathway for marker grounding in WriteEvidence. The
// init topology in products/guide/starter/config.json must start pathway
// before map; createClient wires the gRPC connection at boot.
const pathwayClient = await createClient("pathway", logger, tracer);

const service = new MapService(config, { supabase, pathwayClient });
const server = new Server(service, config, logger, tracer);

await server.start();
