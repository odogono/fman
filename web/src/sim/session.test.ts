import { expect, test } from 'bun:test';

import { submitInput } from '../test/input';
import { createSession } from './session';
import { viewOn } from './view-on';

const setup = () => {
  const session = createSession(2 ** 24 - 5);
  session.advance(5);
  session.skipPause();
  submitInput(session, 'alex');
  submitInput(session, '1');
  submitInput(session, '1');
  submitInput(session, '0');
  return session;
};

test('title timing, manager limit and club paging follow the original setup', () => {
  const session = createSession();
  session.advance(303);
  expect(session.view.screen).toBe('title');
  session.advance(1);
  expect(session.view.screen).toBe('manager');
  submitInput(session, 'x'.repeat(21));
  expect(session.view.screen).toBe('message');
  session.advance(205);
  submitInput(session, 'alex');
  expect(session.view.screen).toBe('clubs');
  submitInput(session, '17');
  expect(session.view.screen).toBe('clubs');
  submitInput(session, '99');
  expect(viewOn(session, 'clubs').page).toBe(2);
  submitInput(session, '17');
  expect(session.view.screen).toBe('level');
  submitInput(session, '8');
  expect(session.view.screen).toBe('level');
  submitInput(session, '7');
  submitInput(session, '1');
  expect(session.view.screen).toBe('message');
  session.advance(5);
  session.skipPause();
  submitInput(session, '7');
  expect(session.view.screen).toBe('menu');
  expect(session.view.game?.clubs[63]?.name).toBe('Blackburn');
  expect(session.view.game?.level).toBe(7);
});

test('line input requires Enter and preserves the original command cases', () => {
  const session = setup();
  submitInput(session, 's');
  expect(session.view.screen).toBe('status');
  submitInput(session, '');
  submitInput(session, 'LeVeL');
  expect(session.view.screen).toBe('menu');
  submitInput(session, 'LEVEL');
  expect(session.view.screen).toBe('level');
  submitInput(session, '3');
  expect(session.view.screen).toBe('message');
  submitInput(session, '');
  expect(session.view.game?.level).toBe(3);
  expect(session.view.screen).toBe('menu');
});

test('management commands update finances, retry errors and do not reseed on menu return', () => {
  const session = setup();
  const seed = session.view.game!.seed;
  session.advance(100);
  submitInput(session, 'l');
  submitInput(session, 'not a number');
  expect(session.view.screen).toBe('borrow');
  submitInput(session, '250001');
  expect(session.view.screen).toBe('message');
  submitInput(session, '');
  expect(session.view.screen).toBe('borrow');
  submitInput(session, '40000');
  expect(session.view.game?.debt).toBe(40_000);
  submitInput(session, '');
  submitInput(session, 'p');
  submitInput(session, '10000');
  expect(session.view.game?.cash).toBe(130_000);
  expect(session.view.game?.debt).toBe(30_000);
  expect(session.view.game?.seed).toBe(seed);
});

test('copy and saving requests do not reset the current game', () => {
  const session = setup();
  const game = session.view.game;
  expect(submitInput(session, 'h')).toEqual({ type: 'copy' });
  expect(submitInput(session, 'keep')?.type).toBe('save');
  expect(session.view.game).toBe(game);
  submitInput(session, 'a');
  submitInput(session, '99');
  expect(session.view.screen).toBe('menu');
});

test('plays the first league match through selection, highlights, table and bills', () => {
  const session = setup();
  submitInput(session, '99');
  expect(session.view.screen).toBe('fixture');
  submitInput(session, '');
  expect(session.view.screen).toBe('team');
  submitInput(session, 'c');
  submitInput(session, '15');
  expect(session.view.game?.players.filter(p => p.status === 2)).toHaveLength(
    12
  );
  submitInput(session, '99');
  expect(session.view.screen).toBe('selection');
  expect(viewOn(session, 'selection').error).toBe('PLAYER NO. OUT OF RANGE');
  submitInput(session, '1');
  submitInput(session, '99');
  expect(session.view.screen).toBe('team');
  submitInput(session, '99');
  expect(session.view.screen).toBe('highlights');
  session.advance(1_000_000);
  expect(session.view.screen).toBe('result');
  submitInput(session, '');
  expect(session.view.screen).toBe('other-matches');
  submitInput(session, '');
  expect(session.view.screen).toBe('table');
  submitInput(session, '');
  expect(session.view.screen).toBe('bills');
  expect(session.view.game!.cash).toBeGreaterThan(0);
  submitInput(session, '');
  expect(session.view.screen).toBe('transfer');
  submitInput(session, '99');
  expect(session.view.screen).toBe('menu');
  submitInput(session, '99');
  expect(session.view.screen).toBe('fixture');
  expect(viewOn(session, 'fixture').fixture.kind).toBe('cup');
});

