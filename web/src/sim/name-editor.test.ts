import { expect, test } from 'bun:test';

import { createNewGame } from './management';
import { createNameEditor } from './name-editor';

const editor = () =>
  createNameEditor(
    createNewGame({ club: 1, colour: 0, level: 1, manager: 'alex', seed: 0 })
  );
test('questions accept only original yes forms, with h declining rather than copying', () => {
  const e = editor();
  e.submit('h');
  expect(e.kind).toBe('player');
  e.submit('Yes');
  expect(e.done).toBe(true);
});
test('pages wrap, numbers are constrained to the page, and unowned players can be renamed', () => {
  const e = editor();
  const seed = e.game.seed;
  e.submit('YES');
  e.submit('17');
  expect(e.error).toBe('TEAM NUMBER OUT OF RANGE');
  for (let i = 0; i < 3; i++) {
    e.submit('99');
  }
  e.submit('64');
  e.submit('New FC');
  expect(e.game.clubs[63]!.name).toBe('New FC');
  expect(e.submit('h')).toEqual({ type: 'copy' });
  e.submit('n');
  e.submit('y');
  e.submit('99');
  e.submit('99');
  e.submit('22');
  e.submit('R.New');
  e.submit('n');
  expect(e.done).toBe(true);
  expect(e.game.players[21]!.name).toBe('R.New');
  expect(e.game.players[21]!.status).toBe(0);
  expect(e.game.seed).toBe(seed);
});
test('a truncated colour prefix preserves the original BASIC stop and data', () => {
  const e = editor();
  e.submit('y');
  e.submit('1');
  const game = e.game;
  e.submit(String.fromCharCode(16));
  expect(e.phase).toBe('fault');
  expect(e.error).toBe('3 Subscript wrong, 9472:1');
  e.submit('Town');
  expect(e.game).toBe(game);
});
