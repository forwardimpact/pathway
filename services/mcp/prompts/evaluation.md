# Artifact Evaluation Protocol

This is the protocol Guide follows when piped a prompt that asks it to
evaluate activity artifacts against the engineering standard. It is invoked
non-interactively — typically from cron or a GitHub Actions workflow:

```sh
echo "evaluate unscored artifacts for actaeon@bionova.example" | fit-guide
```

## Trigger

A prompt that contains the verb "evaluate" together with a scope:

| Phrasing | Scope tool argument |
|---|---|
| `for {email}` | `{ email: "{email}" }` (one engineer) |
| `for direct reports of {email}` | `{ manager_email: "{email}" }` (a team) |
| `for all` (or no scope clause) | `{ org: true }` (the whole roster) |

## Procedure

1. Parse the scope from the prompt.
2. Call `GetUnscoredArtifacts` with the parsed scope. The tool returns a JSON
   array of `{ artifact_id, artifact_type, email }`. Idempotency is enforced
   by `GetUnscoredArtifacts` itself — artifacts that already have evidence
   rows do not appear, so re-running the same prompt produces no new rows.
3. For each artifact:
   1. Call `GetArtifact` with the `artifact_id` to fetch full detail. The
      response shape varies by source type — pull-request rows carry a
      title, description, and metadata; review rows carry a body; commit
      rows carry a message.
   2. Call `GetPerson` with the artifact's `email` to get the author's
      profile (`discipline`, `level`, `track`).
   3. Call `GetMarkersForProfile` with the profile. The response is a
      newline-separated list of `skill_id<TAB>level_id<TAB>marker_text`
      rows — these are the only markers you may cite.
   4. For each marker line, decide whether the artifact demonstrates that
      marker. Compose a short rationale (one to three sentences) that
      explains the decision in terms of what the artifact shows. `matched:
      false` rows are valid and must be written — they document what was
      checked.
   5. Call `WriteEvidence` once per artifact with the batch of rows for
      that artifact. Every row must carry `artifact_id`, `skill_id`,
      `level_id`, `marker_text`, `matched` (boolean), and `rationale`
      (non-empty).

## Constraints

- **Marker grounding.** Every `skill_id`, `level_id`, and `marker_text`
  must come verbatim from `GetMarkersForProfile` for that artifact's author
  profile. Never invent markers, paraphrase them, or carry markers across
  profiles. `WriteEvidence` rejects any row whose triple is not in the
  standard.
- **Required fields.** Every row needs a non-null `rationale` and
  `level_id`. `WriteEvidence` rejects rows that omit either.
- **No re-evaluation.** Do not call `GetArtifact` or `WriteEvidence` for
  artifacts not returned by `GetUnscoredArtifacts` — they already have
  evidence and would be filtered out anyway.
- **Multi-source awareness.** Different `artifact_type` values describe
  different kinds of work. Read the artifact detail and reason about what
  it shows; do not assume the schema is the same across types.

## Termination

When every returned artifact has been processed (or `GetUnscoredArtifacts`
returned an empty array), exit. The shell sees a normal exit; the
scheduler treats the run as complete.
