import atlas from './assets/spectrum-glyphs.json';
import type { Cell, Style } from './grid';

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

export const glyphMask = (character: string): readonly number[] => {
  const code = character.codePointAt(0)!;
  if (code >= 0xe0_90 && code <= 0xe0_a4) {
    return glyphs[String.fromCharCode(65 + code - 0xe0_90)]!;
  }
  const mapped =
    code >= 0xe0_80 && code < 0xe0_90
      ? spectrumCharacter(code - 0xe0_00)
      : code === 94 || code === 96 || code === 127
        ? spectrumCharacter(code)
        : character;
  return glyphs[mapped] ?? glyphs['?']!;
};

/** Opaque 8×8 cells; no browser font, metrics or antialiasing in native pixels. */
export const rasterText = (
  rgba: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  text: string,
  {
    bright = false,
    flash = false,
    ink = 0,
    inverse = false,
    paper = 7,
    pixels
  }: Style = {},
  flashPhase = false
) => {
  const height = rgba.length / (width * 4);
  for (const character of text) {
    const mask = pixels ?? glyphMask(character);
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
        const on =
          Boolean(mask[row]! & (128 >> column)) !==
          (inverse !== (flash && flashPhase));
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

export const rasterizeCells = (cells: readonly Cell[], flashPhase = false) => {
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
      cell,
      flashPhase
    )
  );
  return rgba;
};
