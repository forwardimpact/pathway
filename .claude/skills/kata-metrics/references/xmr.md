# XmR Charts

XmR (individuals and moving range) charts distinguish stable processes from
those reacting to special causes. They use the data itself to compute natural
process limits — no external targets needed.

## Usage

Run `fit-xmr analyze` against any observation CSV:

```sh
bunx fit-xmr analyze wiki/metrics/{agent}/{domain}/{YYYY}.csv
```

Other commands: `fit-xmr list` (metric inventory), `fit-xmr validate` (schema
check). Run `fit-xmr --help` for details.

Output is JSON to stdout. Pipe through `jq` or read directly.

## Construction

1. **X chart (individuals):** Plot each measurement in time order. Compute the
   average (`x_bar`) as the central line.
2. **mR chart (moving range):** Compute `|x_i - x_{i-1}|` for consecutive
   measurements. Compute the average moving range (`mr_bar`).
3. **Natural Process Limits (NPL):** `unpl = x_bar + 2.66 * mr_bar`.
   `lnpl = max(0, x_bar - 2.66 * mr_bar)`.
4. **Upper Range Limit:** `url = 3.27 * mr_bar` (for the mR chart).

Minimum 15 data points before computing meaningful limits.

## Signal Rules

| Rule               | Meaning                                |
| ------------------ | -------------------------------------- |
| `point_above_unpl` | Value exceeds upper natural limit      |
| `point_below_lnpl` | Value below lower natural limit        |
| `run_above`        | 8+ consecutive points above X-bar      |
| `run_below`        | 8+ consecutive points below X-bar      |
| `trend_up`         | 6+ consecutive increases               |
| `trend_down`       | 6+ consecutive decreases               |
| `mr_above_url`     | Moving range exceeds upper range limit |

## JSON Report Format

The script outputs one JSON object with a `metrics` array. Each element:

```json
{
  "metric": "open_issues",
  "unit": "count",
  "n": 105,
  "from": "2026-01-01",
  "to": "2026-04-14",
  "x_bar": 16.79,
  "mr_bar": 0.64,
  "unpl": 18.5,
  "lnpl": 15.08,
  "url": 2.11,
  "latest": { "date": "2026-04-14", "value": 13, "mr": 1 },
  "signals": [
    { "rule": "run_below", "from": "2026-02-25", "to": "2026-04-14", "length": 50 },
    { "rule": "point_below_lnpl", "from": "2026-03-02", "to": "2026-04-14", "count": 45, "trough": 7 }
  ],
  "status": "signals_present"
}
```

### Field Reference

| Field     | Type   | Description                                           |
| --------- | ------ | ----------------------------------------------------- |
| `metric`  | string | Metric name from the CSV                              |
| `unit`    | string | Unit of measurement                                   |
| `n`       | number | Number of data points                                 |
| `from`    | string | First observation date (ISO 8601)                     |
| `to`      | string | Last observation date (ISO 8601)                      |
| `x_bar`   | number | Central line (mean of all values)                     |
| `mr_bar`  | number | Average moving range                                  |
| `unpl`    | number | Upper natural process limit                           |
| `lnpl`    | number | Lower natural process limit (0 floor for counts)      |
| `url`     | number | Upper range limit (for mR chart)                      |
| `latest`  | object | Most recent observation: `date`, `value`, `mr`        |
| `signals` | array  | Detected signals (see Signal Shapes below)            |
| `status`  | string | `predictable`, `signals_present`, `insufficient_data` |

### Signal Shapes

**Point signals** — consecutive out-of-bounds points consolidated into streaks:

```json
{ "rule": "point_above_unpl", "from": "...", "to": "...", "count": 11, "peak": 25 }
{ "rule": "point_below_lnpl", "date": "...", "count": 1, "trough": 7 }
```

Single-point streaks use `date`; multi-point streaks use `from`/`to`.

**Run signals** — 8+ consecutive points on same side of X-bar:

```json
{ "rule": "run_above", "from": "...", "to": "...", "length": 40 }
```

**Trend signals** — 6+ consecutive increases or decreases:

```json
{ "rule": "trend_down", "from": "...", "to": "...", "moves": 8 }
```

**mR signals** — moving range exceeds URL (unusual point-to-point volatility):

```json
{ "rule": "mr_above_url", "date": "...", "count": 1, "peak": 5 }
```

## Interpretation Guidance

- **`status: "predictable"`** — process is stable. Variation is routine noise.
  Do not react to individual data points.
- **`status: "signals_present"`** — one or more special causes detected. Read
  the `signals` array to understand what changed and when.
- **`status: "insufficient_data"`** — fewer than 15 points. Limits are not
  meaningful yet. Continue recording.
- **Runs and trends** are the most actionable signals — they indicate the
  process level has shifted. Point signals confirm the magnitude of the shift.
- Do not set targets based on NPLs — they describe what the process _does_, not
  what it _should_ do. Target conditions come from the storyboard.
- When a signal appears, annotate the CSV `note` field with what you discover.
