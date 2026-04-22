import os from "node:os";

import { createStorage } from "@forwardimpact/libstorage";

import { runResumeCommand } from "./resume.js";

export async function runClearCommand() {
  const storage = createStorage("guide");
  const key = `${os.userInfo().uid}.json`;
  if (await storage.exists(key)) {
    await storage.delete(key);
  }
  await runResumeCommand();
}
