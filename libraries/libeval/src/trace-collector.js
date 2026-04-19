/**
 * Collects Claude Code stream-json NDJSON events into structured traces.
 *
 * Accepts one NDJSON line at a time via addLine(), then produces either a
 * structured JSON trace (toJSON) or human-readable text (toText).
 *
 * Human text rendering is delegated to the pure modules under `./render/`
 * so the live `TeeWriter` stream and the offline `toText()` replay share
 * one formatting path (spec 540).
 */

import {
  renderTextLine,
  renderToolCallLine,
  renderToolResultLine,
} from "./render/line-renderer.js";
import { hintForCall, previewForResult } from "./render/tool-hints.js";
import { isSuppressedOrchestratorEvent } from "./render/orchestrator-filter.js";

export class TraceCollector {
  /**
   * @param {object} [deps]
   * @param {function} [deps.now] - Returns ISO timestamp string. Defaults to () => new Date().toISOString()
   */
  constructor(deps = {}) {
    /** @type {function} */
    this.now = deps.now ?? (() => new Date().toISOString());
    /** @type {object|null} */
    this.metadata = null;
    /** @type {Array<object>} */
    this.turns = [];
    /** @type {object|null} */
    this.result = null;
    /** @type {number} */
    this.turnIndex = 0;
  }

  /**
   * Parse one NDJSON line and accumulate state.
   * Malformed lines are silently skipped.
   * @param {string} line - A single JSON line from stream-json output
   */
  addLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return;

    let event;
    try {
      event = JSON.parse(trimmed);
    } catch {
      return;
    }

    // Unwrap combined supervised trace format {source, seq, event}. The
    // Supervisor / Facilitator emits this wrapper; when replayed through
    // addLine the inner event is the one we care about. Carry the envelope
    // `source` onto each new turn so the renderer can color it correctly.
    let source = null;
    if (event.event && !event.type && typeof event.source === "string") {
      source = event.source;
      event = event.event;
    }

    // Orchestrator lifecycle events carry no content and are suppressed
    // from turns entirely — the NDJSON artifact keeps them separately.
    if (source === "orchestrator" && isSuppressedOrchestratorEvent(event)) {
      return;
    }

