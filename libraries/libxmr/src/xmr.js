// XmR control chart analysis for Kata metrics CSV files.

const MIN_POINTS = 15;

const EXPECTED_HEADER = "date,metric,value,unit,run,note";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseCSV(text) {
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

export function computeXmR(values) {
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

// eslint-disable-next-line complexity -- inherent to 4 XmR signal rules
export function detectSignals(dates, values, mrs, stats) {
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

// Classify a metric report from `analyze` into a coarse process-behavior
// category. Deterministic — derived purely from `status` and the signal mix.
//
//   insufficient — fewer than MIN_POINTS data points, no limits computed.
//   stable       — predictable; no signals.
//   chaos        — moving range exceeds URL (mr_above_url signal); the limits
//                  themselves are unreliable until the chaos is investigated.
//   signals      — signals present but not chaos; investigate special cause.
export function classify(metric) {
  if (metric.status === "insufficient_data") return "insufficient";
  if (metric.status === "predictable") return "stable";
  if (metric.signals?.some((s) => s.rule === "mr_above_url")) return "chaos";
  return "signals";
}

export function analyze(csvText) {
  const rows = parseCSV(csvText);

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

  return { metrics };
}

export function validateCSV(text) {
  const lines = text.trim().split("\n");
  const errors = [];

  if (lines[0].trim() !== EXPECTED_HEADER) {
    errors.push({
      line: 1,
      message: `expected header "${EXPECTED_HEADER}", got "${lines[0].trim()}"`,
    });
  }

  let dataRows = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    dataRows++;
    const row = parseCSV(EXPECTED_HEADER + "\n" + line)[0];
    if (!row) continue;

    if (!row.date || !ISO_DATE_RE.test(row.date)) {
      errors.push({
        line: i + 1,
        field: "date",
        message: `invalid ISO 8601 date "${row.date}"`,
      });
    }
    if (!row.metric) {
      errors.push({
        line: i + 1,
        field: "metric",
        message: "missing metric name",
      });
    }
    if (Number.isNaN(row.value)) {
      errors.push({
        line: i + 1,
        field: "value",
        message: `not a number "${lines[i].split(",")[2]}"`,
      });
    }
    if (!row.unit) {
      errors.push({ line: i + 1, field: "unit", message: "missing unit" });
    }
  }

  return { valid: errors.length === 0, rows: dataRows, errors };
}

// Sparkline — 12 characters showing the last 12 points as bar heights.
// 9 levels: space (empty), ▁▂▃▄▅▆▇█ (min to max).

const BARS = " ▁▂▃▄▅▆▇█";

export function sparkline(values) {
  const last = values.slice(-12);

  while (last.length < 12) {
    last.unshift(null);
  }

  const nums = last.filter((v) => v !== null);
  if (nums.length === 0) return "            ";

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min;

  return last
    .map((v) => {
      if (v === null) return " ";
      if (range === 0) return BARS[4];
      return BARS[1 + Math.round(((v - min) / range) * 7)];
    })
    .join("");
}

export function listMetrics(csvText) {
  const rows = parseCSV(csvText);

  const groups = {};
  for (const row of rows) {
    if (!groups[row.metric]) groups[row.metric] = [];
    groups[row.metric].push(row);
  }

  return Object.entries(groups).map(([name, group]) => {
    group.sort((a, b) => a.date.localeCompare(b.date));
    return {
      metric: name,
      unit: group[0].unit,
      n: group.length,
      from: group[0].date,
      to: group[group.length - 1].date,
    };
  });
}
