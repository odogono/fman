import { decodeName } from '../sim/names';
import type { View } from '../sim/session';
import type { Paint } from './grid';
import type { LayoutResult, Layouts } from './layout';
import { paintLeagueTable } from './league-table';
import { createPrintScreen } from './print-screen';

const paintSeason = (
  view: Extract<
    View,
    { screen: 'end-season' | 'season-table' | 'season-summary' }
  >,
  put: Paint
): LayoutResult => {
  switch (view.screen) {
    case 'end-season':
      put(0, 0, '****End of Season****', { ink: 2, inverse: true });
      break;
    case 'season-table':
      paintLeagueTable(view.game, put);
      break;
    case 'season-summary': {
      const season = view.season;
      const print = createPrintScreen(true);
      const bonusStyle = { ink: 4, inverse: true };
      print.text('League Success Bonus Money =', bonusStyle);
      print.comma(bonusStyle);
      print.comma(bonusStyle);
      print.text(`        £${season.bonus}`, bonusStyle);
      print.newline();
      for (const movement of season.movements) {
        const text =
          movement.kind === 'promoted'
            ? ' are promoted' + '*'.repeat(41)
            : movement.kind === 'relegated'
              ? ' are relegated' + '+'.repeat(40)
              : ' are League Champions' + '*'.repeat(33);
        print.club(movement.club);
        if (movement.kind !== 'champions') {
          print.text(' ');
        }
        const ink =
          movement.kind === 'promoted'
            ? 1
            : movement.kind === 'relegated'
              ? 3
              : 2;
        // These inline INK bytes can finish a truncated AT in the name.
        print.name(decodeName([16, ink]));
        print.text(movement.kind === 'champions' ? text : text.slice(1));
        print.name(decodeName([16, 0]));
        print.newline();
      }
      print.text('****New Season****', { ink: 1, inverse: true });
      print.newline();
      print.tab(8);
      print.text(`Division ${view.game.division}`);
      print.paint(put);
      break;
    }
  }
  return { copy: true, label: 'Continue', prompt: 'Hit ENTER to continue' };
};

/** The season's end: the banner, the final table and the summary. */
export const seasonLayouts: Layouts<
  'end-season' | 'season-table' | 'season-summary'
> = {
  'end-season': paintSeason,
  'season-summary': paintSeason,
  'season-table': paintSeason
};
