# CLI Reference

```sh
npx fit-terrain                     # Use cached prose (default, repeatable)
npx fit-terrain --generate          # Generate prose via LLM (requires LLM_TOKEN)
npx fit-terrain --no-prose          # Structural scaffolding only (no prose at all)
npx fit-terrain --strict            # Fail on cache miss (with default cached mode)
npx fit-terrain --load              # Load raw docs to Supabase Storage
npx fit-terrain --only=pathway      # Render only one content type
npx fit-terrain --dry-run           # Show what would be written
npx fit-terrain --story=path        # Custom story DSL file
npx fit-terrain --cache=path        # Custom prose cache file
```

### Content Types

Use `--only=<type>` to generate a single content type:

| Type       | Output Directory | Contents                        |
| ---------- | ---------------- | ------------------------------- |
| `html`     | `data/knowledge` | Articles, guides, FAQs, courses |
| `pathway`  | `data/pathway`   | YAML framework files            |
| `raw`      | `data/activity`  | Roster, GitHub events, evidence |
| `markdown` | `data/personal`  | Briefings, notes, KB content    |

### Prose Modes

| Mode       | Flag         | Description                                  |
| ---------- | ------------ | -------------------------------------------- |
| `cached`   | _(default)_  | Read from `prose-cache.json` (no LLM needed) |
| `generate` | `--generate` | Call LLM, write new entries to cache         |
| `no-prose` | `--no-prose` | Structural scaffolding only, no prose at all |
