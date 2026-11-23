import { expect, test } from 'bun:test';

import { createShelves } from './shelves';

test('rects pack along a shelf, a pixel apart', () => {
  const shelves = createShelves(64);
  expect(shelves.place(10, 4)).toEqual({ restarted: false, x: 0, y: 0 });
  expect(shelves.place(6, 8)).toEqual({ restarted: false, x: 11, y: 0 });
});

test('a rect that would cross the edge starts a shelf below the tallest', () => {
  const shelves = createShelves(32);
  shelves.place(20, 4);
  shelves.place(5, 9);
  expect(shelves.place(10, 2)).toEqual({ restarted: false, x: 0, y: 10 });
});

test('when the square is full it starts over empty, a generation on', () => {
  const shelves = createShelves(16);
  shelves.place(15, 10);
  expect(shelves.generation()).toBe(0);
  expect(shelves.place(15, 10)).toEqual({ restarted: true, x: 0, y: 0 });
  expect(shelves.generation()).toBe(1);
  // Packing goes on from the new start.
  expect(shelves.place(15, 2)).toEqual({ restarted: false, x: 0, y: 11 });
});
