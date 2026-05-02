/**
 * Minimal markdown formatter for the `risks` command.
 */

import { Audience } from "../../lib/audience.js";

/**
 * @param {object} params
 * @param {import("../../aggregation/coverage.js").TeamCoverage} params.coverage
 * @param {import("../../aggregation/risks.js").TeamRisks} params.risks
 * @param {string} [params.audience]
 * @returns {string}
 */
export function risksToMarkdown({ coverage, risks, audience }) {
  const lines = [];
  lines.push(`# ${coverage.teamId} structural risks`);
  lines.push("");

  const director = audience === Audience.DIRECTOR;
  formatSpofSection(lines, risks.singlePointsOfFailure, director);
  formatCriticalGapsSection(lines, risks.criticalGaps);
  formatConcentrationSection(lines, risks.concentrationRisks);

  return lines.join("\n") + "\n";
}

function formatSpofSection(lines, singlePointsOfFailure, director) {
  lines.push("## Single points of failure");
  if (singlePointsOfFailure.length === 0) {
    lines.push("- (none detected)");
  } else {
    for (const spof of singlePointsOfFailure) {
      const holder = director
        ? "one engineer"
        : (spof.holder.name ?? spof.holder.email ?? "one engineer");
      lines.push(`- **${spof.skillId}** — ${holder} (${spof.severity})`);
    }
  }
  lines.push("");
}

function formatCriticalGapsSection(lines, criticalGaps) {
  lines.push("## Critical gaps");
  if (criticalGaps.length === 0) {
    lines.push("- (none detected)");
  } else {
    for (const gap of criticalGaps) {
      lines.push(`- **${gap.skillId}** — ${gap.reason}`);
    }
  }
  lines.push("");
}

function formatConcentrationSection(lines, concentrationRisks) {
  lines.push("## Concentration risks");
  if (concentrationRisks.length === 0) {
    lines.push("- (none detected)");
  } else {
    for (const risk of concentrationRisks) {
      lines.push(
        `- **${risk.capabilityId}** — ${risk.count}/${risk.totalMembers} engineers at ${risk.level} ${risk.proficiency}`,
      );
    }
  }
}
