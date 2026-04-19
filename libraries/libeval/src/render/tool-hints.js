/**
 * Tool hints — pure one-line formatters for tool-call arguments and
 * tool-result previews.
 *
 * `hintForCall(name, input)` renders the human-meaningful field for each
 * tool (file path, command, pattern, …) sanitized to strip JSON punctuation
 * (`{`, `}`, `"`) and collapsed to a single line ≤ 80 chars.
 *
 * `previewForResult(content, isError)` collapses a tool result to a single
 * line ≤ 80 chars and flags errors so the renderer can apply the reserved
 * error color and the `Error:` label.
 */

const MAX_HINT_CHARS = 80;

/**
 * Strip `{`, `}`, `"`, collapse whitespace, and truncate to MAX_HINT_CHARS.
 * First line only — anything past a newline is dropped. Always returns a
 * string, never null/undefined.
 * @param {unknown} raw
 * @returns {string}
 */
function sanitize(raw) {
  if (raw === null || raw === undefined) return "";
  const str = String(raw);
  const firstLine = str.split(/\r?\n/)[0] ?? "";
  const stripped = firstLine.replace(/[{}"]/g, "");
  const collapsed = stripped.replace(/\s+/g, " ").trim();
  if (collapsed.length <= MAX_HINT_CHARS) return collapsed;
  return collapsed.slice(0, MAX_HINT_CHARS - 3) + "...";
}

/**
 * Truncate an already-sanitized string to MAX_HINT_CHARS with a trailing
 * ellipsis when it overflows. Shared by the few handlers that concatenate
 * multiple sanitized pieces before deciding on truncation.
 * @param {string} str
 * @returns {string}
 */
function truncate(str) {
  return str.length <= MAX_HINT_CHARS
    ? str
    : str.slice(0, MAX_HINT_CHARS - 3) + "...";
}

/**
 * Per-tool hint handlers. Each entry takes the sanitized input object
 * (never null) and returns the hint string. Kept as a flat table so adding
 * a new tool is one entry, not a new branch in a growing switch.
 */
const HINT_HANDLERS = {
  Bash: (i) => sanitize(i.command),
  Read: (i) => sanitize(i.file_path),
  Write: (i) => sanitize(i.file_path),
  Edit: (i) => {
    const base = sanitize(i.file_path);
    return i.replace_all
      ? (base + " (replace_all)").slice(0, MAX_HINT_CHARS)
      : base;
  },
  Glob: (i) => sanitize(i.pattern),
  Grep: (i) => {
    const pattern = sanitize(i.pattern);
    return i.path ? truncate(`${pattern} in ${sanitize(i.path)}`) : pattern;
  },
  WebFetch: (i) => sanitize(i.url),
  WebSearch: (i) => sanitize(i.query),
  ToolSearch: (i) => sanitize(i.query),
  TodoWrite: (i) => {
    const count = Array.isArray(i.todos) ? i.todos.length : 0;
    return `${count} todos`;
  },
  NotebookEdit: (i) => sanitize(i.notebook_path),
  Skill: (i) => sanitize(i.skill),
  Agent: (i) => sanitize(i.prompt ?? i.description),
  Task: (i) => sanitize(i.prompt ?? i.description),
};

/**
 * MCP-prefixed tool names (e.g. `mcp__orchestration__Tell`) take a different
 * handler path: strip the prefix, then optionally decorate with `to/from`.
 * Returns null if the name does not match any MCP prefix.
 * @param {string} name
 * @param {object} input
 * @returns {string|null}
 */
function hintForMcp(name, input) {
  if (name.startsWith("mcp__orchestration__")) {
    const method = name.slice("mcp__orchestration__".length);
    const parts = [method];
    if (input.to) parts.push(`to ${sanitize(input.to)}`);
    if (input.from) parts.push(`from ${sanitize(input.from)}`);
    return truncate(parts.join(" "));
  }
  if (name.startsWith("mcp__github__")) {
    return name.slice("mcp__github__".length);
  }
  return null;
}

/**
 * Map a tool name and input to a one-line human hint.
 *
 * Unknown tools return an empty hint — the caller still shows the tool
 * name, just without extra detail. Sanitization is uniform: every branch
 * ends with `sanitize`, so the output is guaranteed free of `{`, `}`, `"`
 * from the input object (success criterion #2).
 *
 * @param {string} name - Tool name (e.g. "Bash", "Read", "mcp__orchestration__Tell")
 * @param {object|null|undefined} input - Raw tool input object from the trace
 * @returns {string} One-line hint, or "" when no rule matches
 */
export function hintForCall(name, input) {
  if (!name) return "";
  const safeInput = input && typeof input === "object" ? input : {};

  const handler = HINT_HANDLERS[name];
  if (handler) return handler(safeInput);

  const mcp = hintForMcp(name, safeInput);
  if (mcp !== null) return mcp;

  return "";
}

/**
 * Render a tool result as a single preview line plus an `isError` flag.
 * The flag lets the line-renderer pick the reserved error color without
 * re-inspecting the content.
 *
 * @param {string|object|null|undefined} content - Tool result content
 * @param {boolean} isError - Whether the tool call failed
 * @returns {{text: string, isError: boolean}}
 */
export function previewForResult(content, isError) {
  const normalized =
    content === null || content === undefined
      ? ""
      : typeof content === "string"
        ? content
        : JSON.stringify(content);
  const lines = normalized.split(/\r?\n/);
  let firstNonBlank = "";
  for (const line of lines) {
    if (line.trim().length > 0) {
      firstNonBlank = line.trim();
      break;
    }
  }

  if (isError) {
    const body = firstNonBlank || "(no output)";
    return {
      text:
        body.length <= MAX_HINT_CHARS
          ? body
          : body.slice(0, MAX_HINT_CHARS - 3) + "...",
      isError: true,
    };
  }

  if (!firstNonBlank) return { text: "(ok)", isError: false };
  return {
    text:
      firstNonBlank.length <= MAX_HINT_CHARS
        ? firstNonBlank
        : firstNonBlank.slice(0, MAX_HINT_CHARS - 3) + "...",
    isError: false,
  };
}
