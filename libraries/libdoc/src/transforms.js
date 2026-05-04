/**
 * Decide whether a link points outside the site being built.
 * Relative links and absolute links matching baseUrl's host are internal.
 * @param {string} url - Link target
 * @param {string|undefined} baseUrl - Base URL of the site
 * @returns {boolean}
 */
export function isExternalLink(url, baseUrl) {
  if (!/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(url)) return false;
  if (!baseUrl) return true;
  try {
    return new URL(url).host !== new URL(baseUrl).host;
  } catch {
    return true;
  }
}

/**
 * Rewrite a .md path to its directory-style equivalent.
 * - index -> ./
 * - foo/index -> foo/
 * - foo -> foo/
 * @param {string} path - Path without the .md extension
 * @param {string} fragment - Optional URL fragment (e.g. "#section")
 * @returns {string}
 */
export function rewriteMarkdownPath(path, fragment) {
  if (path === "index" || path === "./index") return `./${fragment}`;
  if (path.endsWith("/index")) return `${path.slice(0, -5)}${fragment}`;
  return `${path}/${fragment}`;
}

/**
 * Transform internal .md links to match the HTML output structure.
 * External links (different host than baseUrl) are left untouched.
 * @param {string} html - HTML content to transform
 * @param {string|undefined} baseUrl - Base URL of the site
 * @returns {string} HTML with transformed links
 */
export function transformMarkdownLinks(html, baseUrl) {
  return html.replace(/href="([^"]*?)\.md(#[^"]*)?"/g, (match, path, hash) => {
    if (isExternalLink(`${path}.md`, baseUrl)) return match;
    return `href="${rewriteMarkdownPath(path, hash || "")}"`;
  });
}

/**
 * Transform internal markdown-syntax links from .md references to directory-style URLs.
 * External links (different host than baseUrl) are left untouched.
 * @param {string} markdown - Markdown content to transform
 * @param {string|undefined} baseUrl - Base URL of the site
 * @returns {string} Markdown with transformed links
 */
export function transformMarkdownBodyLinks(markdown, baseUrl) {
  return markdown.replace(
    /\[([^\]]*)\]\(([^)]*?)\.md(#[^)]*)?\)/g,
    (match, text, path, hash) => {
      if (isExternalLink(`${path}.md`, baseUrl)) return match;
      return `[${text}](${rewriteMarkdownPath(path, hash || "")})`;
    },
  );
}

/**
 * Generate table of contents from h2 headings
 * @param {string} html - HTML content to extract headings from
 * @returns {string} HTML list of ToC links
 */
export function generateToc(html) {
  const headings = Array.from(
    html.matchAll(/<h2 id="([^"]+)">([^<]+)<\/h2>/g),
    (m) => `<li><a href="#${m[1]}">${m[2]}</a></li>`,
  );
  return headings.length ? `<ul>${headings.join("\n")}</ul>` : "";
}

/**
 * Compute URL path from a markdown file's relative path.
 * Strips a trailing `index.md` segment, then folds the rest into `/path/`.
 * @param {string} mdFile - Relative path to markdown file
 * @returns {string} URL path (e.g. "/docs/pathway/")
 */
export function urlPathFromMdFile(mdFile) {
  const stripped = mdFile.replace(/(?:^|\/)index\.md$|\.md$/, "");
  return stripped ? `/${stripped}/` : "/";
}

/**
 * Build breadcrumb HTML for pages two or more levels deep
 * @param {string} urlPath - URL path of the current page
 * @param {Map<string, string>} pageTitles - Map of URL paths to page titles
 * @returns {string} Breadcrumb HTML or empty string
 */
export function buildBreadcrumbs(urlPath, pageTitles) {
  const segments = urlPath.split("/").filter(Boolean);
  if (segments.length < 2) return "";

  const breadcrumbLabel = (title) => {
    const colonIdx = title.indexOf(": ");
    return colonIdx !== -1 ? title.slice(colonIdx + 2) : title;
  };

  const parts = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const ancestorPath = "/" + segments.slice(0, i + 1).join("/") + "/";
    const title = pageTitles.get(ancestorPath) || segments[i];
    parts.push(`<a href="${ancestorPath}">${breadcrumbLabel(title)}</a>`);
  }

  const currentTitle = pageTitles.get(urlPath) || segments[segments.length - 1];
  parts.push(`<span>${breadcrumbLabel(currentTitle)}</span>`);

  return parts.join(" / ");
}

/**
 * Classify pages into Products / Documentation / Optional buckets
 * @param {Array<{urlPath: string}>} pages - Page inventory
 * @returns {Object<string, Array>}
 */
export function classifyPagesIntoSections(pages) {
  const sections = { Products: [], Documentation: [], Optional: [] };
  const productSlugs = new Set([
    "map",
    "pathway",
    "outpost",
    "guide",
    "landmark",
    "summit",
    "gear",
  ]);

  for (const page of pages) {
    const topSegment = page.urlPath.split("/").filter(Boolean)[0];
    if (page.urlPath.startsWith("/docs/")) {
      sections.Documentation.push(page);
    } else if (topSegment && productSlugs.has(topSegment)) {
      sections.Products.push(page);
    } else {
      sections.Optional.push(page);
    }
  }
  return sections;
}

/**
 * Insert page links after matching H2 headings
 * @param {string[]} lines - Original llms.txt lines
 * @param {Object<string, Array>} sections - Classified page buckets
 * @param {Function} linkLine - Formats a page as a markdown link line
 * @returns {string[]} Augmented lines
 */
export function insertSectionLinks(lines, sections, linkLine) {
  const output = [];
  for (const line of lines) {
    output.push(line);
    const h2Match = line.match(/^## (.+)$/);
    if (h2Match) {
      const pageList = sections[h2Match[1].trim()];
      if (pageList?.length) {
        output.push("");
        for (const page of pageList) {
          output.push(linkLine(page));
        }
      }
    }
  }
  return output;
}

/**
 * Build hero section template variables from front matter
 * @param {object} frontMatter - Parsed front matter
 * @returns {object} Hero-related template variables
 */
export function buildHeroVars(frontMatter) {
  const hero = frontMatter.hero;
  const heroCta =
    hero?.cta?.map((item) => ({
      ...item,
      btnClass: item.secondary ? "btn-secondary" : "btn-primary",
    })) || [];

  return {
    hasHero: !!hero,
    heroImage: hero?.image || "",
    heroAlt: hero?.alt || "",
    heroTitle: hero?.title || frontMatter.title,
    heroSubtitle: hero?.subtitle || frontMatter.description || "",
    heroCta,
    hasHeroCta: heroCta.length > 0,
  };
}
