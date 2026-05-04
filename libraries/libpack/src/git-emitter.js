import { readdir, readFile, stat, mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { execFileSync } from "child_process";

const AUTHOR = "Forward Impact Pathway";
const EMAIL = "pathway@forwardimpact.team";
const EPOCH = "1970-01-01T00:00:00Z";

const BARE_CONFIG = `[core]
\trepositoryformatversion = 0
\tfilemode = true
\tbare = true
`;

/** Static bare git repo emitter for dumb-HTTP serving. */
export class GitEmitter {
  #exec;
  /** @param {{exec?: Function}} [opts] */
  constructor({ exec = execFileSync } = {}) {
    this.#exec = exec;
  }

  /** Emit a static bare git repo from stagedDir at outputPath. */
  async emit(stagedDir, outputPath, { version, name }) {
    const cleanEnv = Object.fromEntries(
      Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")),
    );
    this.#gitEnv = {
      ...cleanEnv,
      GIT_DIR: outputPath,
      GIT_AUTHOR_NAME: AUTHOR,
      GIT_AUTHOR_EMAIL: EMAIL,
      GIT_AUTHOR_DATE: EPOCH,
      GIT_COMMITTER_NAME: AUTHOR,
      GIT_COMMITTER_EMAIL: EMAIL,
      GIT_COMMITTER_DATE: EPOCH,
    };

    // 1. Scaffold bare repo
    this.#exec("git", ["init", "--bare", "--initial-branch=main", outputPath], {
      env: cleanEnv,
    });

    // 2–4. Hash all objects and build trees
    const rootTree = await this.#hashTree(stagedDir);

    // 5. Create commit
    const commitSha = this.#exec(
      "git",
      ["commit-tree", rootTree, "-m", `pathway v${version}\n`],
      { env: this.#gitEnv },
    )
      .toString()
      .trim();

    // 6. Point default branch at commit
    this.#exec("git", ["update-ref", "refs/heads/main", commitSha], {
      env: this.#gitEnv,
    });

    // 7. Lightweight tag
    this.#exec("git", ["update-ref", `refs/tags/v${version}`, commitSha], {
      env: this.#gitEnv,
    });

    // 8. Single deterministic packfile
    // -f passes --no-reuse-delta to git-pack-objects
    this.#exec("git", ["repack", "-a", "-d", "-f"], {
      env: this.#gitEnv,
    });

    // 9. Remove loose objects
    this.#exec("git", ["prune-packed"], { env: this.#gitEnv });

    // 10. Write info/refs + objects/info/packs
    this.#exec("git", ["update-server-info"], { env: this.#gitEnv });

    // 11. Write packed-refs
    this.#exec("git", ["pack-refs", "--all"], { env: this.#gitEnv });

    // 12. Deterministic config
    await writeFile(join(outputPath, "config"), BARE_CONFIG);

    // 13. Description
    await writeFile(join(outputPath, "description"), `Pathway pack: ${name}\n`);

    // 14. Strip to design-specified files + empty refs skeleton
    await rm(join(outputPath, "hooks"), { recursive: true, force: true });
    await rm(join(outputPath, "info", "exclude"), { force: true });
    // Keep refs/ as empty dirs — local git clone reads them directly
    const refsDir = join(outputPath, "refs");
    await rm(refsDir, { recursive: true, force: true });
    await mkdir(join(refsDir, "heads"), { recursive: true });
    await mkdir(join(refsDir, "tags"), { recursive: true });
    // Remove loose objects (all packed now)
    const objectsDir = join(outputPath, "objects");
    const objectEntries = await readdir(objectsDir);
    for (const entry of objectEntries) {
      if (entry !== "info" && entry !== "pack") {
        await rm(join(objectsDir, entry), { recursive: true, force: true });
      }
    }
  }

  async #hashTree(stagedDir) {
    const entries = await readdir(stagedDir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    const lines = [];
    for (const entry of entries) {
      const fullPath = join(stagedDir, entry.name);
      if (entry.isDirectory()) {
        const treeSha = await this.#hashTree(fullPath);
        lines.push(`040000 tree ${treeSha}\t${entry.name}`);
      } else {
        const blobSha = this.#exec("git", ["hash-object", "-w", "--stdin"], {
          input: await readFile(fullPath),
          env: this.#gitEnv,
        })
          .toString()
          .trim();
        const mode = (await stat(fullPath)).mode & 0o111 ? "100755" : "100644";
        lines.push(`${mode} blob ${blobSha}\t${entry.name}`);
      }
    }
    return this.#exec("git", ["mktree"], {
      input: lines.join("\n") + "\n",
      env: this.#gitEnv,
    })
      .toString()
      .trim();
  }

  #gitEnv;
}
