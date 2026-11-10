import { expect, test } from 'bun:test';

import reference from './fixtures/spectrum-rom.json';
import { createFrameClock } from './frame-clock';
import { createRng } from './rng';

test('advances only from explicit frames and wraps the 24-bit FRAMES counter', () => {
  const clock = createFrameClock(16_777_215);
  expect(clock.advance(1)).toBe(0);
  expect(clock.advance(65_536 + 219)).toBe(65_755);
  expect(clock.frames).toBe(65_755);
  expect(clock.advance(0)).toBe(65_755);
});

test('RANDOMIZE zero uses the low 16 frame bits without changing the clock', () => {
  const clock = createFrameClock(65_536 + 219);
  const rng = createRng(42);
  rng.randomize(0, clock.frames);
  expect(rng.seed).toBe(219);
  expect(rng.next()).toBe(createRng(219).next());
  expect(clock.frames).toBe(65_755);
  rng.randomize(42, clock.frames);
  expect(rng.seed).toBe(42);
});

test('restoring explicit frame and RNG state reproduces subsequent draws', () => {
  const clock = createFrameClock(100);
  const rng = createRng(7);
  rng.next();
  const snapshot = { frames: clock.frames, seed: rng.seed };
  const restoredClock = createFrameClock(snapshot.frames);
  const restoredRng = createRng(snapshot.seed);
  clock.advance(123);
  restoredClock.advance(123);
  rng.randomize(0, clock.frames);
  restoredRng.randomize(0, restoredClock.frames);
  expect(rng.next()).toBe(restoredRng.next());
});

test('rejects invalid frames without changing state', () => {
  expect(() => createFrameClock(-1)).toThrow();
  expect(() => createFrameClock(16_777_216)).toThrow();
  const clock = createFrameClock(10);
  for (const frames of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    expect(() => clock.advance(frames)).toThrow();
  }
  expect(clock.frames).toBe(10);
  const expected = (10 + (Number.MAX_SAFE_INTEGER % 16_777_216)) % 16_777_216;
  expect(clock.advance(Number.MAX_SAFE_INTEGER)).toBe(expected);
});

test('matches the ROM interrupt counter and RANDOMIZE command observations', () => {
  for (const vector of reference.frames) {
    const clock = createFrameClock(vector.before);
    expect(clock.advance(1)).toBe(vector.after);
  }
  for (const vector of reference.randomize) {
    const rng = createRng(1);
    rng.randomize(vector.argument, vector.frames);
    expect(rng.seed).toBe(vector.seed);
  }
});
