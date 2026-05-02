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
   * Render a summary block. The block is suppressed when LOG_LEVEL=error and
   * the caller reports success (`ok: true`); a failing run still prints so
   * the user sees the diagnostic context regardless of verbosity.
   *
   * @param {object}   params
   * @param {string}   params.title       Block title (rendered as the first line).
   * @param {Array<{label: string, description: string}>} params.items  Rows.
   * @param {boolean}  params.ok          Whether the run this summary describes succeeded.
   * @param {{ write: (s: string) => void }} [stream]  Defaults to process.stdout.
   */
  render({ title, items, ok }, stream = this.#proc.stdout) {
    if (typeof ok !== "boolean") {
      throw new TypeError(
        "SummaryRenderer.render requires an explicit `ok` boolean",
      );
    }
    if (ok && this.#level <= LEVELS.error) return;

    stream.write(title + "\n");
    if (!items || items.length === 0) return;

    const maxLabel = Math.max(...items.map((item) => item.label.length));
    for (const item of items) {
      stream.write(`  ${item.label.padEnd(maxLabel)}  — ${item.description}\n`);
    }
  }
}
