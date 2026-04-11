/**
 * Minimal markdown formatter for the `coverage` command.
 */

/**
 * @param {import("../../aggregation/coverage.js").TeamCoverage} coverage
 * @returns {string}
 */
export function coverageToMarkdown(coverage) {
  const lines = [];
  lines.push(`# ${coverage.teamId} coverage`);
  lines.push("");
  lines.push(`- Members: ${coverage.memberCount}`);
  if (coverage.teamType === "project") {
    lines.push(`- Effective FTE: ${coverage.effectiveFte.toFixed(1)}`);
  }
  lines.push("");
  lines.push("| Skill | Depth | Max proficiency |");
  lines.push("| --- | --- | --- |");
  for (const skill of coverage.skills.values()) {
    const depth =
      coverage.teamType === "project"
        ? skill.effectiveDepth.toFixed(1)
        : String(skill.headcountDepth);
    lines.push(
      `| ${skill.skillName} | ${depth} | ${skill.maxProficiency ?? "—"} |`,
    );
  }
  return lines.join("\n") + "\n";
}
