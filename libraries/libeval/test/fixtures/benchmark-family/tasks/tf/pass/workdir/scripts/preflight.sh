#!/usr/bin/env bash
# Spawns a small Node HTTP server on $PORT in the background. The server
# lives until WorkdirManager.teardown sends SIGTERM to the process group.
# The fixture exercises spec criteria 3 (running-service grading) and 10
# (teardown leaves no descendant in the process group) via tf/pass.
#
# `</dev/null >/dev/null 2>&1` is required: the spawned node inherits the
# parent shell's stdio, and the parent shell's stdio is the harness's
# spawn pipe. Without redirection, the pipe stays open until node dies —
# the harness's `child.on("close")` waits for the pipe, so preflight
# never returns.

node -e '
const http = require("node:http");
const port = Number(process.env.PORT);
http.createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
}).listen(port, "127.0.0.1");
' </dev/null >/dev/null 2>&1 &

# Wait up to 1s for the server to bind.
for _ in $(seq 1 20); do
  if exec 3<>/dev/tcp/127.0.0.1/"$PORT" 2>/dev/null; then
    exec 3>&-
    exit 0
  fi
  sleep 0.05
done
exit 1
