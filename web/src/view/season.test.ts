import { expect, test } from 'bun:test';

import { createNewGame } from '../sim/management';
import { completeSeason } from '../sim/season';
import { makeScreen } from './screen';

test('the season flow keeps the final table visible before showing bonuses and movements', () => {
  const fresh = createNewGame({
    club: 1,
    colour: 0,
    level: 1,
    manager: 'alex',
    seed: 0
  });
  const game = {
    ...fresh,
    cupFinished: true,
    league: fresh.league.map((r, i) => ({
      ...r,
      position: i === 15 ? 1 : i + 2
    })),
    leagueMatches: 15,
    leaguePosition: 1
  };
  const view = {
    frames: 0,
    game,
    paused: false,
    screen: 'end-season' as const
  };
  expect(makeScreen(view).lines[0]).toContain('End of Season');
  const table = makeScreen({ ...view, screen: 'season-table' });
  expect(table.lines[1]).toContain('Arsenal');
  const season = completeSeason(game);
  const summary = makeScreen({
    ...view,
    game: season.game,
    screen: 'season-summary',
    season
  });
  expect(summary.lines.join('\n')).toContain('£80000');
  expect(summary.lines.join('\n')).toContain('are promoted');
  expect(summary.lines.join('\n')).toContain('New Season');
  expect(summary.lines.join('\n')).toContain('Division 3');
});
