import { describe, expect, test } from 'bun:test';

import capturedReference from './fixtures/spectrum-rom.json';
import {
  add,
  divide,
  floor,
  fromNumber,
  multiply,
  subtract,
  toNumber,
  type SpectrumNumber
} from './numeric';

const reference: typeof capturedReference = process.env.FMAN_ROM_REFERENCE
  ? await Bun.file(process.env.FMAN_ROM_REFERENCE).json()
  : capturedReference;

const bytes = (hex: string): SpectrumNumber => {
  const values = hex.match(/../g)!.map(byte => Number.parseInt(byte, 16));
  return [values[0]!, values[1]!, values[2]!, values[3]!, values[4]!];
};

const operations = { add, divide, floor, multiply, subtract };

describe('Spectrum calculator ROM parity', () => {
  for (const vector of reference.operations) {
    test(`${vector.operation}(${vector.inputs.join(', ')})`, () => {
      const left = bytes(vector.inputs[0]!);
      const right = bytes(vector.inputs[1] ?? '0000000000');
      const operation = operations[vector.operation as keyof typeof operations];
      const result = operation(left, right);
      expect(result).toEqual(bytes(vector.result));
      // Operations must not rewrite their operands in place as the ROM does.
      expect(left).toEqual(bytes(vector.inputs[0]!));
    });
  }
});

test('encodes storage boundaries and rejects values outside the format', () => {
  for (const value of [
    0,
    -1,
    65_535,
    -65_535,
    65_536,
    -65_536,
    1.5,
    -(2 ** -128),
    2 ** 126
  ]) {
    expect(toNumber(fromNumber(value))).toBe(value);
  }
  expect(fromNumber(-0)).toEqual([0, 0, 0, 0, 0]);
  expect(() => fromNumber(Number.NaN)).toThrow();
  expect(() => fromNumber(Infinity)).toThrow();
  expect(() => fromNumber(2 ** 127)).toThrow();
  expect(fromNumber(2 ** -130)).toEqual([0, 0, 0, 0, 0]);
});

test('reports arithmetic overflow and division by zero', () => {
  expect(() => divide(fromNumber(1), fromNumber(0))).toThrow(
    'Arithmetic overflow'
  );
  expect(() => multiply(fromNumber(2 ** 126), fromNumber(2))).toThrow(
    'Arithmetic overflow'
  );
});
