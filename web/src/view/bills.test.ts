import { expect, test } from 'bun:test';

import { createNewGame, payWeeklyBills, type Game } from '../sim/management';
import type { Ruleset } from '../sim/ruleset';
import { makeScreen } from './screen';

/** The bills screen for one week's bills, starting exactly at the limit. */
const billsAtLimit = (ruleset: Ruleset, graceWeeks?: number) => {
  const paid = payWeeklyBills({
    ...createNewGame({
      club: 1,
      colour: 0,
      level: 1,
      manager: 'alex',
      ruleset,
      seed: 0
    }),
    cash: 0,
    debt: 250_000
  });
  const game: Game =
    graceWeeks === undefined ? paid.game : { ...paid.game, graceWeeks };
  return makeScreen({
    bills: paid.bills,
    frames: 0,
    game,
    paused: false,
    screen: 'bills'
  }).lines.map(line => line.trimEnd());
};

test('a grace period shows on the bills screen as weeks left, then the last week (ADR 0010)', () => {
  const started = billsAtLimit('enhanced-2');
  expect(started[6]).toBe('LOAN INCREASED TO PAY BILLS');
  expect(started.slice(8, 10)).toEqual([
    'OVER YOUR CREDIT LIMIT',
    '4 WEEKS TO CLEAR IT'
  ]);
  expect(billsAtLimit('enhanced-2', 2)[9]).toBe('2 WEEKS TO CLEAR IT');
  expect(billsAtLimit('enhanced-2', 1)[9]).toBe('LAST WEEK TO CLEAR YOUR DEBT');
  // Every message fits the Spectrum's 32 columns.
  expect(Math.max(...started.map(line => line.length))).toBeLessThanOrEqual(32);
});

test('without a grace period running, the bills screen is the original one', () => {
  // The original and Enhanced version 1 dismiss instead, so no message shows.
  for (const ruleset of ['original', 'enhanced-1'] as const) {
    expect(billsAtLimit(ruleset).slice(8, 10)).toEqual(['', '']);
  }
});
