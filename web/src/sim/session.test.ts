import { expect, test } from 'bun:test';

import { createSession } from './session';
import { viewOn } from './view-on';

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
  expect(session.view.screen).toBe('title');
  session.advance(1);
  expect(session.view.screen).toBe('manager');
  session.submit('x'.repeat(21));
  expect(session.view.screen).toBe('message');
  session.advance(200);
  session.submit('alex');
  expect(session.view.screen).toBe('clubs');
  session.submit('17');
  expect(session.view.screen).toBe('clubs');
  session.submit('99');
  expect(viewOn(session, 'clubs').page).toBe(2);
  session.submit('17');
  expect(session.view.screen).toBe('level');
  session.submit('8');
  expect(session.view.screen).toBe('level');
  session.submit('7');
  session.submit('1');
  expect(session.view.screen).toBe('message');
  session.skipPause();
  session.submit('7');
  expect(session.view.screen).toBe('menu');
  expect(session.view.game?.clubs[63]?.name).toBe('Blackburn');
  expect(session.view.game?.level).toBe(7);
});

test('line input requires Enter and preserves the original command cases', () => {
  const session = setup();
  session.submit('s');
  expect(session.view.screen).toBe('status');
  session.submit('');
  session.submit('LeVeL');
  expect(session.view.screen).toBe('menu');
  session.submit('LEVEL');
  expect(session.view.screen).toBe('level');
  session.submit('3');
  expect(session.view.screen).toBe('message');
  session.submit('');
  expect(session.view.game?.level).toBe(3);
  expect(session.view.screen).toBe('menu');
});

test('management commands update finances, retry errors and do not reseed on menu return', () => {
  const session = setup();
  const seed = session.view.game!.seed;
  session.advance(100);
  session.submit('l');
  session.submit('not a number');
  expect(session.view.screen).toBe('borrow');
  session.submit('250001');
  expect(session.view.screen).toBe('message');
  session.submit('');
  expect(session.view.screen).toBe('borrow');
  session.submit('40000');
  expect(session.view.game?.debt).toBe(40_000);
  session.submit('');
  session.submit('p');
  session.submit('10000');
  expect(session.view.game?.cash).toBe(130_000);
  expect(session.view.game?.debt).toBe(30_000);
  expect(session.view.game?.seed).toBe(seed);
});

test('copy and saving requests do not reset the current game', () => {
  const session = setup();
  const game = session.view.game;
  expect(session.submit('h')).toEqual({ type: 'copy' });
  expect(session.submit('keep')?.type).toBe('save');
  expect(session.view.game).toBe(game);
  session.submit('a');
  session.submit('99');
  expect(session.view.screen).toBe('menu');
});

