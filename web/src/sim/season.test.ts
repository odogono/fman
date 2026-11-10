import { expect, test } from 'bun:test';

import { createNewGame } from './management';
import { completeSeason } from './season';

const finished = () => {
  const fresh = createNewGame({
    club: 1,
    colour: 0,
    level: 1,
    manager: 'alex',
    seed: 0
  });
  return {
    ...fresh,
    cupFinished: true,
    cupRound: 8,
    league: fresh.league.map((r, i) => ({
      ...r,
      position: i === 15 ? 1 : i + 2
    })),
    leagueMatches: 15,
    leaguePosition: 1
  };
};

test('a promoted club receives the old division bonus and resets into the next season without losing ownership or injury state', () => {
  const game = finished();
  const completion = completeSeason({
    ...game,
    players: game.players.map((p, i) =>
      i === 0 ? { ...p, status: 3 as const } : p
    )
  });
  expect(completion.bonus).toBe(80_000);
  expect(completion.game.club).toBe(47);
  expect(completion.game.division).toBe(3);
  expect(completion.game.cash).toBe(180_000);
  expect(completion.game.rating).toBe(100);
  expect(completion.game.players[0]!.status).toBe(3);
  expect(completion.game.homeGate).toBe(10_000);
  expect(completion.game.leagueMatches).toBe(0);
  expect(completion.game.cupFinished).toBe(false);
  expect(
    completion.game.league.every(r => r.position === 0 && r.points === 0)
  ).toBe(true);
  expect(completion.game.attackCarry).toBe(game.attackCarry);
});

test('season completion rejects an unfinished league or cup', () => {
  expect(() => completeSeason({ ...finished(), leagueMatches: 14 })).toThrow();
  expect(() => completeSeason({ ...finished(), cupFinished: false })).toThrow();
});
