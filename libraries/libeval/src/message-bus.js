/**
 * MessageBus — in-memory per-participant message queues for facilitated and
 * supervised modes. The message vocabulary mirrors the orchestration toolkit:
 *
 * - ask(from, to, text, askId)       — direct question; registers nothing
 *   itself (the handler's caller owns pending-ask state). `to === "@broadcast"`
 *   sends an identical entry to every participant except the sender.
 * - answer(from, to, text, askId)    — direct reply to the asker.
 * - announce(from, text)             — broadcast, no reply expected.
 * - synthetic(to, text)              — orchestrator-only reminder injection.
 *
 * Follows OO+DI: constructor injection, factory function, tests bypass factory.
 */

export class MessageBus {
  /**
   * @param {object} deps
   * @param {string[]} deps.participants - Participant names
   */
  constructor({ participants }) {
    this.queues = new Map();
    this.waiters = new Map();
    for (const name of participants) {
      this.queues.set(name, []);
      this.waiters.set(name, null);
    }
  }

  /**
   * Send a question to a participant (direct), or broadcast when
   * `to === "@broadcast"`.
   * @param {string} from
   * @param {string} to - Recipient name or "@broadcast"
   * @param {string} text
   * @param {number} askId
   */
  ask(from, to, text, askId) {
    this.#assertParticipant(from);
    if (to === "@broadcast") {
      for (const [name, queue] of this.queues) {
        if (name === from) continue;
        queue.push({ from, text, kind: "ask", askId, direct: false });
        this.#resolveWaiter(name);
      }
      return;
    }
    this.#assertParticipant(to);
    this.queues.get(to).push({ from, text, kind: "ask", askId, direct: true });
    this.#resolveWaiter(to);
  }

  /**
   * Reply to a pending ask.
   * @param {string} from - Answerer (or "@orchestrator" for a synthetic answer)
   * @param {string} to - Original asker
   * @param {string} text
   * @param {number} askId
   */
  answer(from, to, text, askId) {
    this.#assertParticipant(to);
    // Synthetic answers from the orchestrator bypass the participant check
    // on `from` — the orchestrator is not a message-bus participant.
    if (from !== "@orchestrator") this.#assertParticipant(from);
    this.queues
      .get(to)
      .push({ from, text, kind: "answer", askId, direct: true });
    this.#resolveWaiter(to);
  }

  /**
   * Broadcast a message to every participant except the sender.
   * @param {string} from
   * @param {string} text
   */
  announce(from, text) {
    this.#assertParticipant(from);
    const msg = { from, text, kind: "announce", direct: false };
    for (const [name, queue] of this.queues) {
      if (name === from) continue;
      queue.push(msg);
      this.#resolveWaiter(name);
    }
  }

  /**
   * Send a direct message with no reply expected. Used by the Redirect
   * runtime plumbing (facilitator / supervisor) to deliver replacement
   * instructions to a single participant without engaging the ask/answer
   * contract.
   * @param {string} from
   * @param {string} to
   * @param {string} text
   */
  direct(from, to, text) {
    this.#assertParticipant(from);
    this.#assertParticipant(to);
    this.queues.get(to).push({ from, text, kind: "direct", direct: true });
    this.#resolveWaiter(to);
  }

  /**
   * Inject an orchestrator-originated reminder onto a single participant's
   * queue. Used by the turn-complete guard.
   * @param {string} to
   * @param {string} text
   */
  synthetic(to, text) {
    this.#assertParticipant(to);
    this.queues
      .get(to)
      .push({ from: "@orchestrator", text, kind: "synthetic", direct: true });
    this.#resolveWaiter(to);
  }

  /**
   * Return and clear pending messages for a participant.
   * @param {string} participant - Participant name
   * @returns {{from: string, text: string, kind: string, direct: boolean, askId?: number}[]}
   */
  drain(participant) {
    this.#assertParticipant(participant);
    const queue = this.queues.get(participant);
    const messages = queue.splice(0);
    return messages;
  }

  /**
   * Return a Promise that resolves when at least one message is pending.
   * Resolves immediately if messages are already queued.
   * @param {string} participant - Participant name
   * @returns {Promise<void>}
   */
  waitForMessages(participant) {
    this.#assertParticipant(participant);
    if (this.queues.get(participant).length > 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.waiters.set(participant, resolve);
    });
  }

  #assertParticipant(name) {
    if (!this.queues.has(name)) {
      throw new Error(`Unknown participant: ${name}`);
    }
  }

  #resolveWaiter(name) {
    const waiter = this.waiters.get(name);
    if (waiter) {
      this.waiters.set(name, null);
      waiter();
    }
  }
}

/**
 * Factory function.
 * @param {object} deps - Same as MessageBus constructor
 * @returns {MessageBus}
 */
export function createMessageBus(deps) {
  return new MessageBus(deps);
}
