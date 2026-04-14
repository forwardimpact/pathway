/**
 * MessageBus — in-memory per-participant message queues for facilitate mode.
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
   * Broadcast a message to every participant except the sender.
   * @param {string} from - Sender name
   * @param {string} message - Message text
   */
  share(from, message) {
    this.#assertParticipant(from);
    const msg = { from, text: message, direct: false };
    for (const [name, queue] of this.queues) {
      if (name === from) continue;
      queue.push(msg);
      this.#resolveWaiter(name);
    }
  }

  /**
   * Send a direct message to one participant.
   * @param {string} from - Sender name
   * @param {string} to - Recipient name
   * @param {string} message - Message text
   */
  tell(from, to, message) {
    this.#assertParticipant(from);
    this.#assertParticipant(to);
    const msg = { from, text: message, direct: true };
    this.queues.get(to).push(msg);
    this.#resolveWaiter(to);
  }

  /**
   * Return and clear pending messages for a participant.
   * @param {string} participant - Participant name
   * @returns {{ from: string, text: string, direct: boolean }[]}
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
