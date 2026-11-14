import { coloursText, levels } from '../sim/catalogue';
import type { Game, Player } from '../sim/management';
import { tiringInjuries } from '../sim/ruleset';
import { inSquadOrder, playerCategory } from '../sim/squads';
import type { Paint } from './grid';
import type { Layouts } from './layout';
import { createPrintScreen } from './print-screen';

export const paintStatus = (game: Game, put: Paint) => {
  const print = createPrintScreen(game.leagueMatches > 0);
  print.club(game.clubs[game.club - 1]!);
  print.comma();
  print.text(coloursText(game.colour, game.clubs[game.club - 1]!));
  print.newline();
  print.newline();
  print.text(`Manager : ${game.manager}`);
  print.newline();
  print.newline();
  print.text(`Managerial Rating(Max 100)= ${game.rating}`, {
    ink: 2,
    inverse: true
  });
  print.newline();
  print.newline();
  print.text(`Level ${game.level}`, { ink: 2 });
  print.comma();
  print.text(levels[game.level - 1]!.padEnd(16), {
    bright: true,
    ink: game.level,
    paper: game.level > 3 ? 0 : 7
  });
  print.text(' ', { bright: false, ink: 0, paper: 7 });
  print.newline();
  print.newline();
  print.text(`Seasons ${game.seasons}`);
  print.newline();
  print.newline();
  print.text(`You've £${game.cash} `);
  print.text(`You owe £${game.debt}`, { ink: 2 });
  print.newline();
  print.newline();
  print.text(`Morale   ${game.morale}`);
  print.newline();
  print.newline();
  print.text(`Lge.Pos. ${game.leaguePosition}`);
  print.tab(13);
  print.text(`League match no.=${game.leagueMatches}`);
  print.paint(put);
};

/**
 * The status cell: `p` for picked, and for an injury `i`, or under tiring
 * injuries (#98) the weeks left out, 1–3.
 */
const statusText = (player: Player, weeksOut: boolean) =>
  player.status === 2
    ? 'p'
    : player.status === 3
      ? weeksOut
        ? String(player.weeksOut ?? 1)
        : 'i'
      : ' ';

export const printPlayer = (
  player: Player,
  print: ReturnType<typeof createPrintScreen>,
  weeksOut = false
) => {
  const category = playerCategory(player);
  print.reset({ ink: category });
  // A goalkeeper (#113) is tagged on his own, in defence's ink.
  print.text(player.position === 'GK' ? 'G█' : ['D█', 'M█', 'A█'][category]!, {
    inverse: true
  });
  print.text('', { inverse: false });
  print.name(player.name.padEnd(8));
  print.text(` ${player.id}`);
  print.tab(15);
  print.text(String(player.skill));
  print.tab(20);
  print.text(String(player.energy));
  print.tab(24);
  print.text(`£${player.value}`);
  print.tab(31);
  print.text(statusText(player, weeksOut), {
    ink: player.status > 1 ? (player.status === 2 ? 3 : 4) : 6,
    inverse: true
  });
  print.newline();
};

export const paintPlayer = (
  player: Player,
  row: number,
  put: Paint,
  udgSprites = false
) => {
  const print = createPrintScreen(udgSprites);
  print.at(row, 0);
  printPlayer(player, print);
  print.paint(put, true);
};

export const paintSquad = (
  game: Game,
  put: Paint,
  picked: number,
  selection = false
) => {
  const print = createPrintScreen(game.leagueMatches > 0);
  const weeksOut = tiringInjuries(game.ruleset);
  print.text('p', { ink: 3, inverse: true });
  if (weeksOut) {
    print.text(' = picked, ', { ink: 0, inverse: false });
    print.text('1-3', { ink: 4, inverse: true });
    print.text(' = weeks injured', { ink: 0, inverse: false });
  } else {
    print.text(' = picked to play, ', { ink: 0, inverse: false });
    print.text('i', { ink: 4, inverse: true });
    print.text(' = injured', { ink: 0, inverse: false });
  }
  print.newline();
  print.text('  NAME   NO. SKILL ENERGY VALUE', { bright: true, paper: 6 });
  print.newline();
  const players = inSquadOrder(game.players.filter(p => p.status > 0));
  players.forEach(player => printPlayer(player, print, weeksOut));
  print.text('PLAYERS PICKED', { inverse: true });
  print.text(`=${picked}`, { inverse: false });
  print.newline();
  print.newline();
  print.text(
    selection
      ? picked > 11
        ? 'Type player no. to remove from\nteam'
        : 'Type Player No. to add to team'
      : 'TYPE NO. OF PLAYER TO BE SOLD',
    { ink: 1, inverse: true }
  );
  print.newline();
  if (!selection || picked <= 11) {
    print.text('OR type 99 to continue', { bright: true, paper: 6 });
  }
  print.paint(put);
};

