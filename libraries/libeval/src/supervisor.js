/**
 * Supervisor — orchestrates a relay loop between an agent and a supervisor,
 * both running as AgentRunner instances. The supervisor receives the task first,
 * introduces itself, and delegates work to the agent. The loop then alternates:
 * agent → supervisor → agent.
 *
 * Signaling uses orchestration tools (Conclude, Redirect, Ask) via in-process
 * MCP servers. No text-token detection.
 *
 * Follows OO+DI: constructor injection, factory function, tests bypass factory.
 */

import { Writable } from "node:stream";
import { createAgentRunner } from "./agent-runner.js";
import { TraceCollector } from "./trace-collector.js";
import { SequenceCounter } from "./sequence-counter.js";
import {
  createOrchestrationContext,
  createSupervisorToolServer,
  createSupervisedAgentToolServer,
} from "./orchestration-toolkit.js";

/** System prompt appended for the supervisor runner in supervise mode. */
export const SUPERVISOR_SYSTEM_PROMPT =
  "You relay messages to one persistent agent session — your only output " +
  "channel. Spawning sub-agents or restarting the agent is blocked. Do not " +
  "do the work yourself. Reply briefly to let the agent continue. Use your " +
  "Redirect tool to interrupt and correct the agent. Use your Conclude tool " +
  "with a summary when the task is fully done. Only your final message each " +
  "turn is relayed.";

/** System prompt appended for the agent runner in supervise mode. */
export const AGENT_SYSTEM_PROMPT =
  "A supervisor watches your work and may interrupt with new instructions " +
  "mid-task. Treat any new prompt as authoritative and adjust course. " +
  "When uncertain, use your Ask tool to ask the supervisor a clarifying " +
  "question — you will receive a direct answer.";

/**
 * Maximum number of mid-turn interventions allowed within a single agent turn.
 * Bounded so a looping supervisor exhausts its quota fast (observability) but
 * leaves headroom for legitimate "intervene, observe, intervene again" patterns.
 * The outer maxTurns budget still bounds overall runtime.
 */
const MAX_INTERVENTIONS_PER_TURN = 5;

export class Supervisor {
  /**
   * @param {object} deps
   * @param {import("./agent-runner.js").AgentRunner} deps.agentRunner - Runs the agent sessions
   * @param {import("./agent-runner.js").AgentRunner} deps.supervisorRunner - Runs the supervisor sessions
   * @param {import("stream").Writable} deps.output - Stream to emit tagged NDJSON to
   * @param {number} [deps.maxTurns] - Maximum supervisor ↔ agent exchanges
   * @param {object} [deps.ctx] - Orchestration context (injected by factory)
   */
  constructor({ agentRunner, supervisorRunner, output, maxTurns, ctx }) {
    if (!agentRunner) throw new Error("agentRunner is required");
    if (!supervisorRunner) throw new Error("supervisorRunner is required");
    if (!output) throw new Error("output is required");
    this.agentRunner = agentRunner;
    this.supervisorRunner = supervisorRunner;
    this.output = output;
    this.maxTurns = maxTurns ?? 100;
    this.ctx = ctx ?? createOrchestrationContext();
    this.counter = new SequenceCounter();
    /** @type {"agent"|"supervisor"} */
    this.currentSource = "agent";
    /** @type {number} */
    this.currentTurn = 0;
  }

  /**
   * Run the supervisor ↔ agent relay loop.
   * @param {string} task - The initial task for the supervisor
   * @returns {Promise<{success: boolean, turns: number}>}
   */
  async run(task) {
    this.currentSource = "supervisor";
    this.currentTurn = 0;
    let supervisorResult = await this.supervisorRunner.run(task);

    if (supervisorResult.error) {
      this.emitSummary({ success: false, turns: 0 });
      return { success: false, turns: 0 };
    }

    if (this.ctx.concluded) {
      this.emitSummary({ success: true, turns: 0, summary: this.ctx.summary });
      return { success: true, turns: 0 };
    }

    let pendingRelay = null;
    const turnLimit = this.maxTurns === 0 ? Infinity : this.maxTurns;
    for (let turn = 1; turn <= turnLimit; turn++) {
      const relay =
        pendingRelay ??
        this.extractLastText(this.supervisorRunner, supervisorResult.text);

      const turnOutcome = await this.#runAgentTurn(turn, relay);
      if (turnOutcome.exit) return turnOutcome.exit;

      const reviewOutcome = await this.#endOfTurnReview(turn);
      if (reviewOutcome.exit) return reviewOutcome.exit;
      supervisorResult = reviewOutcome.supervisorResult;
      pendingRelay = reviewOutcome.relay ?? null;
    }

    this.emitSummary({ success: false, turns: this.maxTurns });
    return { success: false, turns: this.maxTurns };
  }

