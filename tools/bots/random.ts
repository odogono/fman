/**
 * The harness's own randomness, kept apart from the game's RNG: think time,
 * pause keypresses and strategy coin-flips. Seeded, so runs are reproducible.
 */
export type HarnessRng = Readonly<{
  /** An integer from `min` to `max` inclusive. */
  int: (min: number, max: number) => number;
  /** A float in [0, 1). */
  next: () => number;
  pick: <T>(items: readonly T[]) => T;
}>;

/** Mixes numbers into one 32-bit seed, so related streams don't overlap. */
export const mixSeed = (...parts: readonly number[]) => {
  let hash = 0x81_1c_9d_c5;
  for (const part of parts) {
    hash = Math.imul(hash ^ (part >>> 0), 0x01_00_01_93);
    hash ^= hash >>> 15;
    hash = Math.imul(hash, 0x2c_1b_3c_6d);
    hash ^= hash >>> 12;
  }
  return hash >>> 0;
};

/** mulberry32: small, fast and good enough for experiment design. */
export const createHarnessRng = (seed: number): HarnessRng => {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d_2b_79_f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  const int = (min: number, max: number) => {
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min) {
      throw new RangeError(`Invalid range ${min}..${max}`);
    }
    return min + Math.floor(next() * (max - min + 1));
  };
  return {
    int,
    next,
    pick: items => {
      if (items.length === 0) {
        throw new RangeError('Cannot pick from no items');
      }
      return items[int(0, items.length - 1)]!;
    }
  };
};
