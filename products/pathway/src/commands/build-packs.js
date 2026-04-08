/**
 * Pack generation for Pathway distribution.
 *
 * Emits one pre-built agent/skill pack per valid discipline/track combination
 * and two discovery manifests (`.well-known/agent-skills/index.json` for
 * `npx skills` and `apm.yml` for Microsoft APM). See
 * specs/320-pathway-ecosystem-distribution for context.
 *
 * Invoked from build.js after the distribution bundle has been generated.
 */

import { mkdir, rm, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { execFileSync } from "child_process";
import { createHash } from "crypto";

import { createDataLoader } from "@forwardimpact/map/loader";
import { createTemplateLoader } from "@forwardimpact/libtemplate";
import {
  generateStageAgentProfile,
  deriveReferenceLevel,
  deriveAgentSkills,
  generateSkillMarkdown,
  interpolateTeamInstructions,
  getDisciplineAbbreviation,
  toKebabCase,
} from "@forwardimpact/libskill";

import { formatAgentProfile } from "../formatters/agent/profile.js";
import {
  formatAgentSkill,
  formatInstallScript,
  formatReference,
} from "../formatters/agent/skill.js";
import { findValidCombinations } from "./agent.js";

/**
 * Slugify a string for use as a package name.
 * @param {string} text
 * @returns {string}
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Stringify a JSON value with object keys sorted recursively.
 * Produces deterministic output for digest stability.
 * @param {unknown} value
 * @returns {string}
 */
function stringifySorted(value) {
  const seen = new WeakSet();
  const sort = (v) => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v)) throw new Error("Cannot stringify circular structure");
    seen.add(v);
    if (Array.isArray(v)) return v.map(sort);
    const out = {};
    for (const key of Object.keys(v).sort()) out[key] = sort(v[key]);
    return out;
  };
  return JSON.stringify(sort(value), null, 2) + "\n";
}

/**
 * Escape a YAML scalar double-quoted value.
 * @param {string} text
 * @returns {string}
 */
