import { expect, test } from 'bun:test';

import { fixtureSides } from '../sim/league';
import { createSession } from '../sim/session';
import { submitInput } from '../test/input';
import { screenTitle } from './screen-title';

test('each screen is titled, and the highlights name the clubs playing', () => {
  const session = createSession(2 ** 24 - 5);
  session.advance(5);
  session.skipPause();
  const titles = [screenTitle(session.view)];
  for (const input of ['alex', '1', '1', '0', 'l', '0', '', '99', '']) {
    submitInput(session, input);
    if (session.view.paused) {
      session.skipPause();
    }
    titles.push(screenTitle(session.view));
  }
  expect(titles).toEqual([
    'New manager',
    'Choose a club',
    'Difficulty level',
    'Team colours',
    'Main menu',
    'Loan',
    'Bank balance',
    'Main menu',
    'League match',
    'Picked team'
  ]);

  submitInput(session, '99');
  const view = session.view;
  if (view.screen !== 'highlights') {
    throw new Error(`Expected the highlights, not ${view.screen}`);
  }
  const { away, home } = fixtureSides(view.game, view.fixture);
  expect(screenTitle(view)).toBe(`${home.name.trim()} v ${away.name.trim()}`);
  expect(screenTitle(view)).toMatch(/^\S.* v \S.*\S$/);
});
