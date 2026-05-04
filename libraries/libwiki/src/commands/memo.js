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

function resolveTargetPath(wikiRoot, target) {
  const summaryPath = path.join(wikiRoot, target + ".md");
  const resolvedRoot = path.resolve(wikiRoot);
  const resolvedTarget = path.resolve(summaryPath);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  const escapesRoot =
    relative === "" || relative.startsWith("..") || path.isAbsolute(relative);
  return { summaryPath, escapesRoot };
}

function writeSingleTarget({ wikiRoot, target, sender, message, today, cli }) {
  const { summaryPath, escapesRoot } = resolveTargetPath(wikiRoot, target);
  if (escapesRoot) {
    cli.usageError(`target escapes wiki root: ${target}`);
    process.exit(2);
  }
  if (!existsSync(summaryPath)) {
    cli.usageError(`target summary not found: ${summaryPath}`);
    process.exit(2);
  }
  writeAndCheck(summaryPath, sender, message, today);
}

function writeBroadcast({ agentsDir, wikiRoot, sender, message, today }) {
  const agents = listAgents({ agentsDir, wikiRoot });
  for (const { agent, summaryPath } of agents) {
    if (agent === sender) continue;
    writeAndCheck(summaryPath, sender, message, today);
  }
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
    writeBroadcast({
      agentsDir,
      wikiRoot,
      sender,
      message: values.message,
      today,
    });
  } else {
    writeSingleTarget({
      wikiRoot,
      target: values.to,
      sender,
      message: values.message,
      today,
      cli,
    });
  }
}