test('plays the first league match through selection, highlights, table and bills', () => {
  const session = setup();
  session.submit('99');
  expect(session.view.screen).toBe('fixture');
  session.submit('');
  expect(session.view.screen).toBe('team');
  session.submit('c');
  session.submit('15');
  expect(session.view.game?.players.filter(p => p.status === 2)).toHaveLength(
    12
  );
  session.submit('99');
  expect(session.view.screen).toBe('selection');
  expect(viewOn(session, 'selection').error).toBe('PLAYER NO. OUT OF RANGE');
  session.submit('1');
  session.submit('99');
  expect(session.view.screen).toBe('team');
  session.submit('99');
  expect(session.view.screen).toBe('highlights');
  session.advance(1_000_000);
  expect(session.view.screen).toBe('result');
  session.submit('');
  expect(session.view.screen).toBe('other-matches');
  session.submit('');
  expect(session.view.screen).toBe('table');
  session.submit('');
  expect(session.view.screen).toBe('bills');
  expect(session.view.game!.cash).toBeGreaterThan(0);
  session.submit('');
  expect(session.view.screen).toBe('transfer');
  session.submit('99');
  expect(session.view.screen).toBe('menu');
  session.submit('99');
  expect(session.view.screen).toBe('fixture');
  expect(viewOn(session, 'fixture').fixture.kind).toBe('cup');
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
  expect(session.view.screen).toBe('transfer');
  const id = viewOn(session, 'transfer').playerId;
  const cash = session.view.game!.cash;
  const seed = session.view.game!.seed;
  expect(session.submit('h')).toEqual({ type: 'copy' });
  session.submit('no');
  expect(session.view.game!.seed).toBe(seed);
  session.submit(String(cash + 1));
  expect(viewOn(session, 'message').message).toEqual({
    kind: 'text',
    text: "You haven't enough money!"
  });
  expect(session.view.game!.seed).toBe(seed);
  session.submit('');
  expect(session.view.screen).toBe('transfer');
  session.submit('');
  expect(viewOn(session, 'message').message).toEqual({
    kind: 'text',
    text: 'YOUR BID IS REFUSED'
  });
  session.submit('');
  expect(viewOn(session, 'transfer').playerId).toBe(id);
  const owned = session.view.game!.players.filter(p => p.status > 0).length;
  session.submit(String(cash));
  expect(session.view.game!.players.filter(p => p.status > 0)).toHaveLength(
    owned + 1
  );
  expect(session.view.game!.players[id - 1]!.status).toBe(1);
  expect(session.view.game!.cash).toBe(0);
  expect(session.view.screen).toBe('transfer-result');
  session.submit('');
  expect(session.view.screen).toBe('menu');
  expect(session.view.game!.seed).toBe(session.view.frames % 65_536);
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
  session.advance((65_536 - (session.view.frames % 65_536)) % 65_536);
  session.submit('99');
  expect(session.view.game!.seed).toBe(0);
  session.submit('99');
  expect(viewOn(session, 'fixture').fixture.kind).toBe('cup');
  const home = viewOn(session, 'fixture').fixture.home;
  session.submit('');
  session.submit('99');
  session.advance(1_000_000);
  expect(viewOn(session, 'result').score).toEqual([1, 1]);
  session.submit('');
  expect(session.view.screen).toBe('replay');
  const cash = session.view.game!.cash;
  session.submit('');
  expect(viewOn(session, 'fixture').fixture.home).toBe(!home);
  expect(session.view.screen).toBe('fixture');
  session.submit('');
  session.submit('99');
  session.advance(1_000_000);
  expect(viewOn(session, 'result').score).toEqual([0, 3]);
  session.submit('');
  expect(session.view.screen).toBe('cup-result');
  expect(session.view.game!.cash).toBeGreaterThan(cash);
  session.submit('');
  expect(session.view.screen).toBe('bills');
  session.submit('');
  session.submit('99');
  expect(session.view.screen).toBe('menu');
  for (let match = 2; match <= 3; match++) {
    session.submit('99');
    expect(session.view.screen).toBe('fixture');
    expect(viewOn(session, 'fixture').fixture.kind).toBe('league');
    expect(viewOn(session, 'fixture').fixture.home).toBe(match === 3);
    expect(session.view.game!.leagueMatches).toBe(match);
    session.submit('');
    session.submit('99');
    session.advance(1_000_000);
    for (let i = 0; i < 4; i++) {
      session.submit('');
    }
    session.submit('99');
    expect(session.view.screen).toBe('menu');
  }
  session.submit('99');
  expect(session.view.screen).toBe('fixture');
  expect(session.view.game!.cupRound).toBe(2);
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
  session.advance((65_537 - (session.view.frames % 65_536)) % 65_536);
  session.submit('99');
  expect(session.view.game!.seed).toBe(1);
  for (const input of ['99', '', '99']) {
    session.submit(input);
  }
  session.advance(1_000_000);
  session.submit('');
  expect(session.view.game!.cupFinished).toBe(true);
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
    expect(session.view.screen).toBe('bills');
    if (match === 15) {
      break;
    }
    session.submit('');
    session.submit('99');
  }
  const game = session.view.game;
  session.submit('');
  expect(session.view.screen).toBe('end-season');
  expect(session.view.game).toBe(game);
  session.submit('');
  expect(session.view.screen).toBe('season-table');
  session.submit('');
  expect(session.view.screen).toBe('season-summary');
  expect(session.view.game!.seasons).toBe(1);
  expect(session.view.game!.leagueMatches).toBe(0);
  session.submit('');
  expect(session.view.screen).toBe('menu');
  session.submit('99');
  expect(viewOn(session, 'fixture').fixture.home).toBe(true);
  expect(session.view.game!.leagueMatches).toBe(1);
});

