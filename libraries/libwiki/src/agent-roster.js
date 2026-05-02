import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { BROADCAST_TARGET } from "./constants.js";

export function listAgents(
  { agentsDir, wikiRoot },
  fs = { readdirSync, statSync },
) {
  const entries = fs.readdirSync(agentsDir);
  const agents = [];

  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const fullPath = path.join(agentsDir, entry);
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) continue;

    const agent = entry.slice(0, -3);
    if (agent === BROADCAST_TARGET) {
      throw new Error(
        `agent name '${BROADCAST_TARGET}' is reserved for broadcast`,
      );
    }

    agents.push({
      agent,
      summaryPath: path.join(wikiRoot, agent + ".md"),
    });
  }

  return agents;
}
