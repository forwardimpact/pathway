/**
 * Numeric severity per syslog ordering. Mirrors the LOG_LEVEL contract used
 * by libtelemetry. Inlined here so libcli stays free of telemetry deps.
 */
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3, trace: 3 };
const DEFAULT_LEVEL = "info";

export class SummaryRenderer {
  #proc;
  #level;

  constructor({ process }) {
    this.#proc = process;
    const raw = (process.env?.LOG_LEVEL || "").toLowerCase().trim();
    this.#level = LEVELS[raw] ?? LEVELS[DEFAULT_LEVEL];
  }

  /**
   * Whether a block describing a run with the given `ok` would be rendered
   * under the current LOG_LEVEL. Centralizes the suppression rule so callers
   * that need to gate richer output (tables, multi-line blocks) on the same
   * policy don't need to reimplement the level check.
   *
   * @param {boolean} ok
   * @returns {boolean}
   */
  shouldRender(ok) {
    if (typeof ok !== "boolean") {
      throw new TypeError(
        "SummaryRenderer.shouldRender requires an explicit `ok` boolean",
      );
    }
    return !(ok && this.#level <= LEVELS.error);
  }

  /**
   * Render a summary block. A block is **atomic, including its top margin**:
   * `render` prepends a single blank line before the title so blocks visually
   * separate from preceding output, and the whole unit (margin + title + items
   * + extras) is suppressed together when LOG_LEVEL=error and the caller
   * reports success (`ok: true`). A failing run still prints so the user sees
   * the diagnostic context regardless of verbosity.
   *
   * Because the margin is owned by the block, callers MUST NOT print their own
   * `\n` before `render`. Doing so leaks a stray blank line when the block is
   * suppressed, and double-spaces it when the block renders.
   *
   * @param {object}   params
   * @param {string}   params.title       Block title (rendered after the leading blank line).
   * @param {Array<{label: string, description: string}>} params.items  Rows.
   * @param {boolean}  params.ok          Whether the run this summary describes succeeded.
   * @param {string}   [params.extras]    Free-form content rendered after items. Subject to the same suppression as the rest of the block.
   * @param {{ write: (s: string) => void }} [stream]  Defaults to process.stdout.
   */
  render({ title, items, ok, extras }, stream = this.#proc.stdout) {
    if (!this.shouldRender(ok)) return;

    stream.write("\n" + title + "\n");

    if (items && items.length > 0) {
      const maxLabel = Math.max(...items.map((item) => item.label.length));
      for (const item of items) {
        stream.write(
          `  ${item.label.padEnd(maxLabel)}  — ${item.description}\n`,
        );
      }
    }

    if (extras) {
      stream.write(extras.endsWith("\n") ? extras : extras + "\n");
    }
  }
}
