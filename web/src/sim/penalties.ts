import type { Player } from './management';
import {
  goalRoll,
  pickShooter,
  pickSquadShooter,
  saveRoll,
  type Moment
} from './moments';
import { createRng } from './rng';
import type { SquadPlayer } from './squads';

// Penalties (#211), under `penalties`. Each side can win one, for a foul in
// the box, and it is a chance of its own: scored on the same roll as any
// other chance, so it can change the result. The draws come from a stream
// of their own, so every other moment and the RND sequence are drawn
// exactly as without them.

/** Seeds the penalty stream from the match's seed, away from the others. */
const penaltySeed = (seed: number) => seed ^ 0x5e_9a;

/**
 * Each side wins a penalty 1 time in this many matches: about one match in
 * four has one, as in league football.
 */
export const penaltyOdds = 8;

/**
 * A match's penalties, drawn after its chances and injuries. For each side,
 * club first, one roll in `penaltyOdds` wins a penalty, then the outcome,
 * the minute and the taker. The managed club's taker is a picked player
 * still on the pitch; an opponent's is anyone in its squad.
 *
 * Where a managed player was injured by a tackle, the club's penalty is for
 * that foul: it comes in the same minute, after the injury, which is marked
 * `foul`, and someone else takes it.
 */
export const drawPenalties = (input: {
  injuries: readonly Moment[];
  opponentSquad?: readonly SquadPlayer[];
  players: readonly Player[];
  seed: number;
}): {
  /** The penalty for a foul, to follow its injury. */
  afterFoul: Moment[];
  injuries: Moment[];
  penalties: Moment[];
} => {
  const rng = createRng(penaltySeed(input.seed));
  let injuries = [...input.injuries];
  const penalties: Moment[] = [];
  const afterFoul: Moment[] = [];
  for (const side of ['club', 'opponent'] as const) {
    const won = rng.int(1, penaltyOdds) === 1;
    const roll = rng.int(1, 100);
    let minute = rng.int(1, 90);
    if (!won) {
      continue;
    }
    const kind: Moment['kind'] =
      roll <= goalRoll ? 'goal' : roll <= saveRoll ? 'save' : 'near-miss';
    if (side === 'opponent') {
      const squadPlayer = input.opponentSquad
        ? pickSquadShooter(rng, input.opponentSquad)
        : undefined;
      penalties.push({
        kind,
        minute,
        penalty: true,
        side,
        ...(squadPlayer === undefined ? {} : { squadPlayer })
      });
      continue;
    }
    // The first injury from a tackle, by the clock.
    const foul = injuries
      .filter(m => m.kind === 'injury' && m.tackled)
      .toSorted((a, b) => a.minute - b.minute)[0];
    if (foul) {
      minute = foul.minute;
    }
    // Nobody injured by then takes it.
    const fit = input.players.filter(
      p =>
        !injuries.some(
          m => m.kind === 'injury' && m.player === p.id && m.minute <= minute
        )
    );
    const player = pickShooter(rng, fit);
    if (player === undefined) {
      continue;
    }
    const penalty: Moment = { kind, minute, penalty: true, player, side };
    if (foul) {
      injuries = injuries.map(m => (m === foul ? { ...m, foul: true } : m));
      afterFoul.push(penalty);
    } else {
      penalties.push(penalty);
    }
  }
  return { afterFoul, injuries, penalties };
};
