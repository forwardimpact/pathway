# Spec 910 — Pathway `agent` Command Needs a `--level` Flag

## Problem

`npx fit-pathway agent <discipline> --track=<track>` is the tool an empowered
engineer runs to generate agent profiles calibrated to their organization's
standard. Today the command exposes no calibration for the engineering level
expected of the agent — and the engineer cannot generate different profiles for
agents that should meet different expectations.

In a `kata-interview` user-testing session (issue
[#880](https://github.com/forwardimpact/monorepo/issues/880)) the J070 persona
needed to produce two agent profiles: one for themselves (J070, platform) and
one for their J060 teammate Selene (also platform). The two persona-distinct
configurations produced **byte-identical output**. The persona named the gap
directly:

> The one thing that doesn't survive contact with my actual job-to-be-done.

The reason is mechanical. `libraries/libskill/src/agent.js:37` exports
`deriveReferenceLevel(data.levels)`, which picks one level (the first whose
core skills reach `practitioner`) and threads it through every downstream
derivation — `deriveAgentSkills`, `deriveAgentBehaviours`,
`generateAgentProfile`, and the rendered `CLAUDE.md` team-instructions. The
`agent` command at `products/pathway/src/commands/agent.js:306` calls
`deriveReferenceLevel` unconditionally; the CLI definition at
`products/pathway/bin/fit-pathway.js:138-150` exposes `--track`, `--output`,
`--skills`, `--tools` — and no `--level`.

The other pathway entity commands that produce calibrated artefacts already
accept a level: `job` (`args: "[<discipline> <level>]"`), `interview`
(`args: "<discipline> <level>"`), and `progress`
(`args: "<discipline> <level>"`). `agent` is the outlier — the only artefact
generator whose level is implicit and unchangeable.

The blast radius is the persona's job-to-be-done. Empowered Engineers hire
Pathway to *give agents organizational context* the way they give it to humans.
The organization holds J060 and J070 to different expectations
(`products/map/starter/levels.yaml` records different
`baseSkillProficiencies`, `baseBehaviourMaturity`, and `expectations` per
level). Pathway today says the agents should not reflect that difference —
contradicting both the standard and the user's job. The persona's workaround
(hand-editing the generated `CLAUDE.md`) is what the
[organizational-context guide](https://www.forwardimpact.team/docs/products/agent-teams/organizational-context/index.md)
explicitly tells users *not* to do.

## Personas and Job

The hire is **Empowered Engineers**, against the Big Hire "Help me configure
agents to meet the expectations the organization holds for humans"
([JTBD.md](../../JTBD.md) § Empowered Engineers: Equip Aligned Agent Teams).
The job is fired when configuration overhead exceeds the quality gain — exactly
the failure mode the persona described, where the only way to encode different
expectations was to hand-edit generated files outside the tool.

The downstream beneficiary is the agent team that runs against the generated
profiles, but the direct hire is the engineer authoring those profiles. Agents
configured by other means (custom system prompts, hand-edits, copies of
another team's config) are out of scope — those are the alternatives this job
competes with, not consumers of the work.

## Scope

### In scope

| Component | What changes |
|---|---|
| `agent` CLI flag | The `agent` subcommand accepts a new `--level=<id>` option whose value is validated against `data.levels`. The validation surfaces the same "Available levels" error UX as the existing `--track` validation does for tracks. |
| Default behaviour | When `--level` is absent, the command preserves today's behaviour exactly: it derives the reference level via `deriveReferenceLevel(data.levels)` and proceeds. The same `(discipline, track)` invocation without `--level` produces byte-identical output to today. |
| Level threading | The resolved level (whether CLI-supplied or derived) reaches `deriveAgentSkills`, `deriveAgentBehaviours`, `generateAgentProfile`, and the rendered `CLAUDE.md` / team-instructions so that skill-proficiency floors and behaviour-maturity expectations reflect the requested level end-to-end. |
| `--help` reflection | The CLI definition (`products/pathway/bin/fit-pathway.js:138-150`) exposes the new option in `--help` output with a one-line description consistent with the existing `--track` entry. |
| Coherence with sibling commands | Whether `--level` is the right surface (vs. a positional argument matching `job` / `interview` / `progress`) is a decision the spec records explicitly. The CLI presents one consistent way of asking for a level across the four artefact-generating commands. |
| `agent --list` unchanged | `npx fit-pathway agent --list` continues to list valid `discipline × track` combinations. `--level` does not gate listability — every level remains valid against every listed combination. |
| Published-guide cascade | The two published guides that reference the `agent` command — [agent-teams](https://www.forwardimpact.team/docs/products/agent-teams/index.md) and [organizational-context](https://www.forwardimpact.team/docs/products/agent-teams/organizational-context/index.md) — document the new flag where they describe profile generation, and explain when an engineer would set it vs. leave it to the default. |
| Test coverage | Unit/integration tests verify three properties: (i) `--level=<id>` produces output that differs from the no-flag invocation when the explicit level differs from `deriveReferenceLevel`'s pick; (ii) two invocations differing only in `--level` produce non-identical output; (iii) absent `--level`, output is byte-identical to today's behaviour for the same `(discipline, track)`. |

### Out of scope, deferred

- **Per-skill or per-capability level overrides.** This spec exposes one level
  per invocation. A persona that wants "J070 for `software_engineering` but
  J060 for `code_review` *within the same agent*" is a separate scope.
- **Calibration knobs beyond `level`.** Driver weighting, capability
  filtering, behaviour-maturity overrides, and similar refinements are
  separate specs. This spec adds the *missing* knob the persona named, not a
  speculative set of future ones.
- **Refactoring `deriveReferenceLevel` itself.** The function continues to
  serve as the default-resolution path. Its heuristic ("first level whose
  core skills reach `practitioner`") is not under review here.
- **Standard-schema changes.** No additions to `levels.yaml` or any other
  starter-standard file. The persona's alternative workaround "extend the
  standard schema" (issue #880) is not what this spec adopts.
- **Web UI route changes.** The agent-builder web route at
  `products/pathway/src/main.js:137-138` already encodes `:discipline` and
  `:track`. Whether the route should also encode `:level` is a separate spec
  about the web UI's calibration surface, not the CLI's.
- **`agent-list` / `agent-builder` page rendering.** The list view enumerates
  `discipline × track` combinations. Whether it should also enumerate by
  level is the same web-UI question deferred above.

## Resolution coherence

The four artefact-generating commands today expose level differently:

| Command | Today's level surface |
|---|---|
| `job` | Positional `<level>` (optional) |
| `interview` | Positional `<level>` (required) |
| `progress` | Positional `<level>` (required) |
| `agent` | None — `deriveReferenceLevel` |

The persona's `kata-interview` discovery is that `agent` is the outlier.
Closing the gap raises a coherence question: should `agent` adopt the
positional form (`agent <discipline> <level>`) or an option form
(`agent <discipline> --level=<id>`)? The spec records the constraints both
forms must satisfy and defers the choice between them to design:

- **Backward compatibility.** Today's invocation
  `npx fit-pathway agent software_engineering --track=platform` must continue
  to work and produce identical output. A required-positional resolution would
  break this; an optional-positional or option-flag resolution would not.
- **`--list` interaction.** Today `npx fit-pathway agent --list` enumerates
  valid combinations without any positional. Whichever resolution is chosen,
  `--list` continues to work without prompting for a level.
- **Help-text symmetry.** The CLI's `--help` output presents the four
  commands' level surface consistently — readers should not need to remember
  per-command syntax differences for the same calibration concept.

## Success Criteria

| # | Criterion | Verification |
|---|---|---|
| SC1 | An invocation that supplies a level produces an agent profile whose skill-proficiency floors and behaviour-maturity values reflect the supplied level. | Compare the generated profile's skill and behaviour ordering for two invocations differing only in level; the diff is non-empty. |
| SC2 | An invocation that does not supply a level produces output byte-identical to today's behaviour for the same `(discipline, track)`. | Diff the new command's no-flag output against the current `main` output captured before the change for the same `(discipline, track)`; the diff is empty. |
| SC3 | The CLI rejects an unknown level value with the same UX shape as today's `--track` error: an error line plus a bulleted "Available levels:" list, exit code 1. | Run the command with a deliberately invalid level; observe stderr matches the documented error shape. |
| SC4 | `--help` for the `agent` command lists the level surface with a one-line description. | `npx fit-pathway agent --help` includes the new entry. |
| SC5 | The two published guides ([agent-teams](https://www.forwardimpact.team/docs/products/agent-teams/index.md), [organizational-context](https://www.forwardimpact.team/docs/products/agent-teams/organizational-context/index.md)) document the level surface where they describe profile generation, and the documented invocation produces the documented outcome. | Run the invocations shown in the updated guides; the outputs match the documented behaviour. |
| SC6 | The `agent` command's level surface is presented consistently with `job`, `interview`, and `progress` in `--help` output. | A reader can identify the level argument shape for all four commands from `--help` without consulting per-command docs. |

## Alternatives considered

| Alternative | Rejected because |
|---|---|
| Leave `agent` as-is; tell users to hand-edit the generated `CLAUDE.md` to encode level differences. | This is the persona's current workaround, which the [organizational-context guide](https://www.forwardimpact.team/docs/products/agent-teams/organizational-context/index.md) explicitly tells users not to do. The job is fired exactly when the configuration overhead exceeds the quality gain. |
| Extend `levels.yaml` schema so multiple "agent levels" map to one human level. | Adds standard-schema surface to solve a CLI-surface problem. The data model already records distinct levels; the missing piece is the ability to pick one at invocation time. |
| Change `deriveReferenceLevel` to return *all* levels and generate one profile per level by default. | Multiplies output size by `levels.length` and breaks backward compatibility for every existing `--output` consumer. The persona wants to pick one level per invocation, not produce N. |
| Add `--level` as a global option on `fit-pathway` (above the subcommand). | Pollutes commands that have no level concept (`skill`, `track`, `tool`, `behaviour`, `driver`) and creates ambiguity for `questions` (which already has `--level` as a filter). The flag belongs on the commands that consume it. |
| Hold the spec until a broader "calibration knobs" design lands. | The persona's job is fired today by the missing level knob specifically. Other knobs (driver weighting, capability filtering) are speculative; level is concrete. Pairing the two delays the closure of a verified gap. |
