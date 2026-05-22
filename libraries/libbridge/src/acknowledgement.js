import { ProgressTicker } from "./progress-ticker.js";

const DEFAULT_TICKER_INTERVAL_MS = 25_000;

/**
 * Channel-agnostic acknowledgement lifecycle. The host service injects two
 * adapters; libbridge owns the *when*, the adapter owns the *how*:
 *
 *   reactionAdapter.add(target) -> reactionId | null
 *   reactionAdapter.remove(reactionId, target) -> void
 *   tickerAdapter.tick(target, n) -> void          // optional
 *
 * `start(token, target)` immediately adds the reaction and, if a ticker
 * adapter is supplied, starts a ProgressTicker that calls `tick(target, n)`
 * every `tickerIntervalMs` (default 25s). `finish(token, target)` stops the
 * ticker and removes the reaction.
 *
 * Errors from adapter calls are logged (via the optional logger) but never
 * thrown — a missing reaction or a failed tick must not block the
 * dispatch or the reply. Ticker rejections auto-stop the ticker
 * (inherited from ProgressTicker).
 */
export class Acknowledgement {
  #reactionAdapter;
  #tickerAdapter;
  #ticker;
  #logger;
  #state = new Map();

  /**
   * @param {object} options
   * @param {{add: Function, remove: Function}} options.reactionAdapter
   * @param {{tick: Function}} [options.tickerAdapter]
   * @param {number} [options.tickerIntervalMs]
   * @param {import("./progress-ticker.js").ProgressTicker} [options.progressTicker]
   * @param {{warn?: Function, error?: Function}} [options.logger]
   */
  constructor({
    reactionAdapter,
    tickerAdapter,
    tickerIntervalMs,
    progressTicker,
    logger,
  } = {}) {
    if (
      !reactionAdapter ||
      typeof reactionAdapter.add !== "function" ||
      typeof reactionAdapter.remove !== "function"
    ) {
      throw new Error("reactionAdapter must implement add() and remove()");
    }
    if (tickerAdapter && typeof tickerAdapter.tick !== "function") {
      throw new Error("tickerAdapter must implement tick()");
    }
    this.#reactionAdapter = reactionAdapter;
    this.#tickerAdapter = tickerAdapter ?? null;
    this.#ticker =
      progressTicker ??
      new ProgressTicker({
        intervalMs: tickerIntervalMs ?? DEFAULT_TICKER_INTERVAL_MS,
      });
    this.#logger = logger ?? null;
  }

  /**
   * Begin acknowledging the dispatch identified by `token`. Idempotent on the
   * same token — a second start is a no-op (the original timer keeps
   * running, the original reaction stays attached).
   * @param {string} token
   * @param {unknown} target
   */
  async start(token, target) {
    if (this.#state.has(token)) return;
    let reactionId = null;
    try {
      reactionId = (await this.#reactionAdapter.add(target)) ?? null;
    } catch (err) {
      this.#logger?.warn?.("acknowledgement.add", err);
    }
    this.#state.set(token, { reactionId, target });
    if (this.#tickerAdapter) {
      let n = 0;
      const adapter = this.#tickerAdapter;
      const logger = this.#logger;
      this.#ticker.start(token, async () => {
        n++;
        try {
          await adapter.tick(target, n);
        } catch (err) {
          logger?.warn?.("acknowledgement.tick", err);
          throw err;
        }
      });
    }
  }

  /**
   * Stop acknowledging the dispatch identified by `token`. No-op if the
   * token has no active acknowledgement.
   * @param {string} token
   * @param {unknown} [target]
   */
  async finish(token, target) {
    const entry = this.#state.get(token);
    if (!entry) return;
    this.#ticker.stop(token);
    this.#state.delete(token);
    try {
      await this.#reactionAdapter.remove(
        entry.reactionId,
        target ?? entry.target,
      );
    } catch (err) {
      this.#logger?.warn?.("acknowledgement.remove", err);
    }
  }

  /** @param {string} token @returns {boolean} */
  pending(token) {
    return this.#state.has(token);
  }
}
