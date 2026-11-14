import { expect, test } from 'bun:test';

import {
  artColours,
  ballArt,
  playerArt,
  statusArt,
  type ArtGrid
} from './assets/clip-sprites';

const everyGrid = (): [string, ArtGrid][] => [
  ...Object.entries(playerArt).flatMap(([pose, facings]) =>
    Object.entries(
      facings as Record<string, ArtGrid | readonly ArtGrid[]>
    ).flatMap(([facing, art]) =>
      (typeof art[0] === 'string' ? [art as ArtGrid] : (art as ArtGrid[])).map(
        (grid, i): [string, ArtGrid] => [`${pose} ${facing} ${i}`, grid]
      )
    )
  ),
  ...ballArt.map((grid, i): [string, ArtGrid] => [`ball ${i}`, grid]),
  ['tired', statusArt.tired]
];

test('every grid is a rectangle drawn in the palette', () => {
  for (const [name, grid] of everyGrid()) {
    expect(grid.length, name).toBeGreaterThan(0);
    for (const row of grid) {
      expect(row.length, name).toBe(grid[0]!.length);
      for (const ch of row) {
        expect(artColours as readonly string[], name).toContain(ch);
      }
    }
  }
});

test('players are about 14 by 22 art pixels, larger than the original 8 by 8 characters', () => {
  for (const [name, grid] of everyGrid().filter(
    ([name]) => !/^(ball|tired|dive)/.test(name)
  )) {
    expect(grid[0]!.length, name).toBeGreaterThanOrEqual(11);
    expect(grid[0]!.length, name).toBeLessThanOrEqual(20);
    expect(grid.length, name).toBeGreaterThanOrEqual(19);
    expect(grid.length, name).toBeLessThanOrEqual(26);
    // A player stands on their bottom row.
    expect(grid.at(-1)!.replaceAll('.', ''), name).not.toBe('');
  }
});

test('the run cycles through more than one frame each way', () => {
  for (const frames of Object.values(playerArt.run)) {
    expect(frames.length).toBeGreaterThan(1);
  }
});
