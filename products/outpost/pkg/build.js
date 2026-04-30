#!/usr/bin/env bun

// Build script for Outpost (arm64 macOS).
//
// Usage:
//   bun pkg/build.js                    Prepare templates + scheduler + launcher
//   bun pkg/build.js --app              Above + assemble Outpost.app
//   bun pkg/build.js --pkg              Above + .pkg installer
//   bun pkg/build.js --prepare-template Copy fit-* skills into templates only
//   bun pkg/build.js --scheduler        Compile scheduler binary only
//   bun pkg/build.js --launcher         Compile Swift launcher only

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";

const __dirname =
  import.meta.dirname || dirname(new URL(import.meta.url).pathname);
const PROJECT_DIR = join(__dirname, "..");
const DIST_DIR = join(PROJECT_DIR, "dist");
const APP_NAME = "fit-outpost";
const LAUNCHER_NAME = "Outpost";
const LAUNCHER_DIR = join(PROJECT_DIR, "macos", "Outpost");
const VERSION = JSON.parse(
  readFileSync(join(PROJECT_DIR, "package.json"), "utf8"),
).version;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  return execSync(cmd, { encoding: "utf8", stdio: "inherit", ...opts });
}

// ---------------------------------------------------------------------------
// Copy fit-* skills from monorepo into templates
// ---------------------------------------------------------------------------

const MONOREPO_SKILLS_DIR = join(PROJECT_DIR, "..", "..", ".claude", "skills");
const TEMPLATE_SKILLS_DIR = join(PROJECT_DIR, "templates", ".claude", "skills");

function prepareTemplate() {
  console.log("\nCopying fit-* skills into templates...");

  if (!existsSync(MONOREPO_SKILLS_DIR)) {
    console.error(`  Monorepo skills not found at ${MONOREPO_SKILLS_DIR}`);
    process.exit(1);
  }

  const fitSkills = readdirSync(MONOREPO_SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("fit-"))
    .map((d) => d.name);

  for (const skill of fitSkills) {
    const src = join(MONOREPO_SKILLS_DIR, skill);
    const dest = join(TEMPLATE_SKILLS_DIR, skill);
    rmSync(dest, { recursive: true, force: true });
    cpSync(src, dest, { recursive: true });
    console.log(`  Copied ${skill}`);
  }

  console.log(`  -> ${fitSkills.length} skills copied`);
}

// ---------------------------------------------------------------------------
// Compile scheduler binary
// ---------------------------------------------------------------------------

function compileScheduler() {
  const outputPath = join(DIST_DIR, APP_NAME);

  console.log(`\nCompiling ${APP_NAME}...`);
  ensureDir(DIST_DIR);

  const cmd = [
    "bun build",
    "--compile",
    `--outfile "${outputPath}"`,
    `--define 'process.env.OUTPOST_VERSION'='"${VERSION}"'`,
    "src/outpost.js",
  ].join(" ");

  run(cmd, { cwd: PROJECT_DIR });

  console.log(`  -> ${outputPath}`);
  return outputPath;
}

// ---------------------------------------------------------------------------
// Compile Swift app launcher (includes status menu UI)
// ---------------------------------------------------------------------------

function compileLauncher() {
  console.log(`\nCompiling ${LAUNCHER_NAME}...`);
  ensureDir(DIST_DIR);

  const buildDir = join(LAUNCHER_DIR, ".build");
  rmSync(buildDir, { recursive: true, force: true });

  run("swift build -c release", { cwd: LAUNCHER_DIR });

  const binary = join(buildDir, "release", LAUNCHER_NAME);
  const outputPath = join(DIST_DIR, LAUNCHER_NAME);
  run(`cp "${binary}" "${outputPath}"`);

  rmSync(buildDir, { recursive: true, force: true });

  console.log(`  -> ${outputPath}`);
  return outputPath;
}

// ---------------------------------------------------------------------------
// Assemble Outpost.app bundle
// ---------------------------------------------------------------------------

function buildApp() {
  console.log("\nAssembling Outpost.app...");

  const LIBMACOS = join(PROJECT_DIR, "..", "..", "libraries", "libmacos");
  const script = join(LIBMACOS, "scripts", "build-app.sh");
  const iconDir = join(PROJECT_DIR, "..", "..", "design", "icons");
  run(
    [
      `bash "${script}"`,
      `--bundle-name "Outpost"`,
      `--primary-exec "${join(DIST_DIR, LAUNCHER_NAME)}"`,
      `--extra-exec "${join(DIST_DIR, APP_NAME)}"`,
      `--info-plist "${join(PROJECT_DIR, "macos", "Info.plist")}"`,
      `--entitlements "${join(PROJECT_DIR, "macos", "Outpost.entitlements")}"`,
      `--resource "${join(PROJECT_DIR, "config")}"`,
      `--resource "${join(PROJECT_DIR, "templates")}"`,
      `--resource "${join(iconDir, "outpost-flat.svg")}"`,
      `--resource "${join(iconDir, "outpost.svg")}"`,
      `--version "${VERSION}"`,
      `--out-dir "${DIST_DIR}"`,
    ].join(" "),
    { cwd: PROJECT_DIR },
  );
}

// ---------------------------------------------------------------------------
// Build macOS installer package (.pkg)
// ---------------------------------------------------------------------------

function buildPKG() {
  const pkgName = `${APP_NAME}-${VERSION}.pkg`;

  console.log(`\nBuilding pkg: ${pkgName}...`);

  const buildPkg = join(__dirname, "macos", "build-pkg.sh");
  run(`bash "${buildPkg}" "${DIST_DIR}" "${VERSION}"`, { cwd: PROJECT_DIR });

  console.log(`  -> ${join(DIST_DIR, pkgName)}`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

// No flags → full default build (templates + scheduler + launcher).
// Explicit flags → run only those steps; --app/--pkg imply the earlier steps.
const all = args.length === 0;
const want = {
  prepareTemplate: all || args.includes("--prepare-template"),
  scheduler: all || args.includes("--scheduler"),
  launcher: all || args.includes("--launcher"),
  app: args.includes("--app") || args.includes("--pkg"),
  pkg: args.includes("--pkg"),
};
if (want.app || want.pkg) {
  want.prepareTemplate = true;
  want.scheduler = true;
  want.launcher = true;
}

console.log(`Outpost Build (v${VERSION})`);
console.log("==========================");

if (want.prepareTemplate) prepareTemplate();
// Scheduler first (before launcher exists in dist/) so the launcher binary
// is not embedded in the compiled binary.
if (want.scheduler) compileScheduler();
if (want.launcher) compileLauncher();
if (want.app) buildApp();
if (want.pkg) buildPKG();

console.log("\nBuild complete! Output in dist/");
