import { coloursText, levels } from '../sim/catalogue';
import type { Game, Player } from '../sim/management';
import type { Paint } from './grid';
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

export const printPlayer = (
  player: Player,
  print: ReturnType<typeof createPrintScreen>
) => {
  const category = Math.floor((player.id - 1) / 8);
  print.reset({ ink: category });
  print.text(['D█', 'M█', 'A█'][category]!, { inverse: true });
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
  print.text(player.status > 1 ? (player.status === 2 ? 'p' : 'i') : ' ', {
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
  print.text('p', { ink: 3, inverse: true });
  print.text(' = picked to play, ', { ink: 0, inverse: false });
  print.text('i', { ink: 4, inverse: true });
  print.text(' = injured', { ink: 0, inverse: false });
  print.newline();
  print.text('  NAME   NO. SKILL ENERGY VALUE', { bright: true, paper: 6 });
  print.newline();
  const players = game.players.filter(player => player.status > 0);
  players.forEach(player => printPlayer(player, print));
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
