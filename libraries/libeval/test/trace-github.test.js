import { describe, test } from "node:test";
import assert from "node:assert";

import { createTraceGitHub, parseGitRemote } from "@forwardimpact/libeval";

describe("parseGitRemote", () => {
  test("parses SSH remote", () => {
    const result = parseGitRemote("git@github.com:forwardimpact/monorepo.git");
    assert.strictEqual(result.owner, "forwardimpact");
    assert.strictEqual(result.repo, "monorepo");
  });

  test("parses SSH remote without .git suffix", () => {
    const result = parseGitRemote("git@github.com:owner/repo");
    assert.strictEqual(result.owner, "owner");
    assert.strictEqual(result.repo, "repo");
  });

  test("parses HTTPS remote", () => {
    const result = parseGitRemote(
      "https://github.com/forwardimpact/monorepo.git",
    );
    assert.strictEqual(result.owner, "forwardimpact");
    assert.strictEqual(result.repo, "monorepo");
  });

  test("parses HTTPS remote without .git suffix", () => {
    const result = parseGitRemote("https://github.com/owner/repo");
    assert.strictEqual(result.owner, "owner");
    assert.strictEqual(result.repo, "repo");
  });

  test("parses plain owner/repo format", () => {
    const result = parseGitRemote("forwardimpact/monorepo");
    assert.strictEqual(result.owner, "forwardimpact");
    assert.strictEqual(result.repo, "monorepo");
  });

  test("throws for unparseable remote", () => {
    assert.throws(() => parseGitRemote("not-a-remote"), /Cannot parse/);
  });

  test("does not match plain owner/repo if it looks like an SSH URL", () => {
    const result = parseGitRemote("git@github.com:acme/widgets.git");
    assert.strictEqual(result.owner, "acme");
    assert.strictEqual(result.repo, "widgets");
  });
});

describe("createTraceGitHub", () => {
  test("throws a clear error when called with no arguments", async () => {
    await assert.rejects(
      () => createTraceGitHub(),
      /token is required.*Config\.ghToken/,
    );
  });

  test("throws a clear error when token is missing", async () => {
    await assert.rejects(
      () => createTraceGitHub({ repo: "owner/repo" }),
      /token is required.*Config\.ghToken/,
    );
  });

  test("returns a TraceGitHub with the provided token and parsed repo", async () => {
    const gh = await createTraceGitHub({
      token: "ghp_fake",
      repo: "forwardimpact/monorepo",
    });
    assert.strictEqual(gh.token, "ghp_fake");
    assert.strictEqual(gh.owner, "forwardimpact");
    assert.strictEqual(gh.repo, "monorepo");
  });
});
