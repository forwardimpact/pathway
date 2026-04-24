// @ts-check

/**
 * Create a TCC-disclaiming spawn function from the given posix-spawn primitives.
 *
 * @param {{ spawn: Function, waitForExit: Function, readOutput: Function }} deps
 * @returns {(executable: string, args: string[], env?: Record<string, string>, cwd?: string) => Promise<{ exitCode: number, stdout: string, stderr: string }>}
 */
export function createTccSpawn(deps) {
  return async function spawnWithTccDisclaim(executable, args, env, cwd) {
    const { pid, stdoutFile, stderrFile } = deps.spawn(
      executable,
      args,
      env,
      cwd,
    );
    const exitCode = await deps.waitForExit(pid);
    const stdout = deps.readOutput(stdoutFile);
    const stderr = deps.readOutput(stderrFile);
    return { exitCode, stdout, stderr };
  };
}
