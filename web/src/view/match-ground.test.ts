import { expect, test } from 'bun:test';

import type { MatchFixture } from '../sim/league';
import { createNewGame } from '../sim/management';
import { matchKits } from './clip-match';
import { groundPlan } from './ground/grounds';
import {
  celebrationGroundFor,
  clubGround,
  evenly,
  favouring,
  matchGroundFor
} from './match-ground';

// Club 6 began in the First Division, so is managed from the Fourth; the
// club from the 64th place took its place.
const game = createNewGame({
  club: 6,
  colour: 0,
  level: 1,
  manager: 'alex',
  seed: 1
});

const fixture = (
  home: boolean,
  opponent: number,
  kind: 'cup' | 'league' = 'league'
) =>
  ({
    home,
    kind,
    opponent,
    opponentStrength: [7, 10, 10, 10, 10]
  }) as unknown as MatchFixture;

test("a match is played at the home club's ground, sized by the division it began in, its seats in the home kit", () => {
  const atHome = fixture(true, 1);
  const kits = matchKits(game, atHome);
  const ground = matchGroundFor(game, atHome);
  expect(ground.plan).toEqual(
    groundPlan({ club: 6, division: 4, seats: kits.home })
  );
  expect(ground.crowd).toEqual(favouring(kits.home, kits.away));

  const away = fixture(false, 6);
  const awayKits = matchKits(game, away);
  expect(matchGroundFor(game, away).plan).toEqual(
    groundPlan({ club: 64, division: 1, seats: awayKits.home })
  );
  expect(matchGroundFor(game, away).crowd).toEqual(
    favouring(awayKits.home, awayKits.away)
  );
});

test('a cup tie before the final is played at the home club’s ground', () => {
  const tie = fixture(false, 2, 'cup');
  const round = { ...game, cupRound: 7 };
  expect(matchGroundFor(round, tie)).toBe(
    matchGroundFor(round, fixture(false, 2))
  );
});

test("the final's crowd favours neither side, and the cup celebration is at the final's ground, its crowd favouring the winners", () => {
  const final = fixture(false, 2, 'cup');
  const inFinal = { ...game, cupRound: 8 };
  const kits = matchKits(inFinal, final);
  const clips = matchGroundFor(inFinal, final);
  expect(clips.crowd).toEqual(evenly(kits.home, kits.away));
  const celebration = celebrationGroundFor(inFinal, final);
  expect(celebration.plan).toBe(clips.plan);
  // The managed club won it away, in the away kit.
  expect(celebration.crowd).toEqual(favouring(kits.away, kits.home));
});

test('the same ground and crowd give back the same ground, so the painter builds it once', () => {
  const atHome = fixture(true, 1);
  expect(matchGroundFor(game, atHome)).toBe(matchGroundFor(game, atHome));
  const crowd = favouring('#d70000', '#0000d7');
  const ground = clubGround({ club: 3, division: 2, seats: '#d70000' }, crowd);
  const mown = clubGround(
    { club: 3, division: 2, seats: '#d70000' },
    crowd,
    'checks'
  );
  expect(mown.plan.grass).toBe('checks');
  expect(mown.plan.stands).toEqual(ground.plan.stands);
  expect(
    clubGround(
      { club: 3, division: 2, seats: '#d70000' },
      evenly('#d70000', '#0000d7')
    ).plan
  ).toBe(ground.plan);
});
