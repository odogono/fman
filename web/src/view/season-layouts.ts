import { clubInk, clubText } from '../sim/names';
import type { Session } from '../sim/session';
import { paintLeagueTable } from './league-table';
import type { Paint } from './management-layouts';

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
      put(0, 0, 'League Success Bonus Money =', { ink: 4, inverse: true });
      put(2, 0, `        £${season.bonus}`, { ink: 4, inverse: true });
      let row = 3;
      for (const movement of season.movements) {
        const text =
          movement.kind === 'promoted'
            ? ' are promoted' + '*'.repeat(41)
            : movement.kind === 'relegated'
              ? ' are relegated' + '+'.repeat(40)
              : ' are League Champions' + '*'.repeat(33);
        put(row, 0, clubText(movement.club), { ink: clubInk(movement.club) });
        put(row, clubText(movement.club).length, text, {
          ink:
            movement.kind === 'promoted'
              ? 1
              : movement.kind === 'relegated'
                ? 3
                : 2
        });
        row += Math.ceil((clubText(movement.club).length + text.length) / 32);
      }
      put(row, 0, '****New Season****', { ink: 1, inverse: true });
      put(row + 1, 8, `Division ${session.game!.division}`);
      break;
    }
  }
  put(21, 24, '(h=copy)');
  return { label: 'Continue', numeric: false, prompt: 'Hit ENTER to continue' };
};
