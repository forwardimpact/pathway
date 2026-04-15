/**
 * Facilitator — orchestrates multi-agent concurrent sessions with tool-based
 * communication. Manages N agent sessions and one facilitator LLM session,
 * communicating through OrchestrationToolkit primitives and the MessageBus.
 *
 * Follows OO+DI: constructor injection, factory function, tests bypass factory.
 */

import { Writable } from "node:stream";
import { createAgentRunner } from "./agent-runner.js";
import { SequenceCounter } from "./sequence-counter.js";
import { createMessageBus } from "./message-bus.js";
import {
  createOrchestrationContext,
  createFacilitatorToolServer,
  createFacilitatedAgentToolServer,
} from "./orchestration-toolkit.js";

/** System prompt appended for the facilitator runner. */
export const FACILITATOR_SYSTEM_PROMPT =
  "You coordinate multiple agents working on a shared task. " +
  "Tell sends a direct message to one participant. " +
  "Share broadcasts a message to all participants. " +
  "Redirect interrupts a participant and replaces their current instructions. " +
  "RollCall lists available participants and their roles. " +
  "Conclude ends the session with a summary. " +
  "Participants communicate with you via Share and may Ask you questions.";

/** System prompt appended for facilitated agent runners. */
export const FACILITATED_AGENT_SYSTEM_PROMPT =
  "You are one of several agents working on a shared task under a " +
  "facilitator's coordination. " +
  "Share broadcasts your message to all participants. " +
  "Tell sends a direct message to one participant. " +
  "Ask sends a question to the facilitator — you block until answered. " +
  "RollCall lists available participants and their roles. " +
  "The facilitator may Redirect you with new instructions " +
  "— treat redirections as authoritative.";

function createAsyncQueue() {
  const items = [];
  let waiter = null;
  let closed = false;
  return {
    enqueue(item) {
      items.push(item);
      if (waiter) {
        waiter();
        waiter = null;
      }
    },
    async dequeue() {
      if (items.length > 0) return items.shift();
      if (closed) return null;
      await new Promise((resolve) => {
        waiter = resolve;
      });
      return items.length > 0 ? items.shift() : null;
    },
    close() {
      closed = true;
      if (waiter) {
        waiter();
        waiter = null;
      }
    },
  };
}

export class Facilitator {
  /**
   * @param {object} deps
   * @param {import("./agent-runner.js").AgentRunner} deps.facilitatorRunner
   * @param {Array<{name: string, role: string, runner: import("./agent-runner.js").AgentRunner}>} deps.agents
   * @param {import("./message-bus.js").MessageBus} deps.messageBus
   * @param {import("stream").Writable} deps.output
   * @param {number} [deps.maxTurns]
   * @param {object} [deps.ctx]
   * @param {object} [deps.eventQueue]
   */
  constructor({
    facilitatorRunner,
    agents,
    messageBus,
    output,
    maxTurns,
    ctx,
    eventQueue,
  }) {
    this.facilitatorRunner = facilitatorRunner;
    this.agents = agents;
    this.messageBus = messageBus;
    this.output = output;
    this.maxTurns = maxTurns ?? 20;
    this.ctx = ctx ?? createOrchestrationContext();
    this.counter = new SequenceCounter();
    this.eventQueue = eventQueue ?? createAsyncQueue();
    this.facilitatorTurns = 0;

    let resolve;
    const promise = new Promise((r) => {
      resolve = r;
    });
    this.concludePromise = promise;
    this.concludeResolve = resolve;
  }

