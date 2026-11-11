import { levels } from '../sim/catalogue';
import type { Game } from '../sim/management';
import { screenPrintFault } from '../sim/name-print-fault';
import { clubInk } from '../sim/names';
import type { View } from '../sim/session';
import { paintBills, paintDismissal } from './bills';
import type { Cell, Style } from './grid';
import { paintMarket, paintSquad, paintStatus } from './management-layouts';
import { paintMatch } from './match-layouts';
import { paintNames } from './name-layouts';
import { createPrintScreen } from './print-screen';
import { paintSeason } from './season-layouts';

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
  const copy = () => {
    if (!report) {
      put(21, 24, '(h=copy)');
    }
  };
  const choices = (row: number) =>
    levels.forEach((name, index) => {
      put(row + index, 0, String(index + 1));
      put(row + index, 16, name.padEnd(16), {
        bright: true,
        ink: index + 1,
        paper: index + 1 > 3 ? 0 : 7
      });
    });
  const money = (row: number, { cash, debt }: Pick<Game, 'cash' | 'debt'>) => {
    const prefix = `You've £${cash} `;
    put(row, 0, prefix);
    put(row, prefix.length, `You owe £${debt}`, { ink: 2 });
  };
  let prompt = '';
  let label = 'Command';
  let numeric = false;
  switch (view.screen) {
    case 'save-question':
      prompt = 'Do you want to play some more?';
      label = 'Continue playing, y or n';
      break;
    case 'names':
      ({ label, numeric, prompt } = paintNames(view.nameEditor, put));
      break;
    case 'cleared':
      put(23, 0, '© 1982 Sinclair Research Ltd');
      break;
    case 'bills':
      paintBills(view, put);
      prompt = 'Hit ENTER to continue';
      label = 'Continue';
      copy();
      break;
    case 'dismissal':
      ({ label, numeric, prompt } = paintDismissal(view, put));
      break;
    case 'title':
      put(0, 0, 'FOOTBALL MANAGER'.slice(0, view.printed ?? Infinity));
      put(
        1,
        0,
        '© Copyright K. J. Toms 1982'.slice(
          0,
          Math.max(0, (view.printed ?? Infinity) - 15)
        )
      );
      break;
    case 'manager':
      prompt = 'Type your name ';
      label = 'Manager name';
      break;
    case 'clubs': {
      put(0, 0, 'CHOOSE TEAM TO MANAGE -', {
        bright: true,
        ink: 1,
        inverse: true
      });
      put(1, 0, 'NUMBER          NAME', { ink: 1 });
      const offset = (view.page - 1) * 16;
      view.clubs.slice(offset, offset + 16).forEach((club, index) => {
        put(index + 2, 0, String(offset + index + 1));
        put(
          index + 2,
          16,
          club.paper === undefined ? club.name : club.name.padEnd(10),
          {
            ink: clubInk(club),
            ...(club.paper === undefined ? {} : { paper: club.paper })
          }
        );
      });
      put(
        18,
        0,
        'Type team number of the team youwant to manage (or 99 for more  choice)',
        { paper: 6 }
      );
      copy();
      label = 'Club number, or 99 for more choices';
      numeric = true;
      break;
    }
    case 'level':
      if (view.changing) {
        const { level } = view.game;
        put(0, 0, 'Your present skill level is -');
        put(1, 0, `Level ${level}         ${levels[level - 1]}`);
        put(4, 0, 'The choices are -');
        choices(6);
        put(14, 0, 'Enter your chosen level number');
      } else {
        choices(0);
        put(7, 0, 'Type your level (1-7)', { ink: 1 });
      }
      copy();
      label = 'Difficulty level, 1 to 7';
      numeric = true;
      break;
    case 'colours':
      put(0, 0, 'Enter your team colours (0=Blackor 7=White)');
      copy();
      label = 'Team colours, 0 for black or 7 for white';
      numeric = true;
      break;
    case 'menu':
      put(0, 0, 'TO -            TYPE -');
      put(2, 0, 'Sell or list'.padEnd(32), { ink: 2 });
      put(3, 0, ' ', { ink: 2 });
      put(3, 1, 'your Players', { ink: 2 });
      put(3, 18, '- a');
      put(5, 0, 'Print score etc', { ink: 1 });
      put(5, 18, '- s');
      put(7, 0, 'Obtain a loan'.padEnd(32), { ink: 2 });
      put(8, 0, ' '.repeat(32), { ink: 2 });
      put(7, 18, '- l', { ink: 2 });
      put(9, 0, 'Pay off loan'.padEnd(21), { ink: 1 });
      put(9, 18, '- p', { ink: 1 });
      put(11, 0, 'Change your');
      put(12, 3, 'skill level');
      put(12, 18, '- level');
      put(14, 0, 'Change team or');
      put(15, 2, 'player names');
      put(15, 18, '- change');
      put(17, 0, 'Save game');
      put(17, 18, '- keep');
      put(19, 0, 'OR type 99 to continue', { bright: true, paper: 6 });
      copy();
      break;
    case 'status':
      paintStatus(view.game, put);
      prompt = 'Hit ENTER to continue';
      label = 'Continue to menu';
      copy();
      break;
    case 'squad': {
      paintSquad(view.game, put, view.pickedCount);
      label = 'Player number to sell, or 99 to return';
      numeric = true;
      copy();
      break;
    }
    case 'sale': {
      const { game, offer } = view;
      const buyer = game.clubs[offer.buyerId - 1]!;
      const print = createPrintScreen(game.leagueMatches > 0);
      print.club(buyer);
      print.text(' ');
      print.text('have offered £', { ink: 1 });
      print.text(String(offer.amount));
      print.comma();
      print.text(' for ', { ink: 1 });
      print.name(game.players[offer.playerId - 1]!.name.padEnd(8));
      print.newline(false);
      print.newline(false);
      print.text(`He is worth £${game.players[offer.playerId - 1]!.value}`);
      print.paint(put);
      prompt = 'Do you accept? ';
      label = 'Accept sale, y or n';
      copy();
      break;
    }
    case 'transfer':
      paintMarket(view.game, view.playerId, put);
      label = 'Bid in pounds, or 99 to decline';
      numeric = true;
      copy();
      break;
    case 'transfer-result':
      if (view.fullSquad) {
        put(0, 0, '****Transfer Market****', { ink: 4, inverse: true });
        put(3, 0, view.text, { ink: 3 });
      } else {
        const print = createPrintScreen(view.game.leagueMatches > 0);
        print.name(view.text);
        print.paint(put);
      }
      prompt = 'Hit ENTER to continue';
      label = 'Continue to management';
      copy();
      break;
    case 'borrow':
    case 'repay':
      money(0, view.game);
      put(
        3,
        0,
        view.screen === 'borrow'
          ? 'Type loan amount required (£)'
          : 'Type amount you want to pay off your loan (£)',
        { ink: 1, inverse: true }
      );
      label =
        view.screen === 'borrow'
          ? 'Loan amount in pounds'
          : 'Loan repayment in pounds';
      numeric = true;
      copy();
      break;
    case 'message':
      switch (view.message.kind) {
        case 'text':
          {
            const print = createPrintScreen(
              view.game !== undefined && view.game.leagueMatches > 0
            );
            print.name(view.message.text.slice(0, view.printed ?? Infinity));
            print.paint(put);
          }
          break;
        case 'skill-level': {
          const { level } = view.message;
          put(0, 0, 'Your new skill level is -');
          put(1, 0, `Level ${level}         ${levels[level - 1]}`);
          break;
        }
        case 'balance':
          money(0, view.message);
          break;
      }
      if (!view.paused) {
        prompt = 'Hit ENTER to continue';
        label = 'Continue';
        copy();
      }
      break;
    case 'end-season':
    case 'season-table':
    case 'season-summary':
      ({ label, numeric, prompt } = paintSeason(
        { ...view, ...(report ? { printFault: report } : {}) },
        put
      ));
      break;
    default:
      ({ label, numeric, prompt } = paintMatch(
        { ...view, ...(report ? { printFault: report } : {}) },
        put
      ));
  }
  if (report) {
    put(23, 0, report);
    prompt = '';
  }
  return {
    cells,
    label,
    lines: Array.from({ length: rows }, (_, row) =>
      cells
        .slice(row * 32, row * 32 + 32)
        .map(cell => cell.text)
        .join('')
    ),
    numeric,
    paused: view.paused || view.screen === 'cleared' || fault,
    prompt
  };
};
