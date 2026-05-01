#!/usr/bin/env node

// Crop an SVG to the bounding box of its drawn shapes.
//
// Computes the union bounding box of every visible shape (<path>,
// <rect>, <circle>, <ellipse>, <line>, <polyline>, <polygon>) and
// rewrites the root <svg> width, height, and viewBox to match.  Path
// d attributes are parsed with command awareness (M L H V C S Q T A
// Z, absolute and relative).  Bezier control points are included in
// the bounding box, which over-approximates curves slightly — fine
// for cropping since the result is never tighter than the true bbox.
//
// Shapes with fill="none" and no stroke are treated as invisible and
// excluded.  Shapes whose fill is lighter than --fill-cutoff are also
// excluded — they render as faint shading and dropping them lets the
// crop reach the visually meaningful content (mirroring the PNG
// alpha-threshold heuristic).  Stroke widths and transforms are
// ignored — for the fit assets these are absent or negligible.
//
// Files whose basename starts with "icon-" are forced to a 1:1 square
// canvas — the smaller dimension of the cropped bbox is symmetrically
// expanded so the icon stays centred in a square viewBox.
//
// Usage:
//   node scripts/svg-crop.mjs [--fill-cutoff N] [--padding N]
//                             [--dry-run] <file ...>
//
// --fill-cutoff  paths whose fill min(R,G,B) exceeds this value are
//                excluded from the bbox (default 200, excludes
//                #d0d0d0 and lighter).  Pass 255 to include every
//                visible path regardless of lightness.
// --padding      user-unit margin to keep around the content
//                (default 0).

import { readFileSync, writeFileSync } from "fs";
import { basename } from "path";

