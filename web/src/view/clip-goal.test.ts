import { expect, test } from 'bun:test';

import { textColumns } from './clip-card';
import { goalTile, textOn } from './clip-goal';
import { inkColours } from './clip-match';

const goal = (name: string) => ({
  at: 30,
  length: 125,
  minute: '34′',
  name,
  score: [2, 1]
});

test('the tile reads the score, then the scorer and the minute', () => {
  const tile = goalTile(goal('Home 10'), 210);
  expect(tile).toMatchObject({ score: '2-1', scorer: 'Home 10  34′', size: 2 });
  expect(tile.width).toBeLessThanOrEqual(210 - 8);
});

test('a name too long for the picture drops to the small letters', () => {
  const tile = goalTile(goal('Bartholomew-Ashworth'), 210);
  expect(tile.size).toBe(1);
  expect(tile.width).toBeLessThanOrEqual(210 - 8);
});

test('the font reads accented names and apostrophes', () => {
  expect(textColumns("Ó'Ñeill")).toBe(textColumns('O′NEILL'));
});

test('the scorer shows in white on a dark kit, in ink on a light one', () => {
  expect(textOn(inkColours[2])).toBe('#f4f4f4');
  expect(textOn(inkColours[0])).toBe('#f4f4f4');
  expect(textOn(inkColours[7])).toBe('#141414');
  expect(textOn(inkColours[6])).toBe('#141414');
});
