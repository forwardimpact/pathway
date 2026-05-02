import { gfmHeadingId } from "marked-gfm-heading-id";
import { markedHighlight } from "marked-highlight";
import { createLogger } from "@forwardimpact/libtelemetry";

const logger = createLogger("libdoc");

/**
 * Documentation builder for converting Markdown files to HTML
 */
export class DocsBuilder {
  #fs;
  #path;
  #marked;
  #matter;
  #mustacheRender;
  #prettier;

  /**
   * Creates a new DocsBuilder instance
   * @param {object} fs - File system module
   * @param {object} path - Path module
   * @param {Function} markedParser - Marked parser function
   * @param {Function} matterParser - Front matter parser function
   * @param {Function} mustacheRender - Mustache render function
   * @param {object} prettier - Prettier module for HTML formatting
   */
  constructor(fs, path, markedParser, matterParser, mustacheRender, prettier) {
    if (!fs) throw new Error("fs is required");
    if (!path) throw new Error("path is required");
    if (!markedParser) throw new Error("markedParser is required");
    if (!matterParser) throw new Error("matterParser is required");
    if (!mustacheRender) throw new Error("mustacheRender is required");
    if (!prettier) throw new Error("prettier is required");

    this.#fs = fs;
    this.#path = path;
    this.#marked = markedParser;
    this.#matter = matterParser;
    this.#mustacheRender = mustacheRender;
    this.#prettier = prettier;

    // Configure marked with extensions
    this.#marked.use(
      gfmHeadingId({
        prefix: "", // No prefix for heading IDs
      }),
    );

