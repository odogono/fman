import { expect, test } from 'bun:test';

import { createNewGame, type Game } from './management';
import { createMatchday, matchInks, type Matchday } from './matchday';

const fresh = (colour = 0) =>
  createNewGame({ club: 1, colour, level: 1, manager: 'alex', seed: 0 });
const cupEntry = (seed: number): Game => ({
  ...fresh(),
  leagueMatches: 1,
  scheduleCounter: 2,
  seed
});
const watch = (matchday: Matchday) => {
  matchday.refresh();
  matchday.kickOff();
  matchday.advance(1_000_000);
};

test('a league match runs from fixture to settlement in order', () => {
  const matchday = createMatchday(fresh())!;
  expect(matchday.fixture.kind).toBe('league');
  expect(matchday.stage).toBe('fixture');
  expect(() => matchday.kickOff()).toThrow(RangeError);
  watch(matchday);
  expect(matchday.stage).toBe('result');
  matchday.settle();
  expect(matchday.stage).toBe('settled');
  const settled = matchday.settlement!;
  expect(settled.kind).toBe('league');
  expect(matchday.game.leagueMatches).toBe(1);
});

test('the seed and attack carry pass to the game only once the highlights finish', () => {
  const matchday = createMatchday(fresh())!;
  matchday.refresh();
  const before = matchday.game;
  matchday.kickOff();
  expect(matchday.game.seed).toBe(before.seed);
  expect(matchday.game.attackCarry).toBe(before.attackCarry);
  matchday.advance(1_000_000);
  expect(matchday.game.seed).toBe(matchday.highlights!.seed);
  expect(matchday.game.attackCarry).toBe(matchday.highlights!.carry);
});

test('a drawn cup tie replays with swapped grounds, continuing the seed and carry', () => {
  let seed = 0;
  let matchday: Matchday | undefined;
  for (; seed < 2000; seed++) {
    matchday = createMatchday(cupEntry(seed))!;
    watch(matchday);
    const score = matchday.highlights!.score;
    if (score[0] === score[1]) {
      break;
    }
  }
  expect(seed).toBeLessThan(2000);
  const first = matchday!.fixture;
  const firstLeg = matchday!.highlights!;
  matchday!.settle();
  expect(matchday!.stage).toBe('replay');
  expect(matchday!.settlement).toBeUndefined();
  expect(matchday!.game.cash).toBe(cupEntry(seed).cash + first.gate);
  matchday!.replay();
  const replay = matchday!.fixture;
  expect(replay.home).toBe(!first.home);
  expect(replay.opponent).toBe(first.opponent);
  expect(matchday!.inks).toEqual(matchInks(matchday!.game, !first.home));
  expect(matchday!.highlights).toBeUndefined();
  expect(matchday!.game.seed).toBe(firstLeg.seed);
  expect(matchday!.game.attackCarry).toBe(firstLeg.carry);
  expect(matchday!.game.cupRound).toBe(1);
});

test('the managed club keeps its colour at home and takes the opposite away', () => {
  expect(matchInks(fresh(0), true)).toEqual({ away: 7, home: 0 });
  expect(matchInks(fresh(0), false)).toEqual({ away: 0, home: 7 });
  expect(matchInks(fresh(7), true)).toEqual({ away: 0, home: 7 });
});

test('no matchday is offered once the season is over', () => {
  expect(
    createMatchday({ ...fresh(), cupFinished: true, leagueMatches: 15 })
  ).toBeUndefined();
});
