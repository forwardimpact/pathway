/**
 * OrchestrationToolkit — tool schemas, per-role tool sets, and handler
 * factories for orchestration between supervisors, facilitators, and agents.
 *
 * Handlers communicate via a shared context object. The orchestrator reads
 * context at natural checkpoints (after resume(), after onBatch).
 */

import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

/**
 * Create a fresh orchestration context object.
 * @returns {object}
 */
export function createOrchestrationContext() {
  return {
    concluded: false,
    summary: null,
    redirect: null,
    participants: [],
    messageBus: null,
  };
}

// --- Handler factories ---

export function createConcludeHandler(ctx) {
  return async ({ summary }) => {
    ctx.concluded = true;
    ctx.summary = summary;
    return { content: [{ type: "text", text: "Session concluded." }] };
  };
}

export function createRedirectHandler(ctx) {
  return async ({ message, to }) => {
    ctx.redirect = { message, to: to ?? null };
    return { content: [{ type: "text", text: "Redirect queued." }] };
  };
}

export function createAskHandler(ctx, { onAsk }) {
  return async ({ question }) => {
    try {
      const answer = await onAsk(question);
      return { content: [{ type: "text", text: answer }] };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  };
}

export function createRollCallHandler(ctx) {
  return async () => {
    return {
      content: [{ type: "text", text: JSON.stringify(ctx.participants) }],
    };
  };
}

export function createShareHandler(ctx, { from }) {
  return async ({ message }) => {
    ctx.messageBus.share(from, message);
    return { content: [{ type: "text", text: "Message shared." }] };
  };
}

export function createTellHandler(ctx, { from }) {
  return async ({ message, to }) => {
    ctx.messageBus.tell(from, to, message);
    return { content: [{ type: "text", text: "Message sent." }] };
  };
}

// --- Per-role MCP server factories ---

/**
 * Supervisor tools: Conclude + Redirect.
 * @param {object} ctx - Orchestration context
 * @returns {object} MCP server config (type: "sdk")
 */
export function createSupervisorToolServer(ctx) {
  return createSdkMcpServer({
    name: "orchestration",
    tools: [
      tool(
        "Conclude",
        "Signal that the evaluation is done. Provide a summary.",
        { summary: z.string() },
        createConcludeHandler(ctx),
      ),
      tool(
        "Redirect",
        "Interrupt the agent with a corrective message.",
        { message: z.string(), to: z.string().optional() },
        createRedirectHandler(ctx),
      ),
    ],
  });
}

/**
 * Supervised agent tools: Ask.
 * @param {object} ctx - Orchestration context
 * @param {object} opts
 * @param {function} opts.onAsk - Async callback: (question) → answer string
 * @returns {object} MCP server config (type: "sdk")
 */
export function createSupervisedAgentToolServer(ctx, { onAsk }) {
  return createSdkMcpServer({
    name: "orchestration",
    tools: [
      tool(
        "Ask",
        "Ask the supervisor a clarifying question. Blocks until answered.",
        { question: z.string() },
        createAskHandler(ctx, { onAsk }),
      ),
    ],
  });
}

/**
 * Facilitator tools: Conclude + Redirect + RollCall + Share + Tell.
 * No Ask — the facilitator answers Ask calls, not issues them.
 * @param {object} ctx - Orchestration context
 * @returns {object} MCP server config (type: "sdk")
 */
export function createFacilitatorToolServer(ctx) {
  return createSdkMcpServer({
    name: "orchestration",
    tools: [
      tool(
        "Conclude",
        "Signal that the task is done. Provide a summary.",
        { summary: z.string() },
        createConcludeHandler(ctx),
      ),
      tool(
        "Redirect",
        "Interrupt agents with a corrective message. Use to='all' for all agents or a specific agent name.",
        { message: z.string(), to: z.string().optional() },
        createRedirectHandler(ctx),
      ),
      tool(
        "RollCall",
        "List all participants in the session.",
        {},
        createRollCallHandler(ctx),
      ),
      tool(
        "Share",
        "Broadcast a message to all participants.",
        { message: z.string() },
        createShareHandler(ctx, { from: "facilitator" }),
      ),
      tool(
        "Tell",
        "Send a direct message to one participant.",
        { message: z.string(), to: z.string() },
        createTellHandler(ctx, { from: "facilitator" }),
      ),
    ],
  });
}

/**
 * Facilitated agent tools: Ask + RollCall + Share + Tell.
 * @param {object} ctx - Orchestration context
 * @param {object} opts
 * @param {string} opts.from - Agent name (for Share/Tell)
 * @param {function} opts.onAsk - Async callback: (question) → answer string
 * @returns {object} MCP server config (type: "sdk")
 */
export function createFacilitatedAgentToolServer(ctx, { from, onAsk }) {
  return createSdkMcpServer({
    name: "orchestration",
    tools: [
      tool(
        "Ask",
        "Ask the facilitator a clarifying question. Blocks until answered.",
        { question: z.string() },
        createAskHandler(ctx, { onAsk }),
      ),
      tool(
        "RollCall",
        "List all participants in the session.",
        {},
        createRollCallHandler(ctx),
      ),
      tool(
        "Share",
        "Broadcast a message to all participants.",
        { message: z.string() },
        createShareHandler(ctx, { from }),
      ),
      tool(
        "Tell",
        "Send a direct message to one participant.",
        { message: z.string(), to: z.string() },
        createTellHandler(ctx, { from }),
      ),
    ],
  });
}
