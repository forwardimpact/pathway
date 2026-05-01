#!/usr/bin/env node

// Clear near-transparent "grain" pixels from a PNG.
//
// Edge antialiasing and lossy upstream tooling often leave a halo of
// barely-visible pixels (alpha ~1-15) ringing solid shapes.  This pass
// drops any pixel whose alpha is at or below --threshold to fully
// transparent.  RGB on cleared pixels is zeroed too so it stops showing
// up in the compressed stream.
//
// Usage:
//   node scripts/png-alpha.mjs [--threshold 0-255] <file ...>
//
// --threshold  alpha at or below this value becomes 0 (default 160).

import { readFileSync, writeFileSync } from "fs";
import { basename } from "path";
import { parseArgs } from "node:util";
import sharp from "sharp";

const { values, positionals } = parseArgs({
  options: {
    threshold: { type: "string", default: "160" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
});

if (values.help || positionals.length === 0) {
  console.log("Usage: png-alpha [--threshold 0-255] <file.png ...>");
  process.exit(values.help ? 0 : 1);
}

const threshold = intIn("--threshold", values.threshold, 0, 255);

function intIn(name, raw, lo, hi) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < lo || n > hi) {
    console.error(`${name} must be ${lo}-${hi}`);
    process.exit(1);
  }
  return n;
}

function clearGrain(data) {
  let cleared = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0 || a > threshold) continue;
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 0;
    cleared++;
  }
  return cleared;
}

async function processFile(filePath) {
  const input = readFileSync(filePath);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cleared = clearGrain(data);

  const output = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const name = basename(filePath);
  console.log(
    `${name}: ${info.width}×${info.height}, ${cleared} cleared, ${kb(input)}KB → ${kb(output)}KB`,
  );
  writeFileSync(filePath, output);
}

function kb(b) {
  return (b.length / 1024).toFixed(0);
}

console.log(`Clearing alpha ≤${threshold}\n`);
for (const file of positionals) await processFile(file);
