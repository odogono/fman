import { expect, test } from 'bun:test';

import { fontGlyphs, fontHeight } from './assets/clip-font';
import { cardSize, labelSize, overlayUnit, textColumns } from './clip-card';

test('every glyph is seven rows of one width, ink or clear', () => {
  for (const [c, grid] of Object.entries(fontGlyphs)) {
    expect(grid, c).toHaveLength(fontHeight);
    expect(new Set(grid.map(row => row.length)).size, c).toBe(1);
    expect(grid.join('')).toMatch(/^[#.]*$/);
  }
});

test('the font spells every card, whatever its case', () => {
  const cards = ['Kick-off', 'Full time', 'Free kick', 'Corner', 'Throw-in'];
  for (const text of [...cards, 'Goal kick', '90′', '45′', '#10!']) {
    for (const c of text) {
      expect(fontGlyphs[c.toUpperCase()], `${text}: ${c}`).toBeDefined();
    }
  }
});

test('text is measured with its letters a pixel apart', () => {
  expect(textColumns('I')).toBe(3);
  expect(textColumns('34′')).toBe(5 + 1 + 5 + 1 + 1);
});

test('the card fits its lines: the minute alone, or with the restart under it', () => {
  const minute = cardSize({ minute: '34′', shown: 1 });
  const both = cardSize({ minute: '34′', shown: 1, text: 'Free kick' });
  const text = cardSize({ shown: 1, text: 'Kick-off' });
  expect(both.height).toBeGreaterThan(minute.height);
  expect(minute.height).toBeGreaterThan(text.height);
  // The restart is wider than the minute, and sets the width.
  expect(both.width).toBeGreaterThan(minute.width);
});

test('the art pixel scales with the canvas, never below a device pixel', () => {
  expect(overlayUnit(840)).toBe(4);
  expect(overlayUnit(1680)).toBe(8);
  expect(overlayUnit(100)).toBe(1);
});

test("a player's label fits their name in the small letters, with a margin", () => {
  expect(labelSize('S.Frost')).toEqual({
    height: 7 + 4,
    width: textColumns('S.FROST') + 4
  });
});
