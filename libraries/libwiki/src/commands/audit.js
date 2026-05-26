import fsAsync from "node:fs/promises";
import path from "node:path";
import {
  Finder,
  emitFindingsJson,
  emitFindingsText,
} from "@forwardimpact/libutil";
import { runAudit } from "../audit/engine.js";
import { RULES } from "../audit/rules.js";
import { buildContext } from "../audit/scopes.js";

/** Run the wiki audit and emit findings. JSON via --format json. */
export function runAuditCommand(values, _args, _cli) {
  const finder = new Finder(fsAsync, { debug() {} }, process);
  const projectRoot = finder.findProjectRoot(process.cwd());
  const wikiRoot = values["wiki-root"] || path.join(projectRoot, "wiki");
  const today = values.today || new Date().toISOString().slice(0, 10);

  const ctx = buildContext({ wikiRoot, today });
  const findings = runAudit(RULES, ctx);

  process.stdout.write(
    values.format === "json"
      ? emitFindingsJson(findings)
      : emitFindingsText(findings, {
          cwd: projectRoot,
          passMessage: "wiki audit passed",
        }),
  );

  if (findings.some((f) => f.level === "fail")) process.exit(1);
}
