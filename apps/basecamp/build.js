#!/usr/bin/env -S deno run --allow-all

// Build script for Basecamp.
//
// Usage:
//   deno run --allow-all build.js             Build standalone executable (current arch)
//   deno run --allow-all build.js --pkg       Build executable + macOS .pkg installer
//   deno run --allow-all build.js --all       Build for both arm64 and x86_64 + .pkg
//
// Or via deno tasks:
//   deno task build
//   deno task build:pkg

import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";

const __dirname =
  import.meta.dirname || dirname(new URL(import.meta.url).pathname);
const DIST_DIR = join(__dirname, "dist");
const APP_NAME = "fit-basecamp";
const VERSION = "1.0.0";

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

function runCapture(cmd) {
  return execSync(cmd, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

// ---------------------------------------------------------------------------
// Compile standalone binary
// ---------------------------------------------------------------------------

function compile(target = null) {
  const arch = target || detectArch();
  const outputName = target ? `${APP_NAME}-${arch}` : APP_NAME;
  const outputPath = join(DIST_DIR, outputName);

  console.log(`\nCompiling ${APP_NAME} for ${arch}...`);
  ensureDir(DIST_DIR);

  const cmd = [
    "deno compile",
    "--allow-all",
    `--target ${arch}`,
    `--output "${outputPath}"`,
    "--include template/",
    "scheduler.js",
  ].join(" ");

  run(cmd, { cwd: __dirname });

  console.log(`  -> ${outputPath}`);
  return outputPath;
}

function detectArch() {
  const arch = runCapture("uname -m");
  if (arch === "arm64") return "aarch64-apple-darwin";
  return "x86_64-apple-darwin";
}

// ---------------------------------------------------------------------------
// Build macOS installer package (.pkg)
// ---------------------------------------------------------------------------

function buildPKG(binaryPath, arch) {
  const archShort = arch.includes("aarch64") ? "arm64" : "x86_64";
  const pkgName = `${APP_NAME}-${VERSION}-${archShort}.pkg`;

  console.log(`\nBuilding pkg: ${pkgName}...`);

  const buildPkg = join(__dirname, "scripts", "build-pkg.sh");
  run(`"${buildPkg}" "${DIST_DIR}" "${APP_NAME}" "${VERSION}" "${arch}"`, {
    cwd: __dirname,
  });

  console.log(`  -> ${join(DIST_DIR, pkgName)}`);
  return join(DIST_DIR, pkgName);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = Deno?.args || process.argv.slice(2);
const wantPKG = args.includes("--pkg");
const wantAll = args.includes("--all");

console.log(`Basecamp Build (v${VERSION})`);
console.log("==========================");

if (wantAll) {
  // Build for both architectures
  const targets = ["aarch64-apple-darwin", "x86_64-apple-darwin"];
  for (const target of targets) {
    const binary = compile(target);
    buildPKG(binary, target);
  }
} else {
  // Build for current architecture
  const arch = detectArch();
  const binary = compile(arch);

  if (wantPKG) {
    buildPKG(binary, arch);
  }
}

console.log("\nBuild complete! Output in dist/");
