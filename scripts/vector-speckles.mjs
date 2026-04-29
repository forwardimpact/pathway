#!/usr/bin/env node

// Remove speckle artifacts (anti-aliasing) from auto-traced SVGs.
//
// Usage:
//   node scripts/vector-speckles.mjs [--level 1-5] [--dry-run] <file ...>
//
// Levels:
//   1  minimal   — remove fill-opacity paths and sub-5px specks only
//   2  light     — also remove fully isolated dark blobs
//   3  moderate  — default; isolated dark blobs with relaxed thresholds
//   4  firm      — semi-isolated dark blobs included
//   5  aggressive — larger dark blobs, wider mid-gray cleanup

import { readFileSync, writeFileSync } from "fs";
import { basename } from "path";

const LEVEL_PRESETS = {
  1: {
    name: "minimal",
    tinyArea: 5,
    darkMaxArea: 100,
    darkMaxCmds: 4,
    darkMaxNeighbors: 0,
    neighborRadius: 40,
    midGrayMaxArea: 0,
  },
  2: {
    name: "light",
    tinyArea: 10,
    darkMaxArea: 300,
    darkMaxCmds: 5,
    darkMaxNeighbors: 0,
    neighborRadius: 40,
    midGrayMaxArea: 20,
  },
  3: {
    name: "moderate",
    tinyArea: 15,
    darkMaxArea: 500,
    darkMaxCmds: 7,
    darkMaxNeighbors: 0,
    neighborRadius: 40,
    midGrayMaxArea: 30,
  },
  4: {
    name: "firm",
    tinyArea: 20,
    darkMaxArea: 500,
    darkMaxCmds: 7,
    darkMaxNeighbors: 1,
    neighborRadius: 40,
    midGrayMaxArea: 50,
  },
  5: {
    name: "aggressive",
    tinyArea: 30,
    darkMaxArea: 800,
    darkMaxCmds: 9,
    darkMaxNeighbors: 1,
    neighborRadius: 40,
    midGrayMaxArea: 100,
  },
};

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
        "Usage: clean-vector [--level 1-5] [--dry-run] <file.svg ...>",
      );
      console.log("\nLevels:");
      for (const [k, v] of Object.entries(LEVEL_PRESETS)) {
        console.log(`  ${k}  ${v.name}`);
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

function analyzePath(d) {
  const segs = d.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];
  const numCommands = (d.match(/[MmLlHhVvCcSsQqTtAaZz]/g) || []).length;
  let cx = 0,
    cy = 0,
    allX = [],
    allY = [];

  for (const cmd of segs) {
    const type = cmd[0];
    const values =
      cmd
        .slice(1)
        .match(/-?\d+\.?\d*/g)
        ?.map(Number) || [];
    const isRel = type === type.toLowerCase();

    if ("Mm".includes(type)) {
      for (let i = 0; i < values.length; i += 2) {
        cx = isRel ? cx + values[i] : values[i];
        cy = isRel ? cy + values[i + 1] : values[i + 1];
        allX.push(cx);
        allY.push(cy);
      }
    } else if ("Ll".includes(type)) {
      for (let i = 0; i < values.length; i += 2) {
        cx = isRel ? cx + values[i] : values[i];
        cy = isRel ? cy + values[i + 1] : values[i + 1];
        allX.push(cx);
        allY.push(cy);
      }
    } else if ("Hh".includes(type)) {
      for (const v of values) {
        cx = isRel ? cx + v : v;
        allX.push(cx);
        allY.push(cy);
      }
    } else if ("Vv".includes(type)) {
      for (const v of values) {
        cy = isRel ? cy + v : v;
        allX.push(cx);
        allY.push(cy);
      }
    } else if ("Cc".includes(type)) {
      for (let i = 0; i < values.length; i += 6) {
        allX.push(isRel ? cx + values[i] : values[i]);
        allY.push(isRel ? cy + values[i + 1] : values[i + 1]);
        allX.push(isRel ? cx + values[i + 2] : values[i + 2]);
        allY.push(isRel ? cy + values[i + 3] : values[i + 3]);
        const ex = isRel ? cx + values[i + 4] : values[i + 4];
        const ey = isRel ? cy + values[i + 5] : values[i + 5];
        allX.push(ex);
        allY.push(ey);
        cx = ex;
        cy = ey;
      }
    }
  }

  if (allX.length === 0) return null;
  const minX = Math.min(...allX),
    maxX = Math.max(...allX);
  const minY = Math.min(...allY),
    maxY = Math.max(...allY);
  return {
    area: (maxX - minX) * (maxY - minY),
    numCommands,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

function hexBrightness(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r + g + b) / 3;
}

function cleanSvg(filePath, preset, dryRun) {
  const svg = readFileSync(filePath, "utf8");
  const lines = svg.split("\n");

  const entries = [];
  for (const line of lines) {
    const m = line.match(/^<path\s+d="([^"]+)"([^>]*)>/);
    if (!m) {
      entries.push({ line, isPath: false });
      continue;
    }
    const d = m[1],
      attrs = m[2];
    const hasOpacity = /fill-opacity/.test(attrs);
    const info = analyzePath(d);
    const fillMatch = attrs.match(/fill="([^"]+)"/);
    const brightness = fillMatch ? hexBrightness(fillMatch[1]) : 0;
    entries.push({ line, isPath: true, hasOpacity, info, brightness });
  }

  const darkCenters = [];
  for (const e of entries) {
    if (!e.isPath || e.hasOpacity || !e.info) continue;
    if (e.brightness < 100) {
      darkCenters.push({ cx: e.info.cx, cy: e.info.cy });
    }
  }

  const kept = [];
  let _removed = 0,
    origPaths = 0;

  for (const e of entries) {
    if (!e.isPath) {
      kept.push(e.line);
      continue;
    }
    origPaths++;

    if (e.hasOpacity) {
      _removed++;
      continue;
    }
    if (!e.info) {
      kept.push(e.line);
      continue;
    }

    const { area, numCommands, cx, cy } = e.info;

    if (area < preset.tinyArea) {
      _removed++;
      continue;
    }

    if (e.brightness < 100 && area < preset.darkMaxArea * 3) {
      let neighbors = 0;
      for (const dc of darkCenters) {
        if (dc.cx === cx && dc.cy === cy) continue;
        if (Math.hypot(dc.cx - cx, dc.cy - cy) < preset.neighborRadius)
          neighbors++;
      }

      if (
        neighbors <= preset.darkMaxNeighbors &&
        area < preset.darkMaxArea &&
        numCommands <= preset.darkMaxCmds
      ) {
        _removed++;
        continue;
      }
    }

    if (
      e.brightness >= 100 &&
      e.brightness < 170 &&
      area < preset.midGrayMaxArea
    ) {
      _removed++;
      continue;
    }

    kept.push(e.line);
  }

  const result = kept.join("\n");
  const keptPaths = kept.filter((l) => l.startsWith("<path")).length;
  const name = basename(filePath);
  const sizeBefore = (svg.length / 1024).toFixed(0);
  const sizeAfter = (result.length / 1024).toFixed(0);

  console.log(
    `${name}: ${origPaths} → ${keptPaths} paths, ${sizeBefore}KB → ${sizeAfter}KB`,
  );

  if (!dryRun) {
    writeFileSync(filePath, result);
  } else {
    console.log("  (dry run — file not modified)");
  }
}

const { level, dryRun, files } = parseArgs(process.argv);
const preset = LEVEL_PRESETS[level];
console.log(`Level ${level} (${preset.name})${dryRun ? " [dry run]" : ""}\n`);

for (const file of files) {
  cleanSvg(file, preset, dryRun);
}
