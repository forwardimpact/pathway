/**
 * Agent builder preview components
 *
 * Preview panel for agent generation (single profile per discipline/track).
 */

import { div, h2, h3, p, section } from "../lib/render.js";
import {
  generateAgentProfile,
  generateSkillMarkdown,
  deriveAgentSkills,
} from "@forwardimpact/libskill/agent";
import { deriveToolkit } from "@forwardimpact/libskill/toolkit";
import { formatAgentProfile } from "../formatters/agent/profile.js";
import {
  formatAgentSkill,
  formatInstallScript,
  formatReference,
} from "../formatters/agent/skill.js";
import { createFileCard } from "../components/file-card.js";
import { createToolkitTable } from "../formatters/toolkit/dom.js";
import { createDetailSection } from "../components/detail.js";
import { createDownloadSingleButton } from "./agent-builder-download.js";

/**
 * Build a file card for a skill with 1-3 file panes (accordion).
 * @param {Object} skill
 * @param {Object} templates
 * @returns {HTMLElement}
 */
function buildSkillFileCard(skill, templates) {
  const content = formatAgentSkill(skill, templates.skill);

  const files = [
    {
      filename: `${skill.dirname}/SKILL.md`,
      content,
      language: "markdown",
    },
  ];

  if (skill.installScript) {
    files.push({
      filename: `${skill.dirname}/scripts/install.sh`,
      content: formatInstallScript(skill, templates.install),
      language: "bash",
    });
  }

  if (skill.implementationReference) {
    files.push({
      filename: `${skill.dirname}/references/REFERENCE.md`,
      content: formatReference(skill, templates.reference),
      language: "markdown",
    });
  }

  const headerChildren = [
    p({ className: "file-card-name" }, skill.frontmatter.name),
  ];
  if (files.length > 1) {
    headerChildren.push(
      p({ className: "file-card-badge" }, `${files.length} files`),
    );
  }

  return createFileCard({
    header: headerChildren,
    files,
    maxHeight: 300,
  });
}

/**
 * Create a skills section for the preview
 * @param {Array} skillFiles
 * @param {Object} templates
 * @returns {HTMLElement}
 */
function createSkillsSection(skillFiles, templates) {
  return section(
    { className: "agent-section" },
    h2({}, `Skills (${skillFiles.length})`),
    skillFiles.length > 0
      ? div(
          { className: "skill-cards-grid" },
          ...skillFiles.map((skill) => buildSkillFileCard(skill, templates)),
        )
      : p(
          { className: "text-muted" },
          "No skills with agent sections found for this discipline.",
        ),
  );
}

/**
 * Derive skill files and toolkit from context
 * @param {Object} context
 * @returns {{derivedSkills: Array, skillFiles: Array, toolkit: Array}}
 */
function deriveSkillData(context) {
  const { humanDiscipline, humanTrack, level, skills } = context;
  const derivedSkills = deriveAgentSkills({
    discipline: humanDiscipline,
    track: humanTrack,
    level,
    skills,
  });

  const skillFiles = derivedSkills
    .map((d) => skills.find((s) => s.id === d.skillId))
    .filter((skill) => skill?.agent)
    .map((skill) => generateSkillMarkdown({ skillData: skill }));

  const toolkit = deriveToolkit({
    skillMatrix: derivedSkills,
    skills,
  });

  return { derivedSkills, skillFiles, toolkit };
}

/**
 * Create preview for an agent (single profile per discipline/track)
 * @param {Object} context
 * @returns {{preview: HTMLElement, profile: Object, skillFiles: Array}}
 */
export function createAgentPreview(context) {
  const {
    humanDiscipline,
    humanTrack,
    agentDiscipline,
    agentTrack,
    level,
    skills,
    capabilities,
    behaviours,
    agentBehaviours,
    claudeCodeSettings,
    templates,
  } = context;

  const profile = generateAgentProfile({
    discipline: humanDiscipline,
    track: humanTrack,
    level,
    skills,
    capabilities,
    behaviours,
    agentBehaviours,
    agentDiscipline,
    agentTrack,
  });

  const { skillFiles, toolkit } = deriveSkillData(context);

  const preview = div(
    { className: "agent-deployment" },
    createDownloadSingleButton(
      profile,
      skillFiles,
      claudeCodeSettings,
      templates,
    ),
    section(
      { className: "agent-section" },
      h2({}, "Agent"),
      div(
        { className: "agent-cards-grid single" },
        (() => {
          const content = formatAgentProfile(profile, templates.agent);
          return createFileCard({
            header: [h3({}, profile.frontmatter.name)],
            files: [
              { filename: profile.filename, content, language: "markdown" },
            ],
            maxHeight: 400,
          });
        })(),
      ),
    ),
    createSkillsSection(skillFiles, templates),
    toolkit.length > 0
      ? createDetailSection({
          title: `Tool Kit (${toolkit.length})`,
          content: createToolkitTable(toolkit),
        })
      : null,
  );

  return { preview, profile, skillFiles };
}

/**
 * Create help section explaining how agent builder works
 * @returns {HTMLElement}
 */
export function createHelpSection() {
  return section(
    { className: "section section-detail" },
    h2({ className: "section-title" }, "How It Works"),
    div(
      { className: "auto-grid-md" },
      div(
        { className: "detail-item" },
        div({ className: "detail-item-label" }, "Agent Profiles"),
        p(
          {},
          "The .md files contain the agent's identity, skills, and constraints. " +
            "Place them in .claude/agents/ for Claude Code to discover.",
        ),
      ),
      div(
        { className: "detail-item" },
        div({ className: "detail-item-label" }, "Skills"),
        p(
          {},
          "SKILL.md files provide specialized knowledge that agents can use. " +
            "Place them in .claude/skills/{skill-name}/ directories.",
        ),
      ),
      div(
        { className: "detail-item" },
        div({ className: "detail-item-label" }, "Download"),
        p(
          {},
          "Download the complete agent deployment with the agent profile and all skills in one zip file.",
        ),
      ),
    ),
  );
}
