import { levels } from '../sim/catalogue';
import type { Game, Player } from '../sim/management';
import { clubInk, clubText } from '../sim/names';

export type Cell = {
  bright: boolean;
  ink: number;
  inverse: boolean;
  paper: number;
  text: string;
};
export type Style = Partial<Omit<Cell, 'text'>>;

export type Paint = (
  row: number,
  column: number,
  text: string,
  style?: Style
) => void;

export const paintStatus = (game: Game, put: Paint) => {
  const ink = clubInk(game.clubs[game.club - 1]!);
  put(0, 0, clubText(game.clubs[game.club - 1]!), { ink });
  put(0, 16, `Colours = ${game.colour === 0 ? 'Black' : 'White'}`, { ink });
  put(2, 0, `Manager : ${game.manager}`);
  put(4, 0, `Managerial Rating(Max 100)= ${game.rating}`, {
    ink: 2,
    inverse: true
  });
  put(6, 0, `Level ${game.level}`, { ink: 2 });
  put(6, 16, levels[game.level - 1]!.padEnd(16), {
    bright: true,
    ink: game.level,
    paper: game.level > 3 ? 0 : 7
  });
  put(9, 0, `Seasons ${game.seasons}`);
  put(11, 0, `You've £${game.cash}  You owe £${game.debt}`);
  put(13, 0, `Morale   ${game.morale}`);
  put(
    15,
    0,
    `Lge.Pos. ${game.leaguePosition}   League match no.=${game.leagueMatches}`
  );
};

export const paintPlayer = (player: Player, row: number, put: Paint) => {
  const category = Math.floor((player.id - 1) / 8);
  const ink = category;
  put(row, 0, ['D█', 'M█', 'A█'][category]!, { ink, inverse: true });
  put(row, 2, player.name.padEnd(8), { ink });
  put(row, 11, String(player.id), { ink });
  put(row, 15, String(player.skill), { ink });
  put(row, 20, String(player.energy), { ink });
  put(row, 24, `£${player.value}`, { ink });
  if (player.status > 1) {
    put(row, 31, player.status === 2 ? 'p' : 'i', {
      ink: player.status === 2 ? 3 : 4,
      inverse: true
    });
  }
};

export const paintSquad = (game: Game, put: Paint, selection = false) => {
  put(0, 0, 'p = picked to play, i = injured');
  put(1, 0, '  NAME   NO. SKILL ENERGY VALUE', { bright: true, paper: 6 });
  const players = game.players.filter(player => player.status > 0);
  players.forEach((player, index) => {
    const row = index + 2;
    paintPlayer(player, row, put);
  });
  put(
    players.length + 2,
    0,
    `PLAYERS PICKED=${game.players.filter(player => player.status === 2).length}`,
    { inverse: true }
  );
  put(
    players.length + 4,
    0,
    selection
      ? game.players.filter(p => p.status === 2).length > 11
        ? 'Type player no. to remove from\nteam'
        : 'Type Player No. to add to team'
      : 'TYPE NO. OF PLAYER TO BE SOLD',
    {
      ink: 1,
      inverse: true
    }
  );
  if (!selection || game.players.filter(p => p.status === 2).length <= 11) {
    put(players.length + 5, 0, 'OR type 99 to continue', {
      bright: true,
      paper: 6
    });
  }
};
