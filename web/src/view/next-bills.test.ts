import { expect, test } from 'bun:test';

import { createJournal } from '../sim/journal';
import { creditLimit, type Game } from '../sim/management';
import { latestEnhanced } from '../sim/ruleset';
import type { View } from '../sim/session';
import { submitInput } from '../test/input';
import { homeFor } from './home';

type MenuView = Extract<View, { screen: 'menu' }>;

/** A new Enhanced game at the menu, before its first match. */
const atMenu = (): MenuView => {
  const journal = createJournal({ kind: 'title', ruleset: latestEnhanced });
  journal.advance(137);
  journal.skipPause();
  for (const text of ['alex', '1', '1']) {
    submitInput(journal, text);
  }
  const view = journal.session.view;
  if (view.screen !== 'menu') {
    throw new Error(`On ${view.screen}`);
  }
  return view;
};

const menu = atMenu();
const limit = creditLimit(menu.game);
const at = (changes: Partial<Game>): MenuView => ({
  ...menu,
  game: { ...menu.game, ...changes }
});
const bills = (changes: Partial<Game> = {}) => homeFor(at(changes)).bills;

test('while the menu waits, Home shows the next bills with no warning when covered', () => {
  const shown = bills()!;
  expect(shown.total).toBeGreaterThan(0);
  expect(shown.warning).toBeUndefined();
});

test('a shortfall within the limit says how much will be borrowed', () => {
  // No home gate, and every club bottom of the table, so the gate is small.
  const shown = bills({
    cash: 0,
    debt: 0,
    homeGate: 0,
    league: menu.game.league.map(record => ({ ...record, position: 16 }))
  })!;
  expect(shown.warning).toMatchObject({ level: 'borrow' });
  expect(shown.warning!.text).toMatch(
    /^Cash won't cover next week's bills – you'll borrow £[\d,]+\.$/
  );
});

test('going over the limit starts a grace period, then counts it down', () => {
  const starts = bills({ cash: 0, debt: limit + 18_000 })!.warning!;
  expect(starts.level).toBe('grace');
  expect(starts.text).toMatch(
    /^Next week's bills take your loan £[\d,]+ over the credit limit – a 4-week grace period starts\.$/
  );
  const counting = bills({ cash: 0, debt: limit + 18_000, graceWeeks: 3 })!;
  expect(counting.warning!.text).toMatch(/– 2 weeks left to clear it\.$/);
  const lastBut = bills({ cash: 0, debt: limit + 18_000, graceWeeks: 2 })!;
  expect(lastBut.warning!.text).toMatch(/– 1 week left to clear it\.$/);
});

test('the last grace week, or the original over the limit, warns of the sack', () => {
  const sacked = bills({ cash: 0, debt: limit + 18_000, graceWeeks: 1 })!;
  expect(sacked.warning!.level).toBe('sacked');
  expect(sacked.warning!.text).toMatch(
    /^Next week's bills will get you sacked unless you find £[\d,]+\.$/
  );
  const original = homeFor({
    ...menu,
    game: { ...menu.game, cash: 0, debt: limit + 18_000, ruleset: 'original' }
  }).bills!;
  expect(original.warning!.level).toBe('sacked');
});

test('a cup round, whose gate is unknown, words its warning as the worst case', () => {
  const cup = bills({ cash: 0, debt: limit + 18_000, scheduleCounter: 2 })!;
  expect(cup.warning!.text).toMatch(
    /^Next week's bills could take your loan up to £[\d,]+ over the credit limit/
  );
  const sacked = bills({
    cash: 0,
    debt: limit + 18_000,
    graceWeeks: 1,
    scheduleCounter: 2
  })!;
  expect(sacked.warning!.text).toMatch(
    /^Next week's bills could get you sacked unless you find up to £[\d,]+\.$/
  );
});

test('away from the menu, or with the season played, Home shows no next bills', () => {
  const status: View = { ...menu, screen: 'status' };
  expect(homeFor({ ...status, game: menu.game }).bills).toBeUndefined();
  expect(bills({ cupFinished: true, leagueMatches: 15 })).toBeUndefined();
});
