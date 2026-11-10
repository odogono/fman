import atlas from './assets/spectrum-glyphs.json';
import type { Cell, Style } from './management-layouts';

const glyphs: Readonly<Record<string, readonly number[]>> = atlas.glyphs;
export const blockCharacters = ' ▝▘▀▗▐▚▜▖▞▌▛▄▟▙█';

export const spectrumCharacter = (code: number) => {
  if (code >= 128 && code < 144) {
    return blockCharacters[code - 128]!;
  }
  return code === 94
    ? '↑'
    : code === 96
      ? '£'
      : code === 127
        ? '©'
        : String.fromCharCode(code);
};

/** Opaque 8×8 cells; no browser font, metrics or antialiasing in native pixels. */
export const rasterText = (
  rgba: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  text: string,
  { bright = false, ink = 0, inverse = false, paper = 7 }: Style = {}
) => {
  const height = rgba.length / (width * 4);
  for (const character of text) {
    // Names preserve Spectrum byte 94 as ASCII ^. Byte 96/127 and block
    // graphics can also arrive via the name decoder's private-use encoding.
    const code = character.codePointAt(0)!;
    const mapped =
      code >= 0xe0_80 && code < 0xe0_90
        ? spectrumCharacter(code - 0xe0_00)
        : code === 94 || code === 96 || code === 127
          ? spectrumCharacter(code)
          : character;
    const mask = glyphs[mapped] ?? glyphs['?']!;
    for (let row = 0; row < 8; row++) {
      for (let column = 0; column < 8; column++) {
        if (
          x + column < 0 ||
          x + column >= width ||
          y + row < 0 ||
          y + row >= height
        ) {
          continue;
        }
        const on = Boolean(mask[row]! & (128 >> column)) !== inverse;
        const colour = on ? ink : paper;
        const intensity = bright ? 255 : 215;
        const offset = ((y + row) * width + x + column) * 4;
        rgba[offset] = colour & 2 ? intensity : 0;
        rgba[offset + 1] = colour & 4 ? intensity : 0;
        rgba[offset + 2] = colour & 1 ? intensity : 0;
        rgba[offset + 3] = 255;
      }
    }
    x += 8;
  }
};

export const rasterizeCells = (cells: readonly Cell[]) => {
  const rgba = new Uint8ClampedArray(
    256 * Math.ceil(cells.length / 32) * 8 * 4
  );
  cells.forEach((cell, index) =>
    rasterText(
      rgba,
      256,
      (index % 32) * 8,
      Math.floor(index / 32) * 8,
      cell.text,
      cell
    )
  );
  return rgba;
};
