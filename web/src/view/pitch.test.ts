import { createHash } from 'node:crypto';
import { expect, test } from 'bun:test';

import glyphs from '../sim/fixtures/glyphs.json';
import observations from '../sim/fixtures/pitch.json';
import {
  emptyAttackCarry,
  simulateAttack,
  type Attack,
  type SpriteDraw
} from '../sim/highlights';
import { rasterizeAttack, rasterizeHighlight } from './pitch';

const hash = (rgba: Uint8ClampedArray) =>
  createHash('sha256').update(rgba).digest('hex');

const cellPixels = (rgba: Uint8ClampedArray, x: number, y: number) => {
  const cell = new Uint8ClampedArray(8 * 8 * 4);
  for (let row = 0; row < 8; row++) {
    const start = ((y * 8 + row) * 256 + x * 8) * 4;
    cell.set(rgba.subarray(start, start + 32), row * 32);
  }
  return cell;
};

for (const overlay of glyphs.overlays) {
  test(`original ${overlay.kind} overlay PRINT: home ink ${overlay.homeInk}, away ink ${overlay.awayInk}`, () => {
    const goal = overlay.kind === 'goal';
    for (const [outcomeChars, scoreChars] of [
      [0, 0],
      [1, 0],
      [7, 0],
      [31, 0],
      [33, 0],
      [64, 0],
      [127, 0],
      [128, 0],
      [128, 1],
      [128, 12],
      [128, 13],
      [128, 16],
      [128, 28],
      [128, 29]
    ]) {
      const attack: Attack = {
        carry: emptyAttackCarry(),
        direction: 'left',
        frames: [
          {
            draws: [],
            duration: 1,
            kind: goal ? 'goal' : 'miss',
            outcomeChars: outcomeChars!,
            scoreChars: scoreChars!,
            tones: []
          }
        ],
        goal,
        seed: 0,
        trace: []
      };
      const before = rasterizeAttack(attack, 0);
      const rgba = rasterizeHighlight(
        attack,
        0,
        [1, 0],
        { ink: overlay.homeInk, name: 'LIVERPOOL' },
        { ink: overlay.awayInk, name: 'IPSWICH' }
      );
      for (const [index, cell] of overlay.cells.entries()) {
        const printed =
          goal && cell.y === 4
            ? index - 128 < scoreChars!
            : index < outcomeChars!;
        expect(hash(cellPixels(rgba, cell.x, cell.y))).toBe(
          printed ? cell.rgba : hash(cellPixels(before, cell.x, cell.y))
        );
      }
    }
  });
}

test('XOR drawing and erasing a sprite restores the pitch beneath it', () => {
  const sprite: SpriteDraw = { glyph: 0, ink: 0, x: 5, y: 5 };
  const attack: Attack = {
    carry: emptyAttackCarry(),
    direction: 'left',
    frames: [
      { draws: [sprite], duration: 1, kind: 'draw', tones: [] },
      { draws: [{ ...sprite, ink: 6 }], duration: 1, kind: 'draw', tones: [] }
    ],
    goal: false,
    seed: 0,
    trace: []
  };
  const before = rasterizeAttack(attack, -1);
  const drawn = rasterizeAttack(attack, 0);
  const erased = rasterizeAttack(attack, 1);
  expect(drawn.some((value, index) => value !== before[index])).toBe(true);
  expect(Buffer.from(erased).equals(Buffer.from(before))).toBe(true);
});

for (const direction of ['left', 'right'] as const) {
  test(`original ${direction} pitch pixels`, () => {
    const attack: Attack = {
      carry: emptyAttackCarry(),
      direction,
      frames: [],
      goal: false,
      seed: 0,
      trace: []
    };
    expect(hash(rasterizeAttack(attack, -1))).toBe(
      observations.pitches[direction]
    );
  });
}

for (const game of observations.cases) {
  for (const [index, native] of game.attacks.entries()) {
    test(`original highlight pixels: kit ${game.colour}, seed ${game.seed}, attack ${index}`, () => {
      const attack = simulateAttack({
        awayInk: native.awayInk,
        carry: {
          attackers: native.attackers.map(([x, y]) => ({ x: x!, y: y! })),
          defenders: native.defenders.map(([x, y]) => ({ x: x!, y: y! }))
        },
        direction: native.direction as 'left' | 'right',
        homeInk: native.homeInk,
        seed: native.seed
      });
      const draws = attack.frames.flatMap((frame, index) =>
        frame.checkpoint ? [{ frame, index }] : []
      );

      expect(native.frames.map(frame => frame.kind)).toEqual(
        draws.map(({ frame }) => frame.checkpoint!)
      );
      for (const [frame, observed] of native.frames.entries()) {
        expect(hash(rasterizeAttack(attack, draws[frame]!.index))).toBe(
          observed.rgba
        );
      }
    });
  }
}
