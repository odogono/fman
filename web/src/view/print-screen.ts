import type { Club } from '../sim/catalogue';
import { decodeName, encodeClubName, nameBytes } from '../sim/names';
import { PrintError, createPrintDecoder } from '../sim/spectrum-print';
import { blockCharacters, glyphMask, spectrumCharacter } from './glyphs';
import type { Cell, Paint, Style } from './grid';
import { sprites } from './sprites';

const blank = (): Cell => ({
  bright: false,
  ink: 0,
  inverse: false,
  paper: 7,
  text: ' '
});

/** The upper screen channel, including delayed wrap and temporary attributes. */
export const createPrintScreen = (
  udgSprites = false,
  options: {
    cells?: readonly Cell[];
    limit?: number;
    permanent?: Style;
  } = {}
) => {
  const permanent = options.permanent ?? {};
  const clear = (): Cell => ({ ...blank(), ...permanent });
  const cells = options.cells
    ? [...options.cells]
    : Array.from({ length: 704 }, clear);
  const touched = Array.from({ length: 704 }, () => false);
  let remaining = options.limit ?? Infinity;
  let row = 0,
    column = 0;
  let style: Style = { ...permanent };
  let transparentBright = false,
    transparentFlash = false;
  let over = false;
  let fault = '';
  let expandedInput = false;
  const scroll = () => {
    touched.splice(0, 32);
    touched.push(...Array.from({ length: 32 }, () => true));
    cells.splice(0, 32);
    cells.push(...Array.from({ length: 32 }, clear));
    row--;
  };
  const line = () => {
    row++;
    column = 0;
  };
  const normalize = () => {
    if (column === 32) {
      line();
    }
  };
  const glyph = (code: number, right = false) => {
    if (remaining-- <= 0) {
      return;
    }
    normalize();
    while (row >= 22) {
      scroll();
    }
    {
      const previous = cells[row * 32 + column]!;
      const character =
        code >= 144
          ? decodeName([code])
          : code === 94
            ? '^'
            : spectrumCharacter(code);
      const baseInk =
        style.ink === 8 || style.ink === 9 ? previous.ink : (style.ink ?? 0);
      const paper =
        style.paper === 8
          ? previous.paper
          : style.paper === 9
            ? baseInk >= 4
              ? 0
              : 7
            : (style.paper ?? 7);
      const ink = style.ink === 9 ? (paper >= 4 ? 0 : 7) : baseInk;
      const cell: Cell = {
        ...blank(),
        ...style,
        bright: transparentBright ? previous.bright : (style.bright ?? false),
        flash: transparentFlash
          ? (previous.flash ?? false)
          : (style.flash ?? false),
        ink,
        paper,
        text: character
      };
      if (udgSprites && code >= 144 && code < 159) {
        cell.pixels = sprites[code - 144]!;
      }
      if (over || right) {
        const before = (previous.pixels ?? glyphMask(previous.text)).map(
          b => b ^ (previous.inverse ? 255 : 0)
        );
        cell.pixels = (cell.pixels ?? glyphMask(character)).map(
          (b, i) => before[i]! ^ b ^ (cell.inverse && !right ? 255 : 0)
        );
        cell.inverse = false;
      }
      cells[row * 32 + column] = cell;
      touched[row * 32 + column] = true;
    }
    if (!right) {
      column++;
    }
  };
  const spaces = (count: number) => {
    for (let i = 0; i < count; i++) {
      glyph(32);
    }
  };
  const tab = (target: number, next: Style = {}) => {
    Object.assign(style, next);
    normalize();
    target %= 32;
    if (column > target) {
      spaces(32 - column);
      line();
    }
    spaces(target - column);
  };
  const comma = (next: Style = {}) => {
    Object.assign(style, next);
    normalize();
    if (column < 16) {
      tab(16);
    } else {
      spaces(32 - column);
      line();
    }
  };
  const decoder = createPrintDecoder(command => {
    switch (command.type) {
      case 'glyph':
        glyph(command.code);
        break;
      case 'right':
        glyph(32, true);
        break;
      case 'newline':
        line();
        break;
      case 'comma':
        comma();
        break;
      case 'backspace':
        if (column > 0) {
          column--;
        } else if (row > 0) {
          row--;
          column = 31;
        }
        break;
      case 'at':
        row = command.row;
        column = command.column;
        break;
      case 'tab':
        tab(command.column);
        break;
      case 'attribute': {
        const value = command.value;
        if (command.code === 16) {
          style.ink = value;
        }
        if (command.code === 17) {
          style.paper = value;
        }
        if (command.code === 18) {
          transparentFlash = value === 8;
          style.flash = value === 1;
        }
        if (command.code === 19) {
          transparentBright = value === 8;
          style.bright = value === 1;
        }
        if (command.code === 20) {
          style.inverse = Boolean(value);
        }
        if (command.code === 21) {
          over = Boolean(value);
        }
        break;
      }
    }
  });
  const safely = (work: () => void) => {
    if (fault) {
      return;
    }
    try {
      work();
    } catch (error) {
      if (!(error instanceof PrintError)) {
        throw error;
      }
      fault = error.message;
    }
  };
  const name = (value: string) =>
    safely(() => decoder.string(nameBytes(value)));
  return {
    at: (y: number, x: number) =>
      safely(() => {
        decoder.byte(22);
        decoder.byte(y);
        decoder.byte(x);
      }),
    get cells(): readonly Cell[] {
      return cells;
    },
    club: (club: Club) => name(decodeName(encodeClubName(club))),
    comma: (next: Style = {}) =>
      safely(() => {
        Object.assign(style, next);
        decoder.byte(6);
      }),
    get fault() {
      return fault;
    },
    name,
    newline: (resetStyle = true) => {
      safely(() => decoder.byte(13));
      if (!resetStyle) {
        return;
      }
      style = { ...permanent };
      over = false;
      transparentBright = false;
      transparentFlash = false;
    },
    paint: (put: Paint, touchedOnly = false) =>
      cells.forEach((cell, i) => {
        if (!touchedOnly || touched[i]) {
          put(Math.floor(i / 32), i % 32, cell.text, cell);
        }
      }),
    reserveInput: () => {
      if (!fault && row >= 21) {
        scroll();
        expandedInput = true;
      }
      // Once INPUT has grown to three rows, its uppermost row is cleared
      // even if a name's AT moved the upper cursor back to the screen top.
      if (!fault && expandedInput) {
        for (let i = 672; i < 704; i++) {
          cells[i] = clear();
          touched[i] = true;
        }
      }
    },
    reserveRows: (rows: number) => {
      while (!fault && row >= 24 - rows) {
        scroll();
      }
    },
    reset: (next: Style = {}) => {
      style = { ...permanent, ...next };
      over = false;
      transparentBright = false;
      transparentFlash = false;
    },
    tab: (target: number, next: Style = {}) =>
      safely(() => {
        Object.assign(style, next);
        decoder.byte(23);
        decoder.byte(target & 255);
        decoder.byte((target >> 8) & 255);
      }),
    text: (value: string, next: Style = {}) =>
      safely(() => {
        Object.assign(style, next);
        for (const character of value) {
          const code = character.codePointAt(0)!;
          decoder.byte(
            character === '\n'
              ? 13
              : character === '£'
                ? 96
                : character === '©'
                  ? 127
                  : code >= 0xe0_80 && code <= 0xe0_ff
                    ? code - 0xe0_00
                    : code <= 255
                      ? code
                      : blockCharacters.includes(character)
                        ? 128 + blockCharacters.indexOf(character)
                        : 63
          );
        }
      })
  };
};
