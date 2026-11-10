import type { Cell, Paint, Style } from './management-layouts';

// A 32-column PRINT cursor. A full last column wraps only when more output arrives.
const blank = (): Cell => ({
  bright: false,
  ink: 0,
  inverse: false,
  paper: 7,
  text: ' '
});
export const createPrintScreen = () => {
  const cells = Array.from({ length: 704 }, blank);
  let row = 0,
    column = 0;
  const scroll = () => {
    cells.splice(0, 32);
    cells.push(...Array.from({ length: 32 }, blank));
    row--;
  };
  const newline = () => {
    row++;
    column = 0;
  };
  const normalize = () => {
    if (column === 32) {
      newline();
    }
  };
  const text = (value: string, style: Style = {}) => {
    for (const character of value) {
      if (character === '\n') {
        newline();
        continue;
      }
      normalize();
      while (row >= 22) {
        scroll();
      }
      cells[row * 32 + column] = { ...blank(), ...style, text: character };
      column++;
    }
  };
  const tab = (target: number, style: Style = {}) => {
    normalize();
    if (column > target) {
      newline();
    }
    text(' '.repeat(target - column), style);
  };
  return {
    at: (y: number, x: number) => {
      row = y;
      column = x;
    },
    comma: (style: Style = {}) => {
      normalize();
      if (column < 16) {
        tab(16, style);
      } else {
        text(' '.repeat(32 - column), style);
        newline();
      }
    },
    newline,
    paint: (put: Paint) =>
      cells.forEach((cell, i) =>
        put(Math.floor(i / 32), i % 32, cell.text, cell)
      ),
    // Comma-separated INPUT prompts reserve three ROM rows. Repeated empty/COPY
    // retries scroll once until the upper PRINT cursor has room for that prompt.
    reserveInput: () => {
      if (row >= 21) {
        scroll();
      }
    },
    tab,
    text
  };
};
