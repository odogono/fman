import { expect, test } from 'bun:test';

import { createNewGame, type Game } from '../sim/management';
import { createNameEditor } from '../sim/name-editor';
import type { Ruleset } from '../sim/ruleset';
import type { Style } from './grid';
import { paintSquad } from './management-layouts';
import { paintNames } from './name-layouts';

// Club squads on the Spectrum screens (#113): the squad screen's tag follows
// a player's position, and the name editor's player pages are numbered.

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

const start = (ruleset: Ruleset) =>
  createNewGame({ club: 1, level: 1, manager: 'alex', ruleset, seed: 0 });

test("the squad screen tags each player by his position, a goalkeeper's in defence's ink", () => {
  const game = start('enhanced-6');
  const { rows, styles } = paint(game);
  const owned = game.players.filter(p => p.status > 0);
  const tags = { DF: 'D', FW: 'A', GK: 'G', MF: 'M' } as const;
  const inks = { DF: 0, FW: 2, GK: 0, MF: 1 } as const;
  for (const [i, player] of owned.entries()) {
    const row = i + 2;
    expect(rows[row]!.slice(0, 2)).toBe(`${tags[player.position!]}█`);
    expect(rows[row]!.slice(2, 10).trimEnd()).toBe(player.name);
    expect(styles.get(`${row}:0`)).toMatchObject({
      ink: inks[player.position!],
      inverse: true
    });
  }
  expect(owned.some(p => p.position === 'GK')).toBe(true);
});

test('without club squads the tag still follows the number', () => {
  const game = start('enhanced-5');
  const { rows } = paint(game);
  for (const [i, player] of game.players.filter(p => p.status > 0).entries()) {
    expect(rows[i + 2]![0]).toBe('DMA'[Math.floor((player.id - 1) / 8)]);
  }
});

const playerPage = (ruleset: Ruleset) => {
  const editor = createNameEditor(start(ruleset));
  editor.submit('n');
  editor.submit('y');
  const rows: string[] = Array.from({ length: 24 }, () => ' '.repeat(32));
  paintNames(editor, (row, column, text) => {
    rows[row] =
      rows[row]!.slice(0, column) +
      text +
      rows[row]!.slice(column + text.length);
  });
  return rows[0]!.trimEnd();
};

test("the name editor's player pages are numbered under club squads", () => {
  expect(playerPage('enhanced-6')).toBe('Players 1-8');
  expect(playerPage('enhanced-5')).toBe('Defence');
});
