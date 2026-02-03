/**
 * Agent Skill Formatter
 *
 * Formats agent skill data into SKILL.md file content
 * following the Agent Skills Standard specification.
 *
 * Uses Mustache templates for flexible output formatting.
 * Templates are loaded from data/ directory with fallback to templates/ directory.
 */

import Mustache from "mustache";

/**
 * Trim trailing newlines from a string value
 * @param {string|null|undefined} value - Value to trim
 * @returns {string|null} Trimmed value or null
 */
function trimValue(value) {
  if (value == null) return null;
  const trimmed = value.replace(/\n+$/, "");
  return trimmed || null;
}

/**
 * Prepare agent skill data for template rendering
 * Normalizes string values by trimming trailing newlines for consistent template output.
 * @param {Object} params
 * @param {Object} params.frontmatter - YAML frontmatter data
 * @param {string} params.frontmatter.name - Skill name (required)
 * @param {string} params.frontmatter.description - Skill description (required)
 * @param {string} [params.frontmatter.useWhen] - When to use this skill
 * @param {string} params.title - Human-readable skill title for heading
 * @param {Array} params.stages - Array of stage objects with stageName, focus, activities, ready
 * @param {string} params.reference - Reference content (markdown)
 * @returns {Object} Data object ready for Mustache template
 */
function prepareAgentSkillData({ frontmatter, title, stages, reference }) {
  // Process description into lines
  const description = trimValue(frontmatter.description) || "";
  const descriptionLines = description.split("\n");

  // Process useWhen into lines
  const useWhen = trimValue(frontmatter.useWhen) || "";
  const useWhenLines = useWhen ? useWhen.split("\n") : [];

  // Process stages - trim focus and array values
  const processedStages = stages.map((stage) => ({
    ...stage,
    stageName: stage.stageName,
    nextStageName: stage.nextStageName,
    focus: trimValue(stage.focus) || stage.focus,
    activities: (stage.activities || []).map((a) => trimValue(a) || a),
    ready: (stage.ready || []).map((r) => trimValue(r) || r),
  }));

  return {
    name: frontmatter.name,
    descriptionLines,
    useWhenLines,
    title,
    stages: processedStages,
    reference: trimValue(reference) || "",
  };
}

/**
 * Format agent skill as SKILL.md file content using Mustache template
 * @param {Object} skill - Skill with frontmatter, title, stages, reference
 * @param {Object} skill.frontmatter - YAML frontmatter data
 * @param {string} skill.frontmatter.name - Skill name (required)
 * @param {string} skill.frontmatter.description - Skill description (required)
 * @param {string} skill.title - Human-readable skill title for heading
 * @param {Array} skill.stages - Array of stage objects with stageName, focus, activities, ready
 * @param {string} skill.reference - Reference content (markdown)
 * @param {string} template - Mustache template string
 * @returns {string} Complete SKILL.md file content
 */
export function formatAgentSkill(
  { frontmatter, title, stages, reference },
  template,
) {
  const data = prepareAgentSkillData({ frontmatter, title, stages, reference });
  return Mustache.render(template, data);
}
