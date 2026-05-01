#!/usr/bin/env node

// Strip SVG metadata and collapse all colours to greyscale equivalents.
//
// Removes comments, processing instructions, DOCTYPE, <title>, <desc>,
// <metadata>, and editor-specific namespaces (inkscape, sodipodi, rdf,
// cc, dc).  Converts every fill="…" and stroke="…" colour to a
// greyscale hex using Rec. 601 luma (Y = 0.299R + 0.587G + 0.114B).
// rgba()/hsla() alpha is split out into a fill-opacity / stroke-opacity
// attribute so the colour itself stays a clean #gg hex.
//
// Usage:
//   node scripts/svg-strip.mjs [--dry-run] <file ...>

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
  let dryRun = false;
  const files = [];

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--dry-run") {
      dryRun = true;
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log("Usage: svg-strip [--dry-run] <file.svg ...>");
      process.exit(0);
    } else {
      files.push(argv[i]);
    }
  }

  if (files.length === 0) {
    console.error("No SVG files specified. Use --help for usage.");
    process.exit(1);
  }

  return { dryRun, files };
}

function parseColor(value) {
  const v = value.trim().toLowerCase();
  if (v === "none" || v === "currentcolor" || v === "transparent") return null;

  if (v.startsWith("#")) {
    const hex = v.slice(1);
    if (hex.length === 3) {
      return {
        rgb: hex.split("").map((c) => parseInt(c + c, 16)),
        a: 1,
      };
    }
    if (hex.length === 4) {
      const parts = hex.split("").map((c) => parseInt(c + c, 16));
      return { rgb: parts.slice(0, 3), a: parts[3] / 255 };
    }
    if (hex.length === 6) {
      return {
        rgb: [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16),
        ],
        a: 1,
      };
    }
    if (hex.length === 8) {
      return {
        rgb: [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16),
        ],
        a: parseInt(hex.slice(6, 8), 16) / 255,
      };
    }
    return null;
  }

  const rgb = v.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/,
  );
  if (rgb) {
    return {
      rgb: [parseInt(rgb[1], 10), parseInt(rgb[2], 10), parseInt(rgb[3], 10)],
      a: rgb[4] !== undefined ? parseFloat(rgb[4]) : 1,
    };
  }

  if (NAMED_COLORS[v]) {
    return { rgb: NAMED_COLORS[v], a: 1 };
  }

  return null;
}

function toGreyHex([r, g, b]) {
  const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  const h = y.toString(16).padStart(2, "0");
  return `#${h}${h}${h}`;
}

function rewriteColorAttr(attr, value) {
  const parsed = parseColor(value);
  if (!parsed) return null;
  const grey = toGreyHex(parsed.rgb);
  if (parsed.a >= 1) return `${attr}="${grey}"`;
  if (parsed.a <= 0) return `${attr}="${grey}" ${attr}-opacity="0"`;
  const opacity = parseFloat(parsed.a.toFixed(3));
  return `${attr}="${grey}" ${attr}-opacity="${opacity}"`;
}

function stripSvg(svg) {
  let out = svg;
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  out = out.replace(/<\?[\s\S]*?\?>/g, "");
  out = out.replace(/<!DOCTYPE[\s\S]*?>/gi, "");
  out = out.replace(/<metadata\b[\s\S]*?<\/metadata>/gi, "");
  out = out.replace(/<title\b[\s\S]*?<\/title>/gi, "");
  out = out.replace(/<desc\b[\s\S]*?<\/desc>/gi, "");
  out = out.replace(/\sxmlns:(inkscape|sodipodi|rdf|cc|dc)="[^"]*"/g, "");
  out = out.replace(
    /\s(inkscape|sodipodi|rdf|cc|dc):[a-zA-Z-]+="[^"]*"/g,
    "",
  );
  out = out.replace(/(fill|stroke)="([^"]+)"/g, (m, attr, value) => {
    const replaced = rewriteColorAttr(attr, value);
    return replaced ?? m;
  });
  out = out.replace(/^\s*\n/gm, "");
  return out;
}

function processFile(filePath, dryRun) {
  const input = readFileSync(filePath, "utf8");
  const output = stripSvg(input);

  const name = basename(filePath);
  const sizeBefore = (input.length / 1024).toFixed(0);
  const sizeAfter = (output.length / 1024).toFixed(0);
  console.log(`${name}: ${sizeBefore}KB → ${sizeAfter}KB`);

  if (dryRun) {
    console.log("  (dry run — file not modified)");
    return;
  }
  writeFileSync(filePath, output);
}

const { dryRun, files } = parseArgs(process.argv);
console.log(`Stripping to greyscale${dryRun ? " [dry run]" : ""}\n`);

for (const file of files) {
  processFile(file, dryRun);
}
