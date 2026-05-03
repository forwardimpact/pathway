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
