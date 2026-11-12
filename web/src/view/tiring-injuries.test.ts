import { expect, test } from 'bun:test';

import { createNewGame, type Game } from '../sim/management';
import { presentDay, type Ruleset } from '../sim/ruleset';
import type { Style } from './grid';
import { paintSquad } from './management-layouts';

/** A squad with two injured players: one with weeks left, one without. */
const squad = (ruleset: Ruleset): Game => {
  const game = createNewGame({
    club: 1,
    ...(presentDay(ruleset) ? {} : { colour: 0 }),
    level: 1,
    manager: 'alex',
    ruleset,
    seed: 0
  });
  const owned = game.players.filter(p => p.status > 0).map(p => p.id);
  return {
    ...game,
    players: game.players.map(p =>
      p.id === owned[0]
        ? {
            ...p,
            status: 3,
            ...(ruleset === 'original' ? {} : { weeksOut: 3 })
          }
        : p.id === owned[1]
          ? { ...p, status: 3 }
          : p
    )
  };
};

const paint = (game: Game) => {
  const rows: string[] = Array.from({ length: 24 }, () => ' '.repeat(32));
  const styles = new Map<string, Style | undefined>();
  paintSquad(
    game,
    (row, column, text, style) => {
      rows[row] =
        rows[row]!.slice(0, column) +
        text +
        rows[row]!.slice(column + text.length);
      [...text].forEach((_, i) => styles.set(`${row}:${column + i}`, style));
    },
    9
  );
  return { rows, styles };
};

test('the original squad screen marks injuries with i', () => {
  const { rows, styles } = paint(squad('original'));
  expect(rows[0]!.trimEnd()).toBe('p = picked to play, i = injured');
  expect(rows[2]![31]).toBe('i');
  expect(rows[3]![31]).toBe('i');
  expect(styles.get('2:31')).toMatchObject({ ink: 4, inverse: true });
});

test('under tiring injuries the squad screen shows the weeks left out', () => {
  const { rows, styles } = paint(squad('enhanced-5'));
  expect(rows[0]!.trimEnd()).toBe('p = picked, 1-3 = weeks injured');
  expect(rows[0]!.length).toBe(32);
  expect(styles.get('0:12')).toMatchObject({ ink: 4, inverse: true });
  expect(rows[2]![31]).toBe('3');
  expect(rows[3]![31]).toBe('1');
  expect(styles.get('2:31')).toMatchObject({ ink: 4, inverse: true });
});
