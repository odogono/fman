import { expect, test } from 'bun:test';

import { createSession, type View } from '../sim/session';
import { submitInput } from '../test/input';
import { changeAmount, startAmount } from './amount-entry';
import { answersFor } from './answers';
import { modernScreenFor } from './modern-screen';

/**
 * Every screen a new game passes through on its way to its first match:
 * the menu, status, a loan, a repayment, the squad and the team.
 */
const firstMatchViews = () => {
  const session = createSession(2 ** 24 - 5);
  session.advance(5);
  session.skipPause();
  const views: View[] = [];
  for (const input of [
    // A new game, to the menu.
    'alex',
    '1',
    '1',
    '0',
    // Status, and back.
    's',
    '',
    // A loan, and its balance.
    'l',
    '5000',
    '',
    // The squad, and back.
    'a',
    '99',
    // A repayment, and its balance.
    'p',
    '1000',
    '',
    // The next fixture, the team and kick-off.
    '99',
    '',
    '99'
  ]) {
    views.push(session.view);
    submitInput(session, input);
  }
  views.push(session.view);
  return views;
};

test('each original screen shows its Modern screen, or the original', () => {
  const shown = firstMatchViews().map(
    view => `${view.screen}: ${modernScreenFor(view)?.kind ?? 'original'}`
  );
  expect(shown).toEqual([
    'manager: original',
    'clubs: original',
    'level: original',
    'colours: original',
    'menu: home',
    'status: status',
    'menu: home',
    'borrow: amount',
    'message: message',
    'menu: home',
    'squad: original',
    'menu: home',
    'repay: amount',
    'message: message',
    'menu: home',
    'fixture: original',
    'team: pick-team',
    'highlights: highlights'
  ]);
});

test('the Home screen carries the status without its Done button', () => {
  const menu = firstMatchViews().find(view => view.screen === 'menu')!;
  const screen = modernScreenFor(menu);
  expect(screen?.kind).toBe('home');
  expect(screen?.kind === 'home' && screen.status.done).toBeUndefined();
});

test('an amount prompt starts its entry afresh unless one is given', () => {
  const borrow = firstMatchViews().find(view => view.screen === 'borrow')!;
  const offered = answersFor(borrow).find(a => a.kind === 'amount');
  if (offered?.kind !== 'amount') {
    throw new Error('No loan offered');
  }
  const fresh = modernScreenFor(borrow);
  expect(fresh?.kind === 'amount' && fresh.amount.entry).toEqual(
    startAmount(offered)
  );
  const entry = changeAmount(startAmount(offered), { type: 'max' });
  const given = modernScreenFor(borrow, { amount: entry });
  expect(given?.kind === 'amount' && given.amount.entry).toEqual(entry);
});
