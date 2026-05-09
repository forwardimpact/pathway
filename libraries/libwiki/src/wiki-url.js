/**
 * GitHub wiki URL derivation.
 *
 * The wiki for a GitHub repository lives at `<repo>.wiki.git` on github.com.
 * In remote Claude Code environments, the origin remote of the parent repo
 * may be a local proxy URL (e.g. `http://local_proxy@127.0.0.1:PORT/git/<org>/<repo>`)
 * that does not serve the wiki — the proxy only allowlists the main repo.
 * We always rebuild the wiki URL against `https://github.com` so the wiki
 * resolves regardless of how the parent repo is fetched.
 */

/**
 * Parse `<org>/<repo>` from any origin remote URL form: SSH, HTTPS, or proxy.
 * Returns null if the URL doesn't have at least two path segments.
 * @param {string} originUrl
 * @returns {{org: string, repo: string} | null}
 */
export function parseOrgRepo(originUrl) {
  if (!originUrl) return null;
  const trimmed = originUrl.trim();

  const sshMatch = trimmed.match(
    /^[^@\s/]+@[^:/\s]+:([^/]+)\/(.+?)(?:\.git)?\/?$/,
  );
  if (sshMatch) return { org: sshMatch[1], repo: sshMatch[2] };

  let pathname;
  try {
    pathname = new URL(trimmed).pathname;
  } catch {
    pathname = trimmed;
  }
  const cleaned = pathname.replace(/\.git$/, "").replace(/\/$/, "");
  const segments = cleaned.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const repo = segments[segments.length - 1];
  const org = segments[segments.length - 2];
  if (!org || !repo) return null;
  return { org, repo };
}

/**
 * Build the canonical github.com wiki URL from a parent origin remote URL.
 * @param {string} originUrl
 * @returns {string | null}
 */
export function deriveWikiUrl(originUrl) {
  const parsed = parseOrgRepo(originUrl);
  if (!parsed) return null;
  return `https://github.com/${parsed.org}/${parsed.repo}.wiki.git`;
}
