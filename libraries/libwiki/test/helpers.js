import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

export function git(dir, ...args) {
  return execFileSync("git", ["-C", dir, ...args], {
    encoding: "utf-8",
    stdio: "pipe",
  }).trim();
}

export function createBareRepo() {
  const dir = mkdtempSync(join(tmpdir(), "wiki-bare-"));
  execFileSync("git", ["init", "--bare", dir], { stdio: "pipe" });
  return dir;
}

export function seedBareRepo(bare) {
  const tmp = mkdtempSync(join(tmpdir(), "wiki-seed-"));
  execFileSync("git", ["clone", bare, tmp], { stdio: "pipe" });
  git(tmp, "config", "user.name", "Seed");
  git(tmp, "config", "user.email", "seed@example.com");
  git(tmp, "checkout", "-b", "master");
  writeFileSync(join(tmp, "README.md"), "# Wiki\n");
  git(tmp, "add", "-A");
  git(tmp, "commit", "-m", "init");
  git(tmp, "push", "origin", "master");
}

export function cloneRepo(bare, name) {
  const parent = mkdtempSync(join(tmpdir(), `wiki-${name}-`));
  execFileSync("git", ["clone", bare, "wiki"], {
    cwd: parent,
    stdio: "pipe",
  });
  const wikiDir = join(parent, "wiki");
  git(wikiDir, "config", "user.name", "Test User");
  git(wikiDir, "config", "user.email", "test@example.com");
  return { parent, wikiDir };
}
