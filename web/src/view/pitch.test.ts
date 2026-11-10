import { createHash } from 'node:crypto';
import { expect, test } from 'bun:test';

import observations from '../sim/fixtures/pitch.json';
import {
  emptyAttackCarry,
  simulateAttack,
  type Attack,
  type SpriteDraw
} from '../sim/highlights';
import { rasterizeAttack } from './pitch';

const hash = (rgba: Uint8ClampedArray) =>
  createHash('sha256').update(rgba).digest('hex');

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

const category = (duration: number) =>
  duration === 1
    ? 'initial'
    : duration === 30
      ? 'dribble'
      : duration === 8
        ? 'release'
        : duration === 11.5
          ? 'collision'
          : 'ball';

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
      const draws = attack.frames.filter(frame => frame.kind === 'draw');

      expect(native.frames.map(frame => frame.kind)).toEqual(
        draws.map(frame => category(frame.duration))
      );
      for (const [frame, observed] of native.frames.entries()) {
        expect(hash(rasterizeAttack(attack, frame))).toBe(observed.rgba);
      }
    });
  }
}
