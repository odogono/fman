// The sim's only source of randomness: a seeded PRNG (mulberry32), so a
// game replays exactly from its seed.
export type Rng = Readonly<{
  int: (min: number, max: number) => number;
  next: () => number;
}>;

export const createRng = (seed: number): Rng => {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d_2b_79_f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  // An integer in [min, max], inclusive.
  const int = (min: number, max: number) =>
    min + Math.floor(next() * (max - min + 1));
  return { int, next };
};
