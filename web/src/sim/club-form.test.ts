import { expect, test } from 'bun:test';

import { addResults, formOf, freshResults } from './club-form';
import { prepareCupMatch } from './cup';
import { completeLeagueMatch, prepareLeagueMatch } from './league';
import { createNewGame, type Game } from './management';
import {
  clearances,
  clubForm,
  clubSquads,
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
  tiringInjuries
} from './ruleset';
import { completeSeason } from './season';

const newGame = (seed = 1) =>
  createNewGame({
    club: 1,
    level: 1,
    manager: 'alex',
    ruleset: 'enhanced-12',
    seed
  });

/** Every division club with the same latest results. */
const allWith = (game: Game, results: readonly number[]): Game => ({
  ...game,
  recentResults: freshResults().map(() => results)
});

test('Enhanced version 12 is version 11 with club form, which later versions keep', () => {
  expect(clubForm(latestEnhanced)).toBe(true);
  for (const accessor of [
    clearances,
    clubSquads,
    gracePeriodWeeks,
    lastingSkill,
    matchInjuries,
    momentHighlights,
    penalties,
    plainNames,
    presentDay,
    tiringInjuries
  ]) {
    expect(accessor('enhanced-12')).toEqual(accessor('enhanced-11'));
  }
  for (let level = 1; level <= 7; level++) {
    expect(opponentBonus('enhanced-12', level)).toBe(
      opponentBonus('enhanced-11', level)
    );
  }
});

test('Enhanced version 12 and later give clubs form', () => {
  expect(rulesets.filter(clubForm)).toEqual(['enhanced-12', 'enhanced-13']);
  expect(newGame().recentResults).toEqual(freshResults());
  expect(
    createNewGame({
      club: 1,
      colour: 0,
      level: 1,
      manager: 'alex',
      ruleset: 'original',
      seed: 1
    }).recentResults
  ).toBeUndefined();
});

test('a win adds one, a loss takes one away and a draw adds nothing', () => {
  const recent = addResults(freshResults(), [
    { away: 1, home: 0, score: [2, 1] },
    { away: 3, home: 2, score: [1, 1] },
    { away: 5, home: 4, score: [0, 3] }
  ]);
  expect(recent.slice(0, 6)).toEqual([[1], [-1], [0], [0], [-1], [1]]);
});

test('form counts only the last three results', () => {
  let recent = freshResults();
  for (const score of [
    [0, 1],
    [1, 0],
    [1, 0],
    [1, 0]
  ]) {
    recent = addResults(recent, [{ away: 1, home: 0, score }]);
  }
  expect(recent[0]).toEqual([1, 1, 1]);
  expect(recent[1]).toEqual([-1, -1, -1]);
});

test('form sums the results there are, before three are played', () => {
  // Club 64 is managed, so the division is clubs 49–64.
  const game = newGame();
  const recent = freshResults().map((_, i) =>
    i === 0 ? [1] : i === 1 ? [1, -1] : i === 2 ? [1, 0, 1] : []
  );
  const played = { ...game, recentResults: recent };
  expect([49, 50, 51, 52].map(club => formOf(played, club))).toEqual([
    1, 0, 2, 0
  ]);
});

test('the managed club and clubs outside its division have no form', () => {
  const game = allWith(newGame(), [1, 1, 1]);
  expect(formOf(game, 63)).toBe(3);
  expect(formOf(game, game.club)).toBe(0);
  expect(formOf(game, 48)).toBe(0);
  expect(formOf(game, 1)).toBe(0);
});

test('half of form adds to every attribute of a league opponent', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const game = newGame(seed);
    const level = prepareLeagueMatch(game).opponentStrength;
    // Points per match are 0 before the first match, so +1.5 floors to +1.
    const hot = prepareLeagueMatch(allWith(game, [1, 1, 1])).opponentStrength;
    const cold = prepareLeagueMatch(
      allWith(game, [-1, -1, 0])
    ).opponentStrength;
    expect(hot).toEqual(level.map(s => Math.min(20, s + 1)));
    expect(cold).toEqual(level.map(s => Math.max(1, s - 1)));
  }
});

test('a cup opponent from the managed club’s division brings its form', () => {
  // Round 1 draws from clubs 57–64, all in the managed club's division.
  for (const seed of [1, 2, 3, 4, 5]) {
    const game = { ...newGame(seed), scheduleCounter: 2 };
    const level = prepareCupMatch(game);
    const hot = prepareCupMatch(allWith(game, [1, 1, 1]));
    expect(hot.opponent).toBe(level.opponent);
    hot.opponentStrength.forEach((s, i) => {
      const before = level.opponentStrength[i]!;
      // +1.5 on a strength with a fractional part floors to +1 or +2.
      expect(s).toBeOneOf([1, 2].map(up => Math.min(20, before + up)));
    });
  }
});

test('a cup opponent from another division has no form', () => {
  // Round 3 draws from clubs 41–48, in Division 3.
  const game = { ...newGame(), cupRound: 2, scheduleCounter: 2 };
  const level = prepareCupMatch(game);
  const hot = prepareCupMatch(allWith(game, [1, 1, 1]));
  expect(hot.opponentStrength).toEqual(level.opponentStrength);
});

/** The week's other results, for a game with every club on one form. */
const otherGoals = (results: readonly number[]) => {
  const game = newGame(7);
  const fixture = prepareLeagueMatch(allWith(game, results));
  return completeLeagueMatch(fixture.game, fixture, [1, 1]).results.map(
    result => result.score
  );
};

test('a third of form adds to each side’s goals in the week’s results', () => {
  const level = otherGoals([]);
  expect(otherGoals([1, 1, 1])).toEqual(
    level.map(score => score.map(goals => goals + 1))
  );
  expect(otherGoals([-1, -1, -1])).toEqual(
    level.map(score => score.map(goals => Math.max(0, goals - 1)))
  );
  // A form of 2 adds two thirds, which a side's goals keep only when the
  // rest of its score is a third or less below a whole goal.
  const twoThirds = otherGoals([1, 1, 0]);
  twoThirds.flat().forEach((goals, i) => {
    expect(goals - level.flat()[i]!).toBeOneOf([0, 1]);
  });
});

/** A Division 4 club's place in the division. */
const place = (club: number) => club - 49;

test('a week’s league results become each club’s latest result', () => {
  const game = newGame(3);
  const fixture = prepareLeagueMatch(game);
  const week = completeLeagueMatch(fixture.game, fixture, [2, 0]);
  const recent = week.game.recentResults!;
  const own = week.match;
  const ownResult = (club: number) =>
    Math.sign(
      club === own.home
        ? own.score[0]! - own.score[1]!
        : own.score[1]! - own.score[0]!
    );
  expect(recent[place(fixture.opponent)]).toEqual([
    ownResult(fixture.opponent)
  ]);
  expect(recent[place(game.club)]).toEqual([ownResult(game.club)]);
  for (const { away, home, score } of week.results) {
    expect(recent[place(home)]).toEqual([Math.sign(score[0]! - score[1]!)]);
    expect(recent[place(away)]).toEqual([Math.sign(score[1]! - score[0]!)]);
  }
});

test('form starts again at the season end', () => {
  const game = allWith(
    { ...newGame(), cupFinished: true, leagueMatches: 15 },
    [1, 0, -1]
  );
  expect(completeSeason(game).game.recentResults).toEqual(freshResults());
});
