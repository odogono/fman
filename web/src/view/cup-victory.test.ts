import { expect, test } from 'bun:test';

import { prepareCupMatch } from '../sim/cup';
import { createNewGame } from '../sim/management';
import { cupVictoryTones } from './cup-victory';
import { makeScreen } from './screen';

test('the final names its round and the trophy keeps nine star rows and flashing title colours', () => {
  const fresh = createNewGame({
    club: 1,
    colour: 0,
    level: 1,
    manager: 'alex',
    seed: 0
  });
  const fixture = prepareCupMatch({
    ...fresh,
    cupRound: 7,
    leagueMatches: 15,
    scheduleCounter: 2
  });
  const view = {
    fixture,
    frames: 0,
    game: fixture.game,
    paused: false,
    screen: 'fixture' as const
  };
  expect(makeScreen(view).lines[0]).toContain('Round Final');
  const winner = {
    ...view,
    celebration: 9,
    screen: 'cup-result' as const
  };
  const normal = makeScreen(winner);
  expect(normal.lines[11]).toContain("You've won the");
  expect(normal.lines[12]).toContain('F.A. CUP');
  expect(
    normal.lines
      .slice(13, 22)
      .every(row => row.startsWith('************************'))
  ).toBe(true);
  expect(normal.cells[32 + 12]!.inverse).toBe(true);
  const flash = makeScreen({ ...winner, frames: 16 });
  expect(flash.cells[11 * 32]!.inverse).not.toBe(
    normal.cells[11 * 32]!.inverse
  );
  expect(flash.cells[32 + 12]!.inverse).toBe(normal.cells[32 + 12]!.inverse);
});

test('the victory sound uses nine original rising .2-second beeps', () => {
  expect(cupVictoryTones.map(t => t.pitch)).toEqual([
    1, 2, 3, 4, 5, 6, 7, 8, 9
  ]);
  expect(cupVictoryTones.every(t => t.duration === 0.2)).toBe(true);
});
