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
//                                    [--dry-run] <file ...>
//
// --preserve  darkest grey to leave fully opaque (default 200).  Anything
//             at or below this value of min(R,G,B) keeps full alpha and
//             original colour; only lighter pixels get faded.
// --threshold near-white tolerance treated as fully transparent (default 0).

import { readFileSync, writeFileSync } from "fs";
import { basename } from "path";
import sharp from "sharp";

function parseArgs(argv) {
  let preserve = 200;
  let threshold = 0;
  let dryRun = false;
  const files = [];

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--preserve" && argv[i + 1]) {
      preserve = parseInt(argv[++i], 10);
      if (!Number.isFinite(preserve) || preserve < 0 || preserve > 255) {
        console.error("Preserve must be 0-255");
        process.exit(1);
      }
    } else if (argv[i] === "--threshold" && argv[i + 1]) {
      threshold = parseInt(argv[++i], 10);
      if (!Number.isFinite(threshold) || threshold < 0 || threshold > 255) {
        console.error("Threshold must be 0-255");
        process.exit(1);
      }
    } else if (argv[i] === "--dry-run") {
      dryRun = true;
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log(
        "Usage: png-transparent [--preserve 0-255] [--threshold 0-255] [--dry-run] <file.png ...>",
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

  return { preserve, threshold, dryRun, files };
}

function unmixWhite(data, preserve, threshold) {
  let cleared = 0;
  let faded = 0;
  let preserved = 0;
  const denom = 255 - preserve;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a === 0) continue;

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

    const factor = (255 - m) / denom;
    data[i] = Math.max(0, Math.min(255, Math.round(255 - (255 - r) / factor)));
    data[i + 1] = Math.max(
      0,
      Math.min(255, Math.round(255 - (255 - g) / factor)),
    );
    data[i + 2] = Math.max(
      0,
      Math.min(255, Math.round(255 - (255 - b) / factor)),
    );
    data[i + 3] = Math.round(factor * a);
    faded++;
  }
  return { cleared, faded, preserved };
}

async function processFile(filePath, preserve, threshold, dryRun) {
  const input = readFileSync(filePath);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { cleared, faded, preserved } = unmixWhite(data, preserve, threshold);

  const output = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const name = basename(filePath);
  const sizeBefore = (input.length / 1024).toFixed(0);
  const sizeAfter = (output.length / 1024).toFixed(0);
  console.log(
    `${name}: ${info.width}×${info.height}, ${cleared} cleared, ${faded} faded, ${preserved} kept, ${sizeBefore}KB → ${sizeAfter}KB`,
  );

  if (dryRun) {
    console.log("  (dry run — file not modified)");
    return;
  }
  writeFileSync(filePath, output);
}

const { preserve, threshold, dryRun, files } = parseArgs(process.argv);
console.log(
  `Preserve ≤${preserve}, threshold ${threshold}${dryRun ? " [dry run]" : ""}\n`,
);

for (const file of files) {
  await processFile(file, preserve, threshold, dryRun);
}
