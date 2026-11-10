import { inflateSync } from 'node:zlib';
import { expect, test } from 'bun:test';

import observations from '../sim/fixtures/name-layouts.json';
import seasonObservations from '../sim/fixtures/seasons.json';
import { prepareLeagueMatch } from '../sim/league';
import { createNewGame } from '../sim/management';
import { renameClub } from '../sim/names';
import { completeSeason } from '../sim/season';
import { createSession } from '../sim/session';
import { makeScreen } from './screen';

const fresh = () =>
  createNewGame({ club: 1, colour: 0, level: 1, manager: 'alex', seed: 0 });
const compare = (
  actual: ReturnType<typeof makeScreen>,
  original: { attributes: string; inverse: string; lines: string[] }
) => {
  expect(actual.lines.slice(0, 22).map(line => line.trimEnd())).toEqual(
    original.lines.slice(0, 22)
  );
  expect(
    actual.cells
      .slice(0, 704)
      .map(cell => cell.ink + 8 * cell.paper + 64 * Number(cell.bright))
  ).toEqual([...inflateSync(Buffer.from(original.attributes, 'base64'))]);
  expect(actual.cells.slice(0, 704).map(cell => Number(cell.inverse))).toEqual([
    ...inflateSync(Buffer.from(original.inverse, 'base64'))
  ]);
  if (actual.lines.length === 24) {
    expect(actual.lines[23]!.trimEnd()).toBe(original.lines[23]!);
  }
};
for (const [index, episode] of observations.edits.entries()) {
  test(`native ${episode.kind} scrolling episode ${index}`, () => {
    const s = createSession(2 ** 24 - 5);
    s.advance(5);
    s.skipPause();
    for (const text of ['alex', '1', '1', '0', 'change']) {
      s.submit(text);
    }
    if (episode.kind === 'player') {
      s.submit('n');
    }
    for (const step of episode.steps) {
      for (let i = 0; i < step.repeat; i++) {
        s.submit(step.input);
      }
      compare(makeScreen(s.view), step);
    }
  });
}
for (const observed of observations.matches) {
  test(`native long-name fixture and strength table, home=${observed.home}, away=${observed.away}`, () => {
    let game = { ...fresh(), seed: 219 };
    if (observed.home) {
      game = renameClub(game, 64, 'ABCDEFGHIJ');
    }
    if (observed.away) {
      game = renameClub(game, 49, 'ABCDEFGHIJ');
    }
    const fixture = prepareLeagueMatch(game);
    const s = { fixture, frames: 0, game: fixture.game, paused: false };
    compare(makeScreen({ ...s, screen: 'fixture' }), observed.fixture);
    compare(makeScreen({ ...s, screen: 'team' }), observed.team);
  });
}
for (const observed of observations.seasons) {
  test(`native long-name season summary in division ${observed.division}`, () => {
    const season = completeSeason({
      ...fresh(),
      cash: seasonObservations.initial.m,
      club: (observed.division - 1) * 16 + 8,
      clubs: fresh().clubs.map(() => ({
        ink: null,
        name: 'ABCDEFGHIJ',
        width: 12
      })),
      cupFinished: true,
      division: observed.division,
      league: fresh().league.map((r, i) => ({ ...r, position: i + 1 })),
      leagueMatches: 15
    });
    compare(
      makeScreen({
        frames: 0,
        game: season.game,
        paused: false,
        screen: 'season-summary',
        season
      }),
      observed.summary
    );
  });
}
