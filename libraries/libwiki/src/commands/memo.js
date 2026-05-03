import { existsSync } from "node:fs";
import fsAsync from "node:fs/promises";
import path from "node:path";
import { Finder } from "@forwardimpact/libutil";
import { writeMemo } from "../memo-writer.js";
import { listAgents } from "../agent-roster.js";
import { BROADCAST_TARGET } from "../constants.js";

function writeAndCheck(summaryPath, sender, message, today) {
  const result = writeMemo({ summaryPath, sender, message, today });
  if (!result.written) {
    process.stderr.write(`summary lacks memo:inbox marker: ${result.path}\n`);
    process.exit(2);
  }
  process.stdout.write(`wrote ${result.path}\n`);
}

export function runMemoCommand(values, _args, cli) {
  const sender = values.from || process.env.LIBEVAL_AGENT_PROFILE;

  if (!sender) {
    cli.usageError(
      "memo requires --from <sender> or LIBEVAL_AGENT_PROFILE env var",
    );
    process.exit(2);
  }

  if (!values.to) {
    cli.usageError("memo requires --to <target|all>");
    process.exit(2);
  }

  if (!values.message) {
    cli.usageError("memo requires --message <text>");
    process.exit(2);
  }

  const logger = { debug() {} };
  const finder = new Finder(fsAsync, logger, process);
  const projectRoot = finder.findProjectRoot(process.cwd());

  const wikiRoot = values["wiki-root"] || path.join(projectRoot, "wiki");
  const agentsDir = path.join(projectRoot, ".claude", "agents");
  const today = new Date().toISOString().slice(0, 10);

  if (values.to === BROADCAST_TARGET) {
    const agents = listAgents({ agentsDir, wikiRoot });
    for (const { agent, summaryPath } of agents) {
      if (agent === sender) continue;
      writeAndCheck(summaryPath, sender, values.message, today);
    }
  } else {
    const summaryPath = path.join(wikiRoot, values.to + ".md");
    if (!existsSync(summaryPath)) {
      cli.usageError(`target summary not found: ${summaryPath}`);
      process.exit(2);
    }
    writeAndCheck(summaryPath, sender, values.message, today);
  }
}