test('transfer bids retry the same player; joining and declining return through the original reseed boundary', () => {
  const session = setup();
  submitInput(session, '99');
  submitInput(session, '');
  submitInput(session, '99');
  session.advance(1_000_000);
  for (let i = 0; i < 4; i++) {
    submitInput(session, '');
  }
  expect(session.view.screen).toBe('transfer');
  const id = viewOn(session, 'transfer').playerId;
  const cash = session.view.game!.cash;
  const seed = session.view.game!.seed;
  expect(submitInput(session, 'h')).toEqual({ type: 'copy' });
  submitInput(session, 'no');
  expect(session.view.game!.seed).toBe(seed);
  submitInput(session, String(cash + 1));
  expect(viewOn(session, 'message').message).toEqual({
    kind: 'text',
    text: "You haven't enough money!"
  });
  expect(session.view.game!.seed).toBe(seed);
  submitInput(session, '');
  expect(session.view.screen).toBe('transfer');
  submitInput(session, '');
  expect(viewOn(session, 'message').message).toEqual({
    kind: 'text',
    text: 'YOUR BID IS REFUSED'
  });
  submitInput(session, '');
  expect(viewOn(session, 'transfer').playerId).toBe(id);
  const owned = session.view.game!.players.filter(p => p.status > 0).length;
  submitInput(session, String(cash));
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
  submitInput(session, '99');
  submitInput(session, '');
  submitInput(session, '99');
  session.advance(1_000_000);
  for (let i = 0; i < 4; i++) {
    submitInput(session, '');
  }
  session.advance((65_536 - (session.view.frames % 65_536)) % 65_536);
  submitInput(session, '99');
  expect(session.view.game!.seed).toBe(0);
  submitInput(session, '99');
  expect(viewOn(session, 'fixture').fixture.kind).toBe('cup');
  const home = viewOn(session, 'fixture').fixture.home;
  submitInput(session, '');
  submitInput(session, '99');
  session.advance(1_000_000);
  expect(viewOn(session, 'result').score).toEqual([1, 1]);
  submitInput(session, '');
  expect(session.view.screen).toBe('replay');
  const cash = session.view.game!.cash;
  submitInput(session, '');
  expect(viewOn(session, 'fixture').fixture.home).toBe(!home);
  expect(session.view.screen).toBe('fixture');
  submitInput(session, '');
  submitInput(session, '99');
  session.advance(1_000_000);
  expect(viewOn(session, 'result').score).toEqual([0, 3]);
  submitInput(session, '');
  expect(session.view.screen).toBe('cup-result');
  expect(session.view.game!.cash).toBeGreaterThan(cash);
  submitInput(session, '');
  expect(session.view.screen).toBe('bills');
  submitInput(session, '');
  submitInput(session, '99');
  expect(session.view.screen).toBe('menu');
  for (let match = 2; match <= 3; match++) {
    submitInput(session, '99');
    expect(session.view.screen).toBe('fixture');
    expect(viewOn(session, 'fixture').fixture.kind).toBe('league');
    expect(viewOn(session, 'fixture').fixture.home).toBe(match === 3);
    expect(session.view.game!.leagueMatches).toBe(match);
    submitInput(session, '');
    submitInput(session, '99');
    session.advance(1_000_000);
    for (let i = 0; i < 4; i++) {
      submitInput(session, '');
    }
    submitInput(session, '99');
    expect(session.view.screen).toBe('menu');
  }
  submitInput(session, '99');
  expect(session.view.screen).toBe('fixture');
  expect(session.view.game!.cupRound).toBe(2);
});

