/**
 * Tests for APM bundle generation.
 * Covers spec 520 — APM-Compatible Pack Distribution.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

import { createDataLoader } from "@forwardimpact/map/loader";
import {
  getDisciplineAbbreviation,
  toKebabCase,
} from "@forwardimpact/libskill/agent";
import { generatePacks } from "../src/commands/build-packs.js";
import { findValidCombinations } from "../src/commands/agent.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const starterDir = join(__dirname, "..", "..", "map", "starter");
const pathwayPkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf8"),
);

async function silent(fn) {
  const original = console.log;
  console.log = () => {};
  try {
    return await fn();
  } finally {
    console.log = original;
  }
}

describe("APM bundles", () => {
  let workDir;
  let outputDir;
  let validCombinations;

  before(async () => {
    workDir = mkdtempSync(join(tmpdir(), "fit-pathway-apm-test-"));
    outputDir = join(workDir, "public");
    await mkdir(outputDir, { recursive: true });

    const loader = createDataLoader();
    const data = await loader.loadAllData(starterDir);
    const agentData = await loader.loadAgentData(starterDir);
    validCombinations = findValidCombinations(data, agentData);

    await silent(() =>
      generatePacks({
        outputDir,
        dataDir: starterDir,
        siteUrl: "https://example.test",
        framework: { title: "Engineering Pathway" },
        version: pathwayPkg.version,
        templatesDir: join(__dirname, "..", "templates"),
      }),
    );
  });

  after(() => {
    if (workDir) rmSync(workDir, { recursive: true, force: true });
  });

  test("each APM bundle expands to the APM package layout", async () => {
    const packsDir = join(outputDir, "packs");
    const entries = await readdir(packsDir);
    const archive = entries.find((n) => n.endsWith(".apm.tar.gz"));
    assert.ok(archive, "expected at least one APM archive");

    const extractDir = mkdtempSync(join(tmpdir(), "fit-pathway-apm-extract-"));
    try {
      execFileSync("tar", ["-xzf", join(packsDir, archive), "-C", extractDir]);
      assert.ok(existsSync(join(extractDir, ".apm", "skills")));
      assert.ok(existsSync(join(extractDir, ".apm", "agents")));
      assert.ok(existsSync(join(extractDir, "apm.yml")));

      // Agents use .agent.md extension
      const agents = await readdir(join(extractDir, ".apm", "agents"));
      for (const agent of agents) {
        assert.ok(
          agent.endsWith(".agent.md"),
          `agent ${agent} should have .agent.md extension`,
        );
      }

      // Per-bundle apm.yml has name and version
      const apmYml = await readFile(join(extractDir, "apm.yml"), "utf8");
      assert.match(apmYml, /^name: /m);
      assert.match(apmYml, /^version: /m);

      // CLAUDE.md and settings.json must NOT be present in APM bundle
      assert.strictEqual(
        existsSync(join(extractDir, ".claude")),
        false,
        "APM bundle must not contain .claude/ directory",
      );
    } finally {
      rmSync(extractDir, { recursive: true, force: true });
    }
  });

  test("APM bundle content matches raw bundle content", async () => {
    const packsDir = join(outputDir, "packs");
    const { discipline, track } = validCombinations[0];
    const abbrev = getDisciplineAbbreviation(discipline.id);
    const packName = `${abbrev}-${toKebabCase(track.id)}`;

    const rawDir = mkdtempSync(join(tmpdir(), "fit-pathway-raw-"));
    const apmDir = mkdtempSync(join(tmpdir(), "fit-pathway-apm-"));
    try {
      execFileSync("tar", [
        "-xzf",
        join(packsDir, `${packName}.raw.tar.gz`),
        "-C",
        rawDir,
      ]);
      execFileSync("tar", [
        "-xzf",
        join(packsDir, `${packName}.apm.tar.gz`),
        "-C",
        apmDir,
      ]);

      // Each skill's SKILL.md content must be identical
      const rawSkills = await readdir(join(rawDir, ".claude", "skills"));
      const apmSkills = await readdir(join(apmDir, ".apm", "skills"));
      assert.deepStrictEqual(rawSkills.sort(), apmSkills.sort());

      for (const skill of rawSkills) {
        const rawContent = await readFile(
          join(rawDir, ".claude", "skills", skill, "SKILL.md"),
          "utf8",
        );
        const apmContent = await readFile(
          join(apmDir, ".apm", "skills", skill, "SKILL.md"),
          "utf8",
        );
        assert.strictEqual(
          rawContent,
          apmContent,
          `SKILL.md differs for ${skill}`,
        );
      }

      // Agent profile content must be identical (accounting for .agent.md rename)
      const rawAgents = await readdir(join(rawDir, ".claude", "agents"));
      const apmAgents = await readdir(join(apmDir, ".apm", "agents"));
      assert.strictEqual(rawAgents.length, apmAgents.length);

      for (const rawFile of rawAgents) {
        const apmFile = rawFile.replace(/\.md$/, ".agent.md");
        const rawContent = await readFile(
          join(rawDir, ".claude", "agents", rawFile),
          "utf8",
        );
        const apmContent = await readFile(
          join(apmDir, ".apm", "agents", apmFile),
          "utf8",
        );
        assert.strictEqual(
          rawContent,
          apmContent,
          `agent ${rawFile} content differs`,
        );
      }
    } finally {
      rmSync(rawDir, { recursive: true, force: true });
      rmSync(apmDir, { recursive: true, force: true });
    }
  });
});
