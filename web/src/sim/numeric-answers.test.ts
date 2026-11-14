import { describe, expect, test } from 'bun:test';

import { submitInput } from '../test/input';
import { createSession, type Screen, type Session } from './session';

/** At the menu, as in `session.test.ts`. */
const atMenu = () => {
  const session = createSession(2 ** 24 - 5);
  session.advance(5);
  session.skipPause();
  for (const input of ['alex', '1', '1', '0']) {
    submitInput(session, input);
  }
  return session;
};

const typed = (inputs: string[]) => () => {
  const session = atMenu();
  for (const input of inputs) {
    submitInput(session, input);
  }
  return session;
};

/** The transfer market offered after the first match, as in `modern-amount.test.ts`. */
const atMarket = () => {
  const session = typed(['99', '', '99'])();
  session.advance(1_000_000);
  for (let i = 0; i < 4; i++) {
    submitInput(session, '');
  }
  return session;
};

const screens: [Screen, () => Session][] = [
  ['borrow', typed(['l'])],
  ['repay', typed(['p'])],
  ['transfer', atMarket],
  ['selection', typed(['99', '', 'c'])],
  ['squad', typed(['a'])]
];

const submitted = (reach: () => Session, answer: string) => {
  const session = reach();
  submitInput(session, answer);
  return session.view;
};

describe.each(screens)('the %s screen', (screen, reach) => {
  test('refuses non-numeric text without changing the game', () => {
    const session = reach();
    expect(session.view.screen).toBe(screen);
    const before = session.view;
    submitInput(session, 'x');
    expect(session.view.screen).toBe(screen);
    expect(session.view.game).toEqual(before.game!);
  });

  test.each([
    ['a 256-digit answer', '9'.repeat(256)],
    ['an answer past the safe-integer limit', '9007199254740992'],
    ['256 characters of text', 'x'.repeat(256)]
  ])('refuses %s as it does any non-numeric answer', (_, answer) => {
    expect(submitted(reach, answer)).toEqual(submitted(reach, 'x'));
  });

  test('takes the largest safe integer as the number it is', () => {
    const before = reach().view;
    const view = submitted(reach, '9007199254740991');
    // Too large for any of these screens, so refused as an out-of-range number.
    expect(view).toEqual(submitted(reach, '9999999999'));
    expect(view.game).toEqual(before.game!);
  });

  test('reads leading zeros as the number they lead', () => {
    expect(submitted(reach, '0001')).toEqual(submitted(reach, '1'));
  });
});
