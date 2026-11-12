import type { Player } from './management';
import { createRng, type Rng } from './rng';
import { playerCategory } from './squads';

/**
 * One decisive event in a match (#107): a goal, a save or a near miss, at a
 * minute, for the side that made the chance. A moment for the managed club
 * names the picked player who shot; opponents have no players to name.
 */
export type Moment = Readonly<{
  kind: 'goal' | 'near-miss' | 'save';
  minute: number;
  player?: number;
  side: 'club' | 'opponent';
}>;

/**
 * A chance becomes a goal on a d100 roll of this or less: the share of the
 * original's attacks that end in a goal (about 55%, measured with even
 * strengths). Like the original's collision checks, it ignores the strengths.
 */
const goalRoll = 55;
/** Of the rest, a save up to this roll and a near miss above it. */
const saveRoll = 77;

/** How much more often each playing category is named: defence to attack. */
const categoryWeight = [1, 2, 4] as const;

/** A picked player, weighted by skill and leaning towards attackers. */
const pickShooter = (rng: Rng, players: readonly Player[]) => {
  const picked = players.filter(p => p.status === 2);
  const weights = picked.map(p => p.skill * categoryWeight[playerCategory(p)]!);
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total === 0) {
    return undefined;
  }
  let roll = rng.int(1, total);
  for (const [i, weight] of weights.entries()) {
    roll -= weight;
    if (roll <= 0) {
      return picked[i]!.id;
    }
  }
  return undefined;
};

/**
 * Decides a match as moments (#107) in place of the original's attacking
 * sequences. The chances come from the original's tests: for each of the five
 * team strengths, each side in turn wins two chances on `d100 + 5 ×
 * difference ≥ 75`, and a match still goalless after them gives home then
 * away one more. Each chance draws its outcome, its minute and, for the
 * managed club, its shooter. The score is `[home, away]`.
 */
export const decideMoments = (input: {
  home: boolean;
  opponent: readonly number[];
  players: readonly Player[];
  seed: number;
  strength: readonly number[];
}) => {
  const rng = createRng(input.seed);
  const drawn: Moment[] = [];
  const chance = (side: Moment['side']) => {
    const roll = rng.int(1, 100);
    const kind =
      roll <= goalRoll ? 'goal' : roll <= saveRoll ? 'save' : 'near-miss';
    const minute = rng.int(1, 90);
    const player =
      side === 'club' ? pickShooter(rng, input.players) : undefined;
    drawn.push({
      kind,
      minute,
      ...(player === undefined ? {} : { player }),
      side
    });
  };
  for (let i = 0; i < 5; i++) {
    for (const side of ['club', 'opponent'] as const) {
      const difference =
        (input.strength[i]! - input.opponent[i]!) * (side === 'club' ? 1 : -1);
      if (rng.int(1, 100) + difference * 5 >= 75) {
        chance(side);
        chance(side);
      }
    }
  }
  if (!drawn.some(m => m.kind === 'goal')) {
    const homeSide = input.home ? 'club' : 'opponent';
    chance(homeSide);
    chance(homeSide === 'club' ? 'opponent' : 'club');
  }
  const goals = (side: Moment['side']) =>
    drawn.filter(m => m.kind === 'goal' && m.side === side).length;
  const club = goals('club');
  const opponent = goals('opponent');
  return {
    moments: drawn.toSorted((a, b) => a.minute - b.minute),
    score: input.home ? [club, opponent] : [opponent, club],
    seed: rng.seed
  };
};

export type MomentResult = ReturnType<typeof decideMoments>;
