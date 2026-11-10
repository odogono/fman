import { expect, test } from 'bun:test';

import {
  emptyAttackCarry,
  type Attack,
  type SpriteDraw
} from '../sim/highlights';
import { rasterizeAttack } from './pitch';

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