function parseArgs(argv) {
  let fillCutoff = 200;
  let padding = 0;
  let dryRun = false;
  const files = [];

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--fill-cutoff" && argv[i + 1]) {
      fillCutoff = parseInt(argv[++i], 10);
      if (!Number.isFinite(fillCutoff) || fillCutoff < 0 || fillCutoff > 255) {
        console.error("Fill cutoff must be 0-255");
        process.exit(1);
      }
    } else if (argv[i] === "--padding" && argv[i + 1]) {
      padding = parseFloat(argv[++i]);
      if (!Number.isFinite(padding) || padding < 0) {
        console.error("Padding must be a non-negative number");
        process.exit(1);
      }
    } else if (argv[i] === "--dry-run") {
      dryRun = true;
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log(
        "Usage: svg-crop [--fill-cutoff N] [--padding N] [--dry-run] <file.svg ...>",
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

  return { fillCutoff, padding, dryRun, files };
}

function makeBox() {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

function include(box, x, y) {
  if (x < box.minX) box.minX = x;
  if (y < box.minY) box.minY = y;
  if (x > box.maxX) box.maxX = x;
  if (y > box.maxY) box.maxY = y;
}

function isEmpty(box) {
  return box.minX === Infinity;
}

const TOKEN_RE =
  /([MmLlHhVvCcSsQqTtAaZz])|(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)/g;

function pathBox(d) {
  const tokens = d.match(TOKEN_RE);
  if (!tokens) return null;

  const box = makeBox();
  let i = 0;
  let cmd = null;
  let cpx = 0;
  let cpy = 0;
  let spx = 0;
  let spy = 0;

  const num = () => parseFloat(tokens[i++]);
  const isLetter = (t) => /^[A-Za-z]$/.test(t);

  while (i < tokens.length) {
    if (isLetter(tokens[i])) {
      cmd = tokens[i++];
      if (cmd === "Z" || cmd === "z") {
        cpx = spx;
        cpy = spy;
        cmd = null;
        continue;
      }
    }
    if (cmd === null) {
      i++;
      continue;
    }

    const abs = cmd === cmd.toUpperCase();
    const c = cmd.toUpperCase();

    if (i >= tokens.length || isLetter(tokens[i])) continue;

    switch (c) {
      case "M": {
        let x = num();
        let y = num();
        if (!abs) {
          x += cpx;
          y += cpy;
        }
        cpx = x;
        cpy = y;
        spx = x;
        spy = y;
        include(box, x, y);
        cmd = abs ? "L" : "l";
        break;
      }
      case "L": {
        let x = num();
        let y = num();
        if (!abs) {
          x += cpx;
          y += cpy;
        }
        cpx = x;
        cpy = y;
        include(box, x, y);
        break;
      }
      case "H": {
        let x = num();
        if (!abs) x += cpx;
        cpx = x;
        include(box, x, cpy);
        break;
      }
      case "V": {
        let y = num();
        if (!abs) y += cpy;
        cpy = y;
        include(box, cpx, y);
        break;
      }
      case "C": {
        let x1 = num();
        let y1 = num();
        let x2 = num();
        let y2 = num();
        let x = num();
        let y = num();
        if (!abs) {
          x1 += cpx;
          y1 += cpy;
          x2 += cpx;
          y2 += cpy;
          x += cpx;
          y += cpy;
        }
        include(box, x1, y1);
        include(box, x2, y2);
        include(box, x, y);
        cpx = x;
        cpy = y;
        break;
      }
      case "S": {
        let x2 = num();
        let y2 = num();
        let x = num();
        let y = num();
        if (!abs) {
          x2 += cpx;
          y2 += cpy;
          x += cpx;
          y += cpy;
        }
        include(box, x2, y2);
        include(box, x, y);
        cpx = x;
        cpy = y;
        break;
      }
      case "Q": {
        let x1 = num();
        let y1 = num();
        let x = num();
        let y = num();
        if (!abs) {
          x1 += cpx;
          y1 += cpy;
          x += cpx;
          y += cpy;
        }
        include(box, x1, y1);
        include(box, x, y);
        cpx = x;
        cpy = y;
        break;
      }
      case "T": {
        let x = num();
        let y = num();
        if (!abs) {
          x += cpx;
          y += cpy;
        }
        include(box, x, y);
        cpx = x;
        cpy = y;
        break;
      }
      case "A": {
        num();
        num();
        num();
        num();
        num();
        let x = num();
        let y = num();
        if (!abs) {
          x += cpx;
          y += cpy;
        }
        include(box, x, y);
        cpx = x;
        cpy = y;
        break;
      }
      default:
        i++;
    }
  }

  return isEmpty(box) ? null : box;
}

function attrBox(attrs) {
  return (name) => {
    const m = attrs.match(new RegExp(`\\b${name}="([^"]+)"`));
    return m ? parseFloat(m[1]) : null;
  };
}

function rectBox(attrs) {
  const get = attrBox(attrs);
  const x = get("x") ?? 0;
  const y = get("y") ?? 0;
  const w = get("width");
  const h = get("height");
  if (w === null || h === null) return null;
  const box = makeBox();
  include(box, x, y);
  include(box, x + w, y + h);
  return box;
}

function circleBox(attrs) {
  const get = attrBox(attrs);
  const cx = get("cx") ?? 0;
  const cy = get("cy") ?? 0;
  const r = get("r");
  if (r === null) return null;
  const box = makeBox();
  include(box, cx - r, cy - r);
  include(box, cx + r, cy + r);
  return box;
}

function ellipseBox(attrs) {
  const get = attrBox(attrs);
  const cx = get("cx") ?? 0;
  const cy = get("cy") ?? 0;
  const rx = get("rx");
  const ry = get("ry");
  if (rx === null || ry === null) return null;
  const box = makeBox();
  include(box, cx - rx, cy - ry);
  include(box, cx + rx, cy + ry);
  return box;
}

function lineBox(attrs) {
  const get = attrBox(attrs);
  const x1 = get("x1") ?? 0;
  const y1 = get("y1") ?? 0;
  const x2 = get("x2") ?? 0;
  const y2 = get("y2") ?? 0;
  const box = makeBox();
  include(box, x1, y1);
  include(box, x2, y2);
  return box;
}

function pointsBox(attrs) {
  const m = attrs.match(/\bpoints="([^"]+)"/);
  if (!m) return null;
  const nums = m[1].match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 2) return null;
  const box = makeBox();
  for (let i = 0; i + 1 < nums.length; i += 2) {
    include(box, parseFloat(nums[i]), parseFloat(nums[i + 1]));
  }
  return isEmpty(box) ? null : box;
}

const NAMED_COLORS = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  red: [255, 0, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
  silver: [192, 192, 192],
};

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

function isInvisible(attrs, fillCutoff) {
  const fill = attrs.match(/\bfill="([^"]+)"/)?.[1];
  const stroke = attrs.match(/\bstroke="([^"]+)"/)?.[1];
  const strokeAbsent = !stroke || stroke === "none";
  if (fill === "none" && strokeAbsent) return true;
  if (!strokeAbsent) return false;
  if (!fill) return false;
  const rgb = parseColor(fill);
  if (!rgb) return false;
  return Math.min(rgb[0], rgb[1], rgb[2]) > fillCutoff;
}

function unionBox(svg, fillCutoff) {
  const total = makeBox();
  const merge = (b) => {
    if (!b) return;
    if (b.minX < total.minX) total.minX = b.minX;
    if (b.minY < total.minY) total.minY = b.minY;
    if (b.maxX > total.maxX) total.maxX = b.maxX;
    if (b.maxY > total.maxY) total.maxY = b.maxY;
  };

  const elementRe =
    /<(path|rect|circle|ellipse|line|polyline|polygon)\b([^/>]*?)\/?>/g;
  let m;
  while ((m = elementRe.exec(svg)) !== null) {
    const tag = m[1];
    const attrs = m[2];
    if (isInvisible(attrs, fillCutoff)) continue;
    let box = null;
    if (tag === "path") {
      const d = attrs.match(/\bd="([^"]+)"/)?.[1];
      if (d) box = pathBox(d);
    } else if (tag === "rect") box = rectBox(attrs);
    else if (tag === "circle") box = circleBox(attrs);
    else if (tag === "ellipse") box = ellipseBox(attrs);
    else if (tag === "line") box = lineBox(attrs);
    else if (tag === "polyline" || tag === "polygon") box = pointsBox(attrs);
    merge(box);
  }

  return isEmpty(total) ? null : total;
}

