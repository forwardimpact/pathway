/**
 * Formatters for the `health` command.
 */

import { formatDelta, ordinalSuffix, renderHeader } from "./shared.js";

// ---------------------------------------------------------------------------
// Shared driver-section helpers (module-private)
// ---------------------------------------------------------------------------

function formatScorePart(driver) {
  return driver.score != null
    ? `${driver.score}${ordinalSuffix(driver.score)} percentile`
    : "n/a";
}

function formatSkillNames(driver) {
  return driver.contributingSkills.map((s) => s.skillId).join(", ");
}

function formatEvidenceParts(driver) {
  return driver.contributingSkills
    .map((s) => `${s.count} artifacts for ${s.skillId}`)
    .join(", ");
}

function formatCandidates(rec) {
  return rec.candidates
    .slice(0, 2)
    .map((c) => `${c.name ?? c.email} (${c.currentLevel})`)
    .join(" or ");
}

// ---------------------------------------------------------------------------
// Text: per-driver section renderers
// ---------------------------------------------------------------------------

function renderTextComments(driver, lines) {
  if (!driver.comments || driver.comments.length === 0) return;
  const snippets = driver.comments.slice(0, 2).map((c) => `"${c.text}"`);
  lines.push(
    `      GetDX comments: ${snippets.join("\n                      ")}`,
  );
}

function renderTextRecommendations(driver, lines) {
  if (!driver.recommendations || driver.recommendations.length === 0) return;
  for (const rec of driver.recommendations) {
    lines.push("");
    lines.push(
      `      ⮕ Recommendation: ${formatCandidates(rec)} could develop ${rec.skill}.`,
    );
    lines.push(`        (Summit growth alignment: ${rec.impact})`);
  }
}

function renderTextDriver(driver, lines) {
  const orgPart =
    driver.vs_org != null ? `vs_org: ${formatDelta(driver.vs_org)}` : "";
  const scorePart = formatScorePart(driver);
  lines.push(
    `    Driver: ${driver.name} (${scorePart}${orgPart ? ", " + orgPart : ""})`,
  );

  lines.push(`      Contributing skills: ${formatSkillNames(driver)}`);
  lines.push(`      Evidence: ${formatEvidenceParts(driver)}`);

  renderTextComments(driver, lines);
  renderTextRecommendations(driver, lines);

  lines.push("");
}

// ---------------------------------------------------------------------------
// Markdown: per-driver section renderers
// ---------------------------------------------------------------------------

function renderMdComments(driver, lines) {
  if (!driver.comments || driver.comments.length === 0) return;
  lines.push("");
  lines.push("**GetDX comments:**");
  for (const c of driver.comments.slice(0, 2)) {
    lines.push(`> ${c.text}`);
  }
}

function renderMdRecommendations(driver, lines) {
  if (!driver.recommendations || driver.recommendations.length === 0) return;
  lines.push("");
  for (const rec of driver.recommendations) {
    lines.push(
      `> **Recommendation:** ${formatCandidates(rec)} could develop ${rec.skill}. (${rec.impact})`,
    );
  }
}

function renderMdDriver(driver, lines) {
  lines.push(`## Driver: ${driver.name} (${formatScorePart(driver)})`);
  lines.push("");

  lines.push(`**Contributing skills:** ${formatSkillNames(driver)}`);
  lines.push(`**Evidence:** ${formatEvidenceParts(driver)}`);

  renderMdComments(driver, lines);
  renderMdRecommendations(driver, lines);

  lines.push("");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Render the health view as indented plain text with drivers, evidence, comments, and recommendations. */
export function toText(view) {
  const lines = [renderHeader(`${view.teamLabel} — health view`), ""];
  for (const driver of view.drivers) {
    renderTextDriver(driver, lines);
  }
  return lines.join("\n");
}

/** Serialize the health view and metadata as formatted JSON. */
export function toJson(view, meta) {
  return JSON.stringify({ ...view, meta }, null, 2);
}

/** Render the health view as markdown with driver sections, comments, and recommendations. */
export function toMarkdown(view) {
  const lines = [`# ${view.teamLabel} — health view`, ""];
  for (const driver of view.drivers) {
    renderMdDriver(driver, lines);
  }
  return lines.join("\n");
}
