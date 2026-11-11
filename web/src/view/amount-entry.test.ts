import { expect, test } from 'bun:test';

import {
  changeAmount,
  digitAllowed,
  formatAmount,
  startAmount,
  type AmountAction,
  type AmountEntry
} from './amount-entry';

const loan = () =>
  startAmount({
    id: 'borrow.amount',
    kind: 'amount',
    max: 125_500,
    min: 0,
    start: 0
  });

const apply = (entry: AmountEntry, ...actions: AmountAction[]) =>
  actions.reduce(changeAmount, entry);

test('the stepper and chips stay within the range', () => {
  expect(apply(loan(), { delta: -1000, type: 'step' }).value).toBe(0);
  expect(apply(loan(), { delta: 1000, type: 'step' }).value).toBe(1000);
  expect(
    apply(
      loan(),
      { delta: 100_000, type: 'step' },
      { delta: 50_000, type: 'step' }
    ).value
  ).toBe(125_500);
  expect(apply(loan(), { type: 'max' }).value).toBe(125_500);
});

const bid = (value: number) =>
  startAmount({
    id: 'transfer.bid',
    kind: 'amount',
    max: 20_000,
    min: 0,
    start: value
  }).value;

test('a bid starts at the asking value, capped at the cash', () => {
  expect(bid(15_000)).toBe(15_000);
  expect(bid(45_000)).toBe(20_000);
});

test('the keypad types an exact amount, never past the range', () => {
  let entry = apply(loan(), { type: 'keypad' });
  expect(entry.typing).toBe('');
  for (const digit of [1, 2, 5, 5, 0]) {
    entry = changeAmount(entry, { digit, type: 'digit' });
  }
  expect(entry.typing).toBe('12550');
  expect(digitAllowed(entry, 0)).toBe(true);
  expect(digitAllowed(entry, 1)).toBe(false);
  expect(changeAmount(entry, { digit: 1, type: 'digit' })).toBe(entry);
  entry = apply(entry, { digit: 0, type: 'digit' }, { type: 'back' });
  expect(entry.typing).toBe('12550');
  entry = changeAmount(entry, { type: 'done' });
  expect(entry).toMatchObject({ typing: undefined, value: 12_550 });
});

test('leading zeros collapse, and an empty keypad keeps the amount', () => {
  const entry = apply(
    loan(),
    { delta: 3000, type: 'step' },
    { type: 'keypad' },
    { digit: 0, type: 'digit' },
    { digit: 0, type: 'digit' }
  );
  expect(entry.typing).toBe('0');
  expect(apply(entry, { type: 'back' }, { type: 'done' })).toMatchObject({
    typing: undefined,
    value: 3000
  });
});

test('amounts show in pounds with thousands separators', () => {
  expect(formatAmount(0)).toBe('£0');
  expect(formatAmount(1_000_000)).toBe('£1,000,000');
});
