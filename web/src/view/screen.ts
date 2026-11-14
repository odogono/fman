import { screenPrintFault } from '../sim/name-print-fault';
import type { Screen, View } from '../sim/session';
import { billsLayouts } from './bills';
import type { Cell, Paint, Style } from './grid';
import type { Layouts } from './layout';
import { managementLayouts } from './management-layouts';
import { matchLayouts } from './match-layouts';
import { nameLayouts } from './name-layouts';
import { seasonLayouts } from './season-layouts';
import { setupLayouts } from './setup-layouts';

/** Every one of the original's screens has a layout. */
const layouts: Layouts<Screen> = {
  ...billsLayouts,
  ...managementLayouts,
  ...matchLayouts,
  ...nameLayouts,
  ...seasonLayouts,
  ...setupLayouts
};

/** Paints a view with its own screen's layout. */
const paint = <S extends Screen>(
  view: Extract<View, { screen: S }>,
  put: Paint
) => layouts[view.screen as S](view, put);

export const makeScreen = (view: View) => {
  const report = view.printFault ?? screenPrintFault(view);
  const fault =
    Boolean(report) ||
    (view.screen === 'names' && view.nameEditor.phase === 'fault');
  const rows = view.screen === 'cleared' || fault ? 24 : 22;
  const cells: Cell[] = Array.from({ length: rows * 32 }, () => ({
    bright: false,
    ink: 0,
    inverse: false,
    paper: 7,
    text: ' '
  }));
  const put = (
    row: number,
    column: number,
    text: string,
    style: Style = {}
  ) => {
    for (const character of text) {
      if (character === '\n') {
        row++;
        column = 0;
        continue;
      }
      if (row >= rows) {
        break;
      }
      if (row >= 0) {
        cells[row * 32 + column] = {
          ...cells[row * 32 + column]!,
          ...style,
          text: character
        };
      }
      column++;
      if (column === 32) {
        row++;
        column = 0;
      }
    }
  };
  const shown = paint(view, put) ?? {};
  let prompt = shown.prompt ?? '';
  // In the screen's plain colours, even over the cup trophy.
  if (shown.copy && !report) {
    put(21, 24, '(h=copy)', {
      bright: false,
      ink: 0,
      inverse: false,
      paper: 7
    });
  }
  if (report) {
    put(23, 0, report);
    prompt = '';
  }
  return {
    cells,
    label: shown.label ?? 'Command',
    lines: Array.from({ length: rows }, (_, row) =>
      cells
        .slice(row * 32, row * 32 + 32)
        .map(cell => cell.text)
        .join('')
    ),
    numeric: shown.numeric ?? false,
    paused: view.paused || view.screen === 'cleared' || fault,
    prompt
  };
};
