import { spy } from "./spy.js";

function asyncIterableOf(str) {
  return {
    async *[Symbol.asyncIterator]() {
      if (str) yield str;
    },
  };
}

/**
 * A captured-chunks stub for a spawned child's writable stdin. Records every
 * `write(chunk)` on `chunks`; `end()`/`destroy()` are no-ops. Mirrors the
 * shape `createDefaultSubprocess().spawn` exposes (the child's `node:stream`
 * Writable) closely enough for a supervisor that pipes into it.
 */
function createMockStdinSink() {
  const sink = {
    chunks: [],
    write(chunk) {
      sink.chunks.push(typeof chunk === "string" ? chunk : chunk.toString());
      return true;
    },
    end() {},
    destroy() {},
    on() {
      return sink;
    },
    once() {
      return sink;
    },
  };
  return sink;
}

/**
 * Creates a mock subprocess collaborator matching the `Runtime.subprocess`
 * surface. `run(cmd, args, opts)` resolves to `{ stdout, stderr, exitCode }`
 * consulting `responses[cmd]` (default: empty success); `runSync` is its
 * synchronous sibling returning the same shape. `spawn` returns a streaming
 * quad backed by the same responses (its result carries `stdout`/`stderr`
 * AsyncIterables, a captured-chunks `stdin` sink, `exitCode`/`signal` Promises,
 * a `kill(signal)` spy recording on `kills`, and `pid`). All invocations are
 * recorded on `calls`.
 *
 * @param {object} [options]
 * @param {Record<string, {stdout?: string, stderr?: string, exitCode?: number}>} [options.responses]
 * @returns {{run: Function, runSync: Function, spawn: Function, calls: Array<{cmd: string, args: string[], opts: object}>}}
 */
export function createMockSubprocess({ responses = {} } = {}) {
  const calls = [];
  const resolve = (cmd) => ({
    stdout: "",
    stderr: "",
    exitCode: 0,
    signal: null,
    ...(responses[cmd] ?? {}),
  });

  const run = spy(async (cmd, args = [], opts = {}) => {
    calls.push({ cmd, args, opts });
    return resolve(cmd);
  });

  const runSync = spy((cmd, args = [], opts = {}) => {
    calls.push({ cmd, args, opts });
    return resolve(cmd);
  });

  const spawn = spy((cmd, args = [], opts = {}) => {
    calls.push({ cmd, args, opts });
    const r = resolve(cmd);
    const kills = [];
    return {
      stdout: asyncIterableOf(r.stdout),
      stderr: asyncIterableOf(r.stderr),
      // A captured-chunks writable; `null` only when a response explicitly
      // sets `stdin: null` (matching a child spawned without a stdin pipe).
      stdin: r.stdin === null ? null : createMockStdinSink(),
      exitCode: Promise.resolve(r.exitCode),
      // Terminating signal: `null` (clean exit) unless a response overrides it.
      signal: Promise.resolve(r.signal ?? null),
      kills,
      kill: spy((signal) => {
        kills.push(signal);
      }),
      pid: r.pid ?? 4321,
    };
  });

  return { run, runSync, spawn, calls };
}
