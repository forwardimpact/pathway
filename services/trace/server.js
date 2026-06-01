#!/usr/bin/env node
import "@forwardimpact/libpreflight/node22";

import { Server } from "@forwardimpact/librpc";
import { createServiceConfig } from "@forwardimpact/libconfig";
import { createStorage } from "@forwardimpact/libstorage";
import { TraceIndex } from "@forwardimpact/libtelemetry/index/trace.js";
import { createDefaultRuntime } from "@forwardimpact/libutil/runtime";

import { TraceService } from "./index.js";

const config = await createServiceConfig("trace");
const { clock } = createDefaultRuntime();

// Initialize storage for traces
const traceStorage = createStorage("traces");

// Create trace index
const traceIndex = new TraceIndex(traceStorage, "index.jsonl", { clock });

const service = new TraceService(config, traceIndex);
const server = new Server(service, config);
await server.start();
