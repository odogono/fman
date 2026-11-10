import { expect, test } from 'bun:test';

import { createFrameSampler } from './frame-sampler';

test('does not emit negative frames when the first animation timestamp precedes initialization', () => {
  const sample = createFrameSampler(100);
  expect(sample(99)).toBe(0);
  expect(sample(120)).toBe(1);
  expect(sample(129)).toBe(0);
  expect(sample(140)).toBe(1);
});

test('retains fractional frames and accounts for a background-tab gap', () => {
  const sample = createFrameSampler(0);
  expect(sample(10)).toBe(0);
  expect(sample(20)).toBe(1);
  expect(sample(25)).toBe(0);
  expect(sample(2020)).toBe(100);
});
