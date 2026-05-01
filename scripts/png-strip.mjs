#!/usr/bin/env node

// Strip PNG metadata and reduce to greyscale + alpha (PNG colortype 4).
//
// Drops EXIF/ICC/text chunks, collapses RGB channels to a single luma
// channel using Rec. 601 (Y = 0.299R + 0.587G + 0.114B), and keeps the
// existing alpha channel untouched.  Output is recompressed at the
// highest zlib level.
//
// Usage:
//   node scripts/png-strip.mjs [--dry-run] <file ...>

import { readFileSync, writeFileSync } from "fs";
import { basename } from "path";
import sharp from "sharp";

function parseArgs(argv) {
  let dryRun = false;
  const files = [];

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--dry-run") {
      dryRun = true;
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log("Usage: png-strip [--dry-run] <file.png ...>");
      process.exit(0);
    } else {
      files.push(argv[i]);
    }
  }

  if (files.length === 0) {
    console.error("No PNG files specified. Use --help for usage.");
    process.exit(1);
  }

  return { dryRun, files };
}

function rgbaToLumaAlpha(data) {
  const out = Buffer.alloc((data.length / 4) * 2);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 2) {
    out[j] = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2],
    );
    out[j + 1] = data[i + 3];
  }
  return out;
}

async function processFile(filePath, dryRun) {
  const input = readFileSync(filePath);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const la = rgbaToLumaAlpha(data);
  const output = await sharp(la, {
    raw: { width: info.width, height: info.height, channels: 2 },
  })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();

  const name = basename(filePath);
  const sizeBefore = (input.length / 1024).toFixed(0);
  const sizeAfter = (output.length / 1024).toFixed(0);
  console.log(
    `${name}: ${info.width}×${info.height}, ${info.channels}ch → 2ch (LA), ${sizeBefore}KB → ${sizeAfter}KB`,
  );

  if (dryRun) {
    console.log("  (dry run — file not modified)");
    return;
  }
  writeFileSync(filePath, output);
}

const { dryRun, files } = parseArgs(process.argv);
console.log(`Stripping to greyscale+alpha${dryRun ? " [dry run]" : ""}\n`);

for (const file of files) {
  await processFile(file, dryRun);
}