  /**
   * Drive the agent through one turn, allowing the supervisor to interrupt
   * via the Redirect tool. Returns either an `exit` outcome (the loop should
   * return immediately) or `{exit: null}` (proceed to end-of-turn review).
   * @param {number} turn
   * @param {string} initialRelay
   * @returns {Promise<{exit: {success: boolean, turns: number}|null}>}
   */
  async #runAgentTurn(turn, initialRelay) {
    let relay = initialRelay;
    let interventions = 0;

    this.agentRunner.onBatch = (batchLines, ctx) =>
      this.#midTurnReview(turn, batchLines, ctx);

    try {
      while (true) {
        this.currentSource = "agent";
        this.currentTurn = turn;
        const isFirstAgentCall = turn === 1 && interventions === 0;
        const agentResult = isFirstAgentCall
          ? await this.agentRunner.run(relay)
          : await this.agentRunner.resume(relay);

        if (agentResult.error && !agentResult.aborted) {
          this.emitSummary({ success: false, turns: turn });
          return { exit: { success: false, turns: turn } };
        }

        if (this.ctx.concluded) {
          this.emitSummary({
            success: true,
            turns: turn,
            summary: this.ctx.summary,
          });
          return { exit: { success: true, turns: turn } };
        }

        if (agentResult.aborted && this.ctx.redirect) {
          interventions++;
          const redirect = this.ctx.redirect;
          this.ctx.redirect = null;
          if (interventions >= MAX_INTERVENTIONS_PER_TURN) {
            this.emitOrchestratorEvent({ type: "intervention_limit", turn });
            return { exit: null };
          }
          relay = redirect.message;
          this.emitOrchestratorEvent({ type: "intervention_relayed", turn });
          continue;
        }

        return { exit: null };
      }
    } finally {
      this.agentRunner.onBatch = null;
    }
  }

  /**
   * Mid-turn supervisor review fired from inside the agent's onBatch hook.
   * Runs the supervisor's LLM against the batch and aborts the agent if
   * the supervisor calls Redirect or Conclude.
   * @param {number} turn
   * @param {string[]} batchLines
   * @param {{abort: () => void}} ctx
   */
  async #midTurnReview(turn, batchLines, { abort }) {
    const batchTranscript = this.renderBatch(batchLines);
    this.emitOrchestratorEvent({ type: "mid_turn_review", turn });

    this.currentSource = "supervisor";
    this.ctx.redirect = null;

    await this.supervisorRunner.resume(
      `The agent is mid-turn. Latest batch:\n\n${batchTranscript}\n\n` +
        `Review and use your tools if action is needed.`,
    );
    this.currentSource = "agent";

    if (this.ctx.redirect) {
      this.emitOrchestratorEvent({ type: "intervention_requested", turn });
      abort();
      return;
    }
    if (this.ctx.concluded) {
      this.emitOrchestratorEvent({ type: "complete_requested", turn });
      abort();
    }
  }

  /**
   * End-of-turn supervisor review. Returns either an exit outcome (error or
   * completion) or the supervisor result so the outer loop can build the
   * next turn's relay.
   * @param {number} turn
   * @returns {Promise<{exit: {success: boolean, turns: number}|null, supervisorResult?: object, relay?: string}>}
   */
  async #endOfTurnReview(turn) {
    const agentTranscript = this.extractTranscript(this.agentRunner);
    this.currentSource = "supervisor";
    this.currentTurn = turn;
    this.ctx.redirect = null;

    const supervisorResult = await this.supervisorRunner.resume(
      `The agent reported:\n\n${agentTranscript}\n\nReview the agent's work and decide how to proceed.`,
    );

    if (supervisorResult.error) {
      this.emitSummary({ success: false, turns: turn });
      return { exit: { success: false, turns: turn } };
    }

    if (this.ctx.concluded) {
      this.emitSummary({
        success: true,
        turns: turn,
        summary: this.ctx.summary,
      });
      return { exit: { success: true, turns: turn } };
    }

    if (this.ctx.redirect) {
      const redirect = this.ctx.redirect;
      this.ctx.redirect = null;
      return { exit: null, supervisorResult, relay: redirect.message };
    }

    return { exit: null, supervisorResult };
  }

  /**
   * Extract a human-readable transcript from an AgentRunner's buffered output.
   * @param {import("./agent-runner.js").AgentRunner} runner
   * @returns {string}
   */
  extractTranscript(runner) {
    const lines = runner.drainOutput();
    const collector = new TraceCollector();
    for (const line of lines) {
      collector.addLine(line);
    }
    return collector.toText() || "[The agent produced no output.]";
  }

  /**
   * Extract only the last assistant text block from an AgentRunner's buffer.
   * @param {import("./agent-runner.js").AgentRunner} runner
   * @param {string} fallback
   * @returns {string}
   */
  extractLastText(runner, fallback) {
    const lines = runner.buffer;
    for (let i = lines.length - 1; i >= 0; i--) {
      const event = JSON.parse(lines[i]);
      if (event.type !== "assistant") continue;
      const content = event.message?.content ?? event.content;
      if (!Array.isArray(content)) continue;
      for (let j = content.length - 1; j >= 0; j--) {
        if (content[j].type === "text" && content[j].text) {
          return content[j].text;
        }
      }
    }
    return fallback;
  }

  /**
   * Emit a single NDJSON line tagged with the current source and seq.
   * @param {string} line - Raw NDJSON line from the runner
   */
  emitLine(line) {
    const event = JSON.parse(line);
    const tagged = {
      source: this.currentSource,
      seq: this.counter.next(),
      event,
    };
    this.output.write(JSON.stringify(tagged) + "\n");
  }

  /**
   * Render a batch of buffered NDJSON lines as human-readable text.
   * @param {string[]} batchLines
   * @returns {string}
   */
  renderBatch(batchLines) {
    if (batchLines.length === 0) return "[empty]";
    const collector = new TraceCollector();
    for (const line of batchLines) {
      collector.addLine(line);
    }
    return collector.toText() || "[empty]";
  }

  /**
   * Emit an orchestrator-source NDJSON line.
   * @param {{type: string, turn?: number}} event
   */
  emitOrchestratorEvent(event) {
    this.output.write(
      JSON.stringify({
        source: "orchestrator",
        seq: this.counter.next(),
        event,
      }) + "\n",
    );
  }

  /**
   * Emit a final orchestrator summary line.
   * @param {{success: boolean, turns: number, summary?: string}} result
   */
  emitSummary(result) {
    this.output.write(
      JSON.stringify({
        source: "orchestrator",
        type: "summary",
        success: result.success,
        turns: result.turns,
        ...(result.summary && { summary: result.summary }),
      }) + "\n",
    );
  }
}

