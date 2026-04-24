// @ts-check

import { spawn, waitForExit, readOutput } from "./posix-spawn.js";

/**
 * Spawn a child process that disclaims TCC responsibility back to the
 * calling bundle, wait for it to exit, and return the result.
 *
 * @param {string} executable - Absolute path to the executable
 * @param {string[]} args - Arguments (argv[0] should be the executable name)
 * @param {Record<string, string>} [env] - Environment (defaults to current)
 * @param {string} [cwd] - Working directory for the child process
 * @returns {Promise<{ exitCode: number, stdout: string, stderr: string }>}
 */
export async function spawnWithTccDisclaim(executable, args, env, cwd) {
  const { pid, stdoutFile, stderrFile } = spawn(executable, args, env, cwd);
  const exitCode = await waitForExit(pid);
  const stdout = readOutput(stdoutFile);
  const stderr = readOutput(stderrFile);
  return { exitCode, stdout, stderr };
}
