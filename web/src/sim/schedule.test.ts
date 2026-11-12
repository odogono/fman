import { expect, test } from 'bun:test';

import { prepareCupMatch } from './cup';
import { nextFixture, prepareLeagueMatch, previewFixture } from './league';
import { createNewGame } from './management';

const fresh = () =>
  createNewGame({ club: 1, colour: 0, level: 1, manager: 'alex', seed: 0 });

test('the original schedule alternates league grounds independently of cup grounds', () => {
  const game = fresh();
  expect(nextFixture(game)).toBe('league');
  const first = prepareLeagueMatch(game);
  expect(first.home).toBe(true);
  expect(nextFixture(first.game)).toBe('cup');
  const afterCup = { ...first.game, cupRound: 1, scheduleCounter: 0 };
  const second = prepareLeagueMatch(afterCup);
  expect(second.home).toBe(false);
  expect(second.opponent).toBe(50);
  expect(second.game.scheduleCounter).toBe(1);
  const third = prepareLeagueMatch(second.game);
  expect(third.home).toBe(true);
  expect(nextFixture(third.game)).toBe('cup');
  expect(() => prepareLeagueMatch(third.game)).toThrow();
  const eliminated = { ...third.game, cupFinished: true };
  expect(nextFixture(eliminated)).toBe('league');
  expect(prepareLeagueMatch(eliminated).game.scheduleCounter).toBe(0);
});

test('league play stops before a sixteenth match or a season rollover', () => {
  const ended = {
    ...fresh(),
    cupFinished: true,
    cupRound: 1,
    leagueMatches: 15
  };
  expect(nextFixture(ended)).toBe('season');
  expect(() => prepareLeagueMatch(ended)).toThrow();
});

test('the fixture preview names what the next match starts, drawing nothing', () => {
  for (const club of [1, 2, 16, 40]) {
    let game = {
      ...createNewGame({ club, colour: 0, level: 1, manager: 'alex', seed: 7 }),
      division: Math.ceil(club / 16)
    };
    for (let week = 0; nextFixture(game) !== 'season'; week++) {
      const preview = previewFixture(game);
      if (nextFixture(game) === 'league') {
        const fixture = prepareLeagueMatch(game);
        expect(preview).toEqual({
          home: fixture.home,
          kind: 'league',
          opponent: fixture.opponent
        });
        game = fixture.game;
      } else {
        const fixture = prepareCupMatch(game);
        expect(preview).toEqual({ kind: 'cup', round: fixture.game.cupRound });
        // Knocked out after three rounds, so the league runs to its end.
        game = { ...fixture.game, cupFinished: fixture.game.cupRound >= 3 };
      }
      expect(week).toBeLessThan(30);
    }
    expect(previewFixture(game)).toBeUndefined();
  }
});
