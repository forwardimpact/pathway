// @ts-check

export { spawn, waitForExit, readOutput } from "./posix-spawn.js";
export { createTccSpawn } from "./tcc-responsibility.js";

import { spawn, waitForExit, readOutput } from "./posix-spawn.js";
import { createTccSpawn } from "./tcc-responsibility.js";

export const spawnWithTccDisclaim = createTccSpawn({
  spawn,
  waitForExit,
  readOutput,
});
