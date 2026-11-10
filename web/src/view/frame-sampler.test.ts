import { expect, test } from 'bun:test';

import { createFrameSampler } from './frame-sampler';

const frameMs = 19.968;

test('uses the PAL 48K cadence rather than the rounded 20 ms approximation', () => {
  const sample = createFrameSampler(0);
  expect(sample(frameMs - 0.001)).toBe(0);
  expect(sample(frameMs)).toBe(1);
  expect(sample(1000)).toBe(49);
  expect(sample(60_000)).toBe(2954);
});

test('does not run backwards when animation timestamps precede a newer input sample', () => {
  const sample = createFrameSampler(100);
  expect(sample(99)).toBe(0);
  expect(sample(120)).toBe(1);
  expect(sample(119)).toBe(0);
  expect(sample(129)).toBe(0);
  expect(sample(140)).toBe(1);
});

test('fractional, uneven callbacks and input sampling equal a single elapsed interval', () => {
  const chunked = createFrameSampler(123.456);
  const single = createFrameSampler(123.456);
  let total = 0;
  for (let i = 1; i <= 10_000; i++) {
    total += chunked(123.456 + i * 0.1);
  }
  expect(total).toBe(single(1123.456));
  expect(chunked(1221.696)).toBe(single(1221.696));
  expect(chunked(62_000)).toBe(single(62_000));
});

test('catches up an entire delayed or background interval without a cap', () => {
  const sample = createFrameSampler(0);
  expect(sample(10)).toBe(0);
  expect(sample(frameMs)).toBe(1);
  expect(sample(25)).toBe(0);
  expect(sample(frameMs * 100_000)).toBe(99_999);
});

test('freezing the browser menu excludes elapsed time and retains fractional phase', () => {
  const sample = createFrameSampler(0);
  expect(sample(10)).toBe(0);
  expect(sample(5010, false)).toBe(0);
  expect(sample(5019.968)).toBe(1);
  expect(sample(5020)).toBe(0);
});

test('shifting the origin for a long menu interval cannot undo an emitted boundary', () => {
  const sample = createFrameSampler(0.13);
  expect(sample(40.066)).toBe(2);
  expect(sample(10_000_040.166, false)).toBe(0);
  expect(sample(10_000_040.166)).toBe(0);
  expect(sample(10_000_060.135)).toBe(1);
});

test('rejects invalid timestamps without poisoning later samples', () => {
  expect(() => createFrameSampler(Number.NaN)).toThrow(RangeError);
  const sample = createFrameSampler(0);
  for (const now of [Number.NaN, Infinity, -Infinity]) {
    expect(() => sample(now)).toThrow(RangeError);
  }
  expect(sample(frameMs)).toBe(1);
});
