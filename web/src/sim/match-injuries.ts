import { injuryBand } from './cup';
import type { Game, Player } from './management';
import type { Moment } from './moments';
import { createRng } from './rng';
import type { SquadPlayer } from './squads';

// Injuries during the match (#110), under `matchInjuries`. The lasting
// injuries curve (#98) moves from the refresh before team selection to
// kick-off: each picked player rolls it once, and an injury becomes a moment
// of the highlights. It changes nothing in that match. The draws come from a
// stream of their own, so every other moment, the score and the RND
// sequence are drawn exactly as without them.

/** Seeds the injury stream from the match's seed, away from the RND sequence. */
const injurySeed = (seed: number) => seed ^ 0x3c_5a;

/** A tackle causes an injury 2 times in 3; otherwise the player pulls up. */
const tackledRolls = 2;

/**
 * The injuries of a match decided as `chances`: for each picked player, in
 * squad order, the lasting-injuries roll on their energy at kick-off. One
 * in the top `band` of 20 injures, for as many matches as it lands into the
 * band (1–3). The minute falls between the player's last chance and full
 * time, so nobody shoots after going off. Given the opponent's squad, the
 * tackler is one of its outfield players.
 */
export const drawInjuries = (input: {
  chances: readonly Moment[];
  opponentSquad?: readonly SquadPlayer[];
  players: readonly Player[];
  seed: number;
}): Moment[] => {
  const rng = createRng(injurySeed(input.seed));
  const outfield = (input.opponentSquad ?? []).flatMap((p, i) =>
    p.position === 'GK' ? [] : [i]
  );
  const injuries: Moment[] = [];
  for (const player of input.players) {
    if (player.status !== 2) {
      continue;
    }
    const roll = rng.int(1, 20);
    const threshold = 20 - injuryBand(player.energy);
    if (roll <= threshold) {
      continue;
    }
    const last = Math.max(
      1,
      ...input.chances
        .filter(m => m.side === 'club' && m.player === player.id)
        .map(m => m.minute)
    );
    const minute = rng.int(last, 90);
    const tackled = rng.int(1, 3) <= tackledRolls;
    const tackler =
      tackled && outfield.length
        ? outfield[rng.int(0, outfield.length - 1)]
        : undefined;
    injuries.push({
      kind: 'injury',
      minute,
      player: player.id,
      side: 'club',
      ...(tackled ? { tackled } : {}),
      ...(tackler === undefined ? {} : { tackler }),
      weeksOut: roll - threshold
    });
  }
  return injuries;
};

/**
 * The squad after a match under match injuries: each player injured in it
 * is out for the next `weeksOut` matches. The refresh before each match
 * counts an injury down, as under lasting injuries, so it starts one week
 * longer: the next refresh mustn't heal it, and the player recovers no
 * energy until back.
 */
export const settleInjuries = (
  game: Game,
  moments: readonly Moment[]
): Game => ({
  ...game,
  players: game.players.map((player): Player => {
    const injury = moments.find(
      m => m.kind === 'injury' && m.player === player.id
    );
    return injury
      ? { ...player, status: 3, weeksOut: (injury.weeksOut ?? 1) + 1 }
      : player;
  })
});
