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
//   node scripts/svg-crop.mjs [--fill-cutoff N] [--padding N] <file ...>
//
// --fill-cutoff  paths whose fill min(R,G,B) exceeds this value are
//                excluded from the bbox (default 200, excludes
//                #d0d0d0 and lighter).  Pass 255 to include every
//                visible path regardless of lightness.
// --padding      user-unit margin to keep around the content
//                (default 0).

import { readFileSync, writeFileSync } from "fs";
import { basename } from "path";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  options: {
    "fill-cutoff": { type: "string", default: "200" },
    padding: { type: "string", default: "0" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
});

if (values.help || positionals.length === 0) {
  console.log("Usage: svg-crop [--fill-cutoff N] [--padding N] <file.svg ...>");
  process.exit(values.help ? 0 : 1);
}

const fillCutoff = numIn("--fill-cutoff", values["fill-cutoff"], 0, 255, true);
const padding = numIn("--padding", values.padding, 0, Infinity, false);

function numIn(name, raw, lo, hi, asInt) {
  const n = asInt ? parseInt(raw, 10) : parseFloat(raw);
  if (!Number.isFinite(n) || n < lo || n > hi) {
    console.error(`${name} must be ${lo}-${hi === Infinity ? "∞" : hi}`);
    process.exit(1);
  }
  return n;
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
const isLetter = (t) => /^[A-Za-z]$/.test(t);

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
    if (i >= tokens.length || isLetter(tokens[i])) continue;

    const abs = cmd === cmd.toUpperCase();
    const c = cmd.toUpperCase();
    const rx = (x) => (abs ? x : cpx + x);
    const ry = (y) => (abs ? y : cpy + y);

    if (c === "M" || c === "L") {
      const x = rx(num());
      const y = ry(num());
      cpx = x;
      cpy = y;
      if (c === "M") {
        spx = x;
        spy = y;
        cmd = abs ? "L" : "l";
      }
      include(box, x, y);
    } else if (c === "H") {
      cpx = rx(num());
      include(box, cpx, cpy);
    } else if (c === "V") {
      cpy = ry(num());
      include(box, cpx, cpy);
    } else if (c === "C") {
      const x1 = rx(num()), y1 = ry(num());
      const x2 = rx(num()), y2 = ry(num());
      const x = rx(num()), y = ry(num());
      include(box, x1, y1);
      include(box, x2, y2);
      include(box, x, y);
      cpx = x;
      cpy = y;
    } else if (c === "S" || c === "Q") {
      const x1 = rx(num()), y1 = ry(num());
      const x = rx(num()), y = ry(num());
      include(box, x1, y1);
      include(box, x, y);
      cpx = x;
      cpy = y;
    } else if (c === "T") {
      const x = rx(num()), y = ry(num());
      include(box, x, y);
      cpx = x;
      cpy = y;
    } else if (c === "A") {
      num(); num(); num(); num(); num();
      const x = rx(num()), y = ry(num());
      include(box, x, y);
      cpx = x;
      cpy = y;
    } else {
      i++;
    }
  }

  return isEmpty(box) ? null : box;
}

function getAttr(attrs, name) {
  const m = attrs.match(new RegExp(`\\b${name}="([^"]+)"`));
  return m ? parseFloat(m[1]) : null;
}

function rectBox(attrs) {
  const x = getAttr(attrs, "x") ?? 0;
  const y = getAttr(attrs, "y") ?? 0;
  const w = getAttr(attrs, "width");
  const h = getAttr(attrs, "height");
  if (w === null || h === null) return null;
  const box = makeBox();
  include(box, x, y);
  include(box, x + w, y + h);
  return box;
}

function circleBox(attrs) {
  const cx = getAttr(attrs, "cx") ?? 0;
  const cy = getAttr(attrs, "cy") ?? 0;
  const r = getAttr(attrs, "r");
  if (r === null) return null;
  const box = makeBox();
  include(box, cx - r, cy - r);
  include(box, cx + r, cy + r);
  return box;
}

function ellipseBox(attrs) {
  const cx = getAttr(attrs, "cx") ?? 0;
  const cy = getAttr(attrs, "cy") ?? 0;
  const rx = getAttr(attrs, "rx");
  const ry = getAttr(attrs, "ry");
  if (rx === null || ry === null) return null;
  const box = makeBox();
  include(box, cx - rx, cy - ry);
  include(box, cx + rx, cy + ry);
  return box;
}

