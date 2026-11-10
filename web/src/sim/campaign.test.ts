import { expect, test } from 'bun:test';

import { prepareCupMatch, refreshPlayers } from './cup';
import { simulateHighlights } from './highlights';
import { nextFixture, teamStrength, togglePickedPlayer } from './league';
import type { Game } from './management';
import { createSession } from './session';
import { viewOn } from './view-on';

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
      expect(session.view.screen).toBe('transfer');
      let seed = 0;
      if (nextFixture(session.view.game!) === 'cup') {
        for (; seed < 2000; seed++) {
          const fixture = prepareCupMatch({ ...session.view.game!, seed });
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
      session.advance(
        (seed - (session.view.frames % 65_536) + 65_536) % 65_536
      );
      session.submit('99');
    }
    session.submit('99');
    expect(session.view.screen).toBe('fixture');
    session.submit('');
    session.submit('c');
    for (const p of session.view.game!.players) {
      if (session.view.game!.players.filter(p => p.status === 2).length >= 11) {
        break;
      }
      if (p.status === 1) {
        session.submit(String(p.id));
      }
    }
    session.submit('99');
    session.submit('99');
    expect(session.view.screen).toBe('highlights');
    const cup = viewOn(session, 'highlights').fixture.kind === 'cup';
    session.advance(1_000_000);
    session.submit('');
    if (session.view.game!.cupRound === 8 && cup) {
      return session;
    }
    if (session.view.screen === 'cup-result') {
      session.submit('');
    } else {
      expect(session.view.screen).toBe('other-matches');
      session.submit('');
      session.submit('');
    }
    expect(session.view.screen).toBe('bills');
    session.submit('');
  }
  throw new Error('Final not reached');
};

test('a complete winning campaign reaches the final after league match fifteen and celebrates without a skip', () => {
  const session = winningCampaign();
  expect(session.view.game!.leagueMatches).toBe(15);
  expect(session.view.game!.cupFinished).toBe(true);
  expect(session.view.screen).toBe('cup-celebration');
  const seed = session.view.game!.seed;
  session.skipPause();
  expect(session.view.screen).toBe('cup-celebration');
  session.advance(89);
  expect(session.view.screen).toBe('cup-celebration');
  session.advance(1);
  expect(session.view.screen).toBe('cup-result');
  expect(viewOn(session, 'cup-result').celebration).toBe(9);
  expect(session.view.game!.seed).toBe(seed);
  session.submit('');
  expect(session.view.screen).toBe('bills');
  const old = session.view.game!;
  session.submit('');
  expect(session.view.screen).toBe('end-season');
  session.submit('');
  session.submit('');
  expect(session.view.screen).toBe('season-summary');
  expect(session.view.game!.cash).toBe(
    old.cash + viewOn(session, 'season-summary').season.bonus
  );
  expect(session.view.game!.previousNet).toBe(old.previousNet);
  expect(session.view.game!.seasons).toBe(1);
  expect(session.view.game!.players.map(p => p.status)).toEqual(
    old.players.map(p => p.status)
  );
  session.submit('');
  expect(session.view.screen).toBe('menu');
  expect(session.view.game!.seed).toBe(session.view.frames % 65_536);
});
