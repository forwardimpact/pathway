#!/usr/bin/env node

// Make a near-white background path in an SVG transparent.
//
// SVG fills are flat, deliberate values from the artist's palette — a
// near-white like #fafafa often means both "page background" (covering
// the full canvas) and "character body fill" (inside a figure).  Only
// the first usage should become transparent; clearing every near-white
// fill exposes the dark silhouettes layered beneath the figures.
//
// This script targets the canvas background specifically: a <path> whose
// d attribute starts with "M0 0" and uses only rectangle-edge commands
// (M, H, V, L, Z), and whose fill is within --threshold of pure white.
// Curved paths (C, S, Q, T, A) are artwork even if they happen to begin
// at the origin.  Dark backgrounds (e.g. #000000, #303030) are left
// untouched — they are intentional design.
//
// Usage:
//   node scripts/svg-transparent.mjs [--threshold 0-255] [--dry-run] <file ...>
//
// --threshold near-white tolerance treated as transparent (default 16,
//             clears #fafafa, #f7f7f7, #f3f3f3 backgrounds; keeps the
//             #dedede / #dbdbdb palette highlights).

import { readFileSync, writeFileSync } from "fs";
import { basename } from "path";

const NAMED_COLORS = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  red: [255, 0, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
  silver: [192, 192, 192],
  yellow: [255, 255, 0],
  orange: [255, 165, 0],
  cyan: [0, 255, 255],
  magenta: [255, 0, 255],
  purple: [128, 0, 128],
  pink: [255, 192, 203],
  brown: [165, 42, 42],
  navy: [0, 0, 128],
  teal: [0, 128, 128],
  olive: [128, 128, 0],
  maroon: [128, 0, 0],
  lime: [0, 255, 0],
  aqua: [0, 255, 255],
  fuchsia: [255, 0, 255],
};

function parseArgs(argv) {
  let threshold = 16;
  let dryRun = false;
  const files = [];

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--threshold" && argv[i + 1]) {
      threshold = parseInt(argv[++i], 10);
      if (!Number.isFinite(threshold) || threshold < 0 || threshold > 255) {
        console.error("Threshold must be 0-255");
        process.exit(1);
      }
    } else if (argv[i] === "--dry-run") {
      dryRun = true;
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log(
        "Usage: svg-transparent [--threshold 0-255] [--dry-run] <file.svg ...>",
      );
      process.exit(0);
    } else {
      files.push(argv[i]);
    }
  }

  if (files.length === 0) {
    console.error("No SVG files specified. Use --help for usage.");
    process.exit(1);
  }

  return { threshold, dryRun, files };
}

function parseColor(value) {
  const v = value.trim().toLowerCase();
  if (v === "none" || v === "currentcolor" || v === "transparent") return null;

  if (v.startsWith("#")) {
    const hex = v.slice(1);
    if (hex.length === 3) {
      return hex.split("").map((c) => parseInt(c + c, 16));
    }
    if (hex.length === 4) {
      return hex
        .split("")
        .slice(0, 3)
        .map((c) => parseInt(c + c, 16));
    }
    if (hex.length === 6 || hex.length === 8) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
    }
    return null;
  }

  const rgb = v.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)$/,
  );
  if (rgb) {
    return [parseInt(rgb[1], 10), parseInt(rgb[2], 10), parseInt(rgb[3], 10)];
  }

  if (NAMED_COLORS[v]) return NAMED_COLORS[v];

  return null;
}

function isNearWhite(rgb, threshold) {
  return 255 - Math.min(rgb[0], rgb[1], rgb[2]) <= threshold;
}

// Match <path ... d="M0 0..." ... fill="..." ... /> where the d uses
// only rectangle-edge commands (M H V L Z, plus numbers/separators) and
// the fill is near-white.  Intermediate H/V stops along the edges are
// fine (e.g. M0 0H1024V35.6V1024H0V0Z is still a rectangle); curve
// commands (C S Q T A) disqualify the path as artwork.
const RECT_ONLY_D = /^M0[\s,]*0[MHVLZmhvlz0-9.\s,\-]*$/;

function clearBackgrounds(svg, threshold) {
  let cleared = 0;
  const out = svg.replace(
    /<path\b([^>]*?)\bd="([^"]*)"([^>]*?)\bfill="([^"]+)"([^>]*?)\/>/g,
    (m, before, d, between, fill, after) => {
      if (!RECT_ONLY_D.test(d)) return m;
      const rgb = parseColor(fill);
      if (!rgb || !isNearWhite(rgb, threshold)) return m;
      cleared++;
      return `<path${before} d="M0 0Z"${between} fill="none"${after}/>`;
    },
  );
  return { out, cleared };
}

function processFile(filePath, threshold, dryRun) {
  const input = readFileSync(filePath, "utf8");
  const { out, cleared } = clearBackgrounds(input, threshold);

  const name = basename(filePath);
  const sizeBefore = (input.length / 1024).toFixed(0);
  const sizeAfter = (out.length / 1024).toFixed(0);
  console.log(`${name}: ${cleared} cleared, ${sizeBefore}KB → ${sizeAfter}KB`);

  if (dryRun) {
    console.log("  (dry run — file not modified)");
    return;
  }
  writeFileSync(filePath, out);
}

const { threshold, dryRun, files } = parseArgs(process.argv);
console.log(`Threshold ${threshold}${dryRun ? " [dry run]" : ""}\n`);

for (const file of files) {
  processFile(file, threshold, dryRun);
}
