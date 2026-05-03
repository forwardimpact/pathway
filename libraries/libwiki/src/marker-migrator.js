import { readFileSync, writeFileSync } from "node:fs";
import { MEMO_INBOX_MARKER, INBOX_HEADING } from "./constants.js";
import { listAgents } from "./agent-roster.js";

export function insertMarkers(
  { agentsDir, wikiRoot },
  fs = { readFileSync, writeFileSync },
) {
  const agents = listAgents({ agentsDir, wikiRoot });
  const inserted = [];
  const skipped = [];
  const errors = [];

  for (const { agent, summaryPath } of agents) {
    const content = fs.readFileSync(summaryPath, "utf-8");

    if (content.includes(MEMO_INBOX_MARKER)) {
      skipped.push(agent);
      continue;
    }

    const lines = content.split("\n");
    const headingIndex = lines.findIndex(
      (line) => line.trim() === INBOX_HEADING,
    );

    if (headingIndex === -1) {
      errors.push({ agent, reason: "missing-heading" });
      continue;
    }

    lines.splice(headingIndex + 1, 0, "", MEMO_INBOX_MARKER);
    fs.writeFileSync(summaryPath, lines.join("\n"));
    inserted.push(agent);
  }

  return { inserted, skipped, errors };
}
