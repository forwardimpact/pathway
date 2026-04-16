/**
 * Query engine for structured trace documents produced by TraceCollector.
 *
 * Loads a structured JSON trace into memory and provides methods for
 * paging, searching, filtering, and summarizing turns — the operations
 * agents need to analyze large traces efficiently.
 */
export class TraceQuery {
  /**
   * @param {object} trace - Structured trace document (output of TraceCollector.toJSON())
   */
  constructor(trace) {
    this.trace = trace;
    this.metadata = trace.metadata ?? {};
    this.turns = trace.turns ?? [];
    this.summary = trace.summary ?? {};
  }

  /**
   * High-level overview: metadata, summary, turn count, and tool frequency.
   * @returns {object}
   */
  overview() {
    return {
      metadata: this.metadata,
      summary: this.summary,
      turnCount: this.turns.length,
      tools: this.toolFrequency(),
    };
  }

  /** @returns {number} */
  count() {
    return this.turns.length;
  }

  /**
   * Return turns in range [from, to) (zero-indexed).
   * @param {number} from
   * @param {number} to
   * @returns {object[]}
   */
  batch(from, to) {
    return this.turns.slice(from, to);
  }

  /**
   * First N turns.
   * @param {number} [n=10]
   * @returns {object[]}
   */
  head(n = 10) {
    return this.turns.slice(0, n);
  }

  /**
   * Last N turns.
   * @param {number} [n=10]
   * @returns {object[]}
   */
  tail(n = 10) {
    return this.turns.slice(-n);
  }

  /**
   * Search all turn content for a regex pattern.  Returns matching turns
   * with the matched text highlighted by context.
   *
   * Searches: assistant text blocks, tool_use names and stringified input,
   * and tool_result content.
   *
   * @param {string} pattern - Regex pattern (case-insensitive)
   * @param {object} [opts]
   * @param {number} [opts.context=0] - Number of surrounding turns to include
   * @param {number} [opts.limit=50] - Max results
   * @returns {object[]} Array of {turn, matches, context?}
   */
  search(pattern, opts = {}) {
    const { context = 0, limit = 50 } = opts;
    // eslint-disable-next-line security/detect-non-literal-regexp -- pattern is caller-controlled, not untrusted input
    const re = new RegExp(pattern, "gi");
    const hits = [];

    for (const turn of this.turns) {
      const matches = matchTurn(turn, re);
      if (matches.length > 0) {
        const entry = { turn, matches };
        if (context > 0) {
          const idx = turn.index;
          entry.context = this.turns.filter(
            (t) =>
              t.index !== idx &&
              t.index >= idx - context &&
              t.index <= idx + context,
          );
        }
        hits.push(entry);
        if (hits.length >= limit) break;
      }
    }
    return hits;
  }

