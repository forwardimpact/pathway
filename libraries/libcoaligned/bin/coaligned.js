#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { createCli } from "@forwardimpact/libcli";
import { checkInstructions, checkJtbd } from "../src/index.js";

const { version: VERSION } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const definition = {
  name: "coaligned",
  version: VERSION,
  description:
    "Enforce the layered instruction architecture defined in COALIGNED.md",
  commands: [
    {
      name: "instructions",
      args: [],
      description: "Check L1–L6 length and checklist caps across the repo",
      handler: instructionsHandler,
      examples: ["coaligned instructions"],
    },
    {
      name: "jtbd",
      args: [],
      description: "Validate package.json .jobs entries and generated blocks",
      options: {
        fix: {
          type: "boolean",
          description: "Regenerate stale catalog and jobs blocks in place",
        },
      },
      handler: jtbdHandler,
      examples: ["coaligned jtbd", "coaligned jtbd --fix"],
    },
  ],
  globalOptions: {
    help: { type: "boolean", short: "h", description: "Show this help" },
    version: { type: "boolean", description: "Show version" },
    json: { type: "boolean", description: "Output help as JSON" },
  },
  examples: ["coaligned instructions", "coaligned jtbd --fix"],
};

const cli = createCli(definition);

async function instructionsHandler(ctx) {
  const errors = await checkInstructions({ root: ctx.data.root });
  for (const e of errors) process.stderr.write(`error: ${e}\n`);
  return errors.length > 0 ? 1 : 0;
}

async function jtbdHandler(ctx) {
  const { errors, stale, fixed } = await checkJtbd({
    root: ctx.data.root,
    fix: !!ctx.options.fix,
  });
  for (const e of errors) process.stderr.write(`${e}\n`);
  for (const f of fixed) process.stdout.write(`Regenerated ${f}.\n`);
  for (const s of stale) {
    process.stderr.write(
      `${s} out of date. Run \`coaligned jtbd --fix\` to regenerate.\n`,
    );
  }
  return errors.length > 0 || stale.length > 0 ? 1 : 0;
}

async function main() {
  const parsed = cli.parse(process.argv.slice(2));
  if (!parsed) return 0;

  if (parsed.positionals.length === 0) {
    cli.usageError("no command specified (use instructions or jtbd)");
    return 2;
  }

  const known = definition.commands.map((c) => c.name);
  if (!known.includes(parsed.positionals[0])) {
    cli.usageError(`unknown command "${parsed.positionals[0]}"`);
    return 2;
  }

  return await cli.dispatch(parsed, { data: { root: process.cwd() } });
}

main()
  .then((code) => process.exit(code ?? 0))
  .catch((err) => {
    cli.error(err.message);
    process.exit(1);
  });
