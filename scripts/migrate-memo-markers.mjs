#!/usr/bin/env node
import { insertMarkers } from "@forwardimpact/libwiki";

const result = insertMarkers({
  agentsDir: ".claude/agents",
  wikiRoot: "wiki",
});

console.log("inserted:", result.inserted);
console.log("skipped:", result.skipped);
if (result.errors.length) console.log("errors:", result.errors);
