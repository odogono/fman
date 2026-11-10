import { expect, test } from 'bun:test';

import { createSession } from './session';

const setup = () => {
  const session = createSession();
  session.skipPause();
  session.submit('alex');
  session.submit('1');
  session.submit('1');
  session.submit('0');
  return session;
};

test('title timing, manager limit and club paging follow the original setup', () => {
  const session = createSession();
  session.advance(299);
  expect(session.screen).toBe('title');
  session.advance(1);
  expect(session.screen).toBe('manager');
  session.submit('x'.repeat(21));
  expect(session.screen).toBe('message');
  session.advance(200);
  session.submit('alex');
  expect(session.screen).toBe('clubs');
  session.submit('17');
  expect(session.screen).toBe('clubs');
  session.submit('99');
  expect(session.page).toBe(2);
  session.submit('17');
  expect(session.screen).toBe('level');
  session.submit('8');
  expect(session.screen).toBe('level');
  session.submit('7');
  session.submit('1');
  expect(session.screen).toBe('message');
  session.skipPause();
  session.submit('7');
  expect(session.screen).toBe('menu');
  expect(session.game?.clubs[63]?.name).toBe('Blackburn');
  expect(session.game?.level).toBe(7);
});

test('line input requires Enter and preserves the original command cases', () => {
  const session = setup();
  session.submit('s');
  expect(session.screen).toBe('status');
  session.submit('');
  session.submit('LeVeL');
  expect(session.screen).toBe('menu');
  session.submit('LEVEL');
  expect(session.screen).toBe('level');
  session.submit('3');
  expect(session.screen).toBe('message');
  session.submit('');
  expect(session.game?.level).toBe(3);
  expect(session.screen).toBe('menu');
});

test('management commands update finances, retry errors and do not reseed on menu return', () => {
  const session = setup();
  const seed = session.game!.seed;
  session.advance(100);
  session.submit('l');
  session.submit('not a number');
  expect(session.screen).toBe('borrow');
  session.submit('250001');
  expect(session.screen).toBe('message');
  session.submit('');
  expect(session.screen).toBe('borrow');
  session.submit('40000');
  expect(session.game?.debt).toBe(40_000);
  session.submit('');
  session.submit('p');
  session.submit('10000');
  expect(session.game?.cash).toBe(130_000);
  expect(session.game?.debt).toBe(30_000);
  expect(session.game?.seed).toBe(seed);
});

test('copy and unavailable commands do not reset the current game', () => {
  const session = setup();
  const game = session.game;
  expect(session.submit('h')).toEqual({ type: 'copy' });
  expect(session.submit('keep')).toEqual({
    feature: 'Saving',
    type: 'unavailable'
  });
  expect(session.game).toBe(game);
  session.submit('a');
  session.submit('99');
  expect(session.screen).toBe('menu');
});

test('plays the first league match through selection, highlights, table and bills', () => {
  const session = setup();
  session.submit('99');
  expect(session.screen).toBe('fixture');
  session.submit('');
  expect(session.screen).toBe('team');
  session.submit('c');
  session.submit('15');
  expect(session.game?.players.filter(p => p.status === 2)).toHaveLength(12);
  session.submit('99');
  expect(session.screen).toBe('selection');
  expect(session.selectionError).toBe('PLAYER NO. OUT OF RANGE');
  session.submit('1');
  session.submit('99');
  expect(session.screen).toBe('team');
  session.submit('99');
  expect(session.screen).toBe('highlights');
  session.advance(1_000_000);
  expect(session.screen).toBe('result');
  session.submit('');
  expect(session.screen).toBe('other-matches');
  session.submit('');
  expect(session.screen).toBe('table');
  session.submit('');
  expect(session.screen).toBe('bills');
  expect(session.game!.cash).toBeGreaterThan(0);
  session.submit('');
  expect(session.screen).toBe('menu');
  expect(session.submit('99')).toEqual({
    feature: 'Next fixture',
    type: 'unavailable'
  });
});
