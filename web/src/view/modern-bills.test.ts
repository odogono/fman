import { expect, test } from 'bun:test';

import { creditLimit } from '../sim/management';
import type { View } from '../sim/session';
import { playTo } from '../test/play';
import { billsFor } from './modern-bills';
import { modernScreenFor } from './modern-screen';

type BillsView = Extract<View, { screen: 'bills' }>;

const week = playTo('bills');
const { game } = week;
const limit = creditLimit(game);

/** The week's bills, changed by `bills`, after a game changed by `changes`. */
const billed = (
  bills: Partial<BillsView['bills']> = {},
  changes: Partial<BillsView['game']> = {}
): BillsView => ({
  ...week,
  bills: { ...week.bills, ...bills },
  game: { ...game, ...changes }
});

test('the weekly bills show their Modern screen', () => {
  expect(modernScreenFor(week)?.kind).toBe('bills');
});

test('the bills list each charge and their total', () => {
  const screen = billsFor(billed({ interest: 300, rent: 2000, wages: 9600 }))!;
  expect(screen.rows).toEqual([
    ['Wages', 9600],
    ['Ground rent', 2000],
    ['Loan interest', 300]
  ]);
  expect(screen.total).toBe(11_900);
});

test('the weekly balance, cash and loan against the credit limit follow', () => {
  const screen = billsFor(
    billed({ balance: -4500 }, { cash: 12_000, debt: 30_000 })
  )!;
  expect(screen).toMatchObject({
    balance: -4500,
    cash: 12_000,
    debt: 30_000,
    limit
  });
  expect(screen.done).toEqual({
    enabled: true,
    id: 'bills.continue',
    label: 'Continue'
  });
});

test('a shortfall says how much was borrowed; otherwise nothing', () => {
  expect(
    billsFor(billed({ borrowed: 0, loanIncreased: false }))!.borrowed
  ).toBe(undefined);
  expect(
    billsFor(billed({ borrowed: 8400, loanIncreased: true }))!.borrowed
  ).toBe(8400);
});

test('over the credit limit, a grace period says how far over and how long', () => {
  expect(billsFor(week)!.grace).toBeUndefined();
  const over = billsFor(billed({}, { debt: limit + 42_000, graceWeeks: 3 }))!;
  expect(over.grace).toEqual({ over: 42_000, weeks: 3 });
});

test('the dismissal shows the bills, then the sacking', () => {
  const view: View = {
    ...billed({}, { debt: limit + 1000 }),
    creditLimit: limit,
    screen: 'dismissal'
  };
  expect(modernScreenFor(view)?.kind).toBe('bills');
  const screen = billsFor(view)!;
  expect(screen.dismissal).toEqual({ limit });
  expect(screen.grace).toBeUndefined();
  expect(screen.done).toEqual({
    enabled: true,
    id: 'dismissal.continue',
    label: 'Leave the club'
  });
});
