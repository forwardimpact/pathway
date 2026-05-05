import fs from "node:fs/promises";
import { resolve } from "node:path";
import { generateSecret, updateEnvFile } from "@forwardimpact/libsecret";
import {
  SummaryRenderer,
  formatHeader,
  formatSuccess,
  formatError,
  formatBullet,
} from "@forwardimpact/libcli";

/** Bootstrap a Guide project by generating secrets, writing default service URLs to .env, and copying starter configuration. */
export async function runInitCommand() {
  const serviceSecret = generateSecret();
  const mcpToken = generateSecret();

  await updateEnvFile("SERVICE_SECRET", serviceSecret);
  await updateEnvFile("MCP_TOKEN", mcpToken);

  const serviceUrls = {
    SERVICE_TRACE_URL: "grpc://localhost:3001",
    SERVICE_VECTOR_URL: "grpc://localhost:3002",
    SERVICE_GRAPH_URL: "grpc://localhost:3003",
    SERVICE_PATHWAY_URL: "grpc://localhost:3004",
    SERVICE_MAP_URL: "grpc://localhost:3006",
    SERVICE_MCP_URL: "http://localhost:3005",
    EMBEDDING_BASE_URL: "http://localhost:8090",
  };

  for (const [key, url] of Object.entries(serviceUrls)) {
    await updateEnvFile(key, url);
  }

  // Ensure package.json exists (needed by fit-codegen for project root detection)
  const pkgPath = resolve("package.json");
  try {
    await fs.access(pkgPath);
  } catch {
    await fs.writeFile(
      pkgPath,
      JSON.stringify(
        {
          name: "my-guide-project",
          version: "0.1.0",
          type: "module",
          private: true,
        },
        null,
        2,
      ) + "\n",
    );
    process.stdout.write(formatSuccess("package.json created.") + "\n");
  }

  const summary = new SummaryRenderer({ process });
  summary.render({
    title: formatHeader("Environment (.env)"),
    ok: true,
    items: [
      { label: "SERVICE_SECRET", description: "generated" },
      { label: "MCP_TOKEN", description: "generated" },
      { label: "Service URLs", description: "ports 3001\u20133005" },
      {
        label: "ANTHROPIC_API_KEY",
        description: "set manually or run fit-guide login",
      },
    ],
  });
  if (summary.shouldRender(true)) process.stdout.write("\n");

  // Copy starter config into ./config/ (config.json only)
  const starterDir = new URL("../../starter", import.meta.url).pathname;
  const configDir = resolve("config");

  try {
    await fs.access(starterDir);
  } catch {
    process.stderr.write(
      formatError("Starter data not found in package.") + "\n",
    );
    process.exit(1);
  }

  try {
    await fs.access(configDir);
    process.stdout.write(
      formatBullet("config/ already exists, skipping starter copy.", 0) + "\n",
    );
  } catch {
    await fs.cp(starterDir, configDir, { recursive: true });
    process.stdout.write(
      formatSuccess("config/ created with starter configuration.") + "\n",
    );
  }
}
