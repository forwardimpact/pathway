import { urlPathFromMdFile } from "./transforms.js";

export const defaultRegistry = {
  card: (meta, href) =>
    `<a href="${href}">\n<h3>${meta.title}</h3>\n<p>${meta.description}</p>\n</a>`,
  link: (meta, href) => `<a href="${href}">${meta.title}</a>`,
};

const PARTIAL_RE = /<!--\s*part:(\w+):([\w./-]+)\s*-->/g;

/**
 * Replace <!-- part:type:path --> markers with HTML from the registry
 * @param {string} markdown - Markdown content
 * @param {import("./page-tree.js").PageTree} pageTree
 * @param {string} currentPageDir - Directory of the current page (relative to pagesDir)
 * @param {Record<string, (meta: import("./page-tree.js").PageMeta, href: string) => string>} registry
 * @param {{ path: object }} deps
 * @returns {string}
 */
export function resolvePartials(
  markdown,
  pageTree,
  currentPageDir,
  registry,
  { path },
) {
  return markdown.replace(PARTIAL_RE, (_match, type, partialPath) => {
    if (!registry[type]) {
      throw new Error(
        `Unknown partial type "${type}" in ${currentPageDir}/index.md`,
      );
    }

    const resolved = path.normalize(path.join(currentPageDir, partialPath));
    const urlPath = urlPathFromMdFile(resolved + "/index.md");
    const meta = pageTree.get(urlPath);

    if (!meta) {
      throw new Error(
        `Partial target "${partialPath}" not found in page tree (referenced from ${currentPageDir}/index.md)`,
      );
    }

    const currentUrlDir = urlPathFromMdFile(currentPageDir + "/index.md");
    const targetUrlDir = urlPath;
    const fromDir = currentUrlDir.replace(/\/$/, "");
    const toDir = targetUrlDir.replace(/\/$/, "");
    let href = path.relative(fromDir, toDir);
    if (!href.endsWith("/")) href += "/";

    return registry[type](meta, href);
  });
}
