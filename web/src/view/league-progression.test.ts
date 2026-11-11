import { expect, test } from 'bun:test';

import { pickedCount, prepareLeagueMatch } from '../sim/league';
import { createNewGame } from '../sim/management';
import { makeScreen } from './screen';

test('an away league fixture shows the home club and its rank first', () => {
  const fresh = createNewGame({
    club: 1,
    colour: 0,
    level: 1,
    manager: 'alex',
    seed: 0
  });
  const game = {
    ...fresh,
    cupRound: 1,
    league: fresh.league.map((record, index) => ({
      ...record,
      position: index + 1
    })),
    leagueHome: true,
    leagueMatches: 1,
    leaguePosition: 8,
    scheduleCounter: 0
  };
  const fixture = prepareLeagueMatch(game);
  const display = makeScreen({
    fixture,
    frames: 0,
    game: fixture.game,
    paused: false,
    roundName: undefined,
    screen: 'fixture'
  });
  expect(display.lines[2]).toContain('Bury       v Arsenal   ');
  expect(display.lines[4]!.slice(0, 10)).toBe('Lge.Pos. 2');
  expect(display.lines[4]![20]).toBe('8');
  const team = makeScreen({
    fixture,
    frames: 0,
    game: fixture.game,
    paused: false,
    pickedCount: pickedCount(fixture.game),
    screen: 'team'
  });
  expect(team.lines[0]!.slice(10, 17)).toBe('Arsenal');
});
