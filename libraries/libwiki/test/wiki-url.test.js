import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { deriveWikiUrl, parseOrgRepo } from "../src/wiki-url.js";

describe("parseOrgRepo", () => {
  test("https github URL", () => {
    assert.deepEqual(
      parseOrgRepo("https://github.com/forwardimpact/monorepo.git"),
      {
        org: "forwardimpact",
        repo: "monorepo",
      },
    );
  });

  test("https github URL without .git suffix", () => {
    assert.deepEqual(
      parseOrgRepo("https://github.com/forwardimpact/monorepo"),
      {
        org: "forwardimpact",
        repo: "monorepo",
      },
    );
  });

  test("ssh github URL", () => {
    assert.deepEqual(
      parseOrgRepo("git@github.com:forwardimpact/monorepo.git"),
      {
        org: "forwardimpact",
        repo: "monorepo",
      },
    );
  });

  test("local proxy URL with userinfo and port", () => {
    assert.deepEqual(
      parseOrgRepo(
        "http://local_proxy@127.0.0.1:37877/git/forwardimpact/monorepo",
      ),
      { org: "forwardimpact", repo: "monorepo" },
    );
  });

  test("trailing slash is tolerated", () => {
    assert.deepEqual(
      parseOrgRepo("https://github.com/forwardimpact/monorepo/"),
      {
        org: "forwardimpact",
        repo: "monorepo",
      },
    );
  });

  test("empty input returns null", () => {
    assert.equal(parseOrgRepo(""), null);
    assert.equal(parseOrgRepo(null), null);
  });

  test("single-segment URL returns null", () => {
    assert.equal(parseOrgRepo("https://github.com/monorepo"), null);
  });
});

describe("deriveWikiUrl", () => {
  test("rebuilds against github.com from any origin shape", () => {
    const inputs = [
      "https://github.com/forwardimpact/monorepo.git",
      "https://github.com/forwardimpact/monorepo",
      "git@github.com:forwardimpact/monorepo.git",
      "http://local_proxy@127.0.0.1:37877/git/forwardimpact/monorepo",
      "http://local_proxy@127.0.0.1:35023/git/forwardimpact/monorepo.git",
    ];
    for (const input of inputs) {
      assert.equal(
        deriveWikiUrl(input),
        "https://github.com/forwardimpact/monorepo.wiki.git",
        `failed for ${input}`,
      );
    }
  });

  test("returns null for unparseable input", () => {
    assert.equal(deriveWikiUrl(""), null);
    assert.equal(deriveWikiUrl("not-a-url"), null);
  });
});
