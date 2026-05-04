import { test } from "node:test";
import assert from "node:assert/strict";
import { scanPages } from "../src/page-tree.js";

function createMockDeps(fileTree) {
  const mockFs = {
    readdirSync: (dir) => {
      const entries = fileTree[dir];
      if (!entries) return [];
      return Object.keys(entries);
    },
    statSync: (fullPath) => {
      for (const [dir, entries] of Object.entries(fileTree)) {
        for (const [name, value] of Object.entries(entries)) {
          const entryPath = dir + "/" + name;
          if (entryPath === fullPath) {
            return {
              isDirectory: () => typeof value === "object" && value !== null,
              isFile: () => typeof value === "string",
            };
          }
        }
      }
      throw new Error(`ENOENT: ${fullPath}`);
    },
    readFileSync: (fullPath) => {
      for (const [dir, entries] of Object.entries(fileTree)) {
        for (const [name, value] of Object.entries(entries)) {
          if (dir + "/" + name === fullPath && typeof value === "string") {
            return value;
          }
        }
      }
      throw new Error(`ENOENT: ${fullPath}`);
    },
  };

  const mockPath = {
    join: (...parts) => parts.join("/"),
    dirname: (p) => p.split("/").slice(0, -1).join("/") || ".",
    normalize: (p) => {
      const parts = p.split("/").filter(Boolean);
      const result = [];
      for (const part of parts) {
        if (part === "..") result.pop();
        else if (part !== ".") result.push(part);
      }
      return result.join("/") || ".";
    },
    relative: (from, to) => {
      const f = from.split("/").filter(Boolean);
      const t = to.split("/").filter(Boolean);
      let i = 0;
      while (i < f.length && i < t.length && f[i] === t[i]) i++;
      const ups = f.length - i;
      return [...Array(ups).fill(".."), ...t.slice(i)].join("/") || ".";
    },
  };

  const mockMatter = (content) => {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (match) {
      const data = {};
      for (const line of match[1].split("\n")) {
        const kv = line.match(/^(\w+): (.+)$/);
        if (kv) data[kv[1]] = kv[2];
      }
      return { data, content: match[2] };
    }
    return { data: {}, content };
  };

  return { fs: mockFs, path: mockPath, matter: mockMatter };
}

test("scanPages returns map with 3 entries for 3-page directory", () => {
  const fileTree = {
    src: {
      "index.md": "---\ntitle: Home\ndescription: Welcome\n---\nContent",
      about: {},
      docs: {},
    },
    "src/about": {
      "index.md":
        "---\ntitle: About Us\ndescription: About page\n---\nAbout content",
    },
    "src/docs": {
      "index.md":
        "---\ntitle: Documentation\ndescription: Docs hub\n---\nDocs content",
    },
  };

  const deps = createMockDeps(fileTree);
  const pageTree = scanPages("src", deps);

  assert.strictEqual(pageTree.size, 3);

  const home = pageTree.get("/");
  assert.ok(home);
  assert.strictEqual(home.title, "Home");
  assert.strictEqual(home.description, "Welcome");
  assert.strictEqual(home.filePath, "index.md");
  assert.strictEqual(home.urlPath, "/");

  const about = pageTree.get("/about/");
  assert.ok(about);
  assert.strictEqual(about.title, "About Us");
  assert.strictEqual(about.description, "About page");
  assert.strictEqual(about.filePath, "about/index.md");

  const docs = pageTree.get("/docs/");
  assert.ok(docs);
  assert.strictEqual(docs.title, "Documentation");
  assert.strictEqual(docs.description, "Docs hub");
});

test("scanPages excludes pages without title in frontmatter", () => {
  const fileTree = {
    src: {
      "index.md": "---\ntitle: Home\n---\nContent",
      "notitle.md": "---\ndescription: No title here\n---\nContent",
    },
  };

  const deps = createMockDeps(fileTree);
  const pageTree = scanPages("src", deps);

  assert.strictEqual(pageTree.size, 1);
  assert.ok(pageTree.has("/"));
  assert.ok(!pageTree.has("/notitle/"));
});

test("scanPages skips CLAUDE.md, SKILL.md, assets/, public/", () => {
  const fileTree = {
    src: {
      "index.md": "---\ntitle: Home\n---\nContent",
      "CLAUDE.md": "---\ntitle: Claude\n---\nContent",
      "SKILL.md": "---\ntitle: Skill\n---\nContent",
      assets: {},
      public: {},
    },
  };

  const deps = createMockDeps(fileTree);
  const pageTree = scanPages("src", deps);

  assert.strictEqual(pageTree.size, 1);
  assert.ok(pageTree.has("/"));
});

test("scanPages defaults description to empty string", () => {
  const fileTree = {
    src: {
      "index.md": "---\ntitle: Home\n---\nContent",
    },
  };

  const deps = createMockDeps(fileTree);
  const pageTree = scanPages("src", deps);

  assert.strictEqual(pageTree.get("/").description, "");
});