test('a club beyond the debt cap is dismissed and NEW clears the session before an explicit reload', () => {
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
  session.submit(String(session.view.game!.cash));
  session.advance((65_537 - (session.view.frames % 65_536)) % 65_536);
  session.submit('');
  expect(session.view.game!.seed).toBe(1);
  for (const input of ['99', '', '99']) {
    session.submit(input);
  }
  session.advance(1_000_000);
  session.submit('');
  session.submit('');
  expect(session.view.screen).toBe('dismissal');
  expect(session.view.game!.debt).toBeGreaterThan(250_000);
  expect(session.submit('h')).toEqual({ type: 'copy' });
  expect(session.view.screen).toBe('dismissal');
  session.submit('');
  expect(session.view.screen).toBe('cleared');
  expect(session.view).toEqual({ frames: 0, paused: false, screen: 'cleared' });
  session.submit('h');
  session.submit('99');
  session.skipPause();
  expect(session.view.screen).toBe('cleared');
  session.advance(50);
  expect(session.reload()).toBe(true);
  expect(session.view.frames).toBe(50);
  expect(session.view.screen).toBe('title');
  session.advance(300);
  expect(session.view.screen).toBe('manager');
  for (const input of ['new boss', '1', '1', '0']) {
    session.submit(input);
  }
  expect(session.view.screen).toBe('menu');
  expect(session.view.game!.cash).toBe(100_000);
  expect(session.view.game!.debt).toBe(0);
  expect(session.view.game!.manager).toBe('new boss');
  expect(session.view.game!.leagueMatches).toBe(0);
  expect(session.view.game!.seasons).toBe(0);
  expect(session.view.game!.seed).toBe(350);
  expect(session.reload()).toBe(false);
});

test('change edits the live club and unowned pool players, preserving the RNG and confirmation flow', () => {
  const session = setup();
  const before = session.view.game!;
  session.submit('CHANGE');
  expect(session.view.screen).toBe('names');
  session.submit('y');
  for (let i = 0; i < 3; i++) {
    session.submit('99');
  }
  session.submit('64');
  session.submit('');
  expect(viewOn(session, 'names').nameEditor.phase).toBe('name');
  session.submit('ABCDEFGHIJK');
  expect(viewOn(session, 'names').nameEditor.error).toContain('TOO LONG');
  session.submit('New Club');
  expect(viewOn(session, 'names').nameEditor.phase).toBe('more');
  expect(session.submit('H')).toEqual({ type: 'copy' });
  session.submit('y');
  expect(viewOn(session, 'names').nameEditor.page).toBe(4);
  session.submit('49');
  session.submit(String.fromCharCode(16, 4) + 'Greens');
  session.submit('n');
  expect(viewOn(session, 'names').nameEditor.kind).toBe('player');
  session.submit('Y');
  session.submit('99');
  session.submit('99');
  session.submit('22');
  session.submit('R.New');
  session.submit('n');
  expect(session.view.screen).toBe('menu');
  expect(session.view.game!.clubs[63]!.name).toBe('New Club');
  expect(session.view.game!.clubs[63]!.ink).toBeNull();
  expect(session.view.game!.clubs[48]!.ink).toBe(4);
  expect(session.view.game!.players[21]!.name).toBe('R.New');
  expect(session.view.game!.players[21]!.status).toBe(0);
  expect(session.view.game!.seed).toBe(before.seed);
  expect(before.clubs[63]!.name).toBe('Arsenal');
  expect(session.view.game!.cash).toBe(before.cash);
});

test('truncated name colour input stops at the original BASIC error without clearing the game', () => {
  const session = setup();
  const game = session.view.game;
  session.submit('change');
  session.submit('y');
  session.submit('1');
  session.submit(String.fromCharCode(16, 2));
  expect(viewOn(session, 'names').nameEditor.phase).toBe('fault');
  expect(viewOn(session, 'names').nameEditor.error).toBe(
    '3 Subscript wrong, 9473:1'
  );
  session.submit('Town');
  expect(session.view.game).toBe(game);
  expect(session.reload()).toBe(false);
});
