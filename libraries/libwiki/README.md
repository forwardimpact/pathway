# libwiki

<!-- BEGIN:description — Do not edit. Generated from package.json. -->

Wiki lifecycle primitives — stable memory for agent teams so coordination
persists across sessions.

<!-- END:description -->

## Getting Started

```sh
npx fit-wiki memo --from staff-engineer --to security-engineer --message "audit d642ff0c"
npx fit-wiki memo --from staff-engineer --to all --message "new XmR baseline"
```

```js
import { writeMemo, listAgents, insertMarkers } from "@forwardimpact/libwiki";
```

## Key Exports

- `writeMemo({ summaryPath, sender, message, today })` — append a timestamped
  bullet after the `<!-- memo:inbox -->` marker in a wiki summary's
  `## Message Inbox` section.
- `listAgents({ agentsDir, wikiRoot })` — discover agents from
  `.claude/agents/*.md` and derive wiki summary paths.
- `insertMarkers({ agentsDir, wikiRoot })` — idempotent insertion of the memo
  marker into existing summaries.
- `runAudit(rules, ctx)` — declarative audit engine. Pure: takes a rule
  catalogue and a context, returns findings.
- `RULES` — the audit rule catalogue (one literal per rule).

## Audit rules

`fit-wiki audit` is driven by a declarative catalogue at
`src/audit/rules.js`. Each rule is a plain JS object that names what to
check; the engine (`src/audit/engine.js`) dispatches by `kind` against
subjects resolved by `scope` (`src/audit/scopes.js`).

Adding a rule is one literal in `rules.js`:

```js
{
  id: "summary.last-run-marker",
  scope: "summary",
  severity: "fail",
  kind: "matches",
  pattern: /^\*\*Last run\*\*:/m,
  message: (s) => `sections: ${s.path} missing '**Last run**:' line`,
}
```

Available scopes: `summary`, `weekly-log-main`, `weekly-log-part`,
`memory`, `memory-claims-section`, `claims-row`, `priority-row`,
`storyboard`, `stray-file`. Each scope resolves to a list of subjects in
`scopes.js`.

Available kinds (in `src/audit/kinds.js`): `first-line-regex`,
`contains-line`, `matches`, `budget`, `ordering`, `nested-entry`,
`field-format`, `expired-row`, `markers-balanced`, `file-exists`,
`per-required-line`, `predicate`, `always`. Add a new kind only if the
existing set genuinely cannot express the new rule — most new rules are
data.

The rule order in `RULES` defines emit order; the catalogue snapshot test
at `test/audit-engine.test.js` locks it.
