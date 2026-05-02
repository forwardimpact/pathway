#!/usr/bin/env node

// Crop a PNG to the bounding box of its non-transparent pixels.
//
// Scans the alpha channel and finds the smallest rectangle that
// contains every pixel with alpha > --alpha-threshold, then extracts
// it.  The threshold lets faint haze (e.g. the residual fade from
// png-transparent.mjs) be ignored so the crop reaches the visually
// meaningful content, not the last barely-visible pixel.
//
// A row or column is treated as empty unless at least --min-pixels of
// its pixels exceed the alpha threshold, so a handful of stray edge
// pixels (artifacts from earlier processing, or noise) cannot prevent
// a tight crop.
//
// Files whose basename starts with "icon-" are forced to a 1:1 square
// canvas after cropping — the smaller dimension is symmetrically
// padded with transparency so the icon stays centred.
//
// Usage:
//   node design/scripts/png-crop.mjs [--alpha-threshold N] [--min-pixels N]
//                             [--padding N] <file ...>
//
// --alpha-threshold  alpha value (0-254) at or below which a pixel is
//                    treated as transparent (default 80, ignoring the
//                    residual haze png-transparent.mjs leaves on
//                    fading edges).  Set to 0 for crisp PNGs.
// --min-pixels       minimum opaque pixels in a row/column to treat it
//                    as content (default 8).  A row/column with fewer
//                    is dropped from the crop bounds.
// --padding          pixels of transparent margin to keep on each side
//                    (default 0).  The output canvas is grown back out
//                    by this many pixels with transparent fill.

import { readFileSync, writeFileSync } from "fs";
import { basename } from "path";
import { parseArgs } from "node:util";
import sharp from "sharp";

const { values, positionals } = parseArgs({
  options: {
    "alpha-threshold": { type: "string", default: "80" },
    "min-pixels": { type: "string", default: "8" },
    padding: { type: "string", default: "0" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
});

if (values.help || positionals.length === 0) {
  console.log(
    "Usage: png-crop [--alpha-threshold N] [--min-pixels N] [--padding N] <file.png ...>",
  );
  process.exit(values.help ? 0 : 1);
}

const alphaThreshold = intIn("--alpha-threshold", values["alpha-threshold"], 0, 254);
const minPixels = intIn("--min-pixels", values["min-pixels"], 1);
const padding = intIn("--padding", values.padding, 0);

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

console.log(
  `Alpha threshold ${alphaThreshold}, min pixels ${minPixels}, padding ${padding}\n`,
);
for (const file of positionals) await processFile(file);

function intIn(name, raw, lo, hi = Infinity) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < lo || n > hi) {
    console.error(`${name} must be ${lo}-${hi === Infinity ? "∞" : hi}`);
    process.exit(1);
  }
  return n;
}

function span(counts) {
  let lo = -1;
  let hi = -1;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] >= minPixels) {
      if (lo < 0) lo = i;
      hi = i;
    }
  }
  return [lo, hi];
}

function findContentBox(data, width, height) {
  const rows = new Uint32Array(height);
  const cols = new Uint32Array(width);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= alphaThreshold) continue;
      rows[y]++;
      cols[x]++;
    }
  }
  const [minY, maxY] = span(rows);
  const [minX, maxX] = span(cols);
  if (minX < 0 || minY < 0) return null;
  return { minX, minY, maxX, maxY };
}

async function processFile(filePath) {
  const input = readFileSync(filePath);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const box = findContentBox(data, info.width, info.height);
  const name = basename(filePath);

  if (!box) {
    console.log(`${name}: fully transparent, skipped`);
    return;
  }

  const cropW = box.maxX - box.minX + 1;
  const cropH = box.maxY - box.minY + 1;
  const forceSquare = name.startsWith("icon-");
  const side = forceSquare ? Math.max(cropW, cropH) : 0;
  const sqLeft = forceSquare ? Math.floor((side - cropW) / 2) : 0;
  const sqTop = forceSquare ? Math.floor((side - cropH) / 2) : 0;
  const sqRight = forceSquare ? side - cropW - sqLeft : 0;
  const sqBottom = forceSquare ? side - cropH - sqTop : 0;

  const top = sqTop + padding;
  const bottom = sqBottom + padding;
  const left = sqLeft + padding;
  const right = sqRight + padding;

  if (
    box.minX === 0 &&
    box.minY === 0 &&
    cropW === info.width &&
    cropH === info.height &&
    top === 0 && bottom === 0 && left === 0 && right === 0
  ) {
    console.log(`${name}: ${info.width}×${info.height}, already tight`);
    return;
  }

  let pipeline = sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).extract({ left: box.minX, top: box.minY, width: cropW, height: cropH });

  if (top || bottom || left || right) {
    pipeline = pipeline.extend({ top, bottom, left, right, background: TRANSPARENT });
  }

  const output = await pipeline.png({ compressionLevel: 9 }).toBuffer();
  const outW = cropW + left + right;
  const outH = cropH + top + bottom;
  console.log(
    `${name}: ${info.width}×${info.height} → ${outW}×${outH}, ${kb(input)}KB → ${kb(output)}KB`,
  );
  writeFileSync(filePath, output);
}

function kb(b) {
  return (b.length / 1024).toFixed(0);
}
