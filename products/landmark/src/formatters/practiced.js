/**
 * Formatters for the `practiced` command.
 */

import { padRight, renderHeader } from "./shared.js";

/** Render the practiced capability comparison as plain text with derived depth, evidence count, and flags. */
export function toText(view) {
  const lines = [
    renderHeader(
      `Practiced capability — ${view.managerEmail} (${view.teamSize} members)`,
    ),
    "",
  ];

  const nameWidth = Math.max(20, ...view.skills.map((s) => s.skillName.length));

  for (const skill of view.skills) {
    const name = padRight(skill.skillName, nameWidth);
    const derived = skill.derivedDepth ?? "(none)";
    const evidenced =
      skill.evidencedCount > 0 ? `${skill.evidencedCount} evidence rows` : "0";
    const flag = skill.flag ? ` ← ${skill.flag}` : "";
    lines.push(
      `    ${name}  derived: ${padRight(derived, 15)}  evidenced: ${evidenced}${flag}`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

/** Serialize the practiced view and metadata as formatted JSON. */
export function toJson(view, meta) {
  return JSON.stringify({ ...view, meta }, null, 2);
}

/** Render the practiced capability comparison as a markdown table with derived/evidenced/flag columns. */
export function toMarkdown(view) {
  const lines = [
    `# Practiced capability — ${view.managerEmail}`,
    "",
    "| Skill | Derived | Evidenced | Flag |",
    "| --- | --- | --- | --- |",
  ];

  for (const skill of view.skills) {
    const flag = skill.flag ?? "";
    lines.push(
      `| ${skill.skillName} | ${skill.derivedDepth ?? "(none)"} | ${skill.evidencedCount} | ${flag} |`,
    );
  }

  return lines.join("\n");
}
