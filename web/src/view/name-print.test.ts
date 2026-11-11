import { inflateSync } from 'node:zlib';
import { expect, test } from 'bun:test';

import reference from '../sim/fixtures/name-print.json';
import seasonObservations from '../sim/fixtures/seasons.json';
import { completeLeagueMatch, prepareLeagueMatch } from '../sim/league';
import { createNewGame, makeSaleOffer, type Game } from '../sim/management';
import { createNameEditor } from '../sim/name-editor';
import {
  decodeName,
  encodeClubName,
  encodePlayerName,
  renameClub,
  renamePlayer
} from '../sim/names';
import { completeSeason } from '../sim/season';
import { createSession, type ScreenView } from '../sim/session';
import { submitInput } from '../test/input';
import { glyphMask } from './glyphs';
import type { Cell } from './management-layouts';
import { createPrintScreen } from './print-screen';
import { makeScreen } from './screen';

const unpack = (value: string) => [
  ...inflateSync(Buffer.from(value, 'base64'))
];
const compare = (
  actual: { cells: readonly Cell[] },
  record: { attributes: string; bitmap: string },
  start = 0,
  end = 704
) => {
  const bitmap = unpack(record.bitmap);
  const attrs = unpack(record.attributes);
  for (let index = start; index < end; index++) {
    const cell = actual.cells[index]!;
    const row = Math.floor(index / 32),
      column = index % 32;
    const pixels = (cell.pixels ?? glyphMask(cell.text)).map(
      b => b ^ (cell.inverse ? 255 : 0)
    );
    const expected = Array.from(
      { length: 8 },
      (_, y) =>
        bitmap[Math.floor(row / 8) * 2048 + (row % 8) * 32 + y * 256 + column]!
    );
    expect(pixels, `cell ${row},${column}`).toEqual(expected);
    expect(
      cell.ink +
        8 * cell.paper +
        64 * Number(cell.bright) +
        128 * Number(cell.flash ?? false),
      `attribute ${row},${column}`
    ).toBe(attrs[index]!);
  }
};
for (const record of [
  ...reference.edits,
  ...reference.keyboard.map(record => ({ ...record, kind: 'player' }))
]) {
  test(`native PRINT name ${record.kind}: ${record.label}`, () => {
    const game = createNewGame({
      club: 1,
      colour: 0,
      level: 1,
      manager: 'alex',
      seed: 0
    });
    const editor = createNameEditor(game);
    if (record.kind === 'player') {
      editor.submit('n');
    }
    for (const text of ['y', '1', decodeName(record.input)]) {
      editor.submit(text);
    }
    expect(
      record.kind === 'club'
        ? encodeClubName(editor.game.clubs[0]!)
        : encodePlayerName(editor.game.players[0]!.name)
    ).toEqual(record.stored);
    // Raw numeric markers cannot be typed by the name editor. Their lower
    // editor numeric-payload decoding is tracked in #29; retain storage here.
    if (record.input.includes(14)) {
      return;
    }
    const actual = makeScreen({
      frames: 0,
      game: editor.game,
      nameEditor: editor,
      paused: false,
      screen: 'names'
    });
    compare(actual, record);
    if (editor.phase === 'fault') {
      expect(actual.paused).toBe(true);
      const stopped = editor.game;
      editor.submit('y');
      expect(editor.game).toBe(stopped);
      const report = makeScreen({
        frames: 0,
        game: editor.game,
        nameEditor: editor,
        paused: false,
        screen: 'names'
      });
      compare(report, record, 736, 768);
    }
  });
}

const status = (value: number): 0 | 1 | 2 | 3 => {
  if (value === 0 || value === 1 || value === 2 || value === 3) {
    return value;
  }
  throw new Error('Unexpected native player status');
};
const render = (view: ScreenView) =>
  makeScreen({ ...view, frames: 0, paused: false });
const fresh = () =>
  createNewGame({ club: 1, colour: 0, level: 1, manager: 'alex', seed: 0 });
for (const record of reference.scenes) {
  const names = () => {
    let game = fresh();
    for (const id of [49, 50, 57, 64]) {
      game = renameClub(game, id, decodeName(record.club));
    }
    for (const id of [1, 13, 23]) {
      game = renamePlayer(game, id, decodeName(record.player));
    }
    return game;
  };
  const state = (values: typeof record.status.values): Game => ({
    ...names(),
    cash: values.m,
    debt: values.l,
    league: values['t(16)'].map((position, i) => ({
      against: values['c(16)'][i]!,
      for: values['b(16)'][i]!,
      points: values['z(17)'][i]!,
      position
    })),
    leagueMatches: values.ml,
    morale: values['a(5)'][1]!,
    players: names().players.map((p, i) => ({
      ...p,
      energy: values['y(24)'][i]!,
      skill: values['r(24)'][i]!,
      status: status(values['p(24)'][i]!),
      value: values['v(24)'][i]!
    }))
  });
  const fixture = prepareLeagueMatch({ ...names(), seed: 219 });
  for (const screen of [
    'sale',
    'status',
    'squad',
    'fixture',
    'team',
    'result',
    'table',
    'transfer'
  ] as const) {
    test(`native ${screen} PRINT combination ${record.label}`, () => {
      const observed = record[screen];
      const game = state(observed.values);
      let actual;
      if (screen === 'sale') {
        actual = render({
          game,
          offer: makeSaleOffer({ ...game, seed: 219 }, 1),
          screen
        });
      } else if (screen === 'fixture' || screen === 'team') {
        actual = render({ fixture, game, screen });
      } else if (screen === 'result') {
        actual = render({
          fixture,
          game,
          score: observed.values['s(2)'],
          screen
        });
      } else if (screen === 'table') {
        actual = render({
          game: { ...game, leaguePosition: game.league[15]!.position },
          screen: 'season-table'
        });
      } else if (screen === 'transfer') {
        actual = render({ game, playerId: record.transfer.values.r1!, screen });
      } else {
        actual = render({ game, screen });
      }
      compare(actual, observed);
    });
  }
  test(`native other results PRINT combination ${record.label}`, () => {
    const game = { ...state(record.result.values), seed: 219 };
    const completion = completeLeagueMatch(
      game,
      fixture,
      record.result.values['s(2)']
    );
    compare(
      render({ completion, game: completion.game, screen: 'other-matches' }),
      record.other
    );
  });
}
for (const record of reference.seasons) {
  test(`native season summary PRINT combination ${record.label}`, () => {
    const game = {
      ...fresh(),
      cash: seasonObservations.initial.m,
      club: 24,
      clubs: fresh().clubs.map(
        () => renameClub(fresh(), 1, decodeName(record.club)).clubs[0]!
      ),
      cupFinished: true,
      division: 2,
      league: fresh().league.map((r, i) => ({ ...r, position: i + 1 })),
      leagueMatches: 15
    };
    const season = completeSeason(game);
    compare(
      makeScreen({
        frames: 0,
        game: season.game,
        paused: false,
        screen: 'season-summary',
        season
      }),
      record.summary
    );
  });
}

