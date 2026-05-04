import { colorize, colors } from "./color.js";

/**
 * Format a header (bold + cyan)
 * @param {string} text
 * @param {object} proc
 * @returns {string}
 */
export function formatHeader(text, proc = process) {
  return colorize(text, colors.bold + colors.cyan, proc);
}

/**
 * Format a subheader (bold)
 * @param {string} text
 * @param {object} proc
 * @returns {string}
 */
export function formatSubheader(text, proc = process) {
  return colorize(text, colors.bold, proc);
}

/**
 * Format a list item with label and value
 * @param {string} label
 * @param {string} value
 * @param {number} indent
 * @param {object} proc
 * @returns {string}
 */
export function formatListItem(label, value, indent = 0, proc = process) {
  const padding = "  ".repeat(indent);
  const bullet = colorize("\u2022", colors.dim, proc);
  return `${padding}${bullet} ${label}: ${value}`;
}

/**
 * Format a bullet item (no label)
 * @param {string} text
 * @param {number} indent
 * @param {object} proc
 * @returns {string}
 */
export function formatBullet(text, indent = 0, proc = process) {
  const padding = "  ".repeat(indent);
  const bullet = colorize("\u2022", colors.dim, proc);
  return `${padding}${bullet} ${text}`;
}

/**
 * Format a table with aligned columns
 * @param {string[]} headers
 * @param {Array<Array<string|number>>} rows
 * @param {Object} options
 * @param {boolean} [options.compact=false]
 * @param {object} proc
 * @returns {string}
 */
export function formatTable(headers, rows, options = {}, proc = process) {
  const { compact = false } = options;

  const widths = headers.map((h, i) =>
    Math.max(String(h).length, ...rows.map((r) => String(r[i] || "").length)),
  );

  const lines = [];

  const headerLine = headers
    .map((h, i) => String(h).padEnd(widths[i]))
    .join("  ");
  lines.push(colorize(headerLine, colors.bold, proc));

  if (!compact) {
    lines.push(widths.map((w) => "\u2500".repeat(w)).join("\u2500\u2500"));
  }

  for (const row of rows) {
    lines.push(
      row.map((cell, i) => String(cell || "").padEnd(widths[i])).join("  "),
    );
  }

  return lines.join("\n");
}

/**
 * Prefix the message with "Error: " and colorize red.
 * @param {string} message
 * @param {object} proc
 * @returns {string}
 */
export function formatError(message, proc = process) {
  return colorize(`Error: ${message}`, colors.red, proc);
}

/**
 * Format a success message
 * @param {string} message
 * @param {object} proc
 * @returns {string}
 */
export function formatSuccess(message, proc = process) {
  return colorize(message, colors.green, proc);
}

/**
 * Prefix the message with "Warning: " and colorize yellow.
 * @param {string} message
 * @param {object} proc
 * @returns {string}
 */
export function formatWarning(message, proc = process) {
  return colorize(`Warning: ${message}`, colors.yellow, proc);
}

/**
 * Create a horizontal rule
 * @param {number} width
 * @param {object} proc
 * @returns {string}
 */
export function horizontalRule(width = 60, proc = process) {
  return colorize("\u2500".repeat(width), colors.dim, proc);
}

/**
 * Format a section with title and content
 * @param {string} title
 * @param {string} content
 * @param {object} proc
 * @returns {string}
 */
export function formatSection(title, content, proc = process) {
  return `${formatHeader(title, proc)}\n\n${content}`;
}

/**
 * Indent all lines of text
 * @param {string} text
 * @param {number} spaces
 * @returns {string}
 */
export function indent(text, spaces = 2) {
  const padding = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => padding + line)
    .join("\n");
}
