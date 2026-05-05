import { test, describe } from "node:test";
import assert from "node:assert";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkInstructions } from "../src/index.js";

async function makeRepo() {
  const root = await mkdtemp(join(tmpdir(), "libcoaligned-instr-"));
  await mkdir(join(root, ".claude", "skills", "demo"), { recursive: true });
  return root;
}

describe("checkInstructions", () => {
  test("returns no errors for an empty repo", async () => {
    const root = await makeRepo();
    try {
      const errors = await checkInstructions({ root });
      assert.deepStrictEqual(errors, []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("flags an oversized CLAUDE.md against L1 line cap", async () => {
    const root = await makeRepo();
    try {
      const oversize = "line\n".repeat(200);
      await writeFile(join(root, "CLAUDE.md"), oversize);
      const errors = await checkInstructions({ root });
      assert.ok(
        errors.some((e) => e.includes("CLAUDE.md") && e.includes("L1")),
        `expected an L1 CLAUDE.md error, got: ${JSON.stringify(errors)}`,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("flags a checklist that exceeds 9 items", async () => {
    const root = await makeRepo();
    try {
      const items = Array.from(
        { length: 12 },
        (_, i) => `- [ ] item ${i + 1}.`,
      );
      const skill = [
        "# Demo",
        "",
        '<read_do_checklist goal="Test">',
        "",
        ...items,
        "",
        "</read_do_checklist>",
        "",
      ].join("\n");
      await writeFile(join(root, ".claude/skills/demo/SKILL.md"), skill);
      const errors = await checkInstructions({ root });
      assert.ok(
        errors.some(
          (e) => e.includes("L6 checklist") && e.includes("12 items"),
        ),
        `expected an L6 checklist error, got: ${JSON.stringify(errors)}`,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