function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, "");
}

function rewriteSvgRoot(svg, box, padding) {
  const x = box.minX - padding;
  const y = box.minY - padding;
  const w = box.maxX - box.minX + padding * 2;
  const h = box.maxY - box.minY + padding * 2;

  let out = svg.replace(/<svg\b[^>]*>/, (tag) => {
    let next = tag;
    next = next.replace(/\bwidth="[^"]*"/, `width="${fmt(w)}"`);
    next = next.replace(/\bheight="[^"]*"/, `height="${fmt(h)}"`);
    next = next.replace(
      /\bviewBox="[^"]*"/,
      `viewBox="${fmt(x)} ${fmt(y)} ${fmt(w)} ${fmt(h)}"`,
    );
    if (!/\bwidth=/.test(next))
      next = next.replace(/<svg\b/, `<svg width="${fmt(w)}"`);
    if (!/\bheight=/.test(next))
      next = next.replace(/<svg\b/, `<svg height="${fmt(h)}"`);
    if (!/\bviewBox=/.test(next))
      next = next.replace(
        /<svg\b/,
        `<svg viewBox="${fmt(x)} ${fmt(y)} ${fmt(w)} ${fmt(h)}"`,
      );
    return next;
  });

  return { out, w, h };
}

function readDims(svg) {
  const tag = svg.match(/<svg\b[^>]*>/)?.[0] ?? "";
  const w = tag.match(/\bwidth="([^"]+)"/)?.[1];
  const h = tag.match(/\bheight="([^"]+)"/)?.[1];
  const vb = tag.match(/\bviewBox="([^"]+)"/)?.[1];
  let viewBox = null;
  if (vb) {
    const nums = vb.trim().split(/[\s,]+/).map(parseFloat);
    if (nums.length === 4 && nums.every(Number.isFinite)) {
      viewBox = {
        minX: nums[0],
        minY: nums[1],
        maxX: nums[0] + nums[2],
        maxY: nums[1] + nums[3],
      };
    }
  }
  return { w, h, viewBox };
}

function clamp(box, bounds) {
  if (!bounds) return box;
  return {
    minX: Math.max(box.minX, bounds.minX),
    minY: Math.max(box.minY, bounds.minY),
    maxX: Math.min(box.maxX, bounds.maxX),
    maxY: Math.min(box.maxY, bounds.maxY),
  };
}

function isNoopBox(box, bounds) {
  if (!bounds) return false;
  return (
    box.minX === bounds.minX &&
    box.minY === bounds.minY &&
    box.maxX === bounds.maxX &&
    box.maxY === bounds.maxY
  );
}

function squareBox(box) {
  const w = box.maxX - box.minX;
  const h = box.maxY - box.minY;
  if (w === h) return box;
  if (w > h) {
    const grow = (w - h) / 2;
    return {
      minX: box.minX,
      minY: box.minY - grow,
      maxX: box.maxX,
      maxY: box.maxY + grow,
    };
  }
  const grow = (h - w) / 2;
  return {
    minX: box.minX - grow,
    minY: box.minY,
    maxX: box.maxX + grow,
    maxY: box.maxY,
  };
}

function processFile(filePath, fillCutoff, padding, dryRun) {
  const input = readFileSync(filePath, "utf8");
  const before = readDims(input);
  const raw = unionBox(input, fillCutoff);
  const name = basename(filePath);

  if (!raw) {
    console.log(`${name}: no drawable shapes found, skipped`);
    return;
  }

  let box = clamp(raw, before.viewBox);
  const forceSquare = name.startsWith("icon-");
  if (forceSquare) box = squareBox(box);

  if (padding === 0 && isNoopBox(box, before.viewBox)) {
    console.log(`${name}: ${before.w}×${before.h}, already tight`);
    return;
  }

  const { out, w, h } = rewriteSvgRoot(input, box, padding);
  const sizeBefore = (input.length / 1024).toFixed(0);
  const sizeAfter = (out.length / 1024).toFixed(0);
  console.log(
    `${name}: ${before.w}×${before.h} → ${fmt(w)}×${fmt(h)}, ${sizeBefore}KB → ${sizeAfter}KB`,
  );

  if (dryRun) {
    console.log("  (dry run — file not modified)");
    return;
  }
  writeFileSync(filePath, out);
}

const { fillCutoff, padding, dryRun, files } = parseArgs(process.argv);
console.log(
  `Fill cutoff ${fillCutoff}, padding ${padding}${dryRun ? " [dry run]" : ""}\n`,
);

for (const file of files) {
  processFile(file, fillCutoff, padding, dryRun);
}
