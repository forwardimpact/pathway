import { spawnSync } from "node:child_process";

const CREDENTIAL_HELPER_BODY =
  '!f() { echo username=x-access-token; echo "password=${GH_TOKEN:-$GITHUB_TOKEN}"; }; f';

/** Error thrown when a wiki pull encounters a rebase conflict that cannot be resolved automatically. */
export class WikiPullConflict extends Error {
  /** Create a WikiPullConflict with the stderr output from the failed rebase. */
  constructor(stderr) {
    super("rebase conflict on pull");
    this.name = "WikiPullConflict";
    this.stderr = stderr;
  }
}

/** Prepend credential-helper config arguments to a git command when a token is available. */
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

/** Git operations wrapper for the GitHub wiki repository used as agent team memory. */
export class WikiRepo {
  #wikiDir;
  #parentDir;

  /** Create a WikiRepo targeting the given wiki directory and its parent project directory. */
  constructor({ wikiDir, parentDir }) {
    this.#wikiDir = wikiDir;
    this.#parentDir = parentDir;
  }

  /** Check whether the wiki directory is an initialized git repository. */
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

  /** Clone the wiki from the given URL if it is not already cloned. */
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

  /** Copy git user.name and user.email from the parent repository into the wiki repository. */
  inheritIdentity() {
    const name = this.#parentConfig("user.name");
    const email = this.#parentConfig("user.email");
    if (name) this.#git(["config", "user.name", name]);
    if (email) this.#git(["config", "user.email", email]);
  }

  /** Fetch the latest master branch from the wiki remote using token auth if available. */
  fetch() {
    this.#authGit(["-C", this.#wikiDir, "fetch", "origin", "master"]);
  }

  /** Return true if the wiki working tree has no uncommitted changes. */
  isClean() {
    const r = this.#git(["status", "--porcelain"]);
    return r.stdout.toString().trim() === "";
  }

  /** Fetch and rebase on origin/master, throwing WikiPullConflict if the rebase fails. */
  pull() {
    this.fetch();
    const r = this.#git(["rebase", "origin/master"]);
    if (r.status !== 0) {
      this.#git(["rebase", "--abort"]);
      throw new WikiPullConflict(r.stderr?.toString().trim() || "");
    }
  }

  /** Stage all changes, commit with the given message, fetch, rebase on origin/master (falling back to a merge with -X ours if rebase fails), and push.
   *
   * Returns `{ pushed: false, reason: "clean" }` if the working tree was clean,
   * `{ pushed: false, reason: "push-failed", stderr }` if the network push was
   * rejected (the local commit is preserved), or `{ pushed: true, reason: "pushed" }`
   * on success.
   */
  commitAndPush(message) {
    if (this.isClean()) return { pushed: false, reason: "clean" };
    this.#addAllExcludingGitlinks();
    this.#git(["commit", "-m", message]);
    this.fetch();
    const rebase = this.#git(["rebase", "origin/master"]);
    if (rebase.status !== 0) {
      this.#git(["rebase", "--abort"]);
      this.#git(["merge", "origin/master", "-X", "ours", "--no-edit"]);
    }
    const push = this.#authGit([
      "-C",
      this.#wikiDir,
      "push",
      "origin",
      "master",
    ]);
    if (push.status !== 0) {
      return {
        pushed: false,
        reason: "push-failed",
        stderr: push.stderr?.toString().trim() ?? "",
      };
    }
    return { pushed: true, reason: "pushed" };
  }

  /** Stage all changes in the working tree, excluding gitlink entries.
   *
   * The wiki is managed as a standalone repo. Any gitlink (`160000`) entries in
   * the wiki's own index are foreign — likely artifacts of an unrelated push —
   * and `git add -A` fails on them when the corresponding submodule directory
   * is not populated. Exclude those paths via pathspec so the add succeeds.
   */
  #addAllExcludingGitlinks() {
    const gitlinkPaths = this.#listGitlinkPaths();
    if (gitlinkPaths.length === 0) {
      this.#git(["add", "-A"]);
      return;
    }
    const args = ["add", "-A", "--", "."];
    for (const p of gitlinkPaths) args.push(`:(exclude)${p}`);
    this.#git(args);
  }

  /** Return paths of gitlink entries (mode 160000) currently in the index. */
  #listGitlinkPaths() {
    const r = this.#git(["ls-files", "--stage"]);
    if (r.status !== 0) return [];
    const out = r.stdout?.toString() ?? "";
    const paths = [];
    for (const line of out.split("\n")) {
      if (!line.startsWith("160000 ")) continue;
      const tab = line.indexOf("\t");
      if (tab < 0) continue;
      paths.push(line.slice(tab + 1));
    }
    return paths;
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
