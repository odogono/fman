import { createHash } from 'node:crypto';
import { expect, test } from 'bun:test';

import reference from '../sim/fixtures/glyphs.json';
import { rasterText, rasterizeCells, spectrumCharacter } from './glyphs';

const hash = (rgba: Uint8ClampedArray) =>
  createHash('sha256').update(rgba).digest('hex');

for (const glyph of reference.glyphs) {
  test(`original PRINT glyph ${glyph.code}: ${spectrumCharacter(glyph.code)}`, () => {
    const rgba = new Uint8ClampedArray(8 * 8 * 4);
    rasterText(rgba, 8, 0, 0, spectrumCharacter(glyph.code));
    expect(hash(rgba)).toBe(glyph.rgba);
  });
}

for (const style of reference.cases) {
  test(`original PRINT repertoire and strings: ink ${style.ink}, paper ${style.paper}, bright ${style.bright}, inverse ${style.inverse}`, () => {
    // Capture begins with a black cleared bitmap/attribute area. Only PRINTed
    // cells gain the selected attributes, including spaces within strings.
    const cells = Array.from({ length: 32 * 11 }, () => ({
      bright: false,
      ink: 0,
      inverse: false,
      paper: 0,
      text: ' '
    }));
    reference.glyphs.forEach(({ code }, index) => {
      cells[index] = { ...style, text: spectrumCharacter(code) };
    });
    reference.strings.forEach((codes, row) =>
      codes.forEach((code, column) => {
        cells[(row + 4) * 32 + column] = {
          ...style,
          text: spectrumCharacter(code)
        };
      })
    );
    expect(hash(rasterizeCells(cells))).toBe(style.rgba);
  });
}

test('unsupported Unicode has a deterministic fallback and raster text clips at the edges', () => {
  const unsupported = new Uint8ClampedArray(256);
  const question = new Uint8ClampedArray(256);
  rasterText(unsupported, 8, 0, 0, '😀');
  rasterText(question, 8, 0, 0, '?');
  expect(unsupported).toEqual(question);
  rasterText(unsupported, 8, -8, -8, 'abc');
  expect(unsupported).toEqual(question);
});

test('Spectrum name-byte aliases use the corresponding printable masks', () => {
  for (const [alias, character] of [
    ['^', '↑'],
    ['`', '£'],
    ['\u007f', '©'],
    ['\ue08c', '▄'],
    ['\ue08f', '█']
  ]) {
    const first = new Uint8ClampedArray(256);
    const second = new Uint8ClampedArray(256);
    rasterText(first, 8, 0, 0, alias!);
    rasterText(second, 8, 0, 0, character!);
    expect(first).toEqual(second);
  }
});
