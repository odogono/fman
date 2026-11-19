import { expect, test } from 'bun:test';

import { freshResults } from './club-form';
import { completeLeagueMatch, prepareLeagueMatch } from './league';
import { createNewGame, type Game } from './management';
import {
  clearances,
  clubForm,
  clubSquads,
  evenTable,
  gracePeriodWeeks,
  lastingSkill,
  latestEnhanced,
  matchInjuries,
  momentHighlights,
  opponentBonus,
  penalties,
  plainNames,
  presentDay,
  rulesets,
  squadStrength,
  tiringInjuries,
  type Ruleset
} from './ruleset';
import { goalGap, squadGoals } from './squad-strength';
import type { SquadPlayer } from './squads';

const newGame = (ruleset: Ruleset = 'enhanced-14', seed = 7) =>
  createNewGame({ club: 1, level: 1, manager: 'alex', ruleset, seed });

/** Every division club with the same latest results. */
const allWith = (game: Game, results: readonly number[]): Game => ({
  ...game,
  recentResults: freshResults().map(() => results)
});

/** The week's other results, scores in order. */
const otherGoals = (game: Game) => {
  const fixture = prepareLeagueMatch(game);
  return completeLeagueMatch(fixture.game, fixture, [1, 1]).results.map(
    result => result.score
  );
};

test('Enhanced version 14 is version 13 with an even table, and new Enhanced games start with it', () => {
  expect(rulesets.filter(evenTable)).toEqual(['enhanced-14']);
  expect(latestEnhanced).toBe('enhanced-14');
  for (const accessor of [
    clearances,
    clubForm,
    clubSquads,
    gracePeriodWeeks,
    lastingSkill,
    matchInjuries,
    momentHighlights,
    penalties,
    plainNames,
    presentDay,
    squadStrength,
    tiringInjuries
  ]) {
    expect(accessor('enhanced-14')).toEqual(accessor('enhanced-13'));
  }
});

test('Genius takes a bonus of 5.25, and every other level as before (#218)', () => {
  for (let level = 1; level <= 6; level++) {
    expect(opponentBonus('enhanced-14', level)).toBe(
      opponentBonus('enhanced-13', level)
    );
  }
  expect(opponentBonus('enhanced-13', 7)).toBe(5.5);
  expect(opponentBonus('enhanced-14', 7)).toBe(5.25);
});

test('form leaves the week’s other results alone', () => {
  const game = newGame();
  const level = otherGoals(game);
  expect(otherGoals(allWith(game, [1, 1, 1]))).toEqual(level);
  expect(otherGoals(allWith(game, [-1, -1, -1]))).toEqual(level);
  // Under Enhanced version 13 it moves them.
  const before = newGame('enhanced-13');
  expect(otherGoals(allWith(before, [1, 1, 1]))).not.toEqual(
    otherGoals(before)
  );
});

test('form still strengthens a club as an opponent', () => {
  const game = newGame();
  const level = prepareLeagueMatch(game).opponentStrength;
  const hot = prepareLeagueMatch(allWith(game, [1, 1, 1])).opponentStrength;
  expect(hot.reduce((a, b) => a + b, 0)).toBeGreaterThan(
    level.reduce((a, b) => a + b, 0)
  );
});

/** A squad of 12, every player of one skill. */
const evenSquad = (skill: number): SquadPlayer[] =>
  (
    [
      'GK',
      'DF',
      'DF',
      'DF',
      'MF',
      'MF',
      'MF',
      'MF',
      'FW',
      'FW',
      'FW',
      'FW'
    ] as const
  ).map(position => ({ name: 'X', position, skill }));

/** The game with club 50's squad all 5s and club 51's all 1s. */
const withSquads = (game: Game): Game => ({
  ...game,
  clubs: game.clubs.map((club, i) =>
    i + 1 === 50
      ? { ...club, squad: evenSquad(5) }
      : i + 1 === 51
        ? { ...club, squad: evenSquad(1) }
        : club
  )
});

test('the squad-strength gap moves the week’s goals half as much', () => {
  expect(squadGoals(withSquads(newGame()), 50, 51)).toBe(
    (20 - 4) / goalGap / 2
  );
  expect(squadGoals(withSquads(newGame('enhanced-13')), 50, 51)).toBe(
    (20 - 4) / goalGap
  );
});
