import { expect, test } from 'bun:test';

import { nextFixture, prepareLeagueMatch } from './league';
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
