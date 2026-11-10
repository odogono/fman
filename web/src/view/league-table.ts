import type { Game } from '../sim/management';
import { clubInk, clubText } from '../sim/names';
import type { Paint } from './management-layouts';

export const paintLeagueTable = (
  game: Game,
  put: Paint,
  order?: readonly number[]
) => {
  const rows =
    order ??
    game.league
      .map((_, i) => i)
      .sort((a, b) => game.league[a]!.position - game.league[b]!.position);
  put(0, 0, 'TEAM              F   A    PTS', {
    bright: true,
    ink: 7,
    paper: 1
  });
  rows.forEach((index, row) => {
    const record = game.league[index]!;
    const club = game.clubs[(game.division - 1) * 16 + index]!;
    const ink = clubInk(club);
    put(row + 1, 0, clubText(club), { ink });
    put(row + 1, 18, String(record.for), { ink });
    put(row + 1, 22, String(record.against), { ink });
    put(row + 1, 28, String(record.points), { ink });
  });
  put(
    18,
    0,
    `Lge.Pos. ${game.leaguePosition}   League match no.=${game.leagueMatches}`
  );
};
