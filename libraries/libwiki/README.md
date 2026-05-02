# libwiki

Wiki lifecycle primitives for the Kata agent system. Provides cross-team memo
delivery, agent roster discovery, and insertion-marker migration.

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
  observation bullet after the `<!-- memo:inbox -->` marker in a wiki summary.
- `listAgents({ agentsDir, wikiRoot })` — discover agents from
  `.claude/agents/*.md` and derive wiki summary paths.
- `insertMarkers({ agentsDir, wikiRoot })` — idempotent insertion of the memo
  marker into existing summaries.
