#!/usr/bin/env node

// Cut chip artifacts off dark strokes in auto-traced SVGs.
//
// Chips are small protrusions hanging off what should be smooth outlines.
// Detects where each chip departs the main stroke and where it returns,
// then cuts it off by connecting those two points directly.
//
// Usage:
//   node scripts/svg-smoothen.mjs [--level 1-5] [--dry-run] <file ...>
//
// Levels:
//   1  minimal    — tiny chips only (max 1.5px height)
//   2  light      — small chips (max 2.5px height)
//   3  moderate   — default (max 4px height)
//   4  firm       — larger bumps (max 6px height)
//   5  aggressive — big bumps (max 10px height)

import { readFileSync, writeFileSync } from "fs";
import { basename } from "path";

const LEVEL_PRESETS = {
  1: {
    name: "minimal",
    minHeight: 0.3,
    maxHeight: 1.5,
    maxBase: 4,
    maxSpan: 3,
    alignDeg: 30,
    maxBrightness: 40,
  },
  2: {
    name: "light",
    minHeight: 0.3,
    maxHeight: 2.5,
    maxBase: 7,
    maxSpan: 4,
    alignDeg: 40,
    maxBrightness: 55,
  },
  3: {
    name: "moderate",
    minHeight: 0.3,
    maxHeight: 4,
    maxBase: 12,
    maxSpan: 5,
    alignDeg: 50,
    maxBrightness: 70,
  },
  4: {
    name: "firm",
    minHeight: 0.3,
    maxHeight: 6,
    maxBase: 18,
    maxSpan: 6,
    alignDeg: 60,
    maxBrightness: 100,
  },
  5: {
    name: "aggressive",
    minHeight: 0.3,
    maxHeight: 10,
    maxBase: 25,
    maxSpan: 8,
    alignDeg: 75,
    maxBrightness: 140,
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
        "Usage: svg-smoothen [--level 1-5] [--dry-run] <file.svg ...>",
      );
      console.log("\nLevels:");
      for (const [k, v] of Object.entries(LEVEL_PRESETS)) {
        console.log(`  ${k}  ${v.name} (max ${v.maxHeight}px height)`);
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

function applyM(state, nums, isRel) {
  for (let i = 0; i < nums.length; i += 2) {
    const x = isRel ? state.cx + nums[i] : nums[i];
    const y = isRel ? state.cy + nums[i + 1] : nums[i + 1];
    if (i === 0) {
      state.segments.push({ type: "M", endX: x, endY: y });
      state.startX = x;
      state.startY = y;
    } else {
      state.segments.push({ type: "L", endX: x, endY: y });
    }
    state.cx = x;
    state.cy = y;
  }
}

function applyL(state, nums, isRel) {
  for (let i = 0; i < nums.length; i += 2) {
    const x = isRel ? state.cx + nums[i] : nums[i];
    const y = isRel ? state.cy + nums[i + 1] : nums[i + 1];
    state.segments.push({ type: "L", endX: x, endY: y });
    state.cx = x;
    state.cy = y;
  }
}

function applyH(state, nums, isRel) {
  for (const v of nums) {
    state.cx = isRel ? state.cx + v : v;
    state.segments.push({ type: "L", endX: state.cx, endY: state.cy });
  }
}

function applyV(state, nums, isRel) {
  for (const v of nums) {
    state.cy = isRel ? state.cy + v : v;
    state.segments.push({ type: "L", endX: state.cx, endY: state.cy });
  }
}

function applyC(state, nums, isRel) {
  for (let i = 0; i < nums.length; i += 6) {
    const cp1x = isRel ? state.cx + nums[i] : nums[i];
    const cp1y = isRel ? state.cy + nums[i + 1] : nums[i + 1];
    const cp2x = isRel ? state.cx + nums[i + 2] : nums[i + 2];
    const cp2y = isRel ? state.cy + nums[i + 3] : nums[i + 3];
    const ex = isRel ? state.cx + nums[i + 4] : nums[i + 4];
    const ey = isRel ? state.cy + nums[i + 5] : nums[i + 5];
    state.segments.push({
      type: "C",
      cp1x,
      cp1y,
      cp2x,
      cp2y,
      endX: ex,
      endY: ey,
    });
    state.cx = ex;
    state.cy = ey;
  }
}

function applyZ(state) {
  state.segments.push({ type: "Z", endX: state.startX, endY: state.startY });
  state.cx = state.startX;
  state.cy = state.startY;
}

function applyCommand(state, type, nums) {
  const isRel = type === type.toLowerCase();
  const absType = type.toUpperCase();
  if (absType === "M") applyM(state, nums, isRel);
  else if (absType === "L") applyL(state, nums, isRel);
  else if (absType === "H") applyH(state, nums, isRel);
  else if (absType === "V") applyV(state, nums, isRel);
  else if (absType === "C") applyC(state, nums, isRel);
  else if (absType === "Z") applyZ(state);
}

function parsePath(d) {
  const raw = d.match(/[MmLlHhVvCcZz][^MmLlHhVvCcZz]*/g) || [];
  const state = { cx: 0, cy: 0, startX: 0, startY: 0, segments: [] };

  for (const cmd of raw) {
    const nums =
      cmd
        .slice(1)
        // eslint-disable-next-line security/detect-unsafe-regex -- the (?:e[+-]?\d+)? group is bounded; matches a single optional exponent on a number token, no nested quantifiers.
        .match(/-?\d+\.?\d*(?:e[+-]?\d+)?/gi)
        ?.map(Number) || [];
    applyCommand(state, cmd[0], nums);
  }

  return state.segments;
}

function fmt(n) {
  return parseFloat(n.toFixed(3)).toString();
}

function segmentsToD(segments) {
  const parts = [];
  for (const seg of segments) {
    if (seg.type === "M") {
      parts.push(`M${fmt(seg.endX)} ${fmt(seg.endY)}`);
    } else if (seg.type === "L") {
      parts.push(`L${fmt(seg.endX)} ${fmt(seg.endY)}`);
    } else if (seg.type === "C") {
      parts.push(
        `C${fmt(seg.cp1x)} ${fmt(seg.cp1y)} ${fmt(seg.cp2x)} ${fmt(seg.cp2y)} ${fmt(seg.endX)} ${fmt(seg.endY)}`,
      );
    } else if (seg.type === "Z") {
      parts.push("Z");
    }
  }
  return parts.join("");
}

function perpDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  return Math.abs(dy * px - dx * py + bx * ay - by * ax) / Math.sqrt(lenSq);
}

function maxPerpDeviation(points, i, j) {
  let maxDev = 0;
  for (let k = i + 1; k < j; k++) {
    const dev = perpDist(
      points[k].x,
      points[k].y,
      points[i].x,
      points[i].y,
      points[j].x,
      points[j].y,
    );
    maxDev = Math.max(maxDev, dev);
  }
  return maxDev;
}

function isAligned({ segments, points, i, j, n, alignRad }) {
  if (i === 0 || j + 1 >= n || segments[j + 1].type === "Z") return true;
  const dirBefore = Math.atan2(
    points[i].y - points[i - 1].y,
    points[i].x - points[i - 1].x,
  );
  const dirAfter = Math.atan2(
    points[j + 1].y - points[j].y,
    points[j + 1].x - points[j].x,
  );
  let diff = Math.abs(dirAfter - dirBefore);
  if (diff > Math.PI) diff = 2 * Math.PI - diff;
  return diff <= alignRad;
}

function findChipAt({ segments, points, i, n, preset, alignRad }) {
  for (let span = 2; span <= preset.maxSpan && i + span < n; span++) {
    const j = i + span;
    if (segments[j].type === "Z") continue;

    const base = Math.hypot(
      points[j].x - points[i].x,
      points[j].y - points[i].y,
    );
    if (base > preset.maxBase) continue;

    const maxDev = maxPerpDeviation(points, i, j);
    if (maxDev < preset.minHeight || maxDev > preset.maxHeight) continue;
    if (!isAligned({ segments, points, i, j, n, alignRad })) continue;

    return { from: i, to: j };
  }
  return null;
}

function detectChips(segments, preset) {
  const points = segments.map((s) => ({ x: s.endX, y: s.endY }));
  const n = points.length;
  const alignRad = (preset.alignDeg * Math.PI) / 180;
  const chips = [];

  let i = 1;
  while (i < n - 1) {
    const chip = findChipAt({ segments, points, i, n, preset, alignRad });
    if (chip) {
      chips.push(chip);
      i = chip.to;
    } else {
      i++;
    }
  }

  return chips;
}

function cutChips(segments, chips) {
  if (chips.length === 0) return { segments, cut: 0 };

  const result = [];
  let totalCut = 0;
  let chipIdx = 0;

  for (let i = 0; i < segments.length; i++) {
    if (chipIdx < chips.length && i === chips[chipIdx].from + 1) {
      const chip = chips[chipIdx];
      const toSeg = segments[chip.to];

      result.push({ type: "L", endX: toSeg.endX, endY: toSeg.endY });

      totalCut += chip.to - chip.from - 1;
      i = chip.to;
      chipIdx++;
    } else {
      result.push(segments[i]);
    }
  }

  return { segments: result, cut: totalCut };
}

function processPath(d, preset) {
  const segments = parsePath(d);
  if (segments.length < 4) return { d, chips: 0, cut: 0 };

  const subpaths = [];
  let current = [];
  for (const seg of segments) {
    if (seg.type === "M" && current.length > 0) {
      subpaths.push(current);
      current = [];
    }
    current.push(seg);
  }
  if (current.length > 0) subpaths.push(current);

  const processed = [];
  let totalChips = 0;
  let totalCut = 0;

  for (const sp of subpaths) {
    const chips = detectChips(sp, preset);
    totalChips += chips.length;
    const { segments: newSegs, cut } = cutChips(sp, chips);
    totalCut += cut;
    processed.push(...newSegs);
  }

  if (totalChips === 0) return { d, chips: 0, cut: 0 };

  return { d: segmentsToD(processed), chips: totalChips, cut: totalCut };
}

function cleanSvg(filePath, preset, dryRun) {
  const svg = readFileSync(filePath, "utf8");
  const lines = svg.split("\n");
  const result = [];
  let totalChips = 0;
  let totalCut = 0;
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

    if (brightness > preset.maxBrightness) {
      result.push(line);
      continue;
    }

    const { d: newD, chips, cut } = processPath(d, preset);
    if (chips > 0) {
      modifiedPaths++;
      totalChips += chips;
      totalCut += cut;
      result.push(`${prefix}${newD}${suffix}>`);
    } else {
      result.push(line);
    }
  }

  const output = result.join("\n");
  const name = basename(filePath);
  const sizeBefore = (svg.length / 1024).toFixed(0);
  const sizeAfter = (output.length / 1024).toFixed(0);

  console.log(
    `${name}: ${totalChips} chips cut from ${modifiedPaths}/${totalPaths} paths, ${totalCut} segments removed, ${sizeBefore}KB → ${sizeAfter}KB`,
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
  `Level ${level} (${preset.name}, max ${preset.maxHeight}px)${dryRun ? " [dry run]" : ""}\n`,
);

for (const file of files) {
  cleanSvg(file, preset, dryRun);
}
