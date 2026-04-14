/**
 * SequenceCounter — global monotonic counter shared across all participants
 * in a session. Single-threaded JS means no synchronization needed.
 */
export class SequenceCounter {
  constructor() {
    this.value = 0;
  }

  next() {
    return this.value++;
  }
}

export function createSequenceCounter() {
  return new SequenceCounter();
}
