import { hashSeed } from '../clips';
import { grassPatterns, type GrassPattern } from './pitch';

// Each club's ground (#273): its own, and the same all game and in every
// new game. The club's place in the catalogue picks how its grass is mown,
// which sides have stands and which of those have roofs; its division when
// the game began sizes the stands, tall in the First and low in the
// Fourth, where a side may have none. Its seats are in its colours. The
// pitch, goals and boards are the same at every ground.

/**
 * A club's ground (#273), as its recipe: the club's place in the
 * catalogue, the division it began the game in and its seats' colour.
 */
export type ClubGround = Readonly<{
  /** The club's place in the catalogue, 1 to 64. */
  club: number;
  /** The club's division when the game began, 1 to 4. */
  division: number;
  seats: string;
}>;

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
  /**
   * The colour of the steps between the seats, where the fans don't hide
   * them, in place of bare concrete.
   */
  steps?: string;
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
export const groundPlan = (ground: ClubGround): GroundPlan => {
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

/**
 * The final ground (#274): designed once, grander than any club's. Taller,
 * seated stands on all four sides, every one roofed, a pitch mown in
 * checks, and claret seats in no club's colours. The fans hide the seats,
 * so the steps between them are claret too, where they show.
 */
export const finalPlan: GroundPlan = {
  grass: 'checks',
  seats: '#8c1c3c',
  stands: (['left', 'right', 'top', 'bottom'] as const).map(side => ({
    riser: 0.5,
    roof: 3,
    rowDepth: 0.9,
    // The touchlines' stands tower over the ends'; even the ends' outdo
    // a First Division club's main stand.
    rows: side === 'left' || side === 'right' ? 18 : 15,
    seated: true,
    side
  })),
  steps: '#6a1430'
};
