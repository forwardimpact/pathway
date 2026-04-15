# Process Behavior Charts (XmR)

XmR (individuals and moving range) charts are the standard tool for
distinguishing stable processes from those reacting to special causes. They use
the data itself to compute natural process limits — no external targets needed.

## Construction

1. **X chart (individuals):** Plot each measurement value in time order. Compute
   the average (X-bar) as the central line.
2. **mR chart (moving range):** Compute the absolute difference between
   consecutive measurements. Compute the average moving range (mR-bar).
3. **Natural Process Limits (NPL):** Upper NPL = X-bar + 2.66 x mR-bar. Lower
   NPL = X-bar - 2.66 x mR-bar (or 0 if negative for counts).
4. **Plot.** X chart with X-bar and NPLs. mR chart with mR-bar and Upper Range
   Limit (URL = 3.27 x mR-bar).

## Reading the Chart

- **Within limits, no patterns** — stable/predictable process. Variation is
  routine. Do not react to individual points.
- **Point outside NPL** — signal (special cause). Investigate what changed.
- **Run of 8+ on same side of central line** — signal. Process has shifted.
- **Trend of 6+ consecutive increases or decreases** — signal.

## Guidance for Agents

- Build charts mentally or in markdown tables when reviewing metrics during
  storyboard meetings.
- Minimum 10-15 data points before computing meaningful limits.
- When a signal appears, annotate the CSV `note` field with what you discover.
- Do not set targets based on NPLs — they describe what the process _does_, not
  what it _should_ do. Target conditions come from the storyboard.
