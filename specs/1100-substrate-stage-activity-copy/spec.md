# Spec 1100: `substrate stage` copies `data/activity/` to the agent workspace

**Issue:** [#993](https://github.com/forwardimpact/monorepo/issues/993)
finding 4 ("substrate-stage seeds activity into Supabase but doesn't
copy the files to $AGENT_CWD — those are different things and the
skill conflates them")

**Persona/job:** Teams Using Agents — "Run an autonomous, continuously
improving development team that plans, ships, studies its own traces,
and acts on findings" (per [CLAUDE.md](../../CLAUDE.md) § Primary
Products). The kata-interview workflow is the Study surface; this
spec eliminates a silent-landmine step the supervisor must remember
on every Landmark interview.

## Why now

Two end-to-end `kata-interview` workflow runs ([run
25999252444](https://github.com/forwardimpact/monorepo/actions/runs/25999252444),
[run
25999790849](https://github.com/forwardimpact/monorepo/actions/runs/25999790849))
revealed an inconsistency in the Landmark substrate flow:

- For Landmark,
  [`kata-interview` SKILL.md Step 3](../../.claude/skills/kata-interview/SKILL.md)
  table says the supervisor stages **`data/pathway/` and
  `data/activity/`** into `$AGENT_CWD`, **plus** the workflow's
  separate `Substrate stage` step seeds the Supabase substrate.
- The Landmark substrate-stage verb (`fit-map substrate stage` at
  `products/map/src/commands/substrate-stage.js`) seeds activity rows
  into Supabase via its `seed` phase
  (`substrate-stage.js:93`) but does **not** copy the source
  `data/activity/` files to the target workspace.
- The supervisor must therefore both:
  1. Run `bunx fit-map substrate stage` (which seeds Supabase), and
  2. Manually `cp -r data/activity "$AGENT_CWD/data/activity"`.

The skill conflates these two operations into one paragraph. The
silent-landmine cost showed up in run-to-run drift:

| Run | What the supervisor did about the manual cp |
| --- | --- |
| 25999252444 (Run 1) | Skipped the manual cp; the omission did not fire because the agent abandoned at Guide install before reading activity files |
| 25999790849 (Run 2) | Remembered the manual cp at supervisor turn 38 |

Same task, two different outcomes. The substrate-stage step is the
single Landmark-substrate touchpoint the workflow already invokes; it
is the natural home for the file copy that currently lives in the
supervisor's head.

## Strategic decision

**Move the `data/activity/` file copy out of the supervisor's manual
instructions and into the substrate-stage automation.** The
substrate-stage step is the Landmark-specific phase the workflow
already runs in CI before the supervisor hands off to the agent;
running the file copy there closes the conflation and makes the run
deterministic with respect to activity-file availability.

Whether the copy is added to `substrate stage`'s existing `init`
phase, lands as a new phase, or moves into `substrate issue
--stage-files` is **design-determined**. The criterion is the
behavior the workspace exhibits after staging completes, not which
verb owns the work.

## Scope

| Surface | Change |
| --- | --- |
| `bunx fit-map substrate stage` (or `substrate issue`, design's choice) | After the verb completes, the target workspace contains `data/activity/` with the same file tree the source monorepo's `data/activity/` carries — without the supervisor running `cp`. |
| [`kata-interview` SKILL.md Step 3](../../.claude/skills/kata-interview/SKILL.md) Landmark row | The supervisor instruction no longer prescribes a manual `cp -r data/activity "$AGENT_CWD/data/activity"` for Landmark. The Map row (non-substrate path) is untouched. |
| Phase-level diagnostic on failure | If the activity-copy step fails, the substrate-stage diagnostic message (today: `[substrate stage: <phase>] <reason>` at `substrate-stage.js:108-113`) identifies the new phase by name so a CI step's stderr surfaces the failed phase to the operator. |

**Out of scope:**

- The Supabase-side activity seed (the `seed` phase at
  `substrate-stage.js:93`) — already automated, untouched.
- Non-Landmark products' manual workspace staging (Map, Pathway,
  Summit). Those continue to rely on supervisor `cp`; a broader
  workspace-stage unification is a future spec.
- The substrate roster/suggest surface reframe (spec 1090).
- The wiki log rotation policy (spec 1110).

## Success criteria

1. **Activity files staged automatically.** After
   `bunx fit-map substrate stage` (or whichever verb design names)
   completes against an empty target directory, the target directory
   contains a `data/activity/` subtree whose file list matches the
   source monorepo's `data/activity/` file list. Verify by running
   the verb, then comparing `find $AGENT_CWD/data/activity -type f`
   against `find <monorepo>/data/activity -type f`.
2. **SKILL.md alignment.** Reading
   `.claude/skills/kata-interview/SKILL.md` § Step 3 end-to-end for
   Landmark yields a procedure that does not include a manual
   `cp -r data/activity "$AGENT_CWD/data/activity"` instruction. The
   instruction is either removed or replaced by a reference to the
   automated phase.
3. **Failure surfaces named phase.** Inducing a copy failure (e.g.
   target directory unwritable, source absent) emits a diagnostic
   matching the substrate-stage phase-error contract:
   `[substrate stage: <phase>] <reason>` (or the equivalent in the
   chosen verb), with `<phase>` carrying the name of the file-copy
   step. Verify by reading stderr after the induced failure.
4. **Non-Landmark untouched.** Running the workflow against Map,
   Pathway, or Summit (products that do not invoke `substrate
   stage`) produces no new behavior — the existing supervisor `cp`
   instructions for those products in SKILL.md Step 3 are unchanged.

## Risks

- **Race with workspace init.** `substrate-stage.js` already runs an
  `init` phase against `target` (`substrate-stage.js:67`). The
  activity-copy must compose with that init without clobbering
  bootstrapped files. Design must sequence the copy after `init` or
  scope it to subdirectories the init does not touch.
- **Source-directory discovery.** Today's `substrate-stage.js:89`
  resolves `dataDir` via `findDataDir(undefined)` for the seed
  phase. The same resolver may or may not be appropriate for a
  file-copy operation, which needs the on-disk source root rather
  than the resolved seed payload. Design must name the discovery
  path explicitly.
- **CI-vs-developer-flow divergence.** `substrate-stage.js:10`
  documents this verb as CI-only (not a developer verb). The new
  copy behavior may not be appropriate when a developer runs the
  verb against their working tree — design must decide whether to
  gate the copy on env or always run it.

## References

- Issue [#993](https://github.com/forwardimpact/monorepo/issues/993)
  finding 4 (substrate-stage workspace conflation).
- Spec 990 — `kata-interview-real-landmark-substrate` (the substrate
  this spec extends).
- Spec 1010 — `jtbd-teams-using-agents` (`design draft`; promotes
  Teams Using Agents to JTBD.md).
- Sibling specs from same triage: 1090 (substrate roster reframe),
  1110 (wiki log rotation).
- `products/map/src/commands/substrate-stage.js`,
  `products/map/src/commands/substrate-issue.js` (the surfaces
  design will choose between).
- `.claude/skills/kata-interview/SKILL.md` § Step 3 (the consumer
  this spec serves).
