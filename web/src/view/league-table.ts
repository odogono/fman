import type { Game } from '../sim/management';
import type { Paint } from './management-layouts';
import { createPrintScreen } from './print-screen';

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
  const print = createPrintScreen(game.leagueMatches > 0);
  print.text('TEAM              F   A    PTS', {
    bright: true,
    ink: 7,
    paper: 1
  });
  print.newline();
  rows.forEach(index => {
    const record = game.league[index]!;
    print.club(game.clubs[(game.division - 1) * 16 + index]!);
    print.tab(18);
    print.text(String(record.for));
    print.tab(22);
    print.text(String(record.against));
    print.tab(28);
    print.text(String(record.points));
    print.newline();
  });
  print.comma();
  print.comma();
  print.text(`Lge.Pos. ${game.leaguePosition}`);
  print.tab(13);
  print.text(`League match no.=${game.leagueMatches}`);
  print.paint(put);
};
