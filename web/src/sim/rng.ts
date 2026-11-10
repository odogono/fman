import { validateFrames } from './frame-clock';

// The simulation's only source of randomness: the original Spectrum RND.
// Raw seed restoration is distinct from BASIC RANDOMIZE 0 (frame-based).
export type Rng = Readonly<{
  int: (min: number, max: number) => number;
  next: () => number;
  randomize: (seed: number, frames: number) => void;
  seed: number;
}>;

const validateSeed = (seed: number): void => {
  if (!Number.isInteger(seed) || seed < 0 || seed > 65_535) {
    throw new RangeError('SEED must be a 16-bit unsigned integer');
  }
};

export const createRng = (seed: number): Rng => {
  validateSeed(seed);
  let state = seed;
  const next = () => {
    state = (((state + 1) * 75) % 65_537) - 1;
    return state / 65_536;
  };
  const int = (min: number, max: number) => {
    const span = max - min + 1;
    if (
      !Number.isSafeInteger(min) ||
      !Number.isSafeInteger(max) ||
      span < 1 ||
      span > 65_536
    ) {
      throw new RangeError(
        'Expected an inclusive integer range of at most 65536 values'
      );
    }
    // With this range, multiplication uses at most 32 significant bits,
    // so host arithmetic is exact for the ROM's 16-bit RND fraction.
    return min + Math.floor(next() * span);
  };
  return {
    int,
    next,
    randomize: (value, frames) => {
      validateSeed(value);
      validateFrames(frames);
      state = value === 0 ? frames & 65_535 : value;
    },
    get seed() {
      return state;
    }
  };
};