  /**
   * Run the full facilitated session.
   * @param {string} task
   * @returns {Promise<{success: boolean, turns: number}>}
   */
  async run(task) {
    this.emitOrchestratorEvent({ type: "session_start" });

    // Turn 0: facilitator receives the task
    this.facilitatorTurns++;
    await this.facilitatorRunner.run(task);

    if (this.ctx.concluded) {
      this.concludeResolve();
      this.emitSummary({ success: true, turns: 0, summary: this.ctx.summary });
      return { success: true, turns: 0 };
    }

    // Handle redirect after turn 0
    await this.#processRedirect();

    // Abort agents promptly when Conclude is called
    this.concludePromise.then(() => {
      for (const agent of this.agents) {
        agent.runner.currentAbortController?.abort();
      }
    });

    // Launch all loops concurrently
    const agentPromises = this.agents.map((a) => this.#runAgent(a));
    const facilitatorPromise = this.#facilitatorLoop();

    try {
      await Promise.all([...agentPromises, facilitatorPromise]);
    } catch (err) {
      for (const agent of this.agents) {
        agent.runner.currentAbortController?.abort();
      }
      this.facilitatorRunner.currentAbortController?.abort();
      throw err;
    }

    const result = {
      success: this.ctx.concluded,
      turns: this.facilitatorTurns,
    };
    this.emitSummary({
      success: result.success,
      turns: result.turns,
      summary: this.ctx.summary,
    });
    return result;
  }

  /**
   * Agent outer loop — waits for messages, runs/resumes the agent.
   * @param {{name: string, role: string, runner: import("./agent-runner.js").AgentRunner}} agent
   */
  async #runAgent(agent) {
    // Wait for first message (lazy start)
    await Promise.race([
      this.messageBus.waitForMessages(agent.name),
      this.concludePromise,
    ]);
    if (this.ctx.concluded) return;

    let messages = this.messageBus.drain(agent.name);
    if (messages.length === 0) return;

    this.emitOrchestratorEvent({
      type: "agent_start",
      agent: agent.name,
    });
    await agent.runner.run(this.#formatMessages(messages));
    if (this.ctx.concluded) return;
    this.eventQueue.enqueue({
      type: "lifecycle",
      agent: agent.name,
      status: "turn_complete",
    });

    // Loop: check for new messages, resume if any
    while (!this.ctx.concluded) {
      messages = this.messageBus.drain(agent.name);
      if (messages.length === 0) {
        await Promise.race([
          this.messageBus.waitForMessages(agent.name),
          this.concludePromise,
        ]);
        if (this.ctx.concluded) break;
        messages = this.messageBus.drain(agent.name);
        if (messages.length === 0) break;
      }
      await agent.runner.resume(this.#formatMessages(messages));
      if (this.ctx.concluded) break;
      this.eventQueue.enqueue({
        type: "lifecycle",
        agent: agent.name,
        status: "turn_complete",
      });
    }
  }

  /**
   * Facilitator event loop — only runs when input arrives.
   */
  async #facilitatorLoop() {
    while (!this.ctx.concluded) {
      const event = await this.eventQueue.dequeue();
      if (this.ctx.concluded || event === null) break;
      await this.#handleEvent(event);
    }
  }

  async #handleEvent(event) {
    switch (event.type) {
      case "ask": {
        if (this.ctx.concluded) {
          event.resolve("Session has concluded.");
          break;
        }
        this.facilitatorTurns++;
        this.emitOrchestratorEvent({
          type: "ask_received",
          from: event.from,
        });
        await this.facilitatorRunner.resume(
          `Agent "${event.from}" asks: "${event.question}"\nAnswer the question.`,
        );
        const answer = this.extractLastText(
          this.facilitatorRunner,
          "No answer.",
        );
        this.emitOrchestratorEvent({
          type: "ask_answered",
          from: event.from,
        });
        event.resolve(answer);
        await this.#processRedirect();
        break;
      }
      case "messages": {
        const msgs = this.messageBus.drain("facilitator");
        if (msgs.length === 0) break;
        this.facilitatorTurns++;
        await this.facilitatorRunner.resume(this.#formatMessages(msgs));
        await this.#processRedirect();
        break;
      }
      case "lifecycle": {
        // Check for pending shared messages for the facilitator
        const msgs = this.messageBus.drain("facilitator");
        if (msgs.length === 0) break;
        this.facilitatorTurns++;
        await this.facilitatorRunner.resume(this.#formatMessages(msgs));
        await this.#processRedirect();
        break;
      }
    }

    if (this.ctx.concluded) {
      this.concludeResolve();
      this.eventQueue.close();
    }
  }

  /**
   * Process a pending redirect after a facilitator turn.
   */
  async #processRedirect() {
    if (!this.ctx.redirect) return;
    const redirect = this.ctx.redirect;
    this.ctx.redirect = null;

    this.emitOrchestratorEvent({
      type: "redirect",
      to: redirect.to,
    });

    if (redirect.to === "all") {
      // Abort all agents and deliver redirect via broadcast
      for (const agent of this.agents) {
        agent.runner.currentAbortController?.abort();
      }
      this.messageBus.share("facilitator", redirect.message);
    } else if (redirect.to) {
      // Abort specific agent and deliver via direct message
      const target = this.agents.find((a) => a.name === redirect.to);
      if (target) {
        target.runner.currentAbortController?.abort();
      }
      this.messageBus.tell("facilitator", redirect.to, redirect.message);
    }
  }

  /**
   * Format messages for an agent prompt.
   * @param {Array<{from: string, text: string, direct: boolean}>} messages
   * @returns {string}
   */
  #formatMessages(messages) {
    return messages
      .map((m) => {
        const tag = m.direct ? "[direct]" : "[shared]";
        return `${tag} ${m.from}: ${m.text}`;
      })
      .join("\n");
  }

