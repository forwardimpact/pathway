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
//   node scripts/png-crop.mjs [--alpha-threshold N] [--min-pixels N]
//                             [--padding N] [--dry-run] <file ...>
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
import sharp from "sharp";

function parseArgs(argv) {
  let alphaThreshold = 80;
  let minPixels = 8;
  let padding = 0;
  let dryRun = false;
  const files = [];

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--alpha-threshold" && argv[i + 1]) {
      alphaThreshold = parseInt(argv[++i], 10);
      if (
        !Number.isFinite(alphaThreshold) ||
        alphaThreshold < 0 ||
        alphaThreshold > 254
      ) {
        console.error("Alpha threshold must be 0-254");
        process.exit(1);
      }
    } else if (argv[i] === "--min-pixels" && argv[i + 1]) {
      minPixels = parseInt(argv[++i], 10);
      if (!Number.isFinite(minPixels) || minPixels < 1) {
        console.error("Min pixels must be a positive integer");
        process.exit(1);
      }
    } else if (argv[i] === "--padding" && argv[i + 1]) {
      padding = parseInt(argv[++i], 10);
      if (!Number.isFinite(padding) || padding < 0) {
        console.error("Padding must be a non-negative integer");
        process.exit(1);
      }
    } else if (argv[i] === "--dry-run") {
      dryRun = true;
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log(
        "Usage: png-crop [--alpha-threshold N] [--min-pixels N] [--padding N] [--dry-run] <file.png ...>",
      );
      process.exit(0);
    } else {
      files.push(argv[i]);
    }
  }

  if (files.length === 0) {
    console.error("No PNG files specified. Use --help for usage.");
    process.exit(1);
  }

  return { alphaThreshold, minPixels, padding, dryRun, files };
}

function findContentBox(data, width, height, alphaThreshold, minPixels) {
  const rowCounts = new Uint32Array(height);
  const colCounts = new Uint32Array(width);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a <= alphaThreshold) continue;
      rowCounts[y]++;
      colCounts[x]++;
    }
  }

  let minY = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    if (rowCounts[y] >= minPixels) {
      if (minY < 0) minY = y;
      maxY = y;
    }
  }
  let minX = -1;
  let maxX = -1;
  for (let x = 0; x < width; x++) {
    if (colCounts[x] >= minPixels) {
      if (minX < 0) minX = x;
      maxX = x;
    }
  }

  if (minX < 0 || minY < 0) return null;
  return { minX, minY, maxX, maxY };
}

async function processFile(filePath, alphaThreshold, minPixels, padding, dryRun) {
  const input = readFileSync(filePath);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const box = findContentBox(
    data,
    info.width,
    info.height,
    alphaThreshold,
    minPixels,
  );
  const name = basename(filePath);

  if (!box) {
    console.log(`${name}: fully transparent, skipped`);
    return;
  }

  const cropW = box.maxX - box.minX + 1;
  const cropH = box.maxY - box.minY + 1;
  const forceSquare = name.startsWith("icon-");
  const squareSide = forceSquare ? Math.max(cropW, cropH) : 0;
  const squareLeft = forceSquare ? Math.floor((squareSide - cropW) / 2) : 0;
  const squareRight = forceSquare ? squareSide - cropW - squareLeft : 0;
  const squareTop = forceSquare ? Math.floor((squareSide - cropH) / 2) : 0;
  const squareBottom = forceSquare ? squareSide - cropH - squareTop : 0;
  const isNoop =
    box.minX === 0 &&
    box.minY === 0 &&
    cropW === info.width &&
    cropH === info.height &&
    padding === 0 &&
    (!forceSquare || cropW === cropH);

  if (isNoop) {
    console.log(`${name}: ${info.width}×${info.height}, already tight`);
    return;
  }

  let pipeline = sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).extract({
    left: box.minX,
    top: box.minY,
    width: cropW,
    height: cropH,
  });

  if (forceSquare && (squareLeft || squareRight || squareTop || squareBottom)) {
    pipeline = pipeline.extend({
      top: squareTop,
      bottom: squareBottom,
      left: squareLeft,
      right: squareRight,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }

  if (padding > 0) {
    pipeline = pipeline.extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }

  const output = await pipeline.png({ compressionLevel: 9 }).toBuffer();
  const baseW = forceSquare ? squareSide : cropW;
  const baseH = forceSquare ? squareSide : cropH;
  const outW = baseW + padding * 2;
  const outH = baseH + padding * 2;

  const sizeBefore = (input.length / 1024).toFixed(0);
  const sizeAfter = (output.length / 1024).toFixed(0);
  console.log(
    `${name}: ${info.width}×${info.height} → ${outW}×${outH}, ${sizeBefore}KB → ${sizeAfter}KB`,
  );

  if (dryRun) {
    console.log("  (dry run — file not modified)");
    return;
  }
  writeFileSync(filePath, output);
}

const { alphaThreshold, minPixels, padding, dryRun, files } = parseArgs(
  process.argv,
);
console.log(
  `Alpha threshold ${alphaThreshold}, min pixels ${minPixels}, padding ${padding}${dryRun ? " [dry run]" : ""}\n`,
);

for (const file of files) {
  await processFile(file, alphaThreshold, minPixels, padding, dryRun);
}
