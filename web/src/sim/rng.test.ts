import { describe, expect, test } from 'bun:test';

import { createRng } from './rng';

describe('createRng', () => {
  test('replays the same sequence from the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const draws = Array.from({ length: 5 }, () => a.next());
    expect(draws).toEqual(Array.from({ length: 5 }, () => b.next()));
  });

  test('keeps values in range', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const value = rng.int(1, 6);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
    }
  });
});
