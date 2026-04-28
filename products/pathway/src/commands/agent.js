/**
 * Agent Command
 *
 * CLI command for generating AI coding agent configurations
 * from Engineering Pathway data. Outputs follow the Claude Code
 * agent specification.
 *
 * By default, outputs to console. Use --output to write files.
 *
 * Usage:
 *   npx fit-pathway agent <discipline> --track=<track>
 *   npx fit-pathway agent <discipline> --track=<track> --output=./agents
 *   npx fit-pathway agent <discipline> --track=<track> --skills  # Plain list of skill IDs
 *   npx fit-pathway agent <discipline> --track=<track> --tools   # Plain list of tool names
 *   npx fit-pathway agent --list
 *
 * Examples:
 *   npx fit-pathway agent software_engineering --track=platform
 *   npx fit-pathway agent software_engineering --track=platform --output=./agents
 */

import { createDataLoader } from "@forwardimpact/map/loader";
import {
  generateAgentProfile,
  validateAgentProfile,
  validateAgentSkill,
  deriveReferenceLevel,
  deriveAgentSkills,
  generateSkillMarkdown,
  interpolateTeamInstructions,
} from "@forwardimpact/libskill/agent";
import { deriveToolkit } from "@forwardimpact/libskill/toolkit";
import { formatAgentProfile } from "../formatters/agent/profile.js";
import { formatTeamInstructions } from "../formatters/agent/team-instructions.js";
import {
  formatError,
  formatSuccess,
  formatSubheader,
  formatBullet,
} from "@forwardimpact/libcli";
import { toolkitToPlainList } from "../formatters/toolkit/markdown.js";
import { listAgentCombinations } from "./agent-list.js";
import {
  generateClaudeSettings,
  generateVscodeSettings,
  writeProfile,
  writeTeamInstructions,
  writeSkills,
} from "./agent-io.js";

// Re-export so downstream consumers (build-packs, tests) can import
// findValidCombinations from './commands/agent.js' as before.
export { findValidCombinations } from "./agent-list.js";

/**
 * Resolve and validate human + agent entities for a discipline/track pair
 * @param {Object} data - Full pathway data
 * @param {Object} agentData - Agent-specific data
 * @param {string} disciplineId
 * @param {string|null} trackId
 * @returns {{humanDiscipline: Object, humanTrack: Object|null, agentDiscipline: Object, agentTrack: Object|null}}
 */
function resolveAgentEntities(data, agentData, disciplineId, trackId) {
  const humanDiscipline = data.disciplines.find((d) => d.id === disciplineId);
  const humanTrack = trackId ? data.tracks.find((t) => t.id === trackId) : null;

  if (!humanDiscipline) {
    process.stderr.write(
      formatError(`Unknown discipline: ${disciplineId}`) + "\n",
    );
    process.stderr.write("\nAvailable disciplines:\n");
    for (const d of data.disciplines) {
      process.stderr.write(formatBullet(d.id, 1) + "\n");
    }
    process.exit(1);
  }
  if (trackId && !humanTrack) {
    process.stderr.write(formatError(`Unknown track: ${trackId}`) + "\n");
    process.stderr.write("\nAvailable tracks:\n");
    for (const t of data.tracks) {
      process.stderr.write(formatBullet(t.id, 1) + "\n");
    }
    process.exit(1);
  }

  const agentDiscipline = agentData.disciplines.find(
    (d) => d.id === disciplineId,
  );
  const agentTrack = trackId
    ? agentData.tracks.find((t) => t.id === trackId)
    : null;

  if (!agentDiscipline) {
    process.stderr.write(
      formatError(`No agent definition for discipline: ${disciplineId}`) + "\n",
    );
    process.stderr.write("\nAgent definitions exist for:\n");
    for (const d of agentData.disciplines) {
      process.stderr.write(formatBullet(d.id, 1) + "\n");
    }
    process.exit(1);
  }
  if (trackId && !agentTrack) {
    process.stderr.write(
      formatError(`No agent definition for track: ${trackId}`) + "\n",
    );
    process.stderr.write("\nAgent definitions exist for:\n");
    for (const t of agentData.tracks) {
      process.stderr.write(formatBullet(t.id, 1) + "\n");
    }
    process.exit(1);
  }

  return { humanDiscipline, humanTrack, agentDiscipline, agentTrack };
}

/**
 * Output team instructions to console if present
 * @param {Object|null} agentTrack
 * @param {Object} humanDiscipline
 * @param {string} template - Mustache template for CLAUDE.md
 */
function printTeamInstructions(agentTrack, humanDiscipline, template) {
  const teamInstructions = interpolateTeamInstructions({
    agentTrack,
    humanDiscipline,
  });
  if (teamInstructions) {
    // Markdown output — headings stay literal so downstream tools parse them
    process.stdout.write("# Team Instructions (CLAUDE.md)\n\n");
    process.stdout.write(
      formatTeamInstructions(teamInstructions, template) + "\n",
    );
    process.stdout.write("\n---\n\n");
  }
}

/**
 * Handle agent generation (single profile per discipline/track)
 * @param {Object} params
 */
