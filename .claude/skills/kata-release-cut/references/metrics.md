# Metrics — Release Cut

Record per KATA.md § Metrics. Append
one row per run.

| Metric       | Unit  | Description                            | Data source     |
| ------------ | ----- | -------------------------------------- | --------------- |
| releases_cut | count | Releases tagged and published this run | gh release list |

Unreleased commit count and time-since-last-release are queried from `git log`
and `gh release list` — they're stocks/sawtooth, not process data.
