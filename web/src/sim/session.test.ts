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
  expect(session.screen).toBe('transfer');
  session.submit('99');
  expect(session.screen).toBe('menu');
  session.submit('99');
  expect(session.screen).toBe('fixture');
  expect(session.fixture!.kind).toBe('cup');
});

test('transfer bids retry the same player; joining and declining return through the original reseed boundary', () => {
  const session = setup();
  session.submit('99');
  session.submit('');
  session.submit('99');
  session.advance(1_000_000);
  for (let i = 0; i < 4; i++) {
    session.submit('');
  }
  expect(session.screen).toBe('transfer');
  const id = session.transfer!.playerId;
  const cash = session.game!.cash;
  const seed = session.game!.seed;
  expect(session.submit('h')).toEqual({ type: 'copy' });
  session.submit('no');
  expect(session.game!.seed).toBe(seed);
  session.submit(String(cash + 1));
  expect(session.message).toBe("You haven't enough money!");
  expect(session.game!.seed).toBe(seed);
  session.submit('');
  expect(session.screen).toBe('transfer');
  session.submit('');
  expect(session.message).toBe('YOUR BID IS REFUSED');
  session.submit('');
  expect(session.transfer!.playerId).toBe(id);
  const owned = session.game!.players.filter(p => p.status > 0).length;
  session.submit(String(cash));
  expect(session.game!.players.filter(p => p.status > 0)).toHaveLength(
    owned + 1
  );
  expect(session.game!.players[id - 1]!.status).toBe(1);
  expect(session.game!.cash).toBe(0);
  expect(session.screen).toBe('transfer-result');
  session.submit('');
  expect(session.screen).toBe('menu');
  expect(session.game!.seed).toBe(session.frames % 65_536);
});

test('the first cup replays at the opposite ground, bills once, then returns through transfers', () => {
  const session = setup();
  session.submit('99');
  session.submit('');
  session.submit('99');
  session.advance(1_000_000);
  for (let i = 0; i < 4; i++) {
    session.submit('');
  }
  session.advance((65_536 - (session.frames % 65_536)) % 65_536);
  session.submit('99');
  expect(session.game!.seed).toBe(0);
  session.submit('99');
  expect(session.fixture!.kind).toBe('cup');
  const home = session.fixture!.home;
  session.submit('');
  session.submit('99');
  session.advance(1_000_000);
  expect(session.highlights!.score).toEqual([1, 1]);
  session.submit('');
  expect(session.screen).toBe('replay');
  const cash = session.game!.cash;
  session.submit('');
  expect(session.fixture!.home).toBe(!home);
  expect(session.screen).toBe('fixture');
  session.submit('');
  session.submit('99');
  session.advance(1_000_000);
  expect(session.highlights!.score).toEqual([0, 3]);
  session.submit('');
  expect(session.screen).toBe('cup-result');
  expect(session.game!.cash).toBeGreaterThan(cash);
  session.submit('');
  expect(session.screen).toBe('bills');
  session.submit('');
  session.submit('99');
  expect(session.screen).toBe('menu');
  for (let match = 2; match <= 3; match++) {
    session.submit('99');
    expect(session.screen).toBe('fixture');
    expect(session.fixture!.kind).toBe('league');
    expect(session.fixture!.home).toBe(match === 3);
    expect(session.game!.leagueMatches).toBe(match);
    session.submit('');
    session.submit('99');
    session.advance(1_000_000);
    for (let i = 0; i < 4; i++) {
      session.submit('');
    }
    session.submit('99');
    expect(session.screen).toBe('menu');
  }
  session.submit('99');
  expect(session.screen).toBe('fixture');
  expect(session.game!.cupRound).toBe(2);
});

test('after cup elimination, all remaining league matches lead to a season boundary before transfers', () => {
  const session = setup();
  for (const input of ['99', '', '99']) {
    session.submit(input);
  }
  session.advance(1_000_000);
  for (let i = 0; i < 4; i++) {
    session.submit('');
  }
  session.advance((65_537 - (session.frames % 65_536)) % 65_536);
  session.submit('99');
  expect(session.game!.seed).toBe(1);
  for (const input of ['99', '', '99']) {
    session.submit(input);
  }
  session.advance(1_000_000);
  session.submit('');
  expect(session.game!.cupFinished).toBe(true);
  session.submit('');
  session.submit('');
  session.submit('99');
  for (let match = 2; match <= 15; match++) {
    for (const input of ['99', '', '99']) {
      session.submit(input);
    }
    session.advance(1_000_000);
    for (let i = 0; i < 3; i++) {
      session.submit('');
    }
    expect(session.screen).toBe('bills');
    if (match === 15) {
      break;
    }
    session.submit('');
    session.submit('99');
  }
  const game = session.game;
  expect(session.submit('')).toEqual({
    feature: 'Season progression',
    type: 'unavailable'
  });
  expect(session.screen).toBe('bills');
  expect(session.game).toBe(game);
});

test('a club beyond the debt cap stops before the unimplemented dismissal flow', () => {
  const session = setup();
  session.submit('l');
  session.submit('250000');
  session.submit('');
  for (const input of ['99', '', '99']) {
    session.submit(input);
  }
  session.advance(1_000_000);
  for (let i = 0; i < 4; i++) {
    session.submit('');
  }
  session.submit(String(session.game!.cash));
  session.advance((65_537 - (session.frames % 65_536)) % 65_536);
  session.submit('');
  expect(session.game!.seed).toBe(1);
  for (const input of ['99', '', '99']) {
    session.submit(input);
  }
  session.advance(1_000_000);
  session.submit('');
  session.submit('');
  expect(session.screen).toBe('bills');
  expect(session.game!.debt).toBeGreaterThan(250_000);
  expect(session.submit('')).toEqual({
    feature: 'Dismissal',
    type: 'unavailable'
  });
  expect(session.screen).toBe('bills');
});
