import { expect, test } from 'bun:test';

import reference from './fixtures/name-print.json';
import { completeLeagueMatch, prepareLeagueMatch } from './league';
import { createNewGame, type Game } from './management';
import { createNameEditor } from './name-editor';
import { decodeName, encodeClubName, renameClub } from './names';
import { completeSeason } from './season';

const fresh = () =>
  createNewGame({ club: 1, colour: 0, level: 1, manager: 'alex', seed: 0 });
type Values = (typeof reference.resultFaults)[number]['before']['values'];
const state = (values: Values, base: Game): Game => ({
  ...base,
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
  players: base.players.map((p, i) => {
    const status = values['p(24)'][i]!;
    if (status !== 0 && status !== 1 && status !== 2 && status !== 3) {
      throw new Error('Invalid native status');
    }
    return {
      ...p,
      energy: values['y(24)'][i]!,
      skill: values['r(24)'][i]!,
      status,
      value: values['v(24)'][i]!
    };
  })
});

const compareState = (
  game: Game,
  observed: (typeof reference.resultFaults)[number]['retained']
) => {
  const expected = state(observed.values, game);
  expect(game.cash).toBe(expected.cash);
  expect(game.debt).toBe(expected.debt);
  expect(game.morale).toBe(expected.morale);
  expect(game.leagueMatches).toBe(expected.leagueMatches);
  expect(game.league).toEqual(expected.league);
  expect(game.players).toEqual(expected.players);
  expect(game.clubs.flatMap(encodeClubName)).toEqual(observed.clubs);
  expect(game.seed).toBe(observed.seed);
  expect(game.homeGate).toBe(observed.finance.g);
  expect(game.previousNet).toBe(observed.finance.xp);
  expect(game.leaguePosition).toBe(
    observed.values['t(16)'][game.club - (game.division - 1) * 16 - 1]!
  );
};

for (const observed of reference.resultFaults) {
  test(`native other-match PRINT fault retains partial records for club ${observed.clubId}`, () => {
    const base = renameClub(
      fresh(),
      observed.clubId,
      decodeName(observed.input)
    );
    const fixture = prepareLeagueMatch({ ...base, seed: 219 });
    const completion = completeLeagueMatch(
      // The completion API credits the gate; BASIC has already credited it
      // by the continuation prompt captured before the other matches.
      {
        ...state(observed.before.values, fixture.game),
        cash: observed.before.values.m - fixture.gate,
        seed: 219
      },
      fixture,
      observed.before.values['s(2)']
    );
    expect(completion.printFault).toBe('B Integer out of range, 7630:1');
    expect(completion.bills).toBeUndefined();
    compareState(completion.game, observed.retained);
  });
}

for (const observed of reference.relists) {
  test(`repeated ${observed.kind} list stops without undoing the accepted name`, () => {
    const editor = createNameEditor(fresh());
    if (observed.kind === 'player') {
      editor.submit('n');
    }
    for (const text of ['y', '1', decodeName(observed.input)]) {
      editor.submit(text);
    }
    expect(editor.phase).toBe('more');
    const retained = editor.game;
    editor.submit('y');
    expect(editor.phase).toBe('fault');
    expect(editor.error).toBe(`B Integer out of range, ${observed.line}:2`);
    editor.submit('99');
    expect(editor.game).toBe(retained);
    expect(editor.done).toBe(false);
  });
}

for (const observed of reference.seasonFaults) {
  test(`native season PRINT retains mutations before movement of club ${observed.clubId}`, () => {
    const before = observed.before;
    const initial = state(before.values, fresh());
    const game = {
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
      homeGate: before.finance.g,
      leaguePosition:
        before.values['t(16)'][
          before.finance.t1 - (before.finance.d1 - 1) * 16 - 1
        ]!,
      previousNet: before.finance.xp,
      ratingTotal: before.finance.s,
      scheduleCounter: before.finance.ma,
      seasons: before.finance.s5,
      seed: before.seed
    };
    const completion = completeSeason(game);
    const after = observed.retained;
    if (after.line === 1030) {
      expect(completion.printFault).toBeUndefined();
    } else {
      expect(completion.printFault).toBe(
        `B Integer out of range, ${after.line}:1`
      );
      expect(completion.game.cupFinished).toBe(true);
      expect(completion.game.scheduleCounter).toBe(game.scheduleCounter);
    }
    compareState(completion.game, after);
    expect(completion.game.ratingTotal).toBe(after.finance.s);
    expect(completion.game.seasons).toBe(after.finance.s5);
    expect(completion.game.club).toBe(after.finance.t1);
    expect(completion.game.division).toBe(after.finance.d1);
    expect(completion.game.cupRound).toBe(after.finance.c);
  });
}
