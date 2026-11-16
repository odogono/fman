import { expect, test } from 'bun:test';

import { lowestCupGate, prepareCupMatch } from './cup';
import { completeLeagueMatch, prepareLeagueMatch } from './league';
import {
  createNewGame,
  creditLimit,
  isDismissed,
  type Game
} from './management';
import { nextBills } from './next-bills';
import { latestEnhanced, presentDay, type Ruleset } from './ruleset';

const fresh = (ruleset: Ruleset, seed = 219): Game =>
  createNewGame({
    club: 1,
    ...(presentDay(ruleset) ? {} : { colour: 0 }),
    level: 1,
    manager: 'alex',
    ruleset,
    seed
  });

/** Plays the next league match, as the forecast sees it, to its bills. */
const played = (game: Game) => {
  const fixture = prepareLeagueMatch(game);
  return completeLeagueMatch(fixture.game, fixture, [1, 1]);
};

test('the forecast for a league match is what its bills then do', () => {
  const seen = new Set<string>();
  for (const ruleset of ['original', latestEnhanced] as const) {
    for (let seed = 0; seed < 40; seed++) {
      const base = fresh(ruleset, seed);
      const limit = creditLimit(base);
      for (const [cash, debt, graceWeeks] of [
        [100_000, 0, undefined],
        [0, 0, undefined],
        [0, limit - 1000, undefined],
        [0, limit + 5000, undefined],
        [0, limit + 5000, 2],
        [0, limit + 5000, 1],
        [500_000, limit + 5000, 1]
      ] as const) {
        const game: Game = {
          ...base,
          cash,
          debt,
          ...(graceWeeks === undefined ? {} : { graceWeeks })
        };
        const forecast = nextBills(game)!;
        expect(forecast.exact).toBe(true);
        const { bills, game: after } = played(game);
        expect(forecast.charges).toEqual({
          interest: bills!.interest,
          rent: bills!.rent,
          wages: bills!.wages
        });
        expect(forecast.borrow).toBe(after.debt - debt);
        expect(forecast.debtAfter).toBe(after.debt);
        const outcome = isDismissed(after)
          ? 'sacked'
          : after.debt > creditLimit(after)
            ? 'grace'
            : after.debt > debt
              ? 'borrow'
              : 'covered';
        expect(forecast.outcome).toBe(outcome);
        seen.add(outcome);
        if (outcome === 'grace') {
          expect(forecast.weeksLeft).toBe(after.graceWeeks);
          expect(forecast.over).toBe(after.debt - creditLimit(after));
        }
      }
    }
  }
  expect([...seen].toSorted()).toEqual([
    'borrow',
    'covered',
    'grace',
    'sacked'
  ]);
});

const over = (ruleset: Ruleset) => {
  const game = fresh(ruleset);
  return nextBills({ ...game, cash: 0, debt: creditLimit(game) + 5000 })!;
};

test('the original sacks at once; Enhanced starts a grace period first', () => {
  expect(over('original').outcome).toBe('sacked');
  expect(over(latestEnhanced)).toMatchObject({
    outcome: 'grace',
    starts: true,
    weeksLeft: 4
  });
});

test("a cup round counts the lowest gate its draw can bring, and isn't exact", () => {
  for (let seed = 0; seed < 200; seed++) {
    const game: Game = { ...fresh(latestEnhanced, seed), scheduleCounter: 2 };
    const lowest = lowestCupGate(game);
    const fixture = prepareCupMatch(game);
    expect(fixture.gate).toBeGreaterThanOrEqual(lowest);
    const forecast = nextBills(game);
    expect(forecast?.exact).toBe(false);
    expect(forecast?.gate).toBe(lowest);
  }
});

test('with the season played, there are no next bills', () => {
  const game = fresh(latestEnhanced);
  expect(
    nextBills({ ...game, cupFinished: true, leagueMatches: 15 })
  ).toBeUndefined();
});
