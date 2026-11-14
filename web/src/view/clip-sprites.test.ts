import { expect, test } from 'bun:test';

import {
  artColours,
  ballArt,
  playerArt,
  statusArt,
  type ArtGrid
} from './assets/clip-sprites';
import {
  artPixelSize,
  ballHeld,
  kitColours,
  looksFor,
  rasterise,
  spriteFor
} from './clip-sprites';

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

test('a player looks the same in every clip, picked by their name', () => {
  expect(looksFor('J. Smith', 3)).toEqual(looksFor('J. Smith', 7));
  const many = new Set(
    Array.from({ length: 40 }, (_, i) => looksFor(`Player ${i}`, 0).skin)
  );
  expect(many.size).toBeGreaterThan(1);
});

test('facing right draws the left art mirrored, and a runner strides as they go', () => {
  const at = { pose: 'run', x: 10, y: 10 } as const;
  const left = spriteFor({ ...at, facing: 'left' });
  const right = spriteFor({ ...at, facing: 'right' });
  expect(right.grid).toBe(left.grid);
  expect([left.mirrored, right.mirrored]).toEqual([false, true]);
  const strides = new Set(
    Array.from(
      { length: 10 },
      (_, i) => spriteFor({ ...at, facing: 'down', x: 10 + i * 0.5 }).grid
    )
  );
  expect(strides.size).toBe(2);
  expect(spriteFor({ ...at, facing: 'up', pose: 'stand' }).grid).toBe(
    playerArt.stand.up
  );
});

test('art pixels cover whole device pixels', () => {
  expect(artPixelSize(9.75, 3)).toBe(3);
  expect(artPixelSize(9.75, 1)).toBe(1);
  expect(artPixelSize(2, 1)).toBe(1);
});

test('the shorts are a darker shade of the kit, and black stays visible', () => {
  expect(kitColours('#d70000').shorts).toBe('#850000');
  const black = kitColours('#000000');
  expect(black.shirt).not.toBe(black.outline);
});

test('a held ball is drawn in the holder’s hands, not on its own', () => {
  const ball = { x: 30, y: 100 };
  expect(ballHeld([{ pose: 'hold', x: 30, y: 100.5 }], ball)).toBe(true);
  expect(ballHeld([{ pose: 'run', x: 30, y: 100.5 }], ball)).toBe(false);
});

test('a grid becomes RGBA pixels, mirrored when asked', () => {
  const { data, width } = rasterise(['so.'], { o: '#000000', s: '#ff0000' });
  expect(width).toBe(3);
  expect([...data]).toEqual([255, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 0]);
  const flipped = rasterise(['so.'], { o: '#000000', s: '#ff0000' }, true);
  expect(Array.from(flipped.data).slice(8)).toEqual([255, 0, 0, 255]);
});
