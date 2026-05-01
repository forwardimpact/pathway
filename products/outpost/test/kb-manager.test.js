import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import { KBManager } from "../src/kb-manager.js";

/**
 * In-memory fs mock for KBManager tests.
 * @param {Record<string, string>} files
 */
function createKBMockFs(files = {}) {
  const data = new Map(Object.entries(files));
  const dirs = new Set();

  for (const path of data.keys()) {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) {
      dirs.add(parts.slice(0, i).join("/"));
    }
  }

  return {
    data,
    dirs,
    copyFileSyncCallCount: 0,
    existsSync(path) {
      return data.has(path) || dirs.has(path);
    },
    mkdirSync(path) {
      dirs.add(path);
    },
    copyFileSync(src, dest) {
      this.copyFileSyncCallCount++;
      const content = data.get(src);
      if (content === undefined) {
        const err = new Error("ENOENT: no such file, copyFile '" + src + "'");
        err.code = "ENOENT";
        throw err;
      }
      data.set(dest, content);
    },
    cpSync(src, dest, _options) {
      this.cpSyncCallCount = (this.cpSyncCallCount || 0) + 1;
      const fileEntries = [...data.keys()].filter(
        (k) => k === src || k.startsWith(src + "/"),
      );
      if (fileEntries.length === 0 && !dirs.has(src)) {
        const err = new Error(
          "ENOENT: no such file or directory '" + src + "'",
        );
        err.code = "ENOENT";
        throw err;
      }
      dirs.add(dest);
      for (const d of [...dirs]) {
        if (d.startsWith(src + "/")) dirs.add(dest + d.slice(src.length));
      }
      for (const key of fileEntries) {
        const target = key === src ? dest : dest + key.slice(src.length);
        const parts = target.split("/");
        for (let i = 1; i < parts.length; i++) {
          dirs.add(parts.slice(0, i).join("/"));
        }
        data.set(target, data.get(key));
      }
    },
    readFileSync(path, encoding) {
      const content = data.get(path);
      if (content === undefined) {
        const err = new Error("ENOENT: no such file, open '" + path + "'");
        err.code = "ENOENT";
        throw err;
      }
      return encoding ? content : Buffer.from(content);
    },
    writeFileSync(path, content) {
      data.set(
        path,
        typeof content === "string" ? content : content.toString(),
      );
    },
    readdirSync(path, options) {
      const prefix = path.endsWith("/") ? path : path + "/";
      const names = new Set();
      for (const key of data.keys()) {
        if (key.startsWith(prefix)) {
          const name = key.slice(prefix.length).split("/")[0];
          if (name) names.add(name);
        }
      }
      for (const d of dirs) {
        if (d.startsWith(prefix)) {
          const name = d.slice(prefix.length).split("/")[0];
          if (name) names.add(name);
        }
      }
      if (options && options.withFileTypes) {
        return [...names].map((name) => ({
          name,
          isDirectory: () => dirs.has(path + "/" + name),
          isFile: () => data.has(path + "/" + name),
        }));
      }
      return [...names];
    },
  };
}

function noop() {}

describe("KBManager", () => {
  describe("constructor validation", () => {
    test("throws when fs is missing", () => {
      assert.throws(() => new KBManager(null, noop), /fs is required/);
    });

    test("throws when logFn is missing", () => {
      assert.throws(() => new KBManager({}, null), /logFn is required/);
    });
  });

  describe("copyBundledFiles", () => {
    let mockFs;
    let km;

    beforeEach(() => {
      mockFs = createKBMockFs({
        "/tpl/CLAUDE.md": "# Instructions",
        "/tpl/.claude/settings.json": '{"permissions":{}}',
        "/tpl/.claude/agents/postman.md": "postman content",
        "/tpl/.claude/agents/librarian.md": "librarian content",
        "/tpl/.claude/skills/draft-emails/SKILL.md": "draft skill",
        "/tpl/.claude/skills/meeting-prep/SKILL.md": "meeting skill",
        "/dest/CLAUDE.md": "# Old Instructions",
        "/dest/.claude/settings.json": '{"permissions":{}}',
      });
      km = new KBManager(mockFs, noop);
    });

    test("copies CLAUDE.md to destination", () => {
      km.copyBundledFiles("/tpl", "/dest");
      assert.strictEqual(mockFs.data.get("/dest/CLAUDE.md"), "# Instructions");
    });

    test("copies agent files recursively", () => {
      km.copyBundledFiles("/tpl", "/dest");
      assert.strictEqual(
        mockFs.data.get("/dest/.claude/agents/postman.md"),
        "postman content",
      );
      assert.strictEqual(
        mockFs.data.get("/dest/.claude/agents/librarian.md"),
        "librarian content",
      );
    });

    test("copies skill files recursively", () => {
      km.copyBundledFiles("/tpl", "/dest");
      assert.strictEqual(
        mockFs.data.get("/dest/.claude/skills/draft-emails/SKILL.md"),
        "draft skill",
      );
      assert.strictEqual(
        mockFs.data.get("/dest/.claude/skills/meeting-prep/SKILL.md"),
        "meeting skill",
      );
    });

    test("uses cpSync for skill and agent trees", () => {
      km.copyBundledFiles("/tpl", "/dest");
      // One cpSync per top-level subdir: skills, agents.
      assert.strictEqual(mockFs.cpSyncCallCount, 2);
    });

    test("creates destination directories for skills", () => {
      km.copyBundledFiles("/tpl", "/dest");
      assert.ok(mockFs.dirs.has("/dest/.claude/agents"));
      assert.ok(mockFs.dirs.has("/dest/.claude/skills/draft-emails"));
      assert.ok(mockFs.dirs.has("/dest/.claude/skills/meeting-prep"));
    });
  });

  describe("init", () => {
    test("creates knowledge base structure", () => {
      const fs = createKBMockFs({
        "/tpl/CLAUDE.md": "# Instructions",
        "/tpl/USER.md": "# User",
        "/tpl/.claude/settings.json": '{"permissions":{}}',
        "/tpl/.claude/agents/postman.md": "postman",
      });
      const km = new KBManager(fs, noop);
      km.init("/kb", "/tpl");

      assert.ok(fs.data.has("/kb/CLAUDE.md"));
      assert.ok(fs.data.has("/kb/USER.md"));
      assert.ok(fs.data.has("/kb/.claude/agents/postman.md"));
    });
  });

  describe("mergeSettings", () => {
    test("adds new permission entries without duplicating", () => {
      const fs = createKBMockFs({
        "/tpl/.claude/settings.json": JSON.stringify({
          permissions: { allow: ["Bash(ls *)"], deny: ["Bash(rm *)"] },
        }),
        "/dest/.claude/settings.json": JSON.stringify({
          permissions: { allow: ["Bash(ls *)"] },
        }),
      });
      const km = new KBManager(fs, noop);
      km.mergeSettings("/tpl", "/dest");

      const result = JSON.parse(fs.data.get("/dest/.claude/settings.json"));
      assert.strictEqual(result.permissions.allow.length, 1);
      assert.deepStrictEqual(result.permissions.deny, ["Bash(rm *)"]);
    });
  });
});
