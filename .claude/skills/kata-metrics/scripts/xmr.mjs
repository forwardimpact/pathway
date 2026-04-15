#!/usr/bin/env node

// XmR control chart analysis for Kata metrics CSV files.
//
// Usage: node xmr.mjs <csv-path>
// Output: JSON control chart report to stdout.

import { readFileSync } from "node:fs";

const MIN_POINTS = 15;

function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  return lines.slice(1).map((line) => {
    const fields = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (char === "," && !inQuotes) {
        fields.push(current);
        current = "";
        continue;
      }
      current += char;
    }
    fields.push(current);
    return {
      date: fields[0],
      metric: fields[1],
      value: Number(fields[2]),
      unit: fields[3] || "",
      run: fields[4] || "",
      note: fields[5] || "",
    };
  });
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function computeXmR(values) {
  const n = values.length;
  const xBar = values.reduce((a, b) => a + b, 0) / n;

  const mrs = [];
  for (let i = 1; i < n; i++) {
    mrs.push(Math.abs(values[i] - values[i - 1]));
  }
  const mrBar =
    mrs.length > 0 ? mrs.reduce((a, b) => a + b, 0) / mrs.length : 0;

  return {
    xBar,
    mrBar,
    unpl: xBar + 2.66 * mrBar,
    lnpl: Math.max(0, xBar - 2.66 * mrBar),
    url: 3.27 * mrBar,
    mrs,
  };
}

// Detect streaks where a test function is true and emit one signal per streak.
// Callback receives (dates, startIdx, endIdx, count, min, max).
function streaks(dates, series, test, makeSignal) {
  const signals = [];
  let start = -1;
  let lo = null;
  let hi = null;
  for (let i = 0; i <= series.length; i++) {
    if (i < series.length && test(series[i])) {
      if (start < 0) {
        start = i;
        lo = hi = series[i];
      } else {
        if (series[i] < lo) lo = series[i];
        if (series[i] > hi) hi = series[i];
      }
    } else if (start >= 0) {
      signals.push(makeSignal(dates, start, i - 1, i - start, lo, hi));
      start = -1;
      lo = hi = null;
    }
  }
  return signals;
}

// eslint-disable-next-line complexity -- inherent to 4 XMR rules
function detectSignals(dates, values, mrs, stats) {
  const { xBar, unpl, lnpl, url } = stats;
  const signals = [];

  // Rule 1: Streaks of points above UNPL.
  signals.push(
    ...streaks(
      dates,
      values,
      (v) => v > unpl,
      (d, s, e, n, _lo, hi) => ({
        rule: "point_above_unpl",
        ...(n === 1 ? { date: d[s] } : { from: d[s], to: d[e] }),
        count: n,
        peak: hi,
      }),
    ),
  );

  // Rule 1b: Streaks of points below LNPL.
  if (lnpl > 0) {
    signals.push(
      ...streaks(
        dates,
        values,
        (v) => v < lnpl,
        (d, s, e, n, lo) => ({
          rule: "point_below_lnpl",
          ...(n === 1 ? { date: d[s] } : { from: d[s], to: d[e] }),
          count: n,
          trough: lo,
        }),
      ),
    );
  }

  // Rule 2: Run of 8+ consecutive points on same side of X-bar.
  let runStart = 0;
  let runSide = values[0] >= xBar ? 1 : -1;
  for (let i = 1; i <= values.length; i++) {
    const side = i < values.length ? (values[i] >= xBar ? 1 : -1) : 0;
    if (side !== runSide || i === values.length) {
      if (i - runStart >= 8) {
        signals.push({
          rule: runSide > 0 ? "run_above" : "run_below",
          from: dates[runStart],
          to: dates[i - 1],
          length: i - runStart,
        });
      }
      runStart = i;
      runSide = side;
    }
  }

  // Rule 3: Trend of 6+ consecutive increases or decreases.
  let moves = 0;
  let moveDir = 0;
  for (let i = 1; i <= values.length; i++) {
    const dir =
      i < values.length
        ? values[i] > values[i - 1]
          ? 1
          : values[i] < values[i - 1]
            ? -1
            : 0
        : 0;
    if (dir !== 0 && dir === moveDir) {
      moves++;
    } else {
      if (moves >= 6) {
        signals.push({
          rule: moveDir > 0 ? "trend_up" : "trend_down",
          from: dates[i - moves - 1],
          to: dates[i - 1],
          moves,
        });
      }
      moves = dir !== 0 ? 1 : 0;
      moveDir = dir;
    }
  }

  // Rule 4: Streaks of moving range above URL.
  if (url > 0) {
    signals.push(
      ...streaks(
        dates.slice(1),
        mrs,
        (v) => v > url,
        (d, s, e, n, _lo, hi) => ({
          rule: "mr_above_url",
          ...(n === 1 ? { date: d[s] } : { from: d[s], to: d[e] }),
          count: n,
          peak: hi,
        }),
      ),
    );
  }

  return signals.sort((a, b) =>
    (a.date || a.from).localeCompare(b.date || b.from),
  );
}

function analyze(csvPath) {
  const text = readFileSync(csvPath, "utf-8");
  const rows = parseCSV(text);

  const groups = {};
  for (const row of rows) {
    if (!groups[row.metric]) groups[row.metric] = [];
    groups[row.metric].push(row);
  }

  const metrics = [];
  for (const [name, group] of Object.entries(groups)) {
    group.sort((a, b) => a.date.localeCompare(b.date));
    const dates = group.map((r) => r.date);
    const values = group.map((r) => r.value);
    const unit = group[0].unit;
    const n = values.length;

    if (n < MIN_POINTS) {
      metrics.push({
        metric: name,
        unit,
        n,
        from: dates[0],
        to: dates[n - 1],
        status: "insufficient_data",
      });
      continue;
    }

    const stats = computeXmR(values);
    const signals = detectSignals(dates, values, stats.mrs, stats);
    const lastMR = n > 1 ? Math.abs(values[n - 1] - values[n - 2]) : null;

    metrics.push({
      metric: name,
      unit,
      n,
      from: dates[0],
      to: dates[n - 1],
      x_bar: round2(stats.xBar),
      mr_bar: round2(stats.mrBar),
      unpl: round2(stats.unpl),
      lnpl: round2(stats.lnpl),
      url: round2(stats.url),
      latest: { date: dates[n - 1], value: values[n - 1], mr: lastMR },
      signals,
      status: signals.length > 0 ? "signals_present" : "predictable",
    });
  }

  return {
    source: csvPath,
    generated: new Date().toISOString().slice(0, 10),
    metrics,
  };
}

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage: xmr.mjs <csv-path>");
  process.exit(1);
}
console.log(JSON.stringify(analyze(csvPath), null, 2));
