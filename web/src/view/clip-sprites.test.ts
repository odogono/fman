import { expect, test } from 'bun:test';

import {
  artColours,
  ballArt,
  playerArt,
  statusArt,
  type ArtGrid
} from './assets/clip-sprites';
import {
  artPixelMetres,
  artPixelSize,
  ballHeld,
  ballLiftMetres,
  kitColours,
  looksFor,
  rasterise,
  spriteFor
} from './clip-sprites';
import { headHeight } from './clips';

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
    // Clear rows under the feet lift a frame off the ground: a stride's
    // bounce by a row or two, a header's or a jump's leap by a few.
    // Everything else stands on its bottom row.
    const lift = grid.length - 1 - grid.findLastIndex(row => /[^.]/.test(row));
    const body = grid.length - lift;
    expect(lift, name).toBeLessThanOrEqual(
      /^(header|jump)/.test(name)
        ? 6
        : name.startsWith('cheer')
          ? 2
          : name.startsWith('run')
            ? 1
            : 0
    );
    expect(grid[0]!.length, name).toBeGreaterThanOrEqual(11);
    // A header's arms reach out a little wider.
    expect(grid[0]!.length, name).toBeLessThanOrEqual(
      name.startsWith('header') ? 22 : 20
    );
    expect(body, name).toBeGreaterThanOrEqual(19);
    expect(body, name).toBeLessThanOrEqual(26);
  }
});

test('the run cycles through four frames each way: two strides', () => {
  for (const frames of Object.values(playerArt.run)) {
    expect(frames).toHaveLength(4);
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
  const at = { pose: 'run', travelled: 0 } as const;
  const left = spriteFor({ ...at, facing: 'left' });
  const right = spriteFor({ ...at, facing: 'right' });
  expect(right.grid).toBe(left.grid);
  expect([left.mirrored, right.mirrored]).toEqual([false, true]);
  // Every frame of the cycle in turn, one for each 0.8 m covered, whichever
  // way they run.
  for (const facing of ['down', 'left', 'up'] as const) {
    const cycle = playerArt.run[facing];
    const seen = Array.from(
      { length: cycle.length * 2 },
      (_, k) => spriteFor({ ...at, facing, travelled: k * 0.8 + 0.4 }).grid
    );
    expect(seen).toEqual([...cycle, ...cycle]);
  }
  expect(spriteFor({ ...at, facing: 'up', pose: 'stand' }).grid).toBe(
    playerArt.stand.up
  );
});

test('a header shows its crouch, its leap and its contact', () => {
  for (const facing of ['down', 'left', 'up'] as const) {
    const frames = playerArt.header[facing];
    expect(frames).toHaveLength(3);
    frames.forEach((grid, poseFrame) =>
      expect(
        spriteFor({ facing, pose: 'header', poseFrame, travelled: 0 }).grid
      ).toBe(grid)
    );
  }
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

test('a header meets the ball with the forehead, as the ball is drawn', () => {
  // The ball's height at the header, drawn as a lift above the ground, is
  // where the contact frame's forehead is: near the top of the head, above
  // the lift of the leap.
  const drawn = headHeight * ballLiftMetres;
  for (const facing of ['down', 'left', 'up'] as const) {
    const grid = playerArt.header[facing][2]!;
    const top = grid.findIndex(row => /[^.]/.test(row));
    const forehead = (grid.length - top - 3) * artPixelMetres;
    expect(Math.abs(forehead - drawn), facing).toBeLessThan(0.35);
  }
});

// A stride is 0.8 m of ground.
test('a celebrating run strides as a run, and a jump crouches then leaps', () => {
  for (const facing of ['down', 'left', 'up'] as const) {
    expect(playerArt.cheer[facing]).toHaveLength(4);
    expect(playerArt.jump[facing]).toHaveLength(2);
    const frames = new Set(
      [0, 1, 2, 3].map(
        k => spriteFor({ facing, pose: 'cheer', travelled: k * 0.8 }).grid
      )
    );
    expect(frames.size).toBe(4);
    playerArt.jump[facing].forEach((grid, poseFrame) =>
      expect(
        spriteFor({ facing, pose: 'jump', poseFrame, travelled: 0 }).grid
      ).toBe(grid)
    );
  }
});
