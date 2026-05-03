import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import fsAsync from "node:fs/promises";
import { Finder } from "@forwardimpact/libutil";
import { scanMarkers } from "../marker-scanner.js";
import { renderBlock, BlockRenderError } from "../block-renderer.js";

function currentStoryboardPath() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `wiki/storyboard-${yyyy}-M${mm}.md`;
}

export function runRefreshCommand(values, args, cli) {
  const logger = { debug() {} };
  const finder = new Finder(fsAsync, logger, process);
  const projectRoot = finder.findProjectRoot(process.cwd());

  const storyboardPath = path.resolve(
    projectRoot,
    args[0] || currentStoryboardPath(),
  );
  const text = readFileSync(storyboardPath, "utf-8");
  const blocks = scanMarkers(text);

  if (blocks.length === 0) return;

  const lines = text.split("\n");
  let spliced = false;

  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    try {
      const rendered = renderBlock({
        metric: block.metric,
        csvPath: block.csvPath,
        projectRoot,
      });
      lines.splice(
        block.openLine + 1,
        block.closeLine - block.openLine - 1,
        ...rendered,
      );
      spliced = true;
    } catch (err) {
      if (!(err instanceof BlockRenderError)) throw err;
      process.stderr.write(
        `refresh-error ${storyboardPath}:${block.openLine + 1} ${err.message}\n`,
      );
    }
  }

  if (spliced) writeFileSync(storyboardPath, lines.join("\n"));
}
