/** The ROM screen channel's byte protocol, bounded to strings the game prints. */
export type PrintCommand =
  | { code: number; type: 'glyph' }
  | { code: number; type: 'attribute'; value: number }
  | { column: number; row: number; type: 'at' }
  | { column: number; type: 'tab' }
  | { type: 'backspace' | 'comma' | 'newline' | 'right' };

export class PrintError extends Error {}

const tokens = [
  'RND',
  'INKEY$',
  'PI',
  'FN',
  'POINT',
  'SCREEN$',
  'ATTR',
  'AT',
  'TAB',
  'VAL$',
  'CODE',
  'VAL',
  'LEN',
  'SIN',
  'COS',
  'TAN',
  'ASN',
  'ACS',
  'ATN',
  'LN',
  'EXP',
  'INT',
  'SQR',
  'SGN',
  'ABS',
  'PEEK',
  'IN',
  'USR',
  'STR$',
  'CHR$',
  'NOT',
  'BIN',
  'OR',
  'AND',
  '<=',
  '>=',
  '<>',
  'LINE',
  'THEN',
  'TO',
  'STEP',
  'DEF FN',
  'CAT',
  'FORMAT',
  'MOVE',
  'ERASE',
  'OPEN #',
  'CLOSE #',
  'MERGE',
  'VERIFY',
  'BEEP',
  'CIRCLE',
  'INK',
  'PAPER',
  'FLASH',
  'BRIGHT',
  'INVERSE',
  'OVER',
  'OUT',
  'LPRINT',
  'LLIST',
  'STOP',
  'READ',
  'DATA',
  'RESTORE',
  'NEW',
  'BORDER',
  'CONTINUE',
  'DIM',
  'REM',
  'FOR',
  'GO TO',
  'GO SUB',
  'INPUT',
  'LOAD',
  'LIST',
  'LET',
  'PAUSE',
  'NEXT',
  'POKE',
  'PRINT',
  'PLOT',
  'RUN',
  'SAVE',
  'RANDOMIZE',
  'IF',
  'CLS',
  'DRAW',
  'CLEAR',
  'RETURN',
  'COPY'
];

export const createPrintDecoder = (emit: (command: PrintCommand) => void) => {
  let control = 0;
  let parameters: number[] = [];
  let leadingSpace = false;
  const glyph = (code: number) => {
    emit({ code, type: 'glyph' });
    leadingSpace = code !== 32;
  };
  const byte = (code: number) => {
    if (control) {
      parameters.push(code);
      if (parameters.length < (control >= 22 ? 2 : 1)) {
        return;
      }
      const command = control;
      control = 0;
      const value = parameters[0]!;
      if (command < 22) {
        const valid =
          command < 18
            ? value <= 9
            : command < 20
              ? value <= 1 || value === 8
              : value <= 1;
        if (!valid) {
          throw new PrintError('K Invalid colour');
        }
        emit({ code: command, type: 'attribute', value });
      } else if (command === 22) {
        if (value >= 23 || parameters[1]! >= 32) {
          throw new PrintError('B Integer out of range');
        }
        emit({ column: parameters[1]!, row: value, type: 'at' });
        if (value >= 22) {
          throw new PrintError('5 Out of screen');
        }
      } else {
        emit({ column: value % 32, type: 'tab' });
      }
      return;
    }
    if (code >= 16 && code <= 23) {
      control = code;
      parameters = [];
    } else if (code === 6) {
      emit({ type: 'comma' });
    } else if (code === 8) {
      emit({ type: 'backspace' });
    } else if (code === 9) {
      // ROM PO-RIGHT XORs a space to update the cell attributes, without
      // advancing the stored cursor or changing its bitmap.
      emit({ type: 'right' });
    } else if (code === 13) {
      emit({ type: 'newline' });
    } else if (code < 32) {
      glyph(63);
    } else if (code < 165) {
      glyph(code);
    } else {
      const token = tokens[code - 165]!;
      if (
        leadingSpace &&
        code >= 197 &&
        code !== 199 &&
        code !== 200 &&
        code !== 201
      ) {
        glyph(32);
      }
      for (const character of token) {
        glyph(character.charCodeAt(0));
      }
      if (
        code >= 168 &&
        code !== 199 &&
        code !== 200 &&
        code !== 201 &&
        code !== 211 &&
        code !== 212
      ) {
        glyph(32);
      }
    }
  };
  return {
    byte,
    string: (bytes: readonly number[]) => {
      for (const code of bytes) {
        byte(code);
      }
    }
  };
};
