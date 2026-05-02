#!/usr/bin/env node

// Strip PNG metadata and reduce to greyscale + alpha (PNG colortype 4).
//
// Drops EXIF/ICC/text chunks, collapses RGB channels to a single luma
// channel using Rec. 601 (Y = 0.299R + 0.587G + 0.114B), and keeps the
// existing alpha channel untouched.  Output is recompressed at the
// highest zlib level.
//
// Usage:
//   node design/scripts/png-strip.mjs <file ...>

import { readFileSync, writeFileSync } from "fs";
import { basename } from "path";
import { parseArgs } from "node:util";
import sharp from "sharp";

const { values, positionals } = parseArgs({
  options: { help: { type: "boolean", short: "h" } },
  allowPositionals: true,
});

if (values.help || positionals.length === 0) {
  console.log("Usage: png-strip <file.png ...>");
  process.exit(values.help ? 0 : 1);
}

console.log("Stripping to greyscale+alpha\n");
for (const file of positionals) await processFile(file);

async function processFile(filePath) {
  const input = readFileSync(filePath);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const la = Buffer.alloc((data.length / 4) * 2);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 2) {
    la[j] = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2],
    );
    la[j + 1] = data[i + 3];
  }

  const output = await sharp(la, {
    raw: { width: info.width, height: info.height, channels: 2 },
  })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();

  const name = basename(filePath);
  console.log(
    `${name}: ${info.width}×${info.height}, ${info.channels}ch → 2ch (LA), ${kb(input)}KB → ${kb(output)}KB`,
  );
  writeFileSync(filePath, output);
}

function kb(b) {
  return (b.length / 1024).toFixed(0);
}