const devNull = new Writable({
  write(_chunk, _enc, cb) {
    cb();
  },
});

/**
 * Factory function — wires both AgentRunners with their respective configs.
 * @param {object} deps
 * @param {string} deps.supervisorCwd
 * @param {string} deps.agentCwd
 * @param {function} deps.query
 * @param {import("stream").Writable} deps.output
 * @param {string} [deps.model]
 * @param {number} [deps.maxTurns]
 * @param {string[]} [deps.allowedTools]
 * @param {string[]} [deps.supervisorAllowedTools]
 * @param {string[]} [deps.supervisorDisallowedTools]
 * @param {string} [deps.supervisorProfile]
 * @param {string} [deps.agentProfile]
 * @returns {Supervisor}
 */
export function createSupervisor({
  supervisorCwd,
  agentCwd,
  query,
  output,
  model,
  maxTurns,
  allowedTools,
  supervisorDisallowedTools,
  supervisorAllowedTools,
  supervisorProfile,
  agentProfile,
}) {
  let supervisor;
  let supervisorRunner;

  const ctx = createOrchestrationContext();

  const supervisorServer = createSupervisorToolServer(ctx);
  const agentServer = createSupervisedAgentToolServer(ctx, {
    onAsk: async (question) => {
      supervisor.currentSource = "supervisor";
      supervisor.emitOrchestratorEvent({ type: "ask_received" });
      await supervisorRunner.resume(
        `The agent asks: "${question}"\n\nAnswer the question directly.`,
      );
      supervisor.currentSource = "agent";
      supervisor.emitOrchestratorEvent({ type: "ask_answered" });
      return supervisor.extractLastText(supervisorRunner, "No answer.");
    },
  });

  const onLine = (line) => supervisor.emitLine(line);

  const agentRunner = createAgentRunner({
    cwd: agentCwd,
    query,
    output: devNull,
    model,
    maxTurns: 50,
    allowedTools,
    onLine,
    settingSources: ["project"],
    agentProfile,
    systemPrompt: {
      type: "preset",
      preset: "claude_code",
      append: AGENT_SYSTEM_PROMPT,
    },
    mcpServers: { orchestration: agentServer },
  });

  const defaultDisallowed = ["Agent", "Task", "TaskOutput", "TaskStop"];
  const disallowedTools = supervisorDisallowedTools
    ? [...new Set([...defaultDisallowed, ...supervisorDisallowedTools])]
    : defaultDisallowed;

  supervisorRunner = createAgentRunner({
    cwd: supervisorCwd,
    query,
    output: devNull,
    model,
    maxTurns: 20,
    allowedTools: supervisorAllowedTools ?? [
      "Bash",
      "Read",
      "Glob",
      "Grep",
      "Write",
      "Edit",
    ],
    disallowedTools,
    onLine,
    settingSources: ["project"],
    agentProfile: supervisorProfile,
    systemPrompt: {
      type: "preset",
      preset: "claude_code",
      append: SUPERVISOR_SYSTEM_PROMPT,
    },
    mcpServers: { orchestration: supervisorServer },
  });

  supervisor = new Supervisor({
    agentRunner,
    supervisorRunner,
    output,
    maxTurns,
    ctx,
  });
  return supervisor;
}
