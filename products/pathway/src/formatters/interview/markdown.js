/**
 * Interview formatting for markdown/CLI output
 */

import { formatLevel } from "../../lib/render.js";
import { getConceptEmoji } from "@forwardimpact/map/levels";

/**
 * Format interview detail as markdown
 * @param {Object} view - Interview detail view from presenter
 * @param {Object} options - Options (e.g., type, framework)
 * @param {Object} [options.framework] - Framework data for emoji lookup
 * @returns {string}
 */
export function interviewToMarkdown(view, { framework } = {}) {
  const skillEmoji = getConceptEmoji(framework, "skill");
  const behaviourEmoji = getConceptEmoji(framework, "behaviour");
  const lines = [
    `# ${view.typeInfo.icon} Interview: ${view.title}`,
    "",
    `**Type**: ${view.typeInfo.name} (${view.typeInfo.description})`,
    `**Expected duration**: ${view.expectedDurationMinutes} minutes`,
    `**Total questions**: ${view.totalQuestions}`,
    "",
  ];

  // Group sections by type
  const skillSections = view.sections.filter((s) => s.type === "skill");
  const behaviourSections = view.sections.filter((s) => s.type === "behaviour");
  const capabilitySections = view.sections.filter(
    (s) => s.type === "capability",
  );

  // Skill questions
  if (skillSections.length > 0) {
    lines.push(`## ${skillEmoji} Skill Questions`, "");
    for (const section of skillSections) {
      lines.push(`### ${section.name} (${formatLevel(section.level)})`, "");
      for (const q of section.questions) {
        lines.push(`**Q**: ${q.question}`);
        if (q.followUps.length > 0) {
          lines.push("", "**Follow-ups:**");
          for (const followUp of q.followUps) {
            lines.push(`  → ${followUp}`);
          }
        }
        if (q.lookingFor && q.lookingFor.length > 0) {
          lines.push("", "**What to look for:**");
          for (const item of q.lookingFor) {
            lines.push(`- ${item}`);
          }
        }
        lines.push("");
      }
    }
  }

  // Capability decomposition questions
  if (capabilitySections.length > 0) {
    lines.push(`## 🧩 Decomposition Questions`, "");
    for (const section of capabilitySections) {
      lines.push(`### ${section.name} (${formatLevel(section.level)})`, "");
      for (const q of section.questions) {
        lines.push(`**Scenario**: ${q.question}`);
        if (q.context) {
          lines.push(`> ${q.context}`);
        }
        if (q.decompositionPrompts && q.decompositionPrompts.length > 0) {
          lines.push("", "**Guide the candidate through:**");
          for (const prompt of q.decompositionPrompts) {
            lines.push(`- ${prompt}`);
          }
        }
        if (q.followUps.length > 0) {
          lines.push("", "**Follow-ups:**");
          for (const followUp of q.followUps) {
            lines.push(`  → ${followUp}`);
          }
        }
        if (q.lookingFor && q.lookingFor.length > 0) {
          lines.push("", "**What to look for:**");
          for (const item of q.lookingFor) {
            lines.push(`- ${item}`);
          }
        }
        lines.push("");
      }
    }
  }

  // Behaviour stakeholder simulation questions
  if (behaviourSections.length > 0) {
    lines.push(`## ${behaviourEmoji} Stakeholder Simulation`, "");
    for (const section of behaviourSections) {
      lines.push(`### ${section.name} (${formatLevel(section.level)})`, "");
      for (const q of section.questions) {
        lines.push(`**Scenario**: ${q.question}`);
        if (q.context) {
          lines.push(`> ${q.context}`);
        }
        if (q.simulationPrompts && q.simulationPrompts.length > 0) {
          lines.push("", "**Steer the simulation:**");
          for (const prompt of q.simulationPrompts) {
            lines.push(`- ${prompt}`);
          }
        }
        if (q.followUps.length > 0) {
          lines.push("", "**Follow-ups:**");
          for (const followUp of q.followUps) {
            lines.push(`  → ${followUp}`);
          }
        }
        if (q.lookingFor && q.lookingFor.length > 0) {
          lines.push("", "**What to look for:**");
          for (const item of q.lookingFor) {
            lines.push(`- ${item}`);
          }
        }
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}