function lineBox(attrs) {
  const box = makeBox();
  include(box, getAttr(attrs, "x1") ?? 0, getAttr(attrs, "y1") ?? 0);
  include(box, getAttr(attrs, "x2") ?? 0, getAttr(attrs, "y2") ?? 0);
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

function parseColor(value) {
  const v = value.trim().toLowerCase();
  if (v === "none" || v === "currentcolor" || v === "transparent") return null;

  if (v.startsWith("#")) {
    const hex = v.slice(1);
    if (hex.length === 3) {
      return hex.split("").map((c) => parseInt(c + c, 16));
    }
    if (hex.length === 4) {
      return hex.split("").slice(0, 3).map((c) => parseInt(c + c, 16));
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
  if (rgb) return [parseInt(rgb[1], 10), parseInt(rgb[2], 10), parseInt(rgb[3], 10)];

  return NAMED_COLORS[v] ?? null;
}

function isInvisible(attrs) {
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

const SHAPE_BOX = {
  path: (a) => {
    const d = a.match(/\bd="([^"]+)"/)?.[1];
    return d ? pathBox(d) : null;
  },
  rect: rectBox,
  circle: circleBox,
  ellipse: ellipseBox,
  line: lineBox,
  polyline: pointsBox,
  polygon: pointsBox,
};

function unionBox(svg) {
  const total = makeBox();
  const re = /<(path|rect|circle|ellipse|line|polyline|polygon)\b([^/>]*?)\/?>/g;
  let m;
  while ((m = re.exec(svg)) !== null) {
    const [, tag, attrs] = m;
    if (isInvisible(attrs)) continue;
    const b = SHAPE_BOX[tag](attrs);
    if (!b) continue;
    if (b.minX < total.minX) total.minX = b.minX;
    if (b.minY < total.minY) total.minY = b.minY;
    if (b.maxX > total.maxX) total.maxX = b.maxX;
    if (b.maxY > total.maxY) total.maxY = b.maxY;
  }
  return isEmpty(total) ? null : total;
}

function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, "");
}

function setOrInsert(tag, name, value) {
  if (new RegExp(`\\b${name}=`).test(tag)) {
    return tag.replace(new RegExp(`\\b${name}="[^"]*"`), `${name}="${value}"`);
  }
  return tag.replace(/<svg\b/, `<svg ${name}="${value}"`);
}

function rewriteSvgRoot(svg, box) {
  const x = box.minX - padding;
  const y = box.minY - padding;
  const w = box.maxX - box.minX + padding * 2;
  const h = box.maxY - box.minY + padding * 2;

  const out = svg.replace(/<svg\b[^>]*>/, (tag) => {
    let next = tag;
    next = setOrInsert(next, "width", fmt(w));
    next = setOrInsert(next, "height", fmt(h));
    next = setOrInsert(next, "viewBox", `${fmt(x)} ${fmt(y)} ${fmt(w)} ${fmt(h)}`);
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
    return { minX: box.minX, minY: box.minY - grow, maxX: box.maxX, maxY: box.maxY + grow };
  }
  const grow = (h - w) / 2;
  return { minX: box.minX - grow, minY: box.minY, maxX: box.maxX + grow, maxY: box.maxY };
}

function processFile(filePath) {
  const input = readFileSync(filePath, "utf8");
  const before = readDims(input);
  const raw = unionBox(input);
  const name = basename(filePath);

  if (!raw) {
    console.log(`${name}: no drawable shapes found, skipped`);
    return;
  }

  let box = clamp(raw, before.viewBox);
  if (name.startsWith("icon-")) box = squareBox(box);

  if (padding === 0 && isNoopBox(box, before.viewBox)) {
    console.log(`${name}: ${before.w}×${before.h}, already tight`);
    return;
  }

  const { out, w, h } = rewriteSvgRoot(input, box);
  console.log(
    `${name}: ${before.w}×${before.h} → ${fmt(w)}×${fmt(h)}, ${kb(input)}KB → ${kb(out)}KB`,
  );
  writeFileSync(filePath, out);
}

function kb(s) {
  return (s.length / 1024).toFixed(0);
}

console.log(`Fill cutoff ${fillCutoff}, padding ${padding}\n`);
for (const file of positionals) processFile(file);
