import { expect, test } from 'bun:test';

import reference from './fixtures/fresh-setup.json';
import {
  borrow,
  createNewGame,
  creditLimit,
  isDismissed,
  makeSaleOffer,
  repay,
  respondToSale
} from './management';

const fresh = () =>
  createNewGame({
    club: reference.chosenClub,
    colour: reference.colour,
    level: reference.level,
    manager: reference.manager,
    seed: reference.initialSeed
  });

test('reproduces all 24 original players and random state at BASIC line 8999', () => {
  const game = fresh();
  expect(reference.players).toEqual(
    game.players.map(({ energy, skill, status, value }) => ({
      energy,
      skill,
      status,
      value
    }))
  );
  expect(game.seed).toBe(reference.seedBeforeRandomize);
  expect(game.players.filter(player => player.status > 0)).toHaveLength(12);
  expect(game.players.filter(player => player.status === 2)).toHaveLength(11);
  expect(game.cash).toBe(100_000);
  expect(game.debt).toBe(0);
  expect(game.club).toBe(64);
  expect(game.division).toBe(4);
  expect(game.clubs[63]?.name).toBe('Arsenal');
  expect(game.clubs[0]?.name).toBe('York City');
});

test('any chosen club starts in Division 4 without changing the player draw order', () => {
  const first = fresh();
  const york = createNewGame({
    club: 64,
    colour: 7,
    level: 7,
    manager: '',
    seed: 0
  });
  expect(york.clubs[63]?.name).toBe('York City');
  expect(york.clubs[0]?.name).toBe('Arsenal');
  expect(york.players).toEqual(first.players);
  expect(york.level).toBe(7);
  expect(york.colour).toBe(7);
});

test('borrowing and repayment preserve net funds and enforce original limits', () => {
  const game = fresh();
  const borrowed = borrow(game, 250_000);
  expect(borrowed.cash).toBe(350_000);
  expect(borrowed.debt).toBe(250_000);
  expect(() => borrow(borrowed, 1)).toThrow('credit limit');
  const paid = repay(borrowed, 250_000);
  expect(paid.cash).toBe(100_000);
  expect(paid.debt).toBe(0);
  expect(() => repay(game, 1)).toThrow("DON'T OWE");
  expect(() => repay({ ...game, cash: 0, debt: 10 }, 1)).toThrow(
    'enough money'
  );
  expect(() => borrow(game, -1)).toThrow();
  expect(game.cash).toBe(100_000);
});

test('the credit limit grows by £250,000 a division and owing more is dismissal', () => {
  const game = fresh();
  expect(
    [4, 3, 2, 1].map(division => creditLimit({ ...game, division }))
  ).toEqual([250_000, 500_000, 750_000, 1_000_000]);
  expect(isDismissed({ ...game, debt: 250_000 })).toBe(false);
  expect(isDismissed({ ...game, debt: 250_001 })).toBe(true);
});

test('selling changes ownership and cash only on acceptance', () => {
  const game = fresh();
  const player = game.players.find(player => player.status === 2)!;
  const offer = makeSaleOffer(game, player.id);
  expect(offer.amount).toBeGreaterThanOrEqual(Math.floor(player.value * 0.8));
  expect(offer.amount).toBeLessThan(player.value * 1.3);
  const sold = respondToSale(offer.game, offer, true);
  expect(sold.players[player.id - 1]?.status).toBe(0);
  expect(sold.cash).toBe(game.cash + offer.amount);
  expect(game.players[player.id - 1]?.status).toBe(2);
  const refused = respondToSale(offer.game, offer, false);
  expect(refused.cash).toBe(game.cash);
  expect(refused.players[player.id - 1]?.status).not.toBe(0);
  expect(() =>
    makeSaleOffer(
      {
        ...game,
        players: game.players.map(p => ({ ...p, status: 3 as const }))
      },
      player.id
    )
  ).toThrow('injured');
});

test('matches the observed original sale at seed 219', () => {
  const offer = makeSaleOffer({ ...fresh(), seed: 219 }, 1);
  expect(offer.amount).toBe(13_888);
  expect(offer.game.seed).toBe(57_833);
  expect(offer.buyer).toBe('Hull');
});
