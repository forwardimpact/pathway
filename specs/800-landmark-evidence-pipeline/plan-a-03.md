# Plan 800-A Part 03 — Evaluation Pipeline

Depends on Part 02 (MCP tools must be registered).

## Step 1: Evaluation skill

Create the artifact-evaluation protocol that Guide follows when piped an
evaluation prompt. `fit-guide` already supports non-interactive stdin mode via
`librepl` (librepl/src/index.js lines 389–407: detects `!stdin.isTTY`,
buffers all input, processes each line, then exits). No changes to `fit-guide`
or `librepl` are needed.

**Created:** `services/mcp/prompts/evaluation.md`

Content — a concise protocol document (~60–80 lines) covering:

1. **Trigger:** Prompt contains "evaluate" and a scope (person email, manager
   email for team, or "all" for org).
2. **Procedure:**
   - Parse scope from the prompt. Map "for {email}" to person scope, "for
     direct reports of {email}" to team scope (`manager_email`), "for all" to
     org scope (`org: true`).
   - Call `GetUnscoredArtifacts` with the parsed scope.
   - For each artifact:
     - Call `GetArtifact` to get detail.
     - Call `GetPerson` with the artifact's author email to get their profile.
     - Call `GetMarkersForProfile` with `(discipline, level, track)` from the
       profile.
     - Evaluate the artifact against each returned marker. Determine `matched`
       (boolean) and write a 1–3 sentence `rationale`.
     - `matched: false` rows are valid — write them to document what was
       checked.
     - Call `WriteEvidence` with the batch of rows for that artifact.
3. **Constraints:**
   - Every `skill_id` + `marker_text` must come verbatim from
     `GetMarkersForProfile` — never invent markers.
   - Every row must have non-null `rationale` and `level_id`.
   - Do not re-evaluate artifacts that already have evidence (they will not
     appear in `GetUnscoredArtifacts`).
4. **Multi-source note:** `GetArtifact` returns different structures per source
   type. Evaluate based on what the artifact contains (title, description,
   diff context for PRs; review body for reviews; commit message for commits).

**Verify:** File exists and is well-formed markdown.

---

## Step 2: Guide system prompt — evaluation awareness

Include the evaluation protocol in Guide's system prompt.

**Modified:** `services/mcp/prompts/guide-default.md`

Append at the end of the existing prompt:

```markdown
## Artifact Evaluation

When asked to evaluate artifacts, follow the evaluation protocol below.

{inline contents of evaluation.md}
```

The prompt loading in `services/mcp/index.js` reads a single file
(`readFile(promptPath, "utf8")`). Inline the evaluation protocol directly
into `guide-default.md` — do not create a separate file. The `evaluation.md`
from Step 1 is the draft; its content is appended into `guide-default.md` in
this step, then `evaluation.md` is deleted.

**Verify:** `echo "evaluate unscored artifacts for actaeon@bionova.example" |
bunx fit-guide` invokes `GetUnscoredArtifacts`, evaluates artifacts, calls
`WriteEvidence`, and exits. After completion, `activity.evidence` contains rows
for Actaeon with non-null rationale. Running the same command again produces no
new rows (idempotency).
