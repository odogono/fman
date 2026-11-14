import type { Player } from './management';
import { createRng, type Rng } from './rng';
import { playerCategory, positionCategory, type SquadPlayer } from './squads';

/**
 * One decisive event in a match (#107): a goal, a save, a clearance (#150)
 * or a near miss, at a minute, for the side that made the chance. It names the player who shot:
 * for the managed club the picked player's place (`player`), and for an
 * opponent with a squad (#124) the player's index in it (`squadPlayer`).
 */
export type Moment = Readonly<{
  kind: 'clearance' | 'goal' | 'near-miss' | 'save';
  minute: number;
  player?: number;
  side: 'club' | 'opponent';
  squadPlayer?: number;
}>;

/**
 * A chance becomes a goal on a d100 roll of this or less: the share of the
 * original's attacks that end in a goal (about 55%, measured with even
 * strengths). Like the original's collision checks, it ignores the strengths.
 */
const goalRoll = 55;
/** Of the rest, a save up to this roll and a near miss above it. */
const saveRoll = 77;
/**
 * With clearances (#150), the rest split as the original's missed attacks
 * end: a save (off the keeper, about 25% of them) up to the first roll, a
 * clearance (off a defender, about 37%) up to the second, and a near miss
 * (untouched, or off an attacker) above it.
 */
const clearanceRolls = { clearance: 83, save: 66 } as const;

/** How much more often each playing category is named: defence to attack. */
const categoryWeight = [1, 2, 4] as const;

/** An index into `weights`, drawn in proportion to them. */
const weighted = (rng: Rng, weights: readonly number[]) => {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total === 0) {
    return undefined;
  }
  let roll = rng.int(1, total);
  for (const [i, weight] of weights.entries()) {
    roll -= weight;
    if (roll <= 0) {
      return i;
    }
  }
  return undefined;
};

/** A picked player, weighted by skill and leaning towards attackers. */
const pickShooter = (rng: Rng, players: readonly Player[]) => {
  const picked = players.filter(p => p.status === 2);
  const i = weighted(
    rng,
    picked.map(p => p.skill * categoryWeight[playerCategory(p)]!)
  );
  return i === undefined ? undefined : picked[i]!.id;
};

/**
 * An opponent's shooter (#124): anyone in its squad, since other clubs don't
 * pick a team, weighted as `pickShooter` weights the managed club's.
 */
const pickSquadShooter = (rng: Rng, squad: readonly SquadPlayer[]) =>
  weighted(
    rng,
    squad.map(p => p.skill * categoryWeight[positionCategory(p.position)]!)
  );

/**
 * Decides a match as moments (#107) in place of the original's attacking
 * sequences. The chances come from the original's tests: for each of the five
 * team strengths, each side in turn wins two chances on `d100 + 5 ×
 * difference ≥ 75`, and a match still goalless after them gives home then
 * away one more. Each chance draws its outcome, its minute and, for the
 * managed club, its shooter. The score is `[home, away]`.
 *
 * Given the opponent's squad (#124), its shooters are drawn too, from a
 * stream of their own seeded by `squadSeed` and `seed` together. Neither
 * seed advances, so the RND sequence and the squad stream draw as without
 * them, and only the names change.
 */
export const decideMoments = (input: {
  /** Some chances that aren't goals are clearances (#150). */
  clearances?: boolean;
  home: boolean;
  opponent: readonly number[];
  opponentSquad?: readonly SquadPlayer[];
  players: readonly Player[];
  seed: number;
  squadSeed?: number;
  strength: readonly number[];
}) => {
  const rng = createRng(input.seed);
  const { opponentSquad, squadSeed } = input;
  const squadRng =
    opponentSquad && squadSeed !== undefined
      ? createRng(squadSeed ^ input.seed)
      : undefined;
  const drawn: Moment[] = [];
  const chance = (side: Moment['side']) => {
    const roll = rng.int(1, 100);
    const kind: Moment['kind'] =
      roll <= goalRoll
        ? 'goal'
        : input.clearances
          ? roll <= clearanceRolls.save
            ? 'save'
            : roll <= clearanceRolls.clearance
              ? 'clearance'
              : 'near-miss'
          : roll <= saveRoll
            ? 'save'
            : 'near-miss';
    const minute = rng.int(1, 90);
    const player =
      side === 'club' ? pickShooter(rng, input.players) : undefined;
    const squadPlayer =
      side === 'opponent' && squadRng
        ? pickSquadShooter(squadRng, opponentSquad!)
        : undefined;
    drawn.push({
      kind,
      minute,
      ...(player === undefined ? {} : { player }),
      side,
      ...(squadPlayer === undefined ? {} : { squadPlayer })
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