test('after cup elimination, all remaining league matches lead to a season boundary before transfers', () => {
  const session = setup();
  for (const input of ['99', '', '99']) {
    submitInput(session, input);
  }
  session.advance(1_000_000);
  for (let i = 0; i < 4; i++) {
    submitInput(session, '');
  }
  session.advance((65_537 - (session.view.frames % 65_536)) % 65_536);
  submitInput(session, '99');
  expect(session.view.game!.seed).toBe(1);
  for (const input of ['99', '', '99']) {
    submitInput(session, input);
  }
  session.advance(1_000_000);
  submitInput(session, '');
  expect(session.view.game!.cupFinished).toBe(true);
  submitInput(session, '');
  submitInput(session, '');
  submitInput(session, '99');
  for (let match = 2; match <= 15; match++) {
    for (const input of ['99', '', '99']) {
      submitInput(session, input);
    }
    session.advance(1_000_000);
    for (let i = 0; i < 3; i++) {
      submitInput(session, '');
    }
    expect(session.view.screen).toBe('bills');
    if (match === 15) {
      break;
    }
    submitInput(session, '');
    submitInput(session, '99');
  }
  const game = session.view.game;
  submitInput(session, '');
  expect(session.view.screen).toBe('end-season');
  expect(session.view.game).toBe(game);
  submitInput(session, '');
  expect(session.view.screen).toBe('season-table');
  submitInput(session, '');
  expect(session.view.screen).toBe('season-summary');
  expect(session.view.game!.seasons).toBe(1);
  expect(session.view.game!.leagueMatches).toBe(0);
  submitInput(session, '');
  expect(session.view.screen).toBe('menu');
  submitInput(session, '99');
  expect(viewOn(session, 'fixture').fixture.home).toBe(true);
  expect(session.view.game!.leagueMatches).toBe(1);
});

test('a club beyond the debt cap is dismissed and NEW clears the session before an explicit reload', () => {
  const session = setup();
  submitInput(session, 'l');
  submitInput(session, '250000');
  submitInput(session, '');
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
  expect(session.view.game!.seed).toBe(1);
  for (const input of ['99', '', '99']) {
    submitInput(session, input);
  }
  session.advance(1_000_000);
  submitInput(session, '');
  submitInput(session, '');
  expect(session.view.screen).toBe('dismissal');
  expect(session.view.game!.debt).toBeGreaterThan(250_000);
  expect(submitInput(session, 'h')).toEqual({ type: 'copy' });
  expect(session.view.screen).toBe('dismissal');
  submitInput(session, '');
  expect(session.view.screen).toBe('cleared');
  expect(session.view).toEqual({ frames: 0, paused: false, screen: 'cleared' });
  submitInput(session, 'h');
  submitInput(session, '99');
  session.skipPause();
  expect(session.view.screen).toBe('cleared');
  session.advance(50);
  expect(session.reload()).toBe(true);
  expect(session.view.frames).toBe(50);
  expect(session.view.screen).toBe('title');
  session.advance(304);
  expect(session.view.screen).toBe('manager');
  for (const input of ['new boss', '1', '1', '0']) {
    submitInput(session, input);
  }
  expect(session.view.screen).toBe('menu');
  expect(session.view.game!.cash).toBe(100_000);
  expect(session.view.game!.debt).toBe(0);
  expect(session.view.game!.manager).toBe('new boss');
  expect(session.view.game!.leagueMatches).toBe(0);
  expect(session.view.game!.seasons).toBe(0);
  expect(session.view.game!.seed).toBe(354);
  expect(session.reload()).toBe(false);
});

test('change edits the live club and unowned pool players, preserving the RNG and confirmation flow', () => {
  const session = setup();
  const before = session.view.game!;
  submitInput(session, 'CHANGE');
  expect(session.view.screen).toBe('names');
  submitInput(session, 'y');
  for (let i = 0; i < 3; i++) {
    submitInput(session, '99');
  }
  submitInput(session, '64');
  submitInput(session, '');
  expect(viewOn(session, 'names').nameEditor.phase).toBe('name');
  submitInput(session, 'ABCDEFGHIJK');
  expect(viewOn(session, 'names').nameEditor.error).toContain('TOO LONG');
  submitInput(session, 'New Club');
  expect(viewOn(session, 'names').nameEditor.phase).toBe('more');
  expect(submitInput(session, 'H')).toEqual({ type: 'copy' });
  submitInput(session, 'y');
  expect(viewOn(session, 'names').nameEditor.page).toBe(4);
  submitInput(session, '49');
  submitInput(session, String.fromCharCode(16, 4) + 'Greens');
  submitInput(session, 'n');
  expect(viewOn(session, 'names').nameEditor.kind).toBe('player');
  submitInput(session, 'Y');
  submitInput(session, '99');
  submitInput(session, '99');
  submitInput(session, '22');
  submitInput(session, 'R.New');
  submitInput(session, 'n');
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
  submitInput(session, 'change');
  submitInput(session, 'y');
  submitInput(session, '1');
  submitInput(session, String.fromCharCode(16, 2));
  expect(viewOn(session, 'names').nameEditor.phase).toBe('fault');
  expect(viewOn(session, 'names').nameEditor.error).toBe(
    '3 Subscript wrong, 9473:1'
  );
  submitInput(session, 'Town');
  expect(session.view.game).toBe(game);
  expect(session.reload()).toBe(false);
});
