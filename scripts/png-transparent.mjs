#!/usr/bin/env node

// Make white areas in a PNG transparent while retaining antialiasing/shading.
//
// The image is interpreted as ink composited over a white background.  Pixels
// darker than --preserve stay fully opaque with their original colour, so
// solid mid-grays (e.g. the gray ring on icon-guide.png at ~#AFADAE) are
// kept untouched.  Pixels lighter than --preserve fade smoothly toward
// transparent at pure white, with RGB unmixed so the composite-on-white
// matches the original — antialiased edges look identical but no longer
// carry a white halo.
//
// Per-pixel transform (with R,G,B,A in 0..255, P = preserve):
//   m = min(R, G, B)
//   if 255 - m <= threshold        → fully transparent
//   if m <= P                       → unchanged (opaque, original colour)
//   else                            → fade window:
//     a       = (255 - m) / (255 - P)            // 1 at m=P, 0 at m=255
//     alpha'  = round(a * A)
//     chan'   = round(255 - (255 - chan) / a)    // composite-on-white = chan
//
// Usage:
//   node scripts/png-transparent.mjs [--preserve 0-255] [--threshold 0-255]
//                                    <file ...>
//
// --preserve  darkest grey to leave fully opaque (default 200).  Anything
//             at or below this value of min(R,G,B) keeps full alpha and
//             original colour; only lighter pixels get faded.
// --threshold near-white tolerance treated as fully transparent (default 0).

import { readFileSync, writeFileSync } from "fs";
import { basename } from "path";
import { parseArgs } from "node:util";
import sharp from "sharp";

const { values, positionals } = parseArgs({
  options: {
    preserve: { type: "string", default: "200" },
    threshold: { type: "string", default: "0" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
});

if (values.help || positionals.length === 0) {
  console.log(
    "Usage: png-transparent [--preserve 0-255] [--threshold 0-255] <file.png ...>",
  );
  process.exit(values.help ? 0 : 1);
}

const preserve = intIn("--preserve", values.preserve, 0, 255);
const threshold = intIn("--threshold", values.threshold, 0, 255);
const denom = 255 - preserve;

function intIn(name, raw, lo, hi) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < lo || n > hi) {
    console.error(`${name} must be ${lo}-${hi}`);
    process.exit(1);
  }
  return n;
}

function clamp255(v) {
  return Math.max(0, Math.min(255, v));
}

function unmixWhite(data) {
  let cleared = 0;
  let faded = 0;
  let preserved = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const m = Math.min(r, g, b);

    if (255 - m <= threshold) {
      data[i + 3] = 0;
      cleared++;
      continue;
    }
    if (m <= preserve) {
      preserved++;
      continue;
    }

    const f = (255 - m) / denom;
    data[i] = clamp255(Math.round(255 - (255 - r) / f));
    data[i + 1] = clamp255(Math.round(255 - (255 - g) / f));
    data[i + 2] = clamp255(Math.round(255 - (255 - b) / f));
    data[i + 3] = Math.round(f * a);
    faded++;
  }
  return { cleared, faded, preserved };
}

async function processFile(filePath) {
  const input = readFileSync(filePath);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { cleared, faded, preserved } = unmixWhite(data);

  const output = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const name = basename(filePath);
  console.log(
    `${name}: ${info.width}×${info.height}, ${cleared} cleared, ${faded} faded, ${preserved} kept, ${kb(input)}KB → ${kb(output)}KB`,
  );
  writeFileSync(filePath, output);
}

function kb(b) {
  return (b.length / 1024).toFixed(0);
}

console.log(`Preserve ≤${preserve}, threshold ${threshold}\n`);
for (const file of positionals) await processFile(file);