export const paintMarket = (game: Game, playerId: number, put: Paint) => {
  const print = createPrintScreen(game.leagueMatches > 0);
  print.text('****Transfer Market****', { ink: 4, inverse: true });
  print.newline();
  print.newline();
  print.newline();
  print.text(`You've £${game.cash} `);
  print.text(`You owe £${game.debt}`, { ink: 2 });
  print.newline();
  print.newline();
  print.text('  NAME   NO. SKILL ENERGY VALUE', { bright: true, paper: 6 });
  print.newline();
  printPlayer(game.players[playerId - 1]!, print);
  print.newline();
  print.text('Type your bid (£)', { ink: 1, inverse: true });
  print.newline();
  print.newline();
  print.text('OR type 99 to continue', { bright: true, paper: 6 });
  print.paint(put);
};

/** Cash in hand, then the debt in red. */
const paintMoney = (
  row: number,
  { cash, debt }: Pick<Game, 'cash' | 'debt'>,
  put: Paint
) => {
  const prefix = `You've £${cash} `;
  put(row, 0, prefix);
  put(row, prefix.length, `You owe £${debt}`, { ink: 2 });
};

const toContinue = 'Hit ENTER to continue';

/** The management menu and the screens it leads to. */
export const managementLayouts: Layouts<
  | 'menu'
  | 'status'
  | 'squad'
  | 'sale'
  | 'transfer'
  | 'transfer-result'
  | 'borrow'
  | 'repay'
  | 'message'
> = {
  borrow: (view, put) => {
    paintMoney(0, view.game, put);
    put(3, 0, 'Type loan amount required (£)', { ink: 1, inverse: true });
    return { copy: true, label: 'Loan amount in pounds', numeric: true };
  },
  menu: (_view, put) => {
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
    return { copy: true };
  },
  message: (view, put) => {
    switch (view.message.kind) {
      case 'text': {
        const print = createPrintScreen(
          view.game !== undefined && view.game.leagueMatches > 0
        );
        print.name(view.message.text.slice(0, view.printed ?? Infinity));
        print.paint(put);
        break;
      }
      case 'skill-level': {
        const { level } = view.message;
        put(0, 0, 'Your new skill level is -');
        put(1, 0, `Level ${level}         ${levels[level - 1]}`);
        break;
      }
      case 'balance':
        paintMoney(0, view.message, put);
        break;
    }
    return view.paused
      ? undefined
      : { copy: true, label: 'Continue', prompt: toContinue };
  },
  repay: (view, put) => {
    paintMoney(0, view.game, put);
    put(3, 0, 'Type amount you want to pay off your loan (£)', {
      ink: 1,
      inverse: true
    });
    return { copy: true, label: 'Loan repayment in pounds', numeric: true };
  },
  sale: (view, put) => {
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
    return {
      copy: true,
      label: 'Accept sale, y or n',
      prompt: 'Do you accept? '
    };
  },
  squad: (view, put) => {
    paintSquad(view.game, put, view.pickedCount);
    return {
      copy: true,
      label: 'Player number to sell, or 99 to return',
      numeric: true
    };
  },
  status: (view, put) => {
    paintStatus(view.game, put);
    return { copy: true, label: 'Continue to menu', prompt: toContinue };
  },
  transfer: (view, put) => {
    paintMarket(view.game, view.playerId, put);
    return {
      copy: true,
      label: 'Bid in pounds, or 99 to decline',
      numeric: true
    };
  },
  'transfer-result': (view, put) => {
    if (view.fullSquad) {
      put(0, 0, '****Transfer Market****', { ink: 4, inverse: true });
      put(3, 0, view.text, { ink: 3 });
    } else {
      const print = createPrintScreen(view.game.leagueMatches > 0);
      print.name(view.text);
      print.paint(put);
    }
    return { copy: true, label: 'Continue to management', prompt: toContinue };
  }
};
