#!/usr/bin/env node

// Remove small free-floating black areas from auto-traced SVGs.
//
// PNG-to-SVG converters pack the main outline into a single compound path
// containing hundreds of sub-paths.  Many are tiny artifacts (< 1–3 px)
// tracing along the stroke edges.  This script strips those sub-paths
// based on bounding-box area, leaving legitimate features intact.
//
// Usage:
//   node scripts/vector-artifacts.mjs [--level 1-5] [--dry-run] <file ...>
//
// Levels:
//   1  minimal    — sub-pixel artifacts only (< 18px²)
//   2  light      — tiny specks (< 55px²)
//   3  moderate   — default; small blobs (< 140px²)
//   4  firm       — larger blobs (< 350px²)
//   5  aggressive — up to 700px²

import { readFileSync, writeFileSync } from "fs";
import { basename } from "path";

const LEVEL_PRESETS = {
  1: { name: "minimal", maxArea: 18 },
  2: { name: "light", maxArea: 55 },
  3: { name: "moderate", maxArea: 140 },
  4: { name: "firm", maxArea: 350 },
  5: { name: "aggressive", maxArea: 700 },
};

const DARK_BRIGHTNESS = 65;

function parseArgs(argv) {
  let level = 3;
  let dryRun = false;
  const files = [];

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--level" && argv[i + 1]) {
      level = parseInt(argv[++i], 10);
      if (level < 1 || level > 5) {
        console.error("Level must be 1-5");
        process.exit(1);
      }
    } else if (argv[i] === "--dry-run") {
      dryRun = true;
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log(
        "Usage: vector-artifacts [--level 1-5] [--dry-run] <file.svg ...>",
      );
      console.log("\nLevels:");
      for (const [k, v] of Object.entries(LEVEL_PRESETS)) {
        console.log(`  ${k}  ${v.name} (< ${v.maxArea}px²)`);
      }
      process.exit(0);
    } else {
      files.push(argv[i]);
    }
  }

  if (files.length === 0) {
    console.error("No SVG files specified. Use --help for usage.");
    process.exit(1);
  }

  return { level, dryRun, files };
}

function hexBrightness(hex) {
  if (!hex || !hex.startsWith("#") || hex.length < 7) return 255;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r + g + b) / 3;
}

function pushEndpoint(state, x, y) {
  state.allX.push(x);
  state.allY.push(y);
  state.endpoints.push([x, y]);
}

function applyMLT(state, values, isRel) {
  for (let i = 0; i < values.length; i += 2) {
    state.cx = isRel ? state.cx + values[i] : values[i];
    state.cy = isRel ? state.cy + values[i + 1] : values[i + 1];
    pushEndpoint(state, state.cx, state.cy);
  }
}

function applyH(state, values, isRel) {
  for (const v of values) {
    state.cx = isRel ? state.cx + v : v;
    pushEndpoint(state, state.cx, state.cy);
  }
}

function applyV(state, values, isRel) {
  for (const v of values) {
    state.cy = isRel ? state.cy + v : v;
    pushEndpoint(state, state.cx, state.cy);
  }
}

function applyC(state, values, isRel) {
  for (let i = 0; i < values.length; i += 6) {
    state.allX.push(isRel ? state.cx + values[i] : values[i]);
    state.allY.push(isRel ? state.cy + values[i + 1] : values[i + 1]);
    state.allX.push(isRel ? state.cx + values[i + 2] : values[i + 2]);
    state.allY.push(isRel ? state.cy + values[i + 3] : values[i + 3]);
    const ex = isRel ? state.cx + values[i + 4] : values[i + 4];
    const ey = isRel ? state.cy + values[i + 5] : values[i + 5];
    pushEndpoint(state, ex, ey);
    state.cx = ex;
    state.cy = ey;
  }
}

function applySQ(state, values, isRel) {
  for (let i = 0; i < values.length; i += 4) {
    state.allX.push(isRel ? state.cx + values[i] : values[i]);
    state.allY.push(isRel ? state.cy + values[i + 1] : values[i + 1]);
    const ex = isRel ? state.cx + values[i + 2] : values[i + 2];
    const ey = isRel ? state.cy + values[i + 3] : values[i + 3];
    pushEndpoint(state, ex, ey);
    state.cx = ex;
    state.cy = ey;
  }
}

function applyA(state, values, isRel) {
  for (let i = 0; i < values.length; i += 7) {
    const ex = isRel ? state.cx + values[i + 5] : values[i + 5];
    const ey = isRel ? state.cy + values[i + 6] : values[i + 6];
    pushEndpoint(state, ex, ey);
    state.cx = ex;
    state.cy = ey;
  }
}