async function handleAgent({
  options,
  data,
  agentTrack,
  humanDiscipline,
  humanTrack,
  agentData,
  agentDiscipline,
  skillsWithAgent,
  level,
  templateLoader,
  dataDir,
}) {
  const profile = generateAgentProfile({
    discipline: humanDiscipline,
    track: humanTrack,
    level,
    skills: skillsWithAgent,
    capabilities: data.capabilities,
    behaviours: data.behaviours,
    agentBehaviours: agentData.behaviours,
    agentDiscipline,
    agentTrack,
  });

  const derivedSkills = deriveAgentSkills({
    discipline: humanDiscipline,
    track: humanTrack,
    level,
    skills: skillsWithAgent,
    capabilities: data.capabilities,
  });

  const skillFiles = derivedSkills
    .map((derived) => skillsWithAgent.find((s) => s.id === derived.skillId))
    .filter((skill) => skill?.agent)
    .map((skill) => generateSkillMarkdown({ skillData: skill }));

  const errors = validateAgentProfile(profile);
  if (errors.length > 0) {
    process.stderr.write(
      formatError(`Profile ${profile.frontmatter.name} validation failed:`) +
        "\n",
    );
    for (const err of errors) {
      process.stderr.write(formatBullet(err, 1) + "\n");
    }
    process.exit(1);
  }

  for (const skill of skillFiles) {
    const skillErrors = validateAgentSkill(skill);
    if (skillErrors.length > 0) {
      process.stderr.write(
        formatError(`Skill ${skill.frontmatter.name} validation failed:`) +
          "\n",
      );
      for (const err of skillErrors) {
        process.stderr.write(formatBullet(err, 1) + "\n");
      }
      process.exit(1);
    }
  }

  const agentTemplate = templateLoader.load("agent.template.md", dataDir);
  const claudeTemplate = templateLoader.load("claude.template.md", dataDir);
  const skillTemplates = {
    skill: templateLoader.load("skill.template.md", dataDir),
    install: templateLoader.load("skill-install.template.sh", dataDir),
    reference: templateLoader.load("skill-reference.template.md", dataDir),
  };

  const baseDir = options.output || ".";

  if (!options.output) {
    printTeamInstructions(agentTrack, humanDiscipline, claudeTemplate);
    process.stdout.write(formatAgentProfile(profile, agentTemplate) + "\n");
    return;
  }

  const teamInstructions = interpolateTeamInstructions({
    agentTrack,
    humanDiscipline,
  });
  await writeTeamInstructions(teamInstructions, baseDir, claudeTemplate);
  await writeProfile(profile, baseDir, agentTemplate);
  const fileCount = await writeSkills(skillFiles, baseDir, skillTemplates);
  await generateClaudeSettings(baseDir, agentData.claudeSettings);
  await generateVscodeSettings(baseDir, agentData.vscodeSettings);

  process.stdout.write("\n");
  process.stdout.write(
    formatSuccess(`Generated agent: ${profile.frontmatter.name}`) + "\n",
  );
  process.stdout.write(formatSubheader(`Skills: ${fileCount} files`) + "\n");
}

/**
 * Run the agent command
 * @param {Object} params - Command parameters
 * @param {Object} params.data - Loaded pathway data
 * @param {string[]} params.args - Command arguments [discipline_id]
 * @param {Object} params.options - Command options
 * @param {string} params.dataDir - Path to data directory
 */
export async function runAgentCommand({
  data,
  args,
  options,
  dataDir,
  templateLoader,
  loader,
}) {
  const dataLoader = loader || createDataLoader();
  const agentData = await dataLoader.loadAgentData(dataDir);
  const skillsWithAgent = await dataLoader.loadSkillsWithAgentData(dataDir);

  if (options.list) {
    listAgentCombinations(data, agentData, false);
    return;
  }

  if (args.length === 0) {
    process.stderr.write(
      formatError("Missing required argument: <discipline>") + "\n",
    );
    process.stderr.write(
      "\nUsage: npx fit-pathway agent <discipline> --track=<track>\n",
    );
    process.exit(1);
  }

  const [disciplineId] = args;
  const trackId = options.track;

  if (args.length > 1) {
    process.stderr.write(
      formatError(
        `Unexpected argument: ${args[1]}. Did you mean --track=${args[1]}?`,
      ) + "\n",
    );
    process.exit(1);
  }

  if (!trackId) {
    process.stderr.write(
      formatError("Missing required option: --track=<track>") + "\n",
    );
    process.stderr.write(
      "\nUsage: npx fit-pathway agent <discipline> --track=<track>\n",
    );
    process.exit(1);
  }

  const { humanDiscipline, humanTrack, agentDiscipline, agentTrack } =
    resolveAgentEntities(data, agentData, disciplineId, trackId);

  const level = deriveReferenceLevel(data.levels);

  if (options.skills) {
    const derivedSkills = deriveAgentSkills({
      discipline: humanDiscipline,
      track: humanTrack,
      level,
      skills: skillsWithAgent,
      capabilities: data.capabilities,
    });
    for (const skill of derivedSkills)
      process.stdout.write(skill.skillId + "\n");
    return;
  }

  if (options.tools) {
    const derivedSkills = deriveAgentSkills({
      discipline: humanDiscipline,
      track: humanTrack,
      level,
      skills: skillsWithAgent,
      capabilities: data.capabilities,
    });
    const toolkit = deriveToolkit({
      skillMatrix: derivedSkills,
      skills: skillsWithAgent,
    });
    process.stdout.write(toolkitToPlainList(toolkit) + "\n");
    return;
  }

  await handleAgent({
    options,
    data,
    agentTrack,
    humanDiscipline,
    humanTrack,
    agentData,
    agentDiscipline,
    skillsWithAgent,
    level,
    templateLoader,
    dataDir,
  });
}