function yamlQuote(text) {
  return `"${String(text).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Write a single pack's files to disk under the staging directory.
 * Calls the formatters directly (silent, no console output).
 * @param {Object} params
 * @returns {Promise<void>}
 */
async function writePackFiles({
  packDir,
  profiles,
  skillFiles,
  teamInstructions,
  agentTemplate,
  skillTemplates,
  claudeCodeSettings,
}) {
  const claudeDir = join(packDir, ".claude");
  const agentsDir = join(claudeDir, "agents");
  const skillsDir = join(claudeDir, "skills");

  await mkdir(agentsDir, { recursive: true });
  await mkdir(skillsDir, { recursive: true });

  for (const profile of profiles) {
    const profilePath = join(agentsDir, profile.filename);
    await writeFile(
      profilePath,
      formatAgentProfile(profile, agentTemplate),
      "utf-8",
    );
  }

  for (const skill of skillFiles) {
    const skillDir = join(skillsDir, skill.dirname);
    await mkdir(skillDir, { recursive: true });

    await writeFile(
      join(skillDir, "SKILL.md"),
      formatAgentSkill(skill, skillTemplates.skill),
      "utf-8",
    );

    if (skill.installScript) {
      const scriptsDir = join(skillDir, "scripts");
      await mkdir(scriptsDir, { recursive: true });
      await writeFile(
        join(scriptsDir, "install.sh"),
        formatInstallScript(skill, skillTemplates.install),
        { mode: 0o755 },
      );
    }

    if (skill.implementationReference) {
      const refsDir = join(skillDir, "references");
      await mkdir(refsDir, { recursive: true });
      await writeFile(
        join(refsDir, "REFERENCE.md"),
        formatReference(skill, skillTemplates.reference),
        "utf-8",
      );
    }
  }

  if (teamInstructions) {
    await writeFile(
      join(claudeDir, "CLAUDE.md"),
      teamInstructions.trim() + "\n",
      "utf-8",
    );
  }

  // Claude Code settings — matches the CLI path's generateClaudeCodeSettings
  // output format (no merge with existing files since the staging dir starts
  // empty).
  const settings = { ...(claudeCodeSettings || {}) };
  await writeFile(
    join(claudeDir, "settings.json"),
    JSON.stringify(settings, null, 2) + "\n",
    "utf-8",
  );
}

/**
 * Derive profiles, skills, and team instructions for a single combination.
 * @param {Object} params
 * @returns {{profiles: Array, skillFiles: Array, teamInstructions: string|null}}
 */
function derivePackContent({
  discipline,
  track,
  humanDiscipline,
  humanTrack,
  data,
  agentData,
  skillsWithAgent,
  level,
}) {
  const stageParams = {
    discipline: humanDiscipline,
    track: humanTrack,
    level,
    skills: skillsWithAgent,
    behaviours: data.behaviours,
    agentBehaviours: agentData.behaviours,
    agentDiscipline: discipline,
    agentTrack: track,
    stages: data.stages,
  };

  const profiles = data.stages.map((stage) =>
    generateStageAgentProfile({ ...stageParams, stage }),
  );

  const derivedSkills = deriveAgentSkills({
    discipline: humanDiscipline,
    track: humanTrack,
    level,
    skills: skillsWithAgent,
  });

  const skillFiles = derivedSkills
    .map((derived) => skillsWithAgent.find((s) => s.id === derived.skillId))
    .filter((skill) => skill?.agent)
    .map((skill) => generateSkillMarkdown(skill, data.stages));

  const teamInstructions = interpolateTeamInstructions(track, humanDiscipline);

  return { profiles, skillFiles, teamInstructions };
}

/**
 * Archive a staged pack directory as a deterministic tar.gz and return its
 * sha256 digest.
 * @param {string} packDir - Staging directory containing the pack files
 * @param {string} archivePath - Destination path for the tar.gz
 * @returns {Promise<string>} sha256 digest string (e.g. "sha256:abc...")
 */
async function archivePack(packDir, archivePath) {
  execFileSync("tar", [
    "-czf",
    archivePath,
    "--sort=name",
    "--mtime=1970-01-01",
    "--owner=0",
    "--group=0",
    "--numeric-owner",
    "-C",
    packDir,
    ".",
  ]);

  const bytes = await readFile(archivePath);
  return "sha256:" + createHash("sha256").update(bytes).digest("hex");
}

/**
 * Write the `npx skills` discovery manifest.
 * @param {string} outputDir
 * @param {Array<{name: string, description: string, url: string, digest: string}>} packs
 * @param {string} version
 */
async function writeSkillsManifest(outputDir, packs, version) {
  const wellKnownDir = join(outputDir, ".well-known", "agent-skills");
  await mkdir(wellKnownDir, { recursive: true });
  const manifest = {
    $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    skills: packs.map((pack) => ({
      description: pack.description,
      digest: pack.digest,
      name: pack.name,
      type: "archive",
      url: pack.url,
      version,
    })),
  };
  await writeFile(
    join(wellKnownDir, "index.json"),
    stringifySorted(manifest),
    "utf-8",
  );
}

/**
 * Write the Microsoft APM manifest at the site root.
 * @param {string} outputDir
 * @param {Array<{name: string, description: string, url: string, digest: string}>} packs
 * @param {string} version
 * @param {string} frameworkTitle
 */
async function writeApmManifest(outputDir, packs, version, frameworkTitle) {
  const lines = [
    `name: ${slugify(frameworkTitle)}`,
    `version: ${version}`,
    `description: ${yamlQuote(`${frameworkTitle} agent teams for Claude Code`)}`,
    "",
    "skills:",
  ];
  for (const pack of packs) {
    lines.push(`  - name: ${pack.name}`);
    lines.push(`    description: ${yamlQuote(pack.description)}`);
    lines.push(`    version: ${version}`);
    lines.push(`    url: ${yamlQuote(pack.url)}`);
    lines.push(`    digest: ${yamlQuote(pack.digest)}`);
  }
  lines.push("");
  await writeFile(join(outputDir, "apm.yml"), lines.join("\n"), "utf-8");
}

/**
 * Generate pre-built agent/skill packs for installation through ecosystem
 * tools like `npx skills` and Microsoft APM. One pack per valid
 * discipline/track combination.
 *
 * @param {Object} params
 * @param {string} params.outputDir - Build output directory
 * @param {string} params.dataDir - Source data directory
 * @param {string} params.siteUrl - Base URL for the published site
 * @param {Object} params.framework - Framework configuration
 * @param {string} params.version - Pathway package version
 * @param {string} params.templatesDir - Absolute path to pathway/templates
 */
export async function generatePacks({
  outputDir,
  dataDir,
  siteUrl,
  framework,
  version,
  templatesDir,
}) {
  console.log("📦 Generating agent/skill packs...");

  const normalizedSiteUrl = siteUrl.replace(/\/$/, "");
  const frameworkTitle = framework.title || "Engineering Pathway";

  const loader = createDataLoader();
  const templateLoader = createTemplateLoader(templatesDir);

  const data = await loader.loadAllData(dataDir);
  const agentData = await loader.loadAgentData(dataDir);
  const skillsWithAgent = await loader.loadSkillsWithAgentData(dataDir);

  const level = deriveReferenceLevel(data.levels);

  const agentTemplate = templateLoader.load("agent.template.md", dataDir);
  const skillTemplates = {
    skill: templateLoader.load("skill.template.md", dataDir),
    install: templateLoader.load("skill-install.template.sh", dataDir),
    reference: templateLoader.load("skill-reference.template.md", dataDir),
  };

  const stagingDir = join(outputDir, "_packs");
  const packsDir = join(outputDir, "packs");
  await mkdir(stagingDir, { recursive: true });
  await mkdir(packsDir, { recursive: true });

  const combinations = findValidCombinations(data, agentData);
  if (combinations.length === 0) {
    console.log("   (no valid discipline/track combinations — skipping)");
    await rm(stagingDir, { recursive: true, force: true });
    return;
  }

  const packs = [];

  for (const combination of combinations) {
    const { discipline, track, humanDiscipline, humanTrack } = combination;
    const abbrev = getDisciplineAbbreviation(discipline.id);
    const agentName = `${abbrev}-${toKebabCase(track.id)}`;
    const specName = humanDiscipline.specialization || humanDiscipline.name;
    const description = `${specName} (${humanTrack.name}) — agent team`;

    const { profiles, skillFiles, teamInstructions } = derivePackContent({
      ...combination,
      data,
      agentData,
      skillsWithAgent,
      level,
    });

    const packDir = join(stagingDir, agentName);
    await writePackFiles({
      packDir,
      profiles,
      skillFiles,
      teamInstructions,
      agentTemplate,
      skillTemplates,
      claudeCodeSettings: agentData.claudeCodeSettings,
    });

    const archivePath = join(packsDir, `${agentName}.tar.gz`);
    const digest = await archivePack(packDir, archivePath);

    packs.push({
      name: agentName,
      description,
      url: `${normalizedSiteUrl}/packs/${agentName}.tar.gz`,
      digest,
    });

    console.log(`   ✓ packs/${agentName}.tar.gz`);
  }

  await rm(stagingDir, { recursive: true, force: true });

  await writeSkillsManifest(outputDir, packs, version);
  console.log("   ✓ .well-known/agent-skills/index.json");

  await writeApmManifest(outputDir, packs, version, frameworkTitle);
  console.log("   ✓ apm.yml");
}
