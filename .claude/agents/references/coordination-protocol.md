# Coordination Protocol

Pick the channel by what the output **is**, not where context happens to be.
Wiki cadence and structure are governed by
[memory-protocol.md](memory-protocol.md); this protocol covers every other
output an agent produces.

## Channel by output type

| Output                                          | Channel           |
| ----------------------------------------------- | ----------------- |
| Settled decision; weekly progress; agent state  | Wiki              |
| Time-series measurement                         | Metrics CSV       |
| Open question, RFC, cross-product policy debate | Discussion        |
| Reply tied to one PR or one issue               | PR / issue thread |
| Experiment or obstacle PDSA state               | Labeled issue     |
| Mechanical fix or vulnerability patch           | `fix/` branch PR  |
| Structural finding requiring design             | `spec/` branch PR |
| Specialized work needed mid-run                 | Sub-agent         |

## Decision questions

When an output could fit multiple channels, ask in order:

1. Is the answer **settled**? No → Discussion. Yes → continue.
2. Is it **tied to one artifact**? Yes → comment there. No → continue.
3. Is it **mechanical or structural**? Mechanical → `fix/`. Structural →
   `spec/`.
4. Otherwise → wiki.

A finding can require **multiple channels in parallel** — e.g., a CVE that also
raises a policy question lands as both a `fix/` branch (the patch) **and** a
Discussion (the policy question). `fix/` and `spec/` branches never share a PR,
but either may run alongside a Discussion.

## Cross-agent escalation

To pull another agent into a thread, address them by name in plain text — e.g.
"Hello Product Manager," or "Hey Staff Engineer, can you take a look at the
trust check?" The `agent-react` facilitator infers the addressee and routes the
response. Do **not** use `@`-mentions for agents: agents don't have GitHub user
accounts, so `@product-manager` would either ping an unrelated GitHub user with
that handle or resolve to nothing. Do not write to another agent's wiki summary
— they read their own.

## Inbound: unclear addressed comments

If a comment addressed to you is ambiguous — unclear ask, missing context, or
could be interpreted multiple ways — reply asking one specific clarifying
question. Do not act on inferred intent.

## Discussion ownership and termination

The author of a Discussion owns its termination — closing it, linking to the
resulting spec or wiki note, or reassigning ownership to another agent or human
in a comment. A Discussion older than **14 days** without a terminal event is a
mis-routing; the `kata-trace` invariant audit checks for stale open Discussions.

## Trust at run-time

The `agent-react` facilitator verifies the author is a trusted contributor
before engaging any participant — LLM judgement, scoped per run. Untrusted
authors receive an acknowledgement; no participant agent files a `fix/` or
`spec/` branch on their behalf.

## Channels this protocol does NOT cover

- **Wiki reads/writes** — see [memory-protocol.md](memory-protocol.md).
- **Storyboard inputs** — record to metrics CSV; the storyboard reads CSV via
  `fit-xmr`.
- **Sub-agent invocation** — owned by individual skill procedures.

## Citation format

Cite every non-wiki output back in the wiki log so the deliberation trail stays
linked. Format: `<Channel> #<N>: <one-line topic> (<URL>)`.

```
Discussion #123: should fit-pathway support nested levels?
(https://github.com/forwardimpact/monorepo/discussions/123)
PR #549: docs(kata): document agent-react workflow
(https://github.com/forwardimpact/monorepo/pull/549)
Issue #200: clarify proficiency scale for expert tier
(https://github.com/forwardimpact/monorepo/issues/200)
```

## Creating outputs (gh CLI)

`gh` is the authorized tool for every non-wiki output. Capture the returned URL
for the citation format above.

- **Issue comment:** `gh issue comment <N> --body "<text>"`
- **PR comment:** `gh pr comment <N> --body "<text>"`
- **New Discussion:**
  `gh api graphql -f query='mutation { createDiscussion(input: { repositoryId, categoryId, title, body }) { discussion { url } } }'`
- **Discussion comment:**
  `gh api graphql -f query='mutation { addDiscussionComment(input: { discussionId, body }) { comment { url } } }'`
  — pass `replyToId` to thread the reply

## When skills declare a `## Coordination Channels` block

A skill carries a `## Coordination Channels` block when its procedure produces
**non-wiki, non-fix/spec outputs** that need cross-agent or external visibility
— typically PR comments, issue comments, or Discussions. Skills whose only
outputs are wiki appends and fix/spec branches don't need the block; routing for
those is governed by this file plus `memory-protocol.md` directly.

## Common mis-routings

The most frequent failure modes this protocol prevents — watch for these:

- **Open questions stranded as wiki TODOs.** A finding that needs input from
  another agent or a human is not a settled note — it's a Discussion. If a wiki
  entry contains "?", "decide whether", or "needs review", open a Discussion and
  link from the wiki note.
- **Cross-cutting comments lost in PR threads.** A policy question raised on one
  PR but applicable to many should escalate to a Discussion, not stay buried in
  PR review.
- **Agent-to-agent observations sent via wiki summary edits.** Use your own
  summary's teammate-observations section, or address the agent by name ("Hey
  Staff Engineer, …") in a thread; never edit another agent's summary.
