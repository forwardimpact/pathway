# Bidirectional Links

Reference for `extract-entities` Step 10 and Step 7c (Goals / Priorities).

## Bidirectional link rules

After writing, verify each link goes both ways.

| If you add...          | Then also add...                             |
| ---------------------- | -------------------------------------------- |
| Person → Organization  | Organization → Person (in People section)    |
| Person → Project       | Project → Person (in People section)         |
| Project → Organization | Organization → Project (in Projects section) |
| Project → Goal         | Goal → Project (in Projects section)         |
| Goal → Priority        | Priority → Goal (in Goals section)           |
| Project → Priority     | Priority → Project (in Projects section)     |
| Condition → Goal       | Goal → Condition (in Blockers section)       |
| Condition → Project    | Project → Condition (in Related section)     |
| Condition → Role       | Role → Condition (notes or status field)     |

Use absolute paths everywhere: `[[People/Sarah Chen]]`,
`[[Organizations/Acme Corp]]`, `[[Projects/Acme Integration]]`,
`[[Goals/Goal Name]]`, `[[Priorities/Priority Name]]`,
`[[Conditions/Condition Name]]`.

## Goals (Step 7c)

When source content references an existing `knowledge/Goals/*.md`:

- Add a `[[Goals/{Goal}]]` link to the relevant Project or Topic activity entry.
- Add a progress entry to the Goal's `## Progress` section.
- If evidence suggests a status change ("we won't hit the Q3 target"), update
  `**Status:**` and log `[Status → value]`.

**Never auto-create Goals.**

## Priorities (Step 7c)

Match source themes against priority names and descriptions.

- Add `[[Priorities/{Priority}]]` to a Project or Topic `## Related` section if
  not already present.
- Update the Priority's `## Projects` section when a new project emerges that
  serves it.

**Never auto-create Priorities.** Don't over-link — a project that already links
to a Goal which links to a Priority doesn't need a redundant direct Priority
link.
