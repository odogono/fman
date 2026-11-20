import { expect, test } from 'bun:test';

import { patchFor } from './clip-canvas';
import { pitchWidth } from './clips';

test('down to square, the camera keeps its width and the box sets the length', () => {
  expect(patchFor(40, 400, 500)).toEqual({ length: 50, width: 40 });
  expect(patchFor(40, 400, 400)).toEqual({ length: 40, width: 40 });
});

test('wider than square, the box keeps a square’s length and widens, closing in', () => {
  const patch = patchFor(40, 1600, 1000);
  expect(patch.length).toBeCloseTo(40);
  expect(patch.width).toBeCloseTo(64);
  // The moment's tighter camera narrows it in the same way.
  expect(patchFor(30, 1600, 1000).length).toBeCloseTo(30);
});

test('past the pitch and a little touchline, a wider box shows more length', () => {
  const patch = patchFor(40, 2000, 1000);
  expect(patch.width).toBe(pitchWidth + 12);
  expect(patch.length).toBeCloseTo((pitchWidth + 12) / 2);
});
