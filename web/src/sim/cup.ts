import type { MatchFixture } from './league';
import { payWeeklyBills, type Game, type Player } from './management';
import { createRng } from './rng';

const clamp = (n: number) => Math.max(1, Math.min(20, n));
const gate = (game: Game, opponent: number, home: boolean) =>
  home ? game.homeGate : (5 - (Math.floor((opponent - 1) / 16) + 1)) * 10_000;

export const prepareFirstCup = (game: Game): MatchFixture => {
  if (
    game.leagueMatches !== 1 ||
    game.scheduleCounter !== 2 ||
    game.cupRound !== 0
  ) {
    throw new RangeError('Only the first cup round is available');
  }
  const rng = createRng(game.seed);
  let opponent: number;
  do {
    opponent = 56 + rng.int(1, 8);
  } while (opponent === game.club);
  const opponentStrength = Array.from({ length: 5 }, () =>
    clamp(
      Math.floor(
        rng.int(1, 16) +
          game.level +
          (game.club - 1) / 16 -
          ((opponent - 1) / 16 + 1)
      )
    )
  );
  const home = rng.int(1, 2) === 1;
  return {
    game: { ...game, cupRound: 1, scheduleCounter: 0, seed: rng.seed },
    gate: gate(game, opponent, home),
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

export const refreshPlayers = (game: Game): Game => {
  if (game.leagueMatches === 1 && game.cupRound === 0) {
    return game;
  }
  const rng = createRng(game.seed);
  const players = game.players.map((p): Player => {
    const energy = clamp(
      p.energy +
        (p.status === 1 || p.status === 3 ? 10 : p.status === 2 ? -1 : 0)
    );
    // The OR expression evaluates R(20) even for unowned pool players.
    const injured = rng.int(1, 20) === 20;
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
    return { bills: undefined, game: credited, replay: true };
  }
  const win = score[fixture.home ? 0 : 1]! > score[fixture.home ? 1 : 0]!;
  const adjust = (morale: number) =>
    clamp(
      win ? morale + Math.floor((20 - morale) / 2) : Math.floor(morale / 2)
    );
  const billed = payWeeklyBills({
    ...credited,
    cupFinished: !win,
    morale: adjust(adjust(game.morale))
  });
  return { ...billed, replay: false };
};
