import { describe, expect, test } from 'bun:test';

import { decodeNumber, extractBasic, readSnapshot } from './extract';

const snapshot = (payload: number[], compressed = false) => {
  const header = new Uint8Array(30);
  header[6] = 1;
  header[12] = compressed ? 32 : 0;
  return Uint8Array.from([...header, ...payload]);
};

describe('v1 snapshot decoding', () => {
  test('expands ED runs and preserves a literal ED followed by another byte', () => {
    const packed = [0xed, 1];
    let remaining = 49_150;
    while (remaining > 0) {
      const count = Math.min(remaining, 255);
      packed.push(0xed, 0xed, count, 0);
      remaining -= count;
    }
    const result = readSnapshot(snapshot([...packed, 0, 0xed, 0xed, 0], true));
    expect(result.ram.length).toBe(49_152);
    expect(Array.from(result.ram.slice(0, 4))).toEqual([0xed, 1, 0, 0]);
  });

  test('rejects truncated, oversized, unterminated and unsupported snapshots', () => {
    expect(() => readSnapshot(new Uint8Array(29))).toThrow();
    expect(() => readSnapshot(snapshot([0xed, 0xed, 3], true))).toThrow();
    expect(() => readSnapshot(snapshot(new Array(49_153).fill(0)))).toThrow();
    expect(() =>
      readSnapshot(snapshot(new Array(49_152).fill(0), true))
    ).toThrow();
    const extended = snapshot(new Array(49_152).fill(0));
    extended[6] = 0;
    expect(() => readSnapshot(extended)).toThrow();
  });
});

test('decodes Spectrum integer and floating-point representations', () => {
  expect(decodeNumber([0, 0, 255, 255, 0])).toBe(65_535);
  expect(decodeNumber([0, 255, 255, 255, 0])).toBe(-1);
  expect(decodeNumber([129, 0, 0, 0, 0])).toBe(1);
  expect(decodeNumber([128, 128, 0, 0, 0])).toBe(-0.5);
});

test('keeps stored numbers, quoted bytes, control parameters and raw line evidence', () => {
  const memory = new Uint8Array(65_536);
  memory[23_635] = 0;
  memory[23_636] = 96;
  // PRINT "RND-token, literal 0x0E, INK-control whose parameter is CR": GO TO 10,
  // where the hidden numeric value is deliberately 100 rather than visible 10.
  const body = [
    245, 34, 165, 14, 16, 13, 34, 58, 236, 49, 48, 14, 0, 0, 100, 0, 0, 13
  ];
  const end = 24_576 + 4 + body.length;
  memory[23_627] = end & 255;
  memory[23_628] = end >> 8;
  memory.set([0, 10, body.length, 0, ...body], 24_576);
  const lines = extractBasic(memory);
  expect(lines).toHaveLength(1);
  expect(lines[0]?.numbers).toEqual([
    { address: 24_591, bytes: [0, 0, 100, 0, 0], value: 100 }
  ]);
  expect(lines[0]?.text).toContain('GO TO 10');
  expect(lines[0]?.text).toContain('{INK 13}');
  expect(lines[0]?.raw).toEqual(body);
  memory[24_578] = 255;
  expect(() => extractBasic(memory)).toThrow();
});
