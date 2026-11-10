import { createHash } from 'node:crypto';
import { describe, expect, test } from 'bun:test';

import reference from './fixtures/spectrum-rom.json';
import { createRng } from './rng';

describe('Spectrum RND', () => {
  for (const sequence of reference.randomSequences) {
    test(`matches the ROM sequence from seed ${sequence.initial}`, () => {
      const rng = createRng(sequence.initial);
      for (const seed of sequence.seeds) {
        expect(rng.next()).toBe(seed / 65_536);
        expect(rng.seed).toBe(seed);
      }
    });
  }

  test('matches the ROM transition fingerprint over every possible seed', () => {
    const digest = createHash('sha256');
    const bytes = new Uint8Array(2);
    for (let seed = 0; seed < 65_536; seed++) {
      const rng = createRng(seed);
      rng.next();
      bytes[0] = rng.seed & 255;
      bytes[1] = rng.seed >> 8;
      digest.update(bytes);
    }
    expect(digest.digest('hex')).toBe(reference.randomTransitionsSha256);
  });

  test('visits every state exactly once before returning to the initial seed', () => {
    const rng = createRng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 65_536; i++) {
      expect(seen.has(rng.seed)).toBe(false);
      seen.add(rng.seed);
      rng.next();
    }
    expect(rng.seed).toBe(1);
    expect(seen.size).toBe(65_536);
  });

  test('uses the inclusive integer helper without consuming an extra draw', () => {
    const rng = createRng(1);
    expect(rng.int(1, 100)).toBe(1);
    expect(rng.seed).toBe(149);
    const copied = createRng(rng.seed);
    expect(rng.int(-5, 5)).toBe(-5 + Math.floor(copied.next() * 11));
    expect(rng.seed).toBe(copied.seed);
  });

  test('validates seeds and integer ranges without consuming randomness', () => {
    for (const seed of [-1, 65_536, 1.5, Number.NaN]) {
      expect(() => createRng(seed)).toThrow();
    }
    const rng = createRng(219);
    expect(() => rng.randomize(-1, 100)).toThrow();
    expect(() => rng.randomize(0, -1)).toThrow();
    expect(() => rng.int(2, 1)).toThrow();
    expect(() => rng.int(0, 65_536)).toThrow();
    expect(() => rng.int(0.1, 1)).toThrow();
    expect(rng.seed).toBe(219);
  });
});
