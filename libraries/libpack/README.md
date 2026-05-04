# libpack

<!-- BEGIN:description — Do not edit. Generated from package.json. -->

Pack distribution — tarballs, bare git repos, and skill discovery indices

<!-- END:description -->

## Key Exports

- `PackBuilder` — orchestrates stager + emitters per combination
- `PackStager` — stages directory trees per layout (full, APM, skills)
- `TarEmitter` — deterministic `.tar.gz` from a staged directory
- `GitEmitter` — static bare git repo from a staged directory
- `DiscEmitter` — `.well-known/skills/` discovery index

## Composition

```js
import {
  PackBuilder, PackStager,
  TarEmitter, GitEmitter, DiscEmitter,
} from "@forwardimpact/libpack";

const builder = new PackBuilder({
  stager: new PackStager(),
  emitters: {
    tar: new TarEmitter(),
    git: new GitEmitter(),
    disc: new DiscEmitter(),
  },
});

const { packs } = await builder.build({
  combinations,
  outputDir: "./dist",
  version: "1.0.0",
});
```
