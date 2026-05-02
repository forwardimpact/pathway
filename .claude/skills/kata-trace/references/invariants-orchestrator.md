# Orchestrator invariants

Applicable to combined traces produced by `fit-eval facilitate` and
`fit-eval supervise`. Both invariants use the same two evidence queries — the
only axis of difference is which trace the queries run against. Referenced from
[`invariants.md`](invariants.md).

**Query V — `protocol_violation` cardinality.** Count `protocol_violation`
events emitted by the orchestrator:

    jq -c 'select(.source == "orchestrator" and .event.type == "protocol_violation")' \
        trace.ndjson | wc -l

Must return `0` on a healthy run.

**Query C — `Conclude` cardinality.** Count `Conclude` tool calls emitted by the
facilitator / supervisor (the orchestrator's `tool_use` blocks name the tool
explicitly):

    jq -c 'select(.event.type == "assistant") | .event.message.content[]? |
           select(.type == "tool_use" and .name == "Conclude")' \
        trace.ndjson | wc -l

Must return `1` on a healthy run.

| Invariant                                       | Evidence to find                                                                        | Severity |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- | -------- |
| Facilitated-mode request-response contract held | Query V == 0 AND Query C == 1 against the combined trace of a `fit-eval facilitate` run | **High** |
| Supervised-mode request-response contract held  | Query V == 0 AND Query C == 1 against the combined trace of a `fit-eval supervise` run  | **High** |

A run with one or more `protocol_violation` events is a high-severity finding:
the runtime observed an agent ignoring its reply obligation across the single
allowed reminder. A `Conclude` count other than 1 indicates either a
silent-deadlock exit (zero Concludes) or a double-conclude bug (more than one).