  /**
   * Extract the last assistant text block from a runner's buffer.
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
   * Emit a single NDJSON line tagged with source and seq.
   * @param {string} source - Participant name
   * @param {string} line - Raw NDJSON line
   */
  emitLine(source, line) {
    const event = JSON.parse(line);
    this.output.write(
      JSON.stringify({
        source,
        seq: this.counter.next(),
        event,
      }) + "\n",
    );
  }

  /**
   * @param {{type: string}} event
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
   * @param {{success: boolean, turns: number, summary?: string}} result
   */
  emitSummary(result) {
    this.output.write(
      JSON.stringify({
        source: "orchestrator",
        seq: this.counter.next(),
        event: {
          type: "summary",
          success: result.success,
          turns: result.turns,
          ...(result.summary && { summary: result.summary }),
        },
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
 * Factory function — wires all participants with MCP servers.
 * @param {object} deps
 * @param {string} deps.facilitatorCwd
 * @param {Array<{name: string, role: string, cwd?: string, maxTurns?: number, allowedTools?: string[], agentProfile?: string}>} deps.agentConfigs
 * @param {function} deps.query
 * @param {import("stream").Writable} deps.output
 * @param {string} [deps.model]
 * @param {number} [deps.maxTurns]
 * @param {string} [deps.facilitatorProfile]
 * @returns {Facilitator}
 */
export function createFacilitator({
  facilitatorCwd,
  agentConfigs,
  query,
  output,
  model,
  maxTurns,
  facilitatorProfile,
}) {
  const ctx = createOrchestrationContext();
  const messageBus = createMessageBus({
    participants: ["facilitator", ...agentConfigs.map((a) => a.name)],
  });
  ctx.messageBus = messageBus;
  ctx.participants = [
    { name: "facilitator", role: "facilitator" },
    ...agentConfigs.map((a) => ({ name: a.name, role: a.role })),
  ];

  let facilitator;

  const eventQueue = createAsyncQueue();

  const facilitatorServer = createFacilitatorToolServer(ctx);

  const agents = agentConfigs.map((config) => {
    const agentServer = createFacilitatedAgentToolServer(ctx, {
      from: config.name,
      onAsk: async (question) => {
        let resolve;
        const promise = new Promise((r) => {
          resolve = r;
        });
        eventQueue.enqueue({
          type: "ask",
          from: config.name,
          question,
          resolve,
        });
        return promise;
      },
    });

    const runner = createAgentRunner({
      cwd: config.cwd ?? facilitatorCwd,
      query,
      output: devNull,
      model,
      maxTurns: config.maxTurns ?? 50,
      allowedTools: config.allowedTools,
      onLine: (line) => facilitator.emitLine(config.name, line),
      mcpServers: { orchestration: agentServer },
      settingSources: ["project"],
      agentProfile: config.agentProfile,
      systemPrompt: {
        type: "preset",
        preset: "claude_code",
        append: FACILITATED_AGENT_SYSTEM_PROMPT,
      },
    });

    return { name: config.name, role: config.role, runner };
  });

  const facilitatorRunner = createAgentRunner({
    cwd: facilitatorCwd,
    query,
    output: devNull,
    model,
    maxTurns: maxTurns ?? 20,
    onLine: (line) => facilitator.emitLine("facilitator", line),
    mcpServers: { orchestration: facilitatorServer },
    settingSources: ["project"],
    agentProfile: facilitatorProfile,
    systemPrompt: {
      type: "preset",
      preset: "claude_code",
      append: FACILITATOR_SYSTEM_PROMPT,
    },
  });

  facilitator = new Facilitator({
    facilitatorRunner,
    agents,
    messageBus,
    output,
    maxTurns,
    ctx,
    eventQueue,
  });
  return facilitator;
}
