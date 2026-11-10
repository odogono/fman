import { expect, test } from 'bun:test';

import { prepareCupMatch, refreshPlayers } from './cup';
import { simulateHighlights } from './highlights';
import { nextFixture, teamStrength, togglePickedPlayer } from './league';
import type { Game } from './management';
import { createSession } from './session';

const pickAvailable = (game: Game) => {
  let picked = game;
  for (const p of game.players) {
    if (picked.players.filter(p => p.status === 2).length >= 11) {
      break;
    }
    if (p.status === 1) {
      picked = togglePickedPlayer(picked, p.id);
    }
  }
  return picked;
};

export const winningCampaign = () => {
  const session = createSession();
  session.skipPause();
  for (const input of ['alex', '1', '1', '0']) {
    session.submit(input);
  }
  for (let fixtureNumber = 0; fixtureNumber < 23; fixtureNumber++) {
    if (fixtureNumber > 0) {
      expect(session.screen).toBe('transfer');
      let seed = 0;
      if (nextFixture(session.game!) === 'cup') {
        for (; seed < 2000; seed++) {
          const fixture = prepareCupMatch({ ...session.game!, seed });
          const game = pickAvailable(refreshPlayers(fixture.game));
          const highlights = simulateHighlights({
            awayInk: fixture.home ? 7 : 0,
            carry: game.attackCarry,
            home: fixture.home,
            homeInk: fixture.home ? 0 : 7,
            opponent: fixture.opponentStrength,
            seed: game.seed,
            strength: teamStrength(game)
          });
          if (
            highlights.score[fixture.home ? 0 : 1]! >
            highlights.score[fixture.home ? 1 : 0]!
          ) {
            break;
          }
        }
        expect(seed).toBeLessThan(2000);
      }
      session.advance((seed - (session.frames % 65_536) + 65_536) % 65_536);
      session.submit('99');
    }
    session.submit('99');
    expect(session.screen).toBe('fixture');
    session.submit('');
    session.submit('c');
    for (const p of session.game!.players) {
      if (session.game!.players.filter(p => p.status === 2).length >= 11) {
        break;
      }
      if (p.status === 1) {
        session.submit(String(p.id));
      }
    }
    session.submit('99');
    session.submit('99');
    expect(session.screen).toBe('highlights');
    session.advance(1_000_000);
    session.submit('');
    if (session.game!.cupRound === 8 && session.fixture!.kind === 'cup') {
      return session;
    }
    if (session.screen === 'cup-result') {
      session.submit('');
    } else {
      expect(session.screen).toBe('other-matches');
      session.submit('');
      session.submit('');
    }
    expect(session.screen).toBe('bills');
    session.submit('');
  }
  throw new Error('Final not reached');
};

test('a complete winning campaign reaches the final after league match fifteen and celebrates without a skip', () => {
  const session = winningCampaign();
  expect(session.game!.leagueMatches).toBe(15);
  expect(session.game!.cupFinished).toBe(true);
  expect(session.screen).toBe('cup-celebration');
  const seed = session.game!.seed;
  session.skipPause();
  expect(session.screen).toBe('cup-celebration');
  session.advance(89);
  expect(session.screen).toBe('cup-celebration');
  session.advance(1);
  expect(session.screen).toBe('cup-result');
  expect(session.cupWon).toBe(true);
  expect(session.game!.seed).toBe(seed);
  session.submit('');
  expect(session.screen).toBe('bills');
  const old = session.game!;
  session.submit('');
  expect(session.screen).toBe('end-season');
  session.submit('');
  session.submit('');
  expect(session.screen).toBe('season-summary');
  expect(session.game!.cash).toBe(old.cash + session.season!.bonus);
  expect(session.game!.previousNet).toBe(old.previousNet);
  expect(session.game!.seasons).toBe(1);
  expect(session.game!.players.map(p => p.status)).toEqual(
    old.players.map(p => p.status)
  );
  session.submit('');
  expect(session.screen).toBe('menu');
  expect(session.game!.seed).toBe(session.frames % 65_536);
});