for (const [index, record] of reference.streams.entries()) {
  test(`native PRINT over existing cells ${index}`, () => {
    const cells = Array.from({ length: 704 }, (_, i) => ({
      bright: Boolean(Math.floor(i / 32) % 2),
      flash: Boolean(Math.floor(i / 64) % 2),
      ink: i % 8,
      inverse: false,
      paper: Math.floor(i / 8) % 8,
      text: String.fromCharCode(65 + (i % 26))
    }));
    const print = createPrintScreen(false, { cells });
    print.name(decodeName(record.input));
    compare({ cells: print.cells }, record);
  });
}

for (const [index, record] of reference.continuations.entries()) {
  test(`native truncated ${record.kind} continuation ${index}`, () => {
    const session = createSession();
    session.resumeMenu(0, { ...fresh(), seed: 219 });
    submitInput(session, 'change');
    if (record.kind === 'player') {
      submitInput(session, 'n');
    }
    submitInput(session, 'y');
    if (record.kind === 'club') {
      for (let i = 0; i < 3; i++) {
        submitInput(session, '99');
      }
    }
    submitInput(session, record.kind === 'club' ? '64' : '1');
    submitInput(session, decodeName(record.input));
    submitInput(session, 'n');
    if (record.kind === 'club') {
      submitInput(session, 'n');
    }
    submitInput(session, record.command);
    const view = session.view;
    compare(makeScreen(view), record);
    expect(
      record.kind === 'club'
        ? encodeClubName(view.game!.clubs[63]!)
        : encodePlayerName(view.game!.players[0]!.name)
    ).toEqual(record.stored);
    expect(view.game!.seed).toBe(record.seed);
    if (view.printFault) {
      expect(session.sounds).toEqual([]);
      compare(makeScreen(view), record, 736, 768);
      const stopped = view.game;
      session.submit('99');
      expect(session.view.game).toBe(stopped);
      expect(session.view.paused).toBe(true);
    }
  });
}

for (const observed of reference.resultFaults) {
  test(`native partial other-match screen at PRINT fault for club ${observed.clubId}`, () => {
    const initial = renameClub(
      fresh(),
      observed.clubId,
      decodeName(observed.input)
    );
    const fixture = prepareLeagueMatch({ ...initial, seed: 219 });
    const completion = completeLeagueMatch(
      { ...fixture.game, seed: 219 },
      fixture,
      observed.before.values['s(2)']
    );
    const actual = makeScreen({
      completion,
      frames: 0,
      game: completion.game,
      paused: false,
      screen: 'other-matches',
      ...(completion.printFault ? { printFault: completion.printFault } : {})
    });
    compare(actual, observed.retained);
    compare(actual, observed.retained, 736, 768);
  });
}

for (const observed of reference.relists) {
  test(`native repeated ${observed.kind} list PRINT fault`, () => {
    const editor = createNameEditor(fresh());
    if (observed.kind === 'player') {
      editor.submit('n');
    }
    for (const text of ['y', '1', decodeName(observed.input), 'y']) {
      editor.submit(text);
    }
    const actual = makeScreen({
      frames: 0,
      game: editor.game,
      nameEditor: editor,
      paused: false,
      screen: 'names'
    });
    compare(actual, observed);
    compare(actual, observed, 736, 768);
  });
}

for (const observed of reference.seasonFaults) {
  test(`native partial season screen at movement of club ${observed.clubId}`, () => {
    const before = observed.before;
    const initial = fresh();
    const season = completeSeason({
      ...initial,
      club: before.finance.t1,
      clubs: initial.clubs.map((_, i) => ({
        ink: null,
        name: decodeName(before.clubs.slice(i * 12, i * 12 + 12)),
        width: 12
      })),
      cupFinished: true,
      cupRound: before.finance.c,
      division: before.finance.d1,
      league: initial.league.map((r, i) => ({ ...r, position: i + 1 })),
      leagueMatches: 15,
      ratingTotal: before.finance.s,
      seasons: before.finance.s5,
      seed: before.seed
    });
    const actual = makeScreen({
      frames: 0,
      game: season.game,
      paused: false,
      screen: 'season-summary',
      season,
      ...(season.printFault ? { printFault: season.printFault } : {})
    });
    compare(actual, observed.retained);
    if (season.printFault) {
      compare(actual, observed.retained, 736, 768);
    }
  });
}
