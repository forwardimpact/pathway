import { test, describe } from "node:test";
import assert from "node:assert";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkJtbd } from "../src/index.js";

async function makeRepo() {
  const root = await mkdtemp(join(tmpdir(), "libcoaligned-jtbd-"));
  for (const sub of ["products", "services", "libraries"]) {
    await mkdir(join(root, sub), { recursive: true });
  }
  return root;
}

const validJob = {
  user: "Platform Builders",
  goal: "Test Goal",
  trigger: "A test moment.",
  bigHire: "do the thing.",
  littleHire: "do the small thing.",
  competesWith: "doing nothing; hand-rolling",
};

describe("checkJtbd", () => {
  test("passes on an empty repo with no packages", async () => {
    const root = await makeRepo();
    try {
      const result = await checkJtbd({ root });
      assert.deepStrictEqual(result.errors, []);
      assert.deepStrictEqual(result.stale, []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects a job entry whose bigHire is missing the trailing period", async () => {
    const root = await makeRepo();
    try {
      const pkg = {
        name: "@x/libfoo",
        description: "Foo.",
        jobs: [{ ...validJob, bigHire: "do the thing without a period" }],
      };
      await mkdir(join(root, "libraries", "libfoo"));
      await writeFile(
        join(root, "libraries", "libfoo", "package.json"),
        JSON.stringify(pkg),
      );
      const result = await checkJtbd({ root });
      assert.ok(
        result.errors.some((e) => e.includes('must end with "."')),
        `expected period-rule error, got: ${JSON.stringify(result.errors)}`,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("--fix regenerates a stale description block", async () => {
    const root = await makeRepo();
    try {
      const pkg = { name: "@x/libfoo", description: "Updated description." };
      await mkdir(join(root, "libraries", "libfoo"));
      await writeFile(
        join(root, "libraries", "libfoo", "package.json"),
        JSON.stringify(pkg),
      );
      const readme = [
        "# libfoo",
        "",
        "<!-- BEGIN:description -->",
        "",
        "Stale description.",
        "",
        "<!-- END:description -->",
        "",
      ].join("\n");
      const readmePath = join(root, "libraries", "libfoo", "README.md");
      await writeFile(readmePath, readme);

      const dryRun = await checkJtbd({ root, fix: false });
      assert.ok(dryRun.stale.length > 0, "expected stale entries");

      const fixed = await checkJtbd({ root, fix: true });
      assert.ok(fixed.fixed.length > 0, "expected fix to apply");

      const updated = await readFile(readmePath, "utf8");
      assert.ok(updated.includes("Updated description."));
      assert.ok(!updated.includes("Stale description."));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
