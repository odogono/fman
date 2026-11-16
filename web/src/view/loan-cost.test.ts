import { expect, test } from 'bun:test';

import { createJournal, type Journal } from '../sim/journal';
import { creditLimit, weeklyCharges } from '../sim/management';
import { nextBills } from '../sim/next-bills';
import { latestEnhanced } from '../sim/ruleset';
import type { View } from '../sim/session';
import { submitInput } from '../test/input';
import { startAmount, type AmountEntry } from './amount-entry';
import { answersFor } from './answers';
import { amountPromptFor } from './modern-amount';

/** A new Enhanced game at the menu, then `inputs` from there. */
const from = (...inputs: string[]): Journal => {
  const journal = createJournal({ kind: 'title', ruleset: latestEnhanced });
  journal.advance(137);
  journal.skipPause();
  for (const text of ['alex', '1', '1', ...inputs]) {
    submitInput(journal, text);
  }
  return journal;
};

/** The view's amount entry, at `value`. */
const entryAt = (view: View, value: number): AmountEntry => {
  const offered = answersFor(view).find(a => a.kind === 'amount');
  if (offered?.kind !== 'amount') {
    throw new Error(`No amount on ${view.screen}`);
  }
  return { ...startAmount(offered), value };
};

type BorrowView = Extract<View, { screen: 'borrow' }>;

const borrowing = ((): BorrowView => {
  const view = from('l').session.view;
  if (view.screen !== 'borrow') {
    throw new Error(`On ${view.screen}`);
  }
  return view;
})();
const { game } = borrowing;
const limit = creditLimit(game);

test('a loan shows the weekly interest before and after it', () => {
  const prompt = amountPromptFor(borrowing, entryAt(borrowing, 50_000))!;
  expect(prompt.cost!.interest).toEqual({
    after: Math.floor(50_000 / 100),
    before: weeklyCharges(game).interest
  });
});

test('a loan shows the next bills with it, from the sim', () => {
  const prompt = amountPromptFor(borrowing, entryAt(borrowing, 50_000))!;
  expect(prompt.cost!.bills).toBe(
    nextBills({ ...game, cash: game.cash + 50_000, debt: 50_000 })!.total
  );
});

test('the cost follows the amount being typed, as it would be submitted', () => {
  const entry: AmountEntry = { ...entryAt(borrowing, 0), typing: '120000' };
  expect(amountPromptFor(borrowing, entry)!.cost!.interest.after).toBe(1200);
});

test('the next bills warning follows the loan, as on the Home screen', () => {
  // No cash, no home gate and every club bottom of the table: a small gate.
  const broke: BorrowView = {
    ...borrowing,
    game: {
      ...game,
      cash: 0,
      debt: limit - 2000,
      homeGate: 0,
      league: game.league.map(record => ({ ...record, position: 16 }))
    }
  };
  const nothing = amountPromptFor(broke, entryAt(broke, 0))!;
  expect(nothing.cost!.warning?.level).toBe('grace');
  expect(nothing.cost!.warning?.text).toMatch(/grace period starts/);
  // Borrowing the last £2,000 pays some of the bills from the loan instead.
  const all = amountPromptFor(broke, entryAt(broke, 2000))!;
  expect(all.cost!.warning?.level).toBe('grace');
  const covered = amountPromptFor(borrowing, entryAt(borrowing, 50_000))!;
  expect(covered.cost!.warning).toBeUndefined();
});

test('a repayment shows the interest it saves', () => {
  const view = from('l', '100000', '', 'p').session.view;
  expect(view.screen).toBe('repay');
  const prompt = amountPromptFor(view, entryAt(view, 40_000))!;
  expect(prompt.cost!.interest).toEqual({ after: 600, before: 1000 });
});

test('a transfer bid shows no loan cost', () => {
  const bid: View = { ...borrowing, playerId: 1, screen: 'transfer' };
  expect(amountPromptFor(bid, entryAt(bid, 1000))!.cost).toBeUndefined();
});
