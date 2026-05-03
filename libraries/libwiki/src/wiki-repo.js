import { spawnSync } from "node:child_process";

const CREDENTIAL_HELPER_BODY =
  '!f() { echo username=x-access-token; echo "password=${GH_TOKEN:-$GITHUB_TOKEN}"; }; f';

export class WikiPullConflict extends Error {
  constructor(stderr) {
    super("rebase conflict on pull");
    this.name = "WikiPullConflict";
    this.stderr = stderr;
  }
}

export function buildAuthArgs(args, token) {
  if (token) {
    return [
      "-c",
      "credential.helper=",
      "-c",
      `credential.helper=${CREDENTIAL_HELPER_BODY}`,
      ...args,
    ];
  }
  return [...args];
}

export class WikiRepo {
  #wikiDir;
  #parentDir;

  constructor({ wikiDir, parentDir }) {
    this.#wikiDir = wikiDir;
    this.#parentDir = parentDir;
  }

  isCloned() {
    const r = spawnSync(
      "git",
      ["-C", this.#wikiDir, "rev-parse", "--git-dir"],
      {
        stdio: "pipe",
      },
    );
    return r.status === 0;
  }

  ensureCloned(url) {
    if (this.isCloned()) return { cloned: true, reason: "already-cloned" };
    const r = this.#authGit(["clone", url, this.#wikiDir]);
    if (r.status !== 0) {
      return {
        cloned: false,
        reason: r.stderr?.toString().trim() || "clone failed",
      };
    }
    return { cloned: true, reason: "cloned" };
  }

  inheritIdentity() {
    const name = this.#parentConfig("user.name");
    const email = this.#parentConfig("user.email");
    if (name) this.#git(["config", "user.name", name]);
    if (email) this.#git(["config", "user.email", email]);
  }

  fetch() {
    this.#authGit(["-C", this.#wikiDir, "fetch", "origin", "master"]);
  }

  isClean() {
    const r = this.#git(["status", "--porcelain"]);
    return r.stdout.toString().trim() === "";
  }

  pull() {
    this.fetch();
    const r = this.#git(["rebase", "origin/master"]);
    if (r.status !== 0) {
      this.#git(["rebase", "--abort"]);
      throw new WikiPullConflict(r.stderr?.toString().trim() || "");
    }
  }

  commitAndPush(message) {
    if (this.isClean()) return { pushed: false, reason: "clean" };
    this.#git(["add", "-A"]);
    this.#git(["commit", "-m", message]);
    this.fetch();
    const rebase = this.#git(["rebase", "origin/master"]);
    if (rebase.status !== 0) {
      this.#git(["rebase", "--abort"]);
      this.#git(["merge", "origin/master", "-X", "ours", "--no-edit"]);
    }
    this.#authGit(["-C", this.#wikiDir, "push", "origin", "master"]);
    return { pushed: true, reason: "pushed" };
  }

  #parentConfig(key) {
    const r = spawnSync(
      "git",
      ["-C", this.#parentDir, "config", "--get", key],
      {
        stdio: "pipe",
      },
    );
    return r.status === 0 ? r.stdout.toString().trim() : null;
  }

  #git(args) {
    return spawnSync("git", ["-C", this.#wikiDir, ...args], { stdio: "pipe" });
  }

  #authGit(args) {
    const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    const fullArgs = buildAuthArgs(args, token);
    return spawnSync("git", fullArgs, {
      stdio: "pipe",
      env: token ? process.env : undefined,
    });
  }
}
