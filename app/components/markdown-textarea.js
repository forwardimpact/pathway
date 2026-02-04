/**
 * Markdown Textarea Component
 *
 * Reusable read-only code display with syntax highlighting and copy buttons.
 * Used by job descriptions, skill implementation patterns, agent profiles, and agent skills.
 */

/* global Prism */
import { div, p, button } from "../lib/render.js";

/**
 * Create a copy button that copies content to clipboard
 * @param {string} content - The text content to copy
 * @param {string} label - Button label text
 * @param {string} [className="btn btn-primary"] - Button class
 * @returns {HTMLElement}
 */
export function createCopyButton(
  content,
  label = "📋 Copy",
  className = "btn btn-primary",
) {
  const btn = button(
    {
      className: `${className} copy-btn`,
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(content);
          btn.textContent = btn.textContent.includes("📋")
            ? "✓ Copied"
            : "✓ Copied!";
          btn.classList.add("copied");
          setTimeout(() => {
            btn.textContent = label;
            btn.classList.remove("copied");
          }, 2000);
        } catch (err) {
          console.error("Failed to copy:", err);
          btn.textContent = "Copy failed";
          setTimeout(() => {
            btn.textContent = label;
          }, 2000);
        }
      },
    },
    label,
  );
  return btn;
}

/**
 * Create a copy button that copies HTML to clipboard (for rich text pasting)
 * @param {string} html - The HTML content to copy
 * @param {string} label - Button label text
 * @returns {HTMLElement}
 */
export function createCopyHtmlButton(html, label) {
  const btn = button(
    {
      className: "btn btn-secondary copy-btn",
      onClick: async () => {
        try {
          const blob = new Blob([html], { type: "text/html" });
          const clipboardItem = new ClipboardItem({ "text/html": blob });
          await navigator.clipboard.write([clipboardItem]);
          btn.textContent = "✓ Copied!";
          btn.classList.add("copied");
          setTimeout(() => {
            btn.textContent = label;
            btn.classList.remove("copied");
          }, 2000);
        } catch (err) {
          console.error("Failed to copy:", err);
          btn.textContent = "Copy failed";
          setTimeout(() => {
            btn.textContent = label;
          }, 2000);
        }
      },
    },
    label,
  );
  return btn;
}

/**
 * Create a code display with syntax highlighting and copy buttons
 * @param {Object} options
 * @param {string} options.content - The content to display (markdown, code, or plain text)
 * @param {string} [options.markdown] - Alias for content (backwards compatibility)
 * @param {string} [options.language="markdown"] - Language for syntax highlighting (markdown, plaintext, etc.)
 * @param {string} [options.description] - Optional description text above the display
 * @param {string} [options.filename] - Optional filename to show in header
 * @param {string} [options.copyLabel="Copy Markdown"] - Label for the copy button
 * @param {Function} [options.toHtml] - Optional function to convert markdown to HTML for rich copy
 * @param {string} [options.copyHtmlLabel="Copy as HTML"] - Label for the HTML copy button
 * @param {number} [options.minHeight=300] - Minimum height in pixels
 * @param {string} [options.className] - Additional CSS class for container
 * @returns {HTMLElement}
 */
export function createMarkdownTextarea({
  content,
  markdown, // Backwards compatibility
  language = "markdown",
  description,
  filename,
  copyLabel = "Copy Markdown",
  toHtml,
  copyHtmlLabel = "Copy as HTML",
  minHeight = 300,
  className = "",
}) {
  // Support both content and markdown parameters
  const displayContent = content || markdown;

  // Create highlighted code block
  const pre = document.createElement("pre");
  pre.className = "markdown-display";
  pre.style.minHeight = `${minHeight}px`;

  const code = document.createElement("code");
  code.className = `language-${language}`;
  code.textContent = displayContent;
  pre.appendChild(code);

  // Apply Prism highlighting if available
  if (typeof Prism !== "undefined") {
    Prism.highlightElement(code);
  }

  const buttons = [createCopyButton(displayContent, copyLabel)];
  if (toHtml) {
    buttons.push(createCopyHtmlButton(toHtml(displayContent), copyHtmlLabel));
  }

  // Build header content
  const headerContent = [];
  if (filename) {
    headerContent.push(p({ className: "filename" }, filename));
  }
  if (description) {
    headerContent.push(p({ className: "text-muted" }, description));
  }
  headerContent.push(div({ className: "button-group" }, ...buttons));

  return div(
    { className: `markdown-textarea-container ${className}`.trim() },
    div({ className: "markdown-textarea-header" }, ...headerContent),
    pre,
  );
}