  /**
   * Tool usage frequency, sorted descending.
   * @returns {Array<{tool: string, count: number}>}
   */
  toolFrequency() {
    const counts = {};
    for (const turn of this.turns) {
      if (turn.role !== "assistant") continue;
      for (const block of turn.content) {
        if (block.type === "tool_use") {
          counts[block.name] = (counts[block.name] ?? 0) + 1;
        }
      }
    }
    return Object.entries(counts)
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Filter turns involving a specific tool (both the tool_use and its result).
   * @param {string} name - Tool name
   * @returns {object[]}
   */
  tool(name) {
    const toolUseIds = new Set();
    const results = [];

    for (const turn of this.turns) {
      if (turn.role === "assistant") {
        const hasTool = turn.content.some(
          (b) => b.type === "tool_use" && b.name === name,
        );
        if (hasTool) {
          results.push(turn);
          for (const b of turn.content) {
            if (b.type === "tool_use" && b.name === name && b.toolUseId) {
              toolUseIds.add(b.toolUseId);
            }
          }
        }
      } else if (
        turn.role === "tool_result" &&
        toolUseIds.has(turn.toolUseId)
      ) {
        results.push(turn);
      }
    }
    return results;
  }

  /**
   * All error turns (tool results with isError=true).
   * @returns {object[]}
   */
  errors() {
    return this.turns.filter(
      (t) => t.role === "tool_result" && t.isError === true,
    );
  }

  /**
   * Extract just the reasoning text from assistant turns.
   * @param {object} [opts]
   * @param {number} [opts.from] - Start turn index
   * @param {number} [opts.to] - End turn index (exclusive)
   * @returns {Array<{index: number, text: string}>}
   */
  reasoning(opts = {}) {
    const { from, to } = opts;
    const results = [];
    for (const turn of this.turns) {
      if (turn.role !== "assistant") continue;
      if (from !== undefined && turn.index < from) continue;
      if (to !== undefined && turn.index >= to) continue;
      const texts = turn.content
        .filter((b) => b.type === "text")
        .map((b) => b.text);
      if (texts.length > 0) {
        results.push({ index: turn.index, text: texts.join("\n") });
      }
    }
    return results;
  }

  /**
   * Compact one-line-per-assistant-turn timeline showing tool names,
   * reasoning snippet, and token usage.  Thinking-only turns are marked
   * as such and their content is omitted (it is model-internal).
   * @returns {string[]}
   */
  timeline() {
    const lines = [];
    for (const turn of this.turns) {
      if (turn.role !== "assistant") continue;

      const tools = turn.content
        .filter((b) => b.type === "tool_use")
        .map((b) => b.name);

      const textBlocks = turn.content
        .filter((b) => b.type === "text")
        .map((b) => b.text);

      const hasThinking = turn.content.some((b) => b.type === "thinking");

      // Skip thinking-only turns (no user-visible content).
      if (hasThinking && tools.length === 0 && textBlocks.length === 0)
        continue;

      const snippet = textBlocks.join(" ").slice(0, 80).replace(/\n/g, " ");

      const input = turn.usage?.inputTokens ?? 0;
      const output = turn.usage?.outputTokens ?? 0;
      const cacheRead = turn.usage?.cacheReadInputTokens ?? 0;

      const toolStr = tools.length > 0 ? tools.join(", ") : "(text only)";
      const tokenStr = `in:${fmtK(input + cacheRead)} out:${fmtK(output)}`;

      lines.push(
        `[${turn.index}] ${toolStr.padEnd(30)} ${tokenStr.padEnd(18)} ${snippet}`,
      );
    }
    return lines;
  }

  /**
   * Token usage and cost breakdown per assistant turn, plus totals.
   * @returns {object}
   */
  stats() {
    let totalInput = 0;
    let totalOutput = 0;
    let totalCacheRead = 0;
    let totalCacheCreate = 0;
    const perTurn = [];

    for (const turn of this.turns) {
      if (turn.role !== "assistant" || !turn.usage) continue;
      const u = turn.usage;
      totalInput += u.inputTokens ?? 0;
      totalOutput += u.outputTokens ?? 0;
      totalCacheRead += u.cacheReadInputTokens ?? 0;
      totalCacheCreate += u.cacheCreationInputTokens ?? 0;

      perTurn.push({
        index: turn.index,
        inputTokens: u.inputTokens ?? 0,
        outputTokens: u.outputTokens ?? 0,
        cacheReadInputTokens: u.cacheReadInputTokens ?? 0,
        cacheCreationInputTokens: u.cacheCreationInputTokens ?? 0,
      });
    }

    return {
      totals: {
        inputTokens: totalInput,
        outputTokens: totalOutput,
        cacheReadInputTokens: totalCacheRead,
        cacheCreationInputTokens: totalCacheCreate,
        totalCostUsd: this.summary.totalCostUsd ?? 0,
        durationMs: this.summary.durationMs ?? 0,
      },
      perTurn,
    };
  }
}

/**
 * Search a single turn for regex matches. Returns array of match descriptions.
 * @param {object} turn
 * @param {RegExp} re
 * @returns {string[]}
 */
function matchTurn(turn, re) {
  const matches = [];
  if (turn.role === "assistant") {
    for (const block of turn.content) {
      if (block.type === "text" && re.test(block.text)) {
        re.lastIndex = 0;
        matches.push(`text: ${excerptAround(block.text, re)}`);
      }
      if (block.type === "tool_use") {
        if (re.test(block.name)) {
          re.lastIndex = 0;
          matches.push(`tool_name: ${block.name}`);
        }
        const inputStr = JSON.stringify(block.input);
        if (re.test(inputStr)) {
          re.lastIndex = 0;
          matches.push(
            `tool_input(${block.name}): ${excerptAround(inputStr, re)}`,
          );
        }
      }
    }
  } else if (turn.role === "tool_result") {
    const content = turn.content ?? "";
    if (re.test(content)) {
      re.lastIndex = 0;
      matches.push(`result: ${excerptAround(content, re)}`);
    }
  }
  return matches;
}

/**
 * Extract a short excerpt around the first regex match in text.
 * @param {string} text
 * @param {RegExp} re
 * @returns {string}
 */
function excerptAround(text, re) {
  re.lastIndex = 0;
  const m = re.exec(text);
  if (!m) return text.slice(0, 100);
  const start = Math.max(0, m.index - 40);
  const end = Math.min(text.length, m.index + m[0].length + 40);
  let excerpt = text.slice(start, end);
  if (start > 0) excerpt = "..." + excerpt;
  if (end < text.length) excerpt = excerpt + "...";
  return excerpt;
}

/**
 * Format a token count as compact K notation.
 * @param {number} n
 * @returns {string}
 */
function fmtK(n) {
  if (n < 1000) return String(n);
  return (n / 1000).toFixed(1) + "K";
}

/**
 * Load a structured trace from a JSON string.
 * @param {string} json
 * @returns {TraceQuery}
 */
export function createTraceQuery(json) {
  const trace = typeof json === "string" ? JSON.parse(json) : json;
  return new TraceQuery(trace);
}
