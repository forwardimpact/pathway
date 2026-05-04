import { writeFile } from "fs/promises";
import { execFileSync } from "child_process";
import { collectPaths, resetTimestamps } from "./util.js";

export class TarEmitter {
  #exec;
  constructor({ exec = execFileSync } = {}) {
    this.#exec = exec;
  }

  async emit(stagedDir, outputPath) {
    await resetTimestamps(stagedDir);
    const files = await collectPaths(stagedDir);
    files.sort();
    const tarBuf = this.#exec("tar", [
      "--no-recursion",
      "-cf",
      "-",
      "-C",
      stagedDir,
      ...files,
    ]);
    const gzBuf = this.#exec("gzip", ["-n"], { input: tarBuf });
    await writeFile(outputPath, gzBuf);
  }
}