    switch (event.type) {
      case "system":
        this.handleSystem(event);
        break;
      case "assistant":
        this.handleAssistant(event, source);
        break;
      case "user":
        this.handleUser(event, source);
        break;
      case "result":
        this.handleResult(event);
        break;
      default:
        break;
    }
  }

  /**
   * @param {object} event
   */
  handleSystem(event) {
    if (event.subtype === "init") {
      this.metadata = {
        timestamp: event.timestamp ?? this.now(),
        sessionId: event.session_id ?? null,
        model: event.model ?? null,
        claudeCodeVersion: event.claude_code_version ?? null,
        tools: event.tools ?? [],
        permissionMode: event.permissionMode ?? null,
      };
    }
  }

  /**
   * @param {object} event
   * @param {string|null} source
   */
  handleAssistant(event, source) {
    const message = event.message;
    if (!message) return;

    const content = (message.content ?? []).map((block) => {
      if (block.type === "text") {
        return { type: "text", text: block.text };
      }
      if (block.type === "tool_use") {
        return {
          type: "tool_use",
          toolUseId: block.id ?? null,
          name: block.name,
          input: block.input,
        };
      }
      return block;
    });

    const usage = message.usage
      ? {
          inputTokens: message.usage.input_tokens ?? 0,
          outputTokens: message.usage.output_tokens ?? 0,
          cacheReadInputTokens: message.usage.cache_read_input_tokens ?? 0,
          cacheCreationInputTokens:
            message.usage.cache_creation_input_tokens ?? 0,
        }
      : null;

    this.turns.push({
      index: this.turnIndex++,
      role: "assistant",
      source,
      content,
      usage,
    });
  }

  /**
   * @param {object} event
   * @param {string|null} source
   */
  handleUser(event, source) {
    const message = event.message;
    if (!message) return;

    const contentItems = message.content;
    if (!Array.isArray(contentItems)) return;

    for (const item of contentItems) {
      if (item.type === "tool_result") {
        this.turns.push({
          index: this.turnIndex++,
          role: "tool_result",
          source,
          toolUseId: item.tool_use_id ?? null,
          content:
            typeof item.content === "string"
              ? item.content
              : JSON.stringify(item.content),
          isError: item.is_error ?? false,
        });
      }
    }
  }

  /**
   * @param {object} event
   */
  handleResult(event) {
    this.result = {
      result: event.subtype ?? "unknown",
      isError: event.is_error ?? false,
      totalCostUsd: event.total_cost_usd ?? 0,
      durationMs: event.duration_ms ?? 0,
      numTurns: event.num_turns ?? 0,
      tokenUsage: event.usage
        ? {
            inputTokens: event.usage.input_tokens ?? 0,
            outputTokens: event.usage.output_tokens ?? 0,
            cacheReadInputTokens: event.usage.cache_read_input_tokens ?? 0,
            cacheCreationInputTokens:
              event.usage.cache_creation_input_tokens ?? 0,
          }
        : null,
      modelUsage: event.modelUsage ?? null,
    };
  }

  /**
   * Return a structured trace object for offline analysis.
   * @returns {object} Structured trace document
   */
  toJSON() {
    return {
      version: "1.0.0",
      metadata: this.metadata ?? {
        timestamp: this.now(),
        sessionId: null,
        model: null,
        claudeCodeVersion: null,
        tools: [],
        permissionMode: null,
      },
      turns: this.turns,
      summary: this.result ?? {
        result: "unknown",
        isError: false,
        totalCostUsd: 0,
        durationMs: 0,
        numTurns: 0,
        tokenUsage: null,
        modelUsage: null,
      },
    };
  }

  /**
   * Render the accumulated turns as human-readable text — the same path the
   * live `TeeWriter` stream uses, so `fit-eval output --format=text` over a
   * captured trace reproduces what the live workflow log showed.
   *
   * Source prefixes are emitted whenever at least one turn has a non-null
   * source (supervised / facilitated traces). A pure `run` trace has no
   * envelope, all turn sources are null, and the renderer drops the prefix.
   *
   * @returns {string} Formatted text output including ANSI escapes
   */
  toText() {
    const withPrefix = this.turns.some((t) => t.source);
    const out = [];

    for (const turn of this.turns) {
      if (turn.role === "assistant") {
        for (const block of turn.content) {
          if (block.type === "text") {
            out.push(
              renderTextLine({
                source: turn.source,
                text: block.text,
                withPrefix,
              }),
            );
          } else if (block.type === "tool_use") {
            out.push(
              renderToolCallLine({
                source: turn.source,
                toolName: block.name,
                hint: hintForCall(block.name, block.input),
                withPrefix,
              }),
            );
          }
        }
      } else if (turn.role === "tool_result") {
        out.push(
          renderToolResultLine({
            source: turn.source,
            preview: previewForResult(turn.content, turn.isError),
            withPrefix,
          }),
        );
      }
    }

    // Trailing result block — the one summary line humans want (spec 540).
    let tail = "";
    if (this.result) {
      const duration = formatDuration(this.result.durationMs);
      const cost = Number(this.result.totalCostUsd).toFixed(4);
      tail =
        "\n" +
        `--- Result: ${this.result.result} | Turns: ${this.result.numTurns} | Cost: $${cost} | Duration: ${duration} ---`;
    }

    // Each rendered line already ends with `\n`; concatenate, drop the
    // trailing newline, then append the tail so the output shape stays
    // compatible with existing consumers (no double-blank line before
    // the result footer when there are turns, no leading blank when there
    // are not).
    const body = out.join("").replace(/\n$/, "");
    return body + tail;
  }
}

/**
 * Format milliseconds into a human-readable duration.
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Factory function for TraceCollector.
 * @param {object} [deps]
 * @param {function} [deps.now] - Returns ISO timestamp string
 * @returns {TraceCollector}
 */
export function createTraceCollector(deps) {
  return new TraceCollector(deps);
}