function applyCommand(state, type, values) {
  const isRel = type === type.toLowerCase();
  const absType = type.toUpperCase();
  if (absType === "M" || absType === "L" || absType === "T")
    applyMLT(state, values, isRel);
  else if (absType === "H") applyH(state, values, isRel);
  else if (absType === "V") applyV(state, values, isRel);
  else if (absType === "C") applyC(state, values, isRel);
  else if (absType === "S" || absType === "Q") applySQ(state, values, isRel);
  else if (absType === "A") applyA(state, values, isRel);
}

function analyzeSubpath(d) {
  const segs = d.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];
  const state = { cx: 0, cy: 0, allX: [], allY: [], endpoints: [] };

  for (const cmd of segs) {
    const values =
      cmd
        .slice(1)
        // eslint-disable-next-line security/detect-unsafe-regex -- the (?:e[+-]?\d+)? group is bounded; matches a single optional exponent on a number token, no nested quantifiers.
        .match(/-?\d+\.?\d*(?:e[+-]?\d+)?/gi)
        ?.map(Number) || [];
    applyCommand(state, cmd[0], values);
  }

  if (state.allX.length === 0) return null;
  const minX = Math.min(...state.allX),
    maxX = Math.max(...state.allX);
  const minY = Math.min(...state.allY),
    maxY = Math.max(...state.allY);

  let signedArea = 0;
  const ep = state.endpoints;
  for (let i = 0; i < ep.length; i++) {
    const j = (i + 1) % ep.length;
    signedArea += ep[i][0] * ep[j][1] - ep[j][0] * ep[i][1];
  }

  return {
    area: (maxX - minX) * (maxY - minY),
    winding: Math.sign(signedArea),
  };
}

function stripSubpaths(d, maxArea) {
  const parts = d.split(/(?=M)/).filter((s) => s.trim());

  let mainWinding = 0;
  let largestArea = 0;
  for (const part of parts) {
    const info = analyzeSubpath(part);
    if (info && info.area > largestArea) {
      largestArea = info.area;
      mainWinding = info.winding;
    }
  }

  const kept = [];
  let removed = 0;

  for (const part of parts) {
    const info = analyzeSubpath(part);
    if (info && info.area < maxArea && info.winding === mainWinding) {
      removed++;
    } else {
      kept.push(part);
    }
  }

  return { d: kept.join(""), removed };
}

function cleanSvg(filePath, preset, dryRun) {
  const svg = readFileSync(filePath, "utf8");
  const lines = svg.split("\n");
  const result = [];
  let totalRemoved = 0;
  let modifiedPaths = 0;
  let totalPaths = 0;

  for (const line of lines) {
    const m = line.match(/^(<path\s+d=")([^"]+)("([^>]*))>/);
    if (!m) {
      result.push(line);
      continue;
    }
    totalPaths++;

    const prefix = m[1];
    const d = m[2];
    const suffix = m[3];
    const attrs = m[4] || "";
    const fillMatch = attrs.match(/fill="([^"]+)"/);
    const fill = fillMatch ? fillMatch[1] : null;
    const brightness = fill ? hexBrightness(fill) : 255;

    if (brightness >= DARK_BRIGHTNESS) {
      result.push(line);
      continue;
    }

    const subCount = d.split(/(?=M)/).filter((s) => s.trim()).length;
    if (subCount < 2) {
      result.push(line);
      continue;
    }

    const { d: newD, removed } = stripSubpaths(d, preset.maxArea);
    if (removed > 0) {
      modifiedPaths++;
      totalRemoved += removed;
      if (newD) {
        result.push(`${prefix}${newD}${suffix}>`);
      }
    } else {
      result.push(line);
    }
  }

  const output = result.join("\n");
  const name = basename(filePath);
  const sizeBefore = (svg.length / 1024).toFixed(0);
  const sizeAfter = (output.length / 1024).toFixed(0);

  console.log(
    `${name}: ${totalRemoved} sub-paths stripped from ${modifiedPaths}/${totalPaths} paths, ${sizeBefore}KB → ${sizeAfter}KB`,
  );

  if (!dryRun) {
    writeFileSync(filePath, output);
  } else {
    console.log("  (dry run — file not modified)");
  }
}

const { level, dryRun, files } = parseArgs(process.argv);
const preset = LEVEL_PRESETS[level];
console.log(
  `Level ${level} (${preset.name}, < ${preset.maxArea}px²)${dryRun ? " [dry run]" : ""}\n`,
);

for (const file of files) {
  cleanSvg(file, preset, dryRun);
}
