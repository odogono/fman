import { expect, test } from 'bun:test';

import { prepareCupMatch } from './cup';
import { completeLeagueMatch, prepareLeagueMatch } from './league';
import { createNewGame, type Game } from './management';
import {
  clearances,
  clubForm,
  clubSquads,
  gracePeriodWeeks,
  lastingSkill,
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
import {
  categorySums,
  goalGap,
  squadGoals,
  squadMean,
  squadRoll
} from './squad-strength';
import type { Position, SquadPlayer } from './squads';

const newGame = (ruleset: Ruleset = 'enhanced-13', seed = 1) =>
  createNewGame({ club: 1, level: 1, manager: 'alex', ruleset, seed });

const player = (position: Position, skill: number): SquadPlayer => ({
  name: 'X',
  position,
  skill
});

/** A squad of 12, four to a category, every player of one skill. */
const evenSquad = (skill: number): SquadPlayer[] => [
  player('GK', skill),
  ...(['DF', 'MF', 'FW'] as const).flatMap(position =>
    Array.from({ length: position === 'DF' ? 3 : 4 }, () =>
      player(position, skill)
    )
  )
];

/** The game with the given clubs' squads replaced. */
const withSquads = (
  game: Game,
  squads: Readonly<Record<number, SquadPlayer[]>>
): Game => ({
  ...game,
  clubs: game.clubs.map((club, i) => {
    const squad = squads[i + 1];
    return squad ? { ...club, squad } : club;
  })
});

/** Every club but the managed one with the same squad. */
const allSquads = (game: Game, squad: SquadPlayer[]): Game => ({
  ...game,
  clubs: game.clubs.map((club, i) =>
    i + 1 === game.club ? club : { ...club, squad }
  )
});

test('Enhanced version 13 is version 12 with squad strength, which later versions keep', () => {
  expect(rulesets.filter(squadStrength)).toEqual([
    'enhanced-13',
    'enhanced-14'
  ]);
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
    tiringInjuries
  ]) {
    expect(accessor('enhanced-13')).toEqual(accessor('enhanced-12'));
  }
  for (let level = 1; level <= 7; level++) {
    expect(opponentBonus('enhanced-13', level)).toBe(
      opponentBonus('enhanced-12', level)
    );
  }
});

test('a squad sums its skill by category, a goalkeeper in defence', () => {
  const squad = [
    player('GK', 5),
    player('DF', 2),
    player('MF', 3),
    player('MF', 4),
    player('FW', 1)
  ];
  expect(categorySums(squad)).toEqual([7, 7, 1]);
  expect(squadMean(evenSquad(3))).toBe(12);
});

test('a squad over twelve counts each category up to 20', () => {
  const big = [...evenSquad(5), player('FW', 5), player('MF', 2)];
  expect(categorySums(big)).toEqual([20, 22, 25]);
  expect(squadMean(big)).toBe(20);
});

test('a league opponent’s defence, midfield and attack come from its squad', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const game = newGame('enhanced-13', seed);
    const opponent = prepareLeagueMatch(game).opponent;
    const strong = prepareLeagueMatch(
      withSquads(game, { [opponent]: evenSquad(5) })
    ).opponentStrength;
    const weak = prepareLeagueMatch(
      withSquads(game, { [opponent]: evenSquad(1) })
    ).opponentStrength;
    // Energy and morale ignore the squad.
    expect(strong.slice(0, 2)).toEqual(weak.slice(0, 2));
    // A sum of 20 gives 10, a sum of 4 gives 2, before the same roll.
    expect(strong.slice(2)).toEqual(
      weak.slice(2).map(s => Math.min(20, s + 8))
    );
  }
});

test('the squad roll keeps every draw in step with Enhanced version 12', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const squads = newGame('enhanced-13', seed);
    const enhanced = newGame('enhanced-12', seed);
    const a = prepareLeagueMatch(squads);
    const b = prepareLeagueMatch(enhanced);
    expect(a.game.seed).toBe(b.game.seed);
    expect(a.opponentStrength.slice(0, 2)).toEqual(
      b.opponentStrength.slice(0, 2)
    );
    a.opponentStrength.slice(2).forEach(s => {
      // INT(sum / 2) + R(6) + level 1's bonus of 1, before points per match.
      expect(s).toBeGreaterThanOrEqual(2 + 1 + 1);
      expect(s).toBeLessThanOrEqual(10 + squadRoll + 1);
    });
    const cupA = prepareCupMatch({ ...squads, scheduleCounter: 2 });
    const cupB = prepareCupMatch({ ...enhanced, scheduleCounter: 2 });
    expect(cupA.game.seed).toBe(cupB.game.seed);
    expect(cupA.opponent).toBe(cupB.opponent);
    expect(cupA.opponentStrength.slice(0, 2)).toEqual(
      cupB.opponentStrength.slice(0, 2)
    );
  }
});

test('a cup opponent’s squad decides its defence, midfield and attack', () => {
  const game = { ...newGame(), scheduleCounter: 2 };
  const opponent = prepareCupMatch(game).opponent;
  const strong = prepareCupMatch(
    withSquads(game, { [opponent]: evenSquad(5) })
  ).opponentStrength;
  const weak = prepareCupMatch(
    withSquads(game, { [opponent]: evenSquad(1) })
  ).opponentStrength;
  expect(strong.slice(0, 2)).toEqual(weak.slice(0, 2));
  expect(strong.slice(2)).toEqual(weak.slice(2).map(s => Math.min(20, s + 8)));
});

test('the squad-strength gap moves goals in the week’s results', () => {
  const game = withSquads(newGame(), { 50: evenSquad(5), 51: evenSquad(1) });
  expect(squadGoals(game, 50, 51)).toBe((20 - 4) / goalGap);
  expect(squadGoals(game, 51, 50)).toBe(-(20 - 4) / goalGap);
  expect(squadGoals(newGame('enhanced-12'), 50, 51)).toBe(0);
});

/** The week's other results for a game, scores by home club. */
const week = (game: Game) => {
  const fixture = prepareLeagueMatch(game);
  return completeLeagueMatch(fixture.game, fixture, [1, 1]).results;
};

test('equal squads leave the week’s results as Enhanced version 12 has them', () => {
  const squad = evenSquad(3);
  expect(week(allSquads(newGame(), squad))).toEqual(
    week(allSquads(newGame('enhanced-12'), squad))
  );
});

test('the stronger squad scores more, and no side scores below 0', () => {
  const even = week(allSquads(newGame(), evenSquad(3)));
  const strong = 50;
  const game = withSquads(allSquads(newGame(), evenSquad(1)), {
    [strong]: evenSquad(5)
  });
  const results = week(game);
  expect(results.map(r => [r.home, r.away])).toEqual(
    even.map(r => [r.home, r.away])
  );
  for (const [i, { away, home, score }] of results.entries()) {
    expect(score.every(goals => goals >= 0)).toBe(true);
    const before = even[i]!.score;
    if (home === strong) {
      expect(score[0]).toBeGreaterThanOrEqual(before[0]!);
      expect(score[1]).toBeLessThanOrEqual(before[1]!);
    } else if (away === strong) {
      expect(score[1]).toBeGreaterThanOrEqual(before[1]!);
      expect(score[0]).toBeLessThanOrEqual(before[0]!);
    } else {
      expect(score).toEqual(before);
    }
  }
});
