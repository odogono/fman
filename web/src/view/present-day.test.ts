import { expect, test } from 'bun:test';

import { presentDayClubs } from '../sim/catalogue';
import { createNewGame } from '../sim/management';
import { paintStatus } from './management-layouts';
import { createPrintScreen } from './print-screen';

test('a name on its own paper leaves the rest of the line in the screen colours', () => {
  const print = createPrintScreen();
  print.club(presentDayClubs.find(c => c.name === 'Fulham')!);
  print.text('12');
  const cells = print.cells;
  expect(cells.slice(0, 10).map(c => [c.ink, c.paper])).toEqual(
    Array.from({ length: 10 }, () => [7, 0])
  );
  expect(cells.slice(10, 12).map(c => [c.text, c.ink, c.paper])).toEqual([
    ['1', 0, 7],
    ['2', 0, 7]
  ]);
});

test("the status screen names the club's home kit", () => {
  const game = createNewGame({
    club: 1,
    level: 1,
    manager: 'alex',
    ruleset: 'enhanced-3',
    seed: 0
  });
  const rows: string[] = Array.from({ length: 22 }, () => ' '.repeat(32));
  paintStatus(game, (row, column, text) => {
    rows[row] =
      rows[row]!.slice(0, column) +
      text +
      rows[row]!.slice(column + text.length);
  });
  expect(rows[0]!.trimEnd()).toBe('Arsenal         Colours = Red');
});
