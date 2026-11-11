import { expect, test } from 'bun:test';

import { submitInput } from '../test/input';
import {
  createNewGame,
  creditLimit,
  isDismissed,
  payWeeklyBills,
  type Game
} from './management';
import { gracePeriodWeeks, type Ruleset } from './ruleset';
import { decodeSave, encodeSave } from './save';
import { completeSeason } from './season';
import { createSession } from './session';

const club = (ruleset: Ruleset, money: Partial<Game> = {}): Game => ({
  ...createNewGame({
    club: 1,
    colour: 0,
    level: 1,
    manager: 'alex',
    ruleset,
    seed: 0
  }),
  ...money
});

/** Pays one week's bills; `cash` tops the club up first. */
const week = (game: Game, cash = 0) =>
  payWeeklyBills({ ...game, cash: game.cash + cash }).game;

/** Exactly at the limit with no cash: any bill takes the club over. */
const atLimit = (ruleset: Ruleset) => club(ruleset, { cash: 0, debt: 250_000 });

test('only Enhanced version 2 gives a grace period, of 4 weeks', () => {
  expect(gracePeriodWeeks('original')).toBeUndefined();
  expect(gracePeriodWeeks('enhanced-1')).toBeUndefined();
  expect(gracePeriodWeeks('enhanced-2')).toBe(4);
});

test('the original dismisses at the first bills over the limit, with no grace period', () => {
  const paid = week(atLimit('original'));
  expect(paid.debt).toBeGreaterThan(creditLimit(paid));
  expect('graceWeeks' in paid).toBe(false);
  expect(isDismissed(paid)).toBe(true);
});

test('going over starts a grace period that counts down to dismissal', () => {
  let game = week(atLimit('enhanced-2'));
  const left: (number | undefined)[] = [];
  const dismissed: boolean[] = [];
  for (let i = 0; i < 5; i++) {
    left.push(game.graceWeeks);
    dismissed.push(isDismissed(game));
    game = week(game);
  }
  expect(left).toEqual([4, 3, 2, 1, 0]);
  expect(dismissed).toEqual([false, false, false, false, true]);
});

test('getting back to the limit ends the grace period; going over again starts a full one', () => {
  let game = week(week(atLimit('enhanced-2')));
  expect(game.graceWeeks).toBe(3);
  // Gate money arrives: enough to pay the bills and the excess debt.
  game = { ...game, cash: 100_000 };
  game = { ...game, cash: game.cash - (game.debt - 250_000), debt: 250_000 };
  game = week(game);
  expect(game.debt).toBe(250_000);
  expect('graceWeeks' in game).toBe(false);
  expect(isDismissed(game)).toBe(false);
  game = week({ ...game, cash: 0 });
  expect(game.graceWeeks).toBe(4);
});

test('relegation over the new limit starts a grace period at the next bills, and a running one survives the season end', () => {
  // £400k is within Division 3's £500k limit, but not Division 4's £250k.
  const fresh = club('enhanced-2');
  const bottom = fresh.league.map((r, i) => ({ ...r, position: i + 1 }));
  const seasonOver = {
    cupFinished: true,
    cupRound: 8,
    league: bottom,
    leagueMatches: 15
  };
  const third = { ...fresh, ...seasonOver, club: 48, debt: 400_000 };
  const relegated = completeSeason({ ...third, division: 3 }).game;
  expect(relegated.division).toBe(4);
  expect('graceWeeks' in relegated).toBe(false);
  const paid = week(relegated);
  expect(paid.debt).toBeGreaterThan(creditLimit(paid));
  expect(paid.graceWeeks).toBe(4);
  expect(isDismissed(paid)).toBe(false);
  expect(isDismissed(week({ ...relegated, ruleset: 'original' }))).toBe(true);

  // A mid-table finish: no movement, so the debt is still over the limit.
  const midTable = paid.league.map(r => ({ ...r, position: 8 }));
  const ended = completeSeason({
    ...paid,
    ...seasonOver,
    league: midTable
  }).game;
  expect(ended.division).toBe(4);
  expect(ended.graceWeeks).toBe(4);
  expect(week(ended).graceWeeks).toBe(3);
});

const toBills = (ruleset: Ruleset) => {
  // The same play as the original's dismissal test in session.test.ts.
  const session = createSession(2 ** 24 - 5, 0, ruleset);
  session.advance(5);
  session.skipPause();
  for (const text of ['alex', '1', '1', '0', 'l', '250000', '']) {
    submitInput(session, text);
  }
  for (const input of ['99', '', '99']) {
    submitInput(session, input);
  }
  session.advance(1_000_000);
  for (let i = 0; i < 4; i++) {
    submitInput(session, '');
  }
  submitInput(session, String(session.view.game!.cash));
  session.advance((65_537 - (session.view.frames % 65_536)) % 65_536);
  submitInput(session, '');
  for (const input of ['99', '', '99']) {
    submitInput(session, input);
  }
  session.advance(1_000_000);
  submitInput(session, '');
  submitInput(session, '');
  return session;
};

test('in play, the bills that dismiss under the original start a grace period instead', () => {
  expect(toBills('original').view.screen).toBe('dismissal');
  const session = toBills('enhanced-2');
  expect(session.view.screen).toBe('bills');
  expect(session.view.game!.debt).toBeGreaterThan(250_000);
  expect(session.view.game!.graceWeeks).toBe(4);
});

test('saves keep a running grace period; older versions and other rules cannot hold one', () => {
  const over = week(atLimit('enhanced-2'));
  expect(decodeSave(encodeSave(over, 99)).game.graceWeeks).toBe(4);
  const kept = JSON.parse(encodeSave(over, 99));
  for (const invalid of [
    { ...kept, version: 7 },
    { ...kept, game: { ...kept.game, ruleset: 'original' } },
    { ...kept, game: { ...kept.game, ruleset: 'enhanced-1' } },
    { ...kept, game: { ...kept.game, graceWeeks: 5 } },
    { ...kept, game: { ...kept.game, graceWeeks: -1 } }
  ]) {
    expect(() => decodeSave(JSON.stringify(invalid))).toThrow(RangeError);
  }
  // A version 7 keep file without a grace period still loads.
  const { graceWeeks: _, ...before } = kept.game;
  expect(
    decodeSave(JSON.stringify({ ...kept, game: before, version: 7 })).game
      .ruleset
  ).toBe('enhanced-2');
});