    this.#marked.use(
      markedHighlight({
        langPrefix: "language-", // Adds 'language-' prefix to code block classes
        highlight(code, _lang) {
          // Return the code as-is with proper language class
          // Prism.js will handle highlighting on the client side
          return code;
        },
      }),
    );
  }

  /**
   * Decide whether a link points outside the site being built.
   * Relative links and absolute links matching baseUrl's host are internal.
   * @param {string} url - Link target
   * @param {string|undefined} baseUrl - Base URL of the site
   * @returns {boolean}
   */
  #isExternalLink(url, baseUrl) {
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
  #rewriteMarkdownPath(path, fragment) {
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
  #transformMarkdownLinks(html, baseUrl) {
    return html.replace(
      /href="([^"]*?)\.md(#[^"]*)?"/g,
      (match, path, hash) => {
        if (this.#isExternalLink(`${path}.md`, baseUrl)) return match;
        return `href="${this.#rewriteMarkdownPath(path, hash || "")}"`;
      },
    );
  }

  /**
   * Transform internal markdown-syntax links from .md references to directory-style URLs.
   * External links (different host than baseUrl) are left untouched.
   * @param {string} markdown - Markdown content to transform
   * @param {string|undefined} baseUrl - Base URL of the site
   * @returns {string} Markdown with transformed links
   */
  #transformMarkdownBodyLinks(markdown, baseUrl) {
    return markdown.replace(
      /\[([^\]]*)\]\(([^)]*?)\.md(#[^)]*)?\)/g,
      (match, text, path, hash) => {
        if (this.#isExternalLink(`${path}.md`, baseUrl)) return match;
        return `[${text}](${this.#rewriteMarkdownPath(path, hash || "")})`;
      },
    );
  }

  /**
   * Generate table of contents from h2 headings
   * @param {string} html - HTML content to extract headings from
   * @returns {string} HTML list of ToC links
   */
  #generateToc(html) {
    const headings = Array.from(
      html.matchAll(/<h2 id="([^"]+)">([^<]+)<\/h2>/g),
      (m) => `<li><a href="#${m[1]}">${m[2]}</a></li>`,
    );
    return headings.length ? `<ul>${headings.join("\n")}</ul>` : "";
  }

  /**
   * Copy directory recursively
   * @param {string} src - Source directory
   * @param {string} dest - Destination directory
   * @returns {boolean} True if directory was copied
   */
  #copyDir(src, dest) {
    if (!this.#fs.existsSync(src)) return false;

    this.#fs.mkdirSync(dest, { recursive: true });
    const entries = this.#fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = this.#path.join(src, entry.name);
      const destPath = this.#path.join(dest, entry.name);
      entry.isDirectory()
        ? this.#copyDir(srcPath, destPath)
        : this.#fs.copyFileSync(srcPath, destPath);
    }
    return true;
  }

  /**
   * Copy static assets to distribution directory
   * @param {string} docsDir - Source docs directory
   * @param {string} distDir - Destination distribution directory
   */
  #copyStaticAssets(docsDir, distDir) {
    // Copy assets directory (CSS, JS, images)
    if (
      this.#copyDir(
        this.#path.join(docsDir, "assets"),
        this.#path.join(distDir, "assets"),
      )
    ) {
      logger.info("  ✓ assets/");
    }

    // Copy root-level static files (robots.txt, llms.txt, etc.)
    const skipFiles = new Set(["index.template.html", "CNAME"]);
    this.#fs
      .readdirSync(docsDir, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isFile() &&
          !entry.name.endsWith(".md") &&
          !skipFiles.has(entry.name),
      )
      .forEach((entry) => {
        this.#fs.copyFileSync(
          this.#path.join(docsDir, entry.name),
          this.#path.join(distDir, entry.name),
        );
        logger.info(`  ✓ ${entry.name}`);
      });
  }

  /**
   * Compute URL path from a markdown file's relative path.
   * Strips a trailing `index.md` segment, then folds the rest into `/path/`.
   * @param {string} mdFile - Relative path to markdown file
   * @returns {string} URL path (e.g. "/docs/pathway/")
   */
  #urlPathFromMdFile(mdFile) {
    const stripped = mdFile.replace(/(?:^|\/)index\.md$|\.md$/, "");
    return stripped ? `/${stripped}/` : "/";
  }

  /**
   * Build breadcrumb HTML for pages two or more levels deep
   * @param {string} urlPath - URL path of the current page
   * @param {Map<string, string>} pageTitles - Map of URL paths to page titles
   * @returns {string} Breadcrumb HTML or empty string
   */
  #buildBreadcrumbs(urlPath, pageTitles) {
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

    const currentTitle =
      pageTitles.get(urlPath) || segments[segments.length - 1];
    parts.push(`<span>${breadcrumbLabel(currentTitle)}</span>`);

    return parts.join(" / ");
  }

  /**
   * Recursively find all Markdown files in a directory
   * @param {string} dir - Directory to search
   * @param {string} baseDir - Base directory for relative paths
   * @returns {string[]} Array of relative paths to Markdown files
   */
  #findMarkdownFiles(dir, baseDir = dir) {
    const results = [];
    const entries = this.#fs.readdirSync(dir);

    for (const entryName of entries) {
      if (["assets", "public"].includes(entryName)) continue;
      if (["CLAUDE.md", "SKILL.md"].includes(entryName)) continue;
      const fullPath = this.#path.join(dir, entryName);

      // Use statSync to check if it's a directory or file
      try {
        const stat = this.#fs.statSync(fullPath);
        if (stat.isDirectory && stat.isDirectory()) {
          results.push(...this.#findMarkdownFiles(fullPath, baseDir));
        } else if (entryName.endsWith(".md")) {
          // Get path relative to base directory
          const relativePath = fullPath.slice(baseDir.length + 1);
          results.push(relativePath);
        }
      } catch {
        // Skip files that can't be stat'd (e.g., template files)
        if (entryName.endsWith(".md")) {
          const relativePath = fullPath.slice(baseDir.length + 1);
          results.push(relativePath);
        }
      }
    }
    return results;
  }

  /**
   * Generate sitemap.xml from page inventory
   * @param {Array<{urlPath: string}>} pages - Sorted page inventory
   * @param {string} baseUrl - Base URL for the site
   * @param {string} distDir - Destination distribution directory
   */
  #generateSitemap(pages, baseUrl, distDir) {
    const urls = pages
      .map((p) => `  <url>\n    <loc>${baseUrl}${p.urlPath}</loc>\n  </url>`)
      .join("\n");
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      urls,
      "</urlset>",
      "",
    ].join("\n");
    this.#fs.writeFileSync(
      this.#path.join(distDir, "sitemap.xml"),
      xml,
      "utf-8",
    );
    logger.info("  ✓ sitemap.xml");
  }

  /**
   * Augment llms.txt with auto-generated page links under each H2 section
   * @param {Array<{urlPath: string, title: string, description: string}>} pages - Sorted page inventory
   * @param {string} baseUrl - Base URL for the site
   * @param {string} distDir - Destination distribution directory
   */
  #augmentLlmsTxt(pages, baseUrl, distDir) {
    const llmsPath = this.#path.join(distDir, "llms.txt");
    if (!this.#fs.existsSync(llmsPath)) return;

    const content = this.#fs.readFileSync(llmsPath, "utf-8");
    const lines = content.split("\n");

    // Map pages to sections
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

    const linkLine = (page) => {
      const mdUrl =
        page.urlPath === "/"
          ? `${baseUrl}/index.md`
          : `${baseUrl}${page.urlPath}index.md`;
      const desc = page.description ? `: ${page.description}` : "";
      return `- [${page.title}](${mdUrl})${desc}`;
    };

    // Reassemble: insert links after each H2
    const output = [];
    for (const line of lines) {
      output.push(line);
      const h2Match = line.match(/^## (.+)$/);
      if (h2Match) {
        const sectionName = h2Match[1].trim();
        const pageList = sections[sectionName];
        if (pageList?.length) {
          output.push("");
          for (const page of pageList) {
            output.push(linkLine(page));
          }
        }
      }
    }

    this.#fs.writeFileSync(llmsPath, output.join("\n"), "utf-8");
    logger.info("  ✓ llms.txt (augmented)");
  }

  /**
   * Resolve the base URL from an explicit value or CNAME file
   * @param {string|undefined} baseUrl - Explicit base URL
   * @param {string} docsDir - Source docs directory
   * @returns {string|undefined}
   */
  #resolveBaseUrl(baseUrl, docsDir) {
    if (baseUrl) return baseUrl;
    const cnamePath = this.#path.join(docsDir, "CNAME");
    if (this.#fs.existsSync(cnamePath)) {
      const hostname = this.#fs.readFileSync(cnamePath, "utf-8").trim();
      return `https://${hostname}`;
    }
    return undefined;
  }

  /**
   * Collect page titles from all markdown files (first pass)
   * @param {string[]} mdFiles - Relative paths to markdown files
   * @param {string} docsDir - Source docs directory
   * @returns {Map<string, string>}
   */
  #collectPageTitles(mdFiles, docsDir) {
    const pageTitles = new Map();
    for (const mdFile of mdFiles) {
      const { data } = this.#matter(
        this.#fs.readFileSync(this.#path.join(docsDir, mdFile), "utf-8"),
      );
      if (data.title) {
        pageTitles.set(this.#urlPathFromMdFile(mdFile), data.title);
      }
    }
    return pageTitles;
  }

  /**
   * Build hero section template variables from front matter
   * @param {object} frontMatter - Parsed front matter
   * @returns {object} Hero-related template variables
   */
  #buildHeroVars(frontMatter) {
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

  /**
   * Build template variables from front matter and rendered HTML
   * @param {object} frontMatter - Parsed front matter
   * @param {string} html - Rendered HTML content
   * @param {string} urlPath - URL path for this page
   * @param {Map<string, string>} pageTitles - Map of URL paths to page titles
   * @param {string|undefined} baseUrl - Base URL for canonical links
   * @returns {object} Mustache template variables
   */
  #buildTemplateVars(frontMatter, html, urlPath, pageTitles, baseUrl) {
    const toc = frontMatter.toc !== false ? this.#generateToc(html) : "";
    const breadcrumbs = this.#buildBreadcrumbs(urlPath, pageTitles);

    return {
      title: frontMatter.title,
      description: frontMatter.description || "",
      content: html,
      toc,
      hasToc: !!toc,
      layout: frontMatter.layout || "",
      ...this.#buildHeroVars(frontMatter),
      hasBreadcrumbs: !!breadcrumbs,
      breadcrumbs,
      markdownUrl: "index.md",
      canonicalUrl: baseUrl ? baseUrl + urlPath : "",
    };
  }

  /**
   * Compute output path and write HTML + companion Markdown files
   * @param {string} mdFile - Relative path to the markdown file
   * @param {string} distDir - Destination distribution directory
   * @param {string} finalHtml - Formatted HTML content
   * @param {string} companionContent - Companion Markdown content
   */
  #writePageFiles(mdFile, distDir, finalHtml, companionContent) {
    const baseName = mdFile.replace(".md", "");
    const isIndex = baseName === "index" || baseName.endsWith("/index");
    const outputPath = isIndex ? baseName : this.#path.join(baseName, "index");
    const outputDir = this.#path.dirname(this.#path.join(distDir, outputPath));

    this.#fs.mkdirSync(outputDir, { recursive: true });
    this.#fs.writeFileSync(
      this.#path.join(distDir, outputPath + ".html"),
      finalHtml,
      "utf-8",
    );
    logger.info(`  ✓ ${outputPath}.html`);

    this.#fs.writeFileSync(
      this.#path.join(distDir, outputPath + ".md"),
      companionContent,
      "utf-8",
    );
  }

  /**
   * Render a single markdown file to HTML and write output files
   * @param {string} mdFile - Relative path to the markdown file
   * @param {string} docsDir - Source docs directory
   * @param {string} distDir - Destination distribution directory
   * @param {string} template - HTML template string
   * @param {Map<string, string>} pageTitles - Map of URL paths to page titles
   * @param {string|undefined} baseUrl - Base URL for canonical links
   * @returns {Promise<{mdFile: string, urlPath: string, title: string, description: string}|null>}
   */
  async #renderPage(mdFile, docsDir, distDir, template, pageTitles, baseUrl) {
    const { data: frontMatter, content: markdown } = this.#matter(
      this.#fs.readFileSync(this.#path.join(docsDir, mdFile), "utf-8"),
    );

    if (!frontMatter.title) {
      console.error(`Error: Missing 'title' in front matter of ${mdFile}`);
      return null;
    }

    const rawHtml = this.#marked(markdown);
    const html = this.#transformMarkdownLinks(rawHtml, baseUrl);
    const urlPath = this.#urlPathFromMdFile(mdFile);
    const vars = this.#buildTemplateVars(
      frontMatter,
      html,
      urlPath,
      pageTitles,
      baseUrl,
    );
    const outputHtml = this.#mustacheRender(template, vars);
    const finalHtml = await this.#formatAndPostProcess(outputHtml);
    const companionContent = `# ${frontMatter.title}\n\n${this.#transformMarkdownBodyLinks(markdown, baseUrl)}`;

    this.#writePageFiles(mdFile, distDir, finalHtml, companionContent);

    return {
      mdFile,
      urlPath,
      title: frontMatter.title,
      description: frontMatter.description || "",
    };
  }

  /**
   * Format HTML with prettier and unescape Mermaid code blocks
   * @param {string} outputHtml - Raw HTML string
   * @returns {Promise<string>}
   */
  async #formatAndPostProcess(outputHtml) {
    const formattedHtml = await this.#prettier.format(outputHtml, {
      parser: "html",
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
    });

    const mermaidBlocks = formattedHtml.match(
      /<code class="language-mermaid">[\s\S]*?<\/code>/g,
    );
    if (!mermaidBlocks) return formattedHtml;

    return formattedHtml.replace(
      /<code class="language-mermaid">([\s\S]*?)<\/code>/g,
      (_match, code) => {
        const unescapedCode = code
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
        return `<code class="language-mermaid">${unescapedCode}</code>`;
      },
    );
  }

  /**
   * Build documentation from Markdown files
   * @param {string} docsDir - Source documentation directory
   * @param {string} distDir - Destination distribution directory
   * @param {string} [baseUrl] - Base URL for sitemap, canonical links, and llms.txt
   * @returns {Promise<void>}
   */
  async build(docsDir, distDir, baseUrl) {
    logger.info("Building documentation...");

    baseUrl = this.#resolveBaseUrl(baseUrl, docsDir);

    // Clean and create dist directory
    if (this.#fs.existsSync(distDir)) {
      this.#fs.rmSync(distDir, { recursive: true });
    }
    this.#fs.mkdirSync(distDir, { recursive: true });

    // Read and validate template
    const templatePath = this.#path.join(docsDir, "index.template.html");
    if (!this.#fs.existsSync(templatePath)) {
      throw new Error(`index.template.html not found in ${docsDir}`);
    }
    const template = this.#fs.readFileSync(templatePath, "utf-8");

    const mdFiles = this.#findMarkdownFiles(docsDir);

    if (mdFiles.length === 0) {
      console.warn(`Warning: No Markdown files found in ${docsDir}`);
    }

    const pageTitles = this.#collectPageTitles(mdFiles, docsDir);

    const pages = [];
    for (const mdFile of mdFiles) {
      const page = await this.#renderPage(
        mdFile,
        docsDir,
        distDir,
        template,
        pageTitles,
        baseUrl,
      );
      if (page) pages.push(page);
    }

    pages.sort((a, b) => a.urlPath.localeCompare(b.urlPath));

    this.#copyStaticAssets(docsDir, distDir);

    if (baseUrl) {
      this.#generateSitemap(pages, baseUrl, distDir);
      this.#augmentLlmsTxt(pages, baseUrl, distDir);
    }

    logger.info("Documentation build complete!");
  }
}
