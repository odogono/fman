import { hashSeed, type ClipGround } from '../clips';
import { grassPatterns, type GrassPattern } from './pitch';

// Each club's ground (#273): its own, and the same all game and in every
// new game. The club's place in the catalogue picks how its grass is mown,
// which sides have stands and which of those have roofs; its division when
// the game began sizes the stands, tall in the First and low in the
// Fourth, where a side may have none. Its seats are in its colours. The
// pitch, goals and boards are the same at every ground.

export type Side = 'bottom' | 'left' | 'right' | 'top';

export type Stand = Readonly<{
  /** How far each step rises above the one in front, in metres. */
  riser: number;
  /** A roof this far above the top step, over the back half of the rows. */
  roof?: number;
  /** How deep each step is, from front to back. */
  rowDepth: number;
  rows: number;
  /** Seats on its steps, in the club's colours, rather than bare terrace. */
  seated: boolean;
  side: Side;
}>;

export type GroundPlan = Readonly<{
  grass: GrassPattern;
  /** The seats' colour. */
  seats: string;
  stands: readonly Stand[];
}>;

type Size = Readonly<{
  /** How likely each side but the main stand's is bare. */
  bare: number;
  /** Rows in the main stand, and in the others, fewest to most. */
  main: readonly [number, number];
  other: readonly [number, number];
  /** How likely a stand other than the main one is roofed, or seated. */
  roofed: number;
  seated: number;
}>;

/** The stands' sizes, by division. */
const sizes: Readonly<Record<number, Size>> = {
  1: { bare: 0, main: [12, 14], other: [9, 12], roofed: 0.75, seated: 1 },
  2: { bare: 0, main: [9, 11], other: [6, 9], roofed: 0.5, seated: 0.6 },
  3: { bare: 0, main: [6, 8], other: [4, 6], roofed: 0.3, seated: 0.3 },
  4: { bare: 0.3, main: [4, 6], other: [3, 4], roofed: 0.15, seated: 0 }
};

const across = { bottom: 'top', left: 'right', right: 'left', top: 'bottom' };

/** The plan of `ground`. */
export const groundPlan = (ground: ClipGround): GroundPlan => {
  /** A roll from 0 up to 1, the same for the same club and question. */
  const roll = (question: string) =>
    hashSeed(`ground|${ground.club}|${question}`) / 2 ** 32;
  const pick = <T>(question: string, from: readonly T[]) =>
    from[Math.floor(roll(question) * from.length)]!;
  const between = (question: string, [low, high]: readonly [number, number]) =>
    low + Math.floor(roll(question) * (high - low + 1));
  const size = sizes[ground.division] ?? sizes[1]!;
  const main = pick<Side>('main', ['left', 'right']);
  const stands: Stand[] = [];
  for (const side of ['left', 'right', 'top', 'bottom'] as const) {
    const isMain = side === main;
    // The side facing the main stand always has one, so no ground is
    // left with only its main stand and an end.
    if (!isMain && side !== across[main] && roll(`${side}|bare`) < size.bare) {
      continue;
    }
    const rows = between(`${side}|rows`, isMain ? size.main : size.other);
    const roofed = isMain
      ? ground.division <= 3
      : roll(`${side}|roof`) < size.roofed;
    const seated = isMain || roll(`${side}|seated`) < size.seated;
    stands.push({
      // Seats rise more steeply than a terrace's standing steps.
      riser: seated ? 0.5 : 0.35,
      ...(roofed ? { roof: 3 } : {}),
      rowDepth: seated ? 0.9 : 1.2,
      rows,
      seated,
      side
    });
  }
  return {
    grass: pick('grass', grassPatterns),
    seats: ground.seats,
    stands
  };
};
