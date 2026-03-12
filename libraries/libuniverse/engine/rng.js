import seedrandom from "seedrandom";

/**
 * Create a seeded RNG with convenience methods.
 * @param {number|string} seed
 * @returns {{ random: () => number, randomInt: (min: number, max: number) => number, pick: <T>(arr: T[]) => T, shuffle: <T>(arr: T[]) => T[], weightedPick: (items: Array<{weight: number}>) => number, gaussian: (mean: number, std: number) => number }}
 */
export function createSeededRNG(seed) {
  const rng = seedrandom(String(seed));

  const random = () => rng();
  const randomInt = (min, max) => Math.floor(random() * (max - min + 1)) + min;
  const pick = (arr) => arr[Math.floor(random() * arr.length)];

  const shuffle = (arr) => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };

  const weightedPick = (weights) => {
    const total = weights.reduce((s, w) => s + w, 0);
    let r = random() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return weights.length - 1;
  };

  const gaussian = (mean, std) => {
    const u1 = random();
    const u2 = random();
    const z =
      Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
    return mean + z * std;
  };

  return { random, randomInt, pick, shuffle, weightedPick, gaussian };
}
