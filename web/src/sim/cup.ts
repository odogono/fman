import { nextFixture, type MatchFixture } from './league';
import { payWeeklyBills, type Game, type Player } from './management';
import { createRng } from './rng';
import { opponentBonus, tiringInjuries } from './ruleset';

const clamp = (n: number) => Math.max(1, Math.min(20, n));
const gate = (game: Game, opponent: number, home: boolean) =>
  game.cupRound === 8
    ? 100_000
    : game.cupRound === 7
      ? 50_000
      : home
        ? game.homeGate
        : (5 - (Math.floor((opponent - 1) / 16) + 1)) * 10_000;

/** How the original names a cup round: by number until the last two. */
export const cupRoundName = (round: number) =>
  round === 8 ? 'Final' : round === 7 ? 'Semi-Final' : String(round);

export const prepareCupMatch = (game: Game): MatchFixture => {
  if (nextFixture(game) !== 'cup' || game.cupRound >= 8) {
    throw new RangeError('No cup round is scheduled');
  }
  const cupRound = game.cupRound + 1;
  const rng = createRng(game.seed);
  let opponent: number;
  do {
    opponent = (8 - cupRound) * 8 + rng.int(1, 8);
  } while (opponent === game.club);
  const opponentStrength = Array.from({ length: 5 }, () =>
    clamp(
      Math.floor(
        rng.int(1, 16) +
          opponentBonus(game.ruleset, game.level) +
          (game.club - 1) / 16 -
          ((opponent - 1) / 16 + 1)
      )
    )
  );
  const home = rng.int(1, 2) === 1;
  return {
    game: { ...game, cupRound, scheduleCounter: 0, seed: rng.seed },
    gate: gate({ ...game, cupRound }, opponent, home),
    home,
    kind: 'cup',
    opponent,
    opponentStrength
  };
};

export const prepareReplay = (
  game: Game,
  fixture: MatchFixture
): MatchFixture => ({
  ...fixture,
  game,
  gate: gate(game, fixture.opponent, !fixture.home),
  home: !fixture.home
});

/**
 * How many of the 20 rolls injure a player of this energy under lasting
 * injuries (#98): 1, 1, 2 or 3 for energy 16–20, 11–15, 6–10 and 1–5, so a
 * fit player keeps the original's 1 in 20 and a tired one runs up to 3 in 20.
 * Tuned against the gameplay baseline.
 */
export const injuryBand = (energy: number) =>
  energy > 10 ? 1 : energy > 5 ? 2 : 3;

/**
 * One week of lasting injuries (#98) for an owned player, given the
 * original's injury roll. A picked player tires and a reserve recovers as in
 * the original, but an injured player recovers no energy: the injury counts
 * down and heals to the reserves. Otherwise a roll in the top `band` of 20
 * injures, for as many weeks as it lands into the band (1–3).
 */
const lastingRefresh = (p: Player, energy: number, roll: number): Player => {
  if (p.status === 3) {
    const { weeksOut = 1, ...rest } = p;
    return weeksOut > 1
      ? { ...rest, weeksOut: weeksOut - 1 }
      : { ...rest, status: 1 };
  }
  const threshold = 20 - injuryBand(energy);
  return roll > threshold
    ? { ...p, energy, status: 3, weeksOut: roll - threshold }
    : { ...p, energy };
};

export const refreshPlayers = (game: Game): Game => {
  if (game.leagueMatches === 1 && game.cupRound === 0) {
    return game;
  }
  const lasting = tiringInjuries(game.ruleset);
  const rng = createRng(game.seed);
  const players = game.players.map((p): Player => {
    const energy = clamp(
      p.energy +
        (p.status === 1 || p.status === 3 ? 10 : p.status === 2 ? -1 : 0)
    );
    // The OR expression evaluates R(20) even for unowned pool players.
    const roll = rng.int(1, 20);
    if (lasting && p.status !== 0) {
      return lastingRefresh(p, energy, roll);
    }
    const injured = roll === 20;
    return {
      ...p,
      energy,
      status: p.status === 0 ? 0 : injured ? 3 : p.status === 3 ? 1 : p.status
    };
  });
  return { ...game, players, seed: rng.seed };
};

export const settleCupLeg = (
  game: Game,
  fixture: MatchFixture,
  score: readonly number[]
) => {
  const credited = { ...game, cash: game.cash + fixture.gate };
  if (score[0] === score[1]) {
    return { bills: undefined, cupWon: false, game: credited, replay: true };
  }
  const win = score[fixture.home ? 0 : 1]! > score[fixture.home ? 1 : 0]!;
  const adjust = (morale: number) =>
    clamp(
      win ? morale + Math.floor((20 - morale) / 2) : Math.floor(morale / 2)
    );
  const billed = payWeeklyBills({
    ...credited,
    cupFinished: !win || game.cupRound === 8,
    morale: adjust(adjust(game.morale))
  });
  return { ...billed, cupWon: win && game.cupRound === 8, replay: false };
};
