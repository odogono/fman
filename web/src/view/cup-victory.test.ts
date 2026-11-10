import { expect, test } from 'bun:test';

import { prepareCupMatch } from '../sim/cup';
import { createNewGame } from '../sim/management';
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

test('cup printing reveals partial trophy, title and star rows and flashes on ULA time', () => {
  const game = createNewGame({
    club: 1,
    colour: 0,
    level: 1,
    manager: 'alex',
    seed: 0
  });
  const view = {
    celebration: 1,
    celebrationProgress: { stars: 5, text: 12, trophy: 14 },
    frames: 0,
    game,
    paused: true,
    screen: 'cup-celebration' as const,
    ulaFrames: 16
  };
  const screen = makeScreen(view);
  expect(screen.cells[32 + 13]!.inverse).toBe(true);
  expect(screen.cells[32 + 14]!.paper).toBe(7);
  expect(screen.lines[11]!.trimEnd()).toBe('!!!!!!!!!You');
  expect(screen.lines[12]!.trim()).toBe('');
  expect(screen.lines[13]!.trimEnd()).toBe('*****');
  expect(screen.lines[14]!.trim()).toBe('');
  expect(screen.cells[11 * 32]!.inverse).toBe(false);
  const next = makeScreen({ ...view, frames: 16, ulaFrames: 32 });
  expect(next.cells[11 * 32]!.inverse).toBe(true);
});
