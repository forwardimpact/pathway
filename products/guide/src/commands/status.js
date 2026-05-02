import { SummaryRenderer } from "@forwardimpact/libcli";
import { runStatus } from "../lib/status.js";

function printStatusSummary(summary, result) {
  const ok = result.verdict === "ready";

  summary.render({
    title: "Services",
    ok,
    items: Object.entries(result.services).map(([name, info]) => ({
      label: name,
      description: `${info.status === "ok" ? "ok" : "unreachable"}  ${info.url}`,
    })),
  });

  summary.render({
    title: "Data",
    ok,
    items: [
      { label: "resources", description: String(result.data.resources) },
      { label: "triples", description: String(result.data.triples) },
    ],
  });

  summary.render({
    title: "Credentials",
    ok,
    items: [
      {
        label: "ANTHROPIC_API_KEY",
        description: result.credentials.ANTHROPIC_API_KEY,
      },
    ],
  });

  if (summary.shouldRender(ok)) process.stdout.write("\n");
  process.stdout.write(`Status: ${result.verdict}\n`);
}

export async function runStatusCommand({ json }) {
  const { createServiceConfig } = await import("@forwardimpact/libconfig");
  const { healthDefinition } = await import("@forwardimpact/librpc");
  const grpcMod = (await import("@grpc/grpc-js")).default;
  const fsPromises = await import("fs/promises");

  const result = await runStatus({
    createServiceConfig,
    grpc: grpcMod,
    healthDefinition,
    fs: fsPromises,
  });

  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    const summary = new SummaryRenderer({ process });
    printStatusSummary(summary, result);
  }

  return result.verdict === "ready" ? 0 : 1;
}
