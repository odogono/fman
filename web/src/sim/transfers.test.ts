import { expect, test } from 'bun:test';

import reference from './fixtures/transfers.json';
import { createNewGame, type Game, type Player } from './management';
import { bidForPlayer, openTransferMarket } from './transfers';

const savedGame = (seed: number): Game => ({
  ...createNewGame({ club: 1, colour: 0, level: 1, manager: 'alex', seed: 0 }),
  cash: reference.initial.m,
  debt: reference.initial.l,
  division: reference.initial.d1,
  leagueMatches: reference.initial.ml,
  players: reference.initial['p(24)'].map((status, i): Player => ({
    energy: reference.initial['y(24)'][i]!,
    id: i + 1,
    name: `Player ${i + 1}`,
    skill: reference.initial['r(24)'][i]!,
    status: status as Player['status'],
    value: reference.initial['v(24)'][i]!
  })),
  seed
});

for (const observation of reference.records) {
  test(`original transfer seed ${observation.seed}, bid ${observation.bid}`, () => {
    const offer = openTransferMarket(savedGame(observation.seed))!;
    expect(offer.playerId).toBe(observation.playerId);
    expect(offer.game.seed).toBe(observation.offerSeed);
    const result = bidForPlayer(offer.game, offer.playerId, observation.bid);
    expect(result.game.seed).toBe(observation.afterSeed);
    expect(result.game.cash).toBe(observation.cash);
    expect<number[]>(result.game.players.map(p => p.status)).toEqual(
      reference.initial['p(24)'].map((p, i) =>
        i + 1 === observation.playerId ? observation.status : p
      )
    );
    expect(result.game.players.map(p => p.value)).toEqual(
      reference.initial['v(24)'].map((v, i) =>
        i + 1 === observation.playerId ? observation.value : v
      )
    );
  });
}

test('no league match skips the market; a full squad still consumes the offer draw', () => {
  const game = savedGame(42);
  expect(openTransferMarket({ ...game, leagueMatches: 0 })).toBeUndefined();
  const full = {
    ...game,
    players: game.players.map((p, i): Player => ({
      ...p,
      status: i < 16 ? 1 : 0
    }))
  };
  const offer = openTransferMarket(full)!;
  expect(offer.fullSquad).toBe(true);
  expect(offer.game.seed).not.toBe(full.seed);
  expect(() => bidForPlayer(offer.game, offer.playerId, 50_000)).toThrow(
    'Squad is full'
  );
});

test('declining, unaffordable bids and invalid bids consume no acceptance draw', () => {
  const offer = openTransferMarket(savedGame(42))!;
  expect(bidForPlayer(offer.game, offer.playerId, 99)).toEqual({
    game: offer.game,
    outcome: 'declined'
  });
  expect(bidForPlayer(offer.game, offer.playerId, offer.game.cash + 1)).toEqual(
    { game: offer.game, outcome: 'unaffordable' }
  );
  for (const amount of [-1, 0.5, Number.NaN, Infinity]) {
    expect(() => bidForPlayer(offer.game, offer.playerId, amount)).toThrow();
  }
});

test('a refused bid increases the asking value on the same unowned player', () => {
  const offer = openTransferMarket(savedGame(0))!;
  const once = bidForPlayer(offer.game, offer.playerId, 0);
  const twice = bidForPlayer(once.game, offer.playerId, 0);
  expect(once.outcome).toBe('refused');
  expect(twice.outcome).toBe('refused');
  const player = twice.game.players[offer.playerId - 1]!;
  expect(player.status).toBe(0);
  expect(player.value).toBe(
    Math.floor(Math.floor(offer.game.players[player.id - 1]!.value * 1.2) * 1.2)
  );
});
