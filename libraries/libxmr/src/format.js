// Single source of truth for one-decimal value formatting. Used by
// chart labels, signal descriptions, and human-facing report output —
// keep these consistent so the same value never reads as "1" in one
// place and "1.0" in another.
export function fmt1(n) {
  return (Math.round(n * 10) / 10).toFixed(1);
}

export function round1(n) {
  return Math.round(n * 10) / 10;
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}
