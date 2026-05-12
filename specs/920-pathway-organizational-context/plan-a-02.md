# Plan 920-a · Part 02 — Composer + call sites

Overview: [plan-a.md](plan-a.md) · Spec: [spec.md](spec.md) · Design: [design-a.md](design-a.md)

Depends on: Part 01 merged (`renderOrganizationalContext` exported,
`agentData.organizationalContext` loaded).

Extends `formatTeamInstructions` to accept the org section and threads
`orgSection` through three call sites: CLI (`agent.js` + `agent-io.js`),
web preview (`agent-builder.js` + `agent-builder-preview.js`), and
distribution `build-packs.js`. After this part merges, every surface
emits the section when the slot is populated.

## Step 4a — Composer signature

**Modified:** `products/pathway/src/formatters/agent/team-instructions.js`:

```js
export function formatTeamInstructions(teamInstructions, orgSection, template) {
  const ti = trimValue(teamInstructions);
  const os = trimValue(orgSection);
  if (!ti && !os) return null;
  const content = ti && os ? `${ti}\n\n${os}` : ti || os;
  return Mustache.render(template, { content });
}
```

Existing imports (`Mustache`, `trimValue`) stay. JSDoc records: returns `null`
only when both inputs are null/empty/whitespace; org section appended last so
downstream tooling matches the **last** `## Organizational Context`.

## Step 4b — CLI call sites

**Modified:** `products/pathway/src/commands/agent.js`:

```diff
 import {
   ...
   interpolateTeamInstructions,
+  renderOrganizationalContext,
 } from "@forwardimpact/libskill/agent";

-function printTeamInstructions(agentTrack, humanDiscipline, template) {
+function printTeamInstructions(agentTrack, humanDiscipline, orgSection, template) {
   const teamInstructions = interpolateTeamInstructions({ agentTrack, humanDiscipline });
-  if (teamInstructions) {
+  const content = formatTeamInstructions(teamInstructions, orgSection, template);
+  if (content) {
     process.stdout.write("# Team Instructions (CLAUDE.md)\n\n");
-    process.stdout.write(formatTeamInstructions(teamInstructions, template) + "\n");
+    process.stdout.write(content + "\n");
     process.stdout.write("\n---\n\n");
   }
 }
 ...
   if (!options.output) {
-    printTeamInstructions(agentTrack, humanDiscipline, claudeTemplate);
+    const orgSection = renderOrganizationalContext(agentData.organizationalContext);
+    printTeamInstructions(agentTrack, humanDiscipline, orgSection, claudeTemplate);
     ...
   }
   const teamInstructions = interpolateTeamInstructions({ agentTrack, humanDiscipline });
-  await writeTeamInstructions(teamInstructions, baseDir, claudeTemplate);
+  const orgSection = renderOrganizationalContext(agentData.organizationalContext);
+  await writeTeamInstructions(teamInstructions, orgSection, baseDir, claudeTemplate);
```

**Modified:** `products/pathway/src/commands/agent-io.js` § `writeTeamInstructions`:

```diff
 export async function writeTeamInstructions(
   teamInstructions,
+  orgSection,
   baseDir,
   template,
 ) {
-  if (!teamInstructions) return null;
+  const content = formatTeamInstructions(teamInstructions, orgSection, template);
+  if (!content) return null;
   const filePath = join(baseDir, ".claude", "CLAUDE.md");
-  const content = formatTeamInstructions(teamInstructions, template);
   await ensureDir(filePath);
   await writeFile(filePath, content, "utf-8");
   logger.info(formatSuccess(`Created: ${filePath}`));
   return filePath;
 }
```

## Step 4c — Web preview call site

**Modified:** `products/pathway/src/pages/agent-builder.js` § `buildDeriveContext`:

```diff
   function buildDeriveContext(combo, level) {
     return {
       ...combo, level,
       skills: data.skills,
       capabilities: data.capabilities,
       behaviours: data.behaviours,
       agentBehaviours: agentData.behaviours,
       claudeSettings: agentData.claudeSettings,
       vscodeSettings: agentData.vscodeSettings,
+      organizationalContext: agentData.organizationalContext,
       templates,
     };
   }
```

**Modified:** `products/pathway/src/pages/agent-builder-preview.js` § `deriveAgentData`:

```diff
 import {
   ...
   interpolateTeamInstructions,
+  renderOrganizationalContext,
 } from "@forwardimpact/libskill/agent";
 ...
 export function deriveAgentData(context) {
   const {
     ...
     templates,
+    organizationalContext,
   } = context;
   ...
   const teamInstructions = interpolateTeamInstructions({ agentTrack, humanDiscipline });
-  const teamInstructionsContent = teamInstructions
-    ? formatTeamInstructions(teamInstructions, templates.claude)
-    : null;
+  const orgSection = renderOrganizationalContext(organizationalContext);
+  const teamInstructionsContent = formatTeamInstructions(
+    teamInstructions, orgSection, templates.claude,
+  );
   return { profile, skillFiles, toolkit, teamInstructionsContent };
 }
```

## Step 4d — Distribution `build-packs` call site

**Modified:** `products/pathway/src/commands/build-packs.js` — two edits
mirroring 4b/4c: `derivePackContent` imports `renderOrganizationalContext`,
calls it on `agentData.organizationalContext`, and returns `orgSection`
alongside `teamInstructions`; `formatContent` destructures the new field
and passes all three (`teamInstructions, orgSection, templates.claude`) into
`formatTeamInstructions`, dropping the local null check (the composer owns
the null-or-empty return).

## Step 4e — CLI integration tests

**Modified:** `products/pathway/test/cli-command.test.js` (or new
`agent-command.test.js`). Six cases running `runAgentCommand` against a temp
data-dir copied from the starter:

| Case | Slot | `teamInstructions` | Assertion |
| --- | --- | --- | --- |
| 1 | populated | populated | `teamInstructions` body first, blank line, then org section; `rendered.lastIndexOf("## Organizational Context")` equals section start (last-occurrence). |
| 2 | populated | absent | `.claude/CLAUDE.md` written; contains section. |
| 3 | absent | populated | No `## Organizational Context` in rendered file. |
| 4 | `{}` | populated | Byte-identical to case 3. |
| 5 | populated | absent | `.claude/CLAUDE.md` IS written (regression for old skip-on-falsy gate). |
| 6 | populated | populated | Run twice; second `.claude/CLAUDE.md` byte-identical to first (idempotence). |

## DO-CONFIRM for Part 02

- `bun run format:fix` clean (no unrelated ripple).
- `bun run check` exits 0.
- `bun run test` exits 0 across all touched packages.
- Smoke check (slot still absent in starter until Part 03):

```sh
cd /tmp && rm -rf orgctx-smoke && mkdir orgctx-smoke && cd orgctx-smoke
cp -r $REPO/products/map/starter ./data
bunx fit-pathway agent software_engineering --track=platform --output=. --data=./data
test -f .claude/CLAUDE.md && ! rg -q '## Organizational Context' .claude/CLAUDE.md
```

- `git diff origin/main...HEAD --stat` lists only the files in this part's
  slice of the overview File map.

— Staff Engineer 🛠️
