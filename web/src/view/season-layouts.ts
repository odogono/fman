import { clubInk, clubText } from '../sim/names';
import type { Session } from '../sim/session';
import { paintLeagueTable } from './league-table';
import type { Paint } from './management-layouts';
import { createPrintScreen } from './print-screen';

export const paintSeason = (session: Session, put: Paint) => {
  switch (session.screen) {
    case 'end-season':
      put(0, 0, '****End of Season****', { ink: 2, inverse: true });
      break;
    case 'season-table':
      paintLeagueTable(session.game!, put);
      break;
    case 'season-summary': {
      const season = session.season!;
      const print = createPrintScreen();
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
        print.text(clubText(movement.club), { ink: clubInk(movement.club) });
        if (movement.kind !== 'champions') {
          print.text(' ', { ink: clubInk(movement.club) });
        }
        print.text(movement.kind === 'champions' ? text : text.slice(1), {
          ink:
            movement.kind === 'promoted'
              ? 1
              : movement.kind === 'relegated'
                ? 3
                : 2
        });
        print.newline();
      }
      print.text('****New Season****', { ink: 1, inverse: true });
      print.newline();
      print.tab(8);
      print.text(`Division ${session.game!.division}`);
      print.paint(put);
      break;
    }
  }
  put(21, 24, '(h=copy)');
  return { label: 'Continue', numeric: false, prompt: 'Hit ENTER to continue' };
};
