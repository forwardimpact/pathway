/**
 * Tests for agent/skill pack generation in build.js.
 * Covers spec 320 — Pathway Ecosystem Distribution.
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
import { createTemplateLoader } from "@forwardimpact/libtemplate";
import {
  getDisciplineAbbreviation,
  toKebabCase,
} from "@forwardimpact/libskill/agent";
import { generatePacks } from "../src/commands/build-packs.js";
import {
  findValidCombinations,
  runAgentCommand,
} from "../src/commands/agent.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const starterDir = join(__dirname, "..", "starter");
const pathwayPkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf8"),
);

const siteUrl = "https://example.test";
const framework = { title: "Engineering Pathway" };

/**
 * Silence console.log for the duration of a callback. generatePacks logs
 * progress lines; tests don't need to see them.
 */
async function silent(fn) {
  const original = console.log;
  console.log = () => {};
  try {
    return await fn();
  } finally {
    console.log = original;
  }
}

describe("generatePacks", () => {
  let workDir;
  let outputDir;
  let validCombinations;

  before(async () => {
    workDir = mkdtempSync(join(tmpdir(), "fit-pathway-packs-test-"));
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
        siteUrl,
        framework,
        version: pathwayPkg.version,
        templatesDir: join(__dirname, "..", "templates"),
      }),
    );
  });

  after(() => {
    if (workDir) rmSync(workDir, { recursive: true, force: true });
  });

  test("starter data has at least one valid combination", () => {
    assert.ok(
      validCombinations.length > 0,
      "expected starter data to produce valid combinations",
    );
  });

  test("emits one archive per valid combination under packs/", async () => {
    const packsDir = join(outputDir, "packs");
    const entries = await readdir(packsDir);
    const archives = entries.filter((n) => n.endsWith(".tar.gz"));
    assert.strictEqual(archives.length, validCombinations.length);
  });

  test("staging directory _packs/ is cleaned up", () => {
    assert.strictEqual(existsSync(join(outputDir, "_packs")), false);
  });

  test("each archive expands to the Claude Code file layout", async () => {
    const packsDir = join(outputDir, "packs");
    const entries = await readdir(packsDir);
    const archive = entries.find((n) => n.endsWith(".tar.gz"));
    assert.ok(archive, "expected at least one archive");

    const extractDir = mkdtempSync(join(tmpdir(), "fit-pathway-extract-"));
    try {
      execFileSync("tar", ["-xzf", join(packsDir, archive), "-C", extractDir]);
      assert.ok(existsSync(join(extractDir, ".claude", "agents")));
      assert.ok(existsSync(join(extractDir, ".claude", "skills")));
      assert.ok(existsSync(join(extractDir, ".claude", "settings.json")));
    } finally {
      rmSync(extractDir, { recursive: true, force: true });
    }
  });

  test(".well-known/agent-skills/index.json is valid and matches archives", async () => {
    const manifestPath = join(
      outputDir,
      ".well-known",
      "agent-skills",
      "index.json",
    );
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

    assert.strictEqual(
      manifest.$schema,
      "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    );
    assert.ok(Array.isArray(manifest.skills));
    assert.strictEqual(manifest.skills.length, validCombinations.length);

    for (const entry of manifest.skills) {
      assert.strictEqual(typeof entry.name, "string");
      assert.strictEqual(entry.type, "archive");
      assert.strictEqual(typeof entry.description, "string");
      assert.ok(entry.url.startsWith(siteUrl + "/packs/"));
      assert.ok(entry.url.endsWith(".tar.gz"));
      assert.match(entry.digest, /^sha256:[0-9a-f]{64}$/);
      assert.strictEqual(entry.version, pathwayPkg.version);

      const archiveName = entry.url.split("/").pop();
      const archivePath = join(outputDir, "packs", archiveName);
      assert.ok(existsSync(archivePath), `archive missing for ${entry.name}`);

      // Digest in manifest must match actual sha256 of the archive
      const { createHash } = await import("node:crypto");
      const bytes = await readFile(archivePath);
      const actualDigest =
        "sha256:" + createHash("sha256").update(bytes).digest("hex");
      assert.strictEqual(entry.digest, actualDigest);
    }
  });

  test("apm.yml is well-formed and lists every pack", async () => {
    const apm = await readFile(join(outputDir, "apm.yml"), "utf8");
    assert.match(apm, /^name: /m);
    assert.match(apm, /^skills:$/m);
    assert.ok(
      apm.includes(`\nversion: ${pathwayPkg.version}\n`),
      "apm.yml must include pathway version",
    );

    const nameCount = (apm.match(/^ {2}- name: /gm) || []).length;
    assert.strictEqual(nameCount, validCombinations.length);

    const urlCount = (apm.match(/^ {4}url: "https:\/\/example\.test/gm) || [])
      .length;
    assert.strictEqual(urlCount, validCombinations.length);

    const digestCount = (apm.match(/^ {4}digest: "sha256:/gm) || []).length;
    assert.strictEqual(digestCount, validCombinations.length);
  });

  test("pack contents match CLI agent output for the same combination", async () => {
    // Generate agent files via the CLI path into a tmp dir
    const loader = createDataLoader();
    const templateLoader = createTemplateLoader(
      join(__dirname, "..", "templates"),
    );
    const data = await loader.loadAllData(starterDir);

    const { discipline, track } = validCombinations[0];
    const agentName = `${getDisciplineAbbreviation(discipline.id)}-${toKebabCase(track.id)}`;

    const cliOutputDir = mkdtempSync(join(tmpdir(), "fit-pathway-cli-"));
    try {
      await silent(() =>
        runAgentCommand({
          data,
          args: [discipline.id],
          options: { track: track.id, output: cliOutputDir },
          dataDir: starterDir,
          templateLoader,
          loader,
        }),
      );

      // Extract the matching pack archive
      const extractDir = mkdtempSync(join(tmpdir(), "fit-pathway-pack-"));
      try {
        execFileSync("tar", [
          "-xzf",
          join(outputDir, "packs", `${agentName}.tar.gz`),
          "-C",
          extractDir,
        ]);

        // Walk agents/ and skills/ in the CLI output, compare against pack
        const walk = async (root, rel = "") => {
          const out = new Map();
          const full = join(root, rel);
          const entries = await readdir(full, { withFileTypes: true });
          for (const entry of entries) {
            const relPath = rel ? join(rel, entry.name) : entry.name;
            if (entry.isDirectory()) {
              for (const [k, v] of await walk(root, relPath)) out.set(k, v);
            } else {
              out.set(relPath, await readFile(join(root, relPath)));
            }
          }
          return out;
        };

        const cliFiles = await walk(join(cliOutputDir, ".claude"));
        const packFiles = await walk(join(extractDir, ".claude"));

        // Every CLI-generated file must also exist in the pack with
        // byte-identical contents. settings.json is excluded from the
        // byte-identical check because the CLI path merges with any
        // pre-existing file; both paths start from {} here so they match.
        for (const [relPath, cliBytes] of cliFiles) {
          assert.ok(
            packFiles.has(relPath),
            `pack is missing ${relPath} produced by CLI`,
          );
          const packBytes = packFiles.get(relPath);
          assert.ok(
            packBytes.equals(cliBytes),
            `pack file ${relPath} differs from CLI output`,
          );
        }
      } finally {
        rmSync(extractDir, { recursive: true, force: true });
      }
    } finally {
      rmSync(cliOutputDir, { recursive: true, force: true });
    }
  });

  test("second build produces byte-identical archives and manifests", async () => {
    const secondDir = join(workDir, "public2");
    await mkdir(secondDir, { recursive: true });
    await silent(() =>
      generatePacks({
        outputDir: secondDir,
        dataDir: starterDir,
        siteUrl,
        framework,
        version: pathwayPkg.version,
        templatesDir: join(__dirname, "..", "templates"),
      }),
    );

    const firstArchives = (await readdir(join(outputDir, "packs"))).sort();
    const secondArchives = (await readdir(join(secondDir, "packs"))).sort();
    assert.deepStrictEqual(firstArchives, secondArchives);

    for (const name of firstArchives) {
      const a = await readFile(join(outputDir, "packs", name));
      const b = await readFile(join(secondDir, "packs", name));
      assert.ok(a.equals(b), `archive ${name} differs between builds`);
    }

    const firstManifest = await readFile(
      join(outputDir, ".well-known", "agent-skills", "index.json"),
      "utf8",
    );
    const secondManifest = await readFile(
      join(secondDir, ".well-known", "agent-skills", "index.json"),
      "utf8",
    );
    assert.strictEqual(firstManifest, secondManifest);

    const firstApm = await readFile(join(outputDir, "apm.yml"), "utf8");
    const secondApm = await readFile(join(secondDir, "apm.yml"), "utf8");
    assert.strictEqual(firstApm, secondApm);
  });
});
