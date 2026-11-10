import { expect, test } from 'bun:test';

import { prepareCupMatch } from './cup';
import { createNewGame } from './management';
import { renameClub, renamePlayer } from './names';
import { decodeSave, encodeSave } from './save';
import { completeSeason } from './season';
import { createSession } from './session';
import { viewOn } from './view-on';

const fresh = () =>
  createNewGame({ club: 1, colour: 0, level: 1, manager: 'alex', seed: 219 });
const setup = () => {
  const s = createSession(2 ** 24 - 5);
  s.advance(5);
  s.skipPause();
  for (const text of ['alex', '1', '1', '0']) {
    s.submit(text);
  }
  return s;
};

test('versioned save round-trips edited names, season state and highlight carry', () => {
  const game = renamePlayer(
    renameClub(
      completeSeason({
        ...fresh(),
        cupFinished: true,
        cupRound: 8,
        leagueMatches: 15,
        leaguePosition: 1
      }).game,
      1,
      String.fromCharCode(16, 4) + 'Greens'
    ),
    22,
    'R.New'
  );
  const carried = {
    ...game,
    attackCarry: {
      attackers: [
        { x: 4, y: 8 },
        { x: 5, y: 9 },
        { x: 6, y: 10 }
      ],
      defenders: game.attackCarry.defenders
    }
  };
  expect(decodeSave(encodeSave(carried, 16_777_215))).toEqual({
    frames: 16_777_215,
    game: carried
  });
});

test('invalid saves are rejected before a live session changes', () => {
  const s = setup();
  const before = s.view.game;
  const baseline = JSON.parse(encodeSave(fresh(), 350));
  for (const text of [
    'broken',
    'null',
    '{}',
    JSON.stringify({ ...baseline, version: 2 }),
    JSON.stringify({ ...baseline, frames: -1 }),
    JSON.stringify({ ...baseline, game: { ...baseline.game, players: [] } }),
    JSON.stringify({
      ...baseline,
      game: { ...baseline.game, clubs: Array(64).fill({ ink: 99, name: 'X' }) }
    }),
    JSON.stringify({ ...baseline, game: { ...baseline.game, division: 0 } }),
    ' '.repeat(100_001)
  ]) {
    expect(() => s.load(text)).toThrow();
    expect(s.view.game).toBe(before);
    expect(s.view.screen).toBe('menu');
  }
});

test('saving waits for download acknowledgement; continuation and load share line 100', () => {
  const s = setup();
  const before = s.view.game;
  const effect = s.submit('KEEP');
  expect(effect?.type).toBe('save');
  if (effect?.type !== 'save') {
    throw new Error('Expected save');
  }
  expect(decodeSave(effect.data).game).toEqual(before!);
  expect(s.view.screen).toBe('menu');
  expect(s.view.game).toBe(before);
  expect(s.saved()).toBe(true);
  s.advance(37);
  s.submit('YES');
  expect(s.view.screen).toBe('menu');
  expect(s.view.game!.seed).toBe(s.view.frames & 65_535);
  const loaded = createSession();
  loaded.load(encodeSave(before!, s.view.frames));
  expect(loaded.view.game).toEqual(s.view.game);
  for (const text of ['99', '', '99']) {
    s.submit(text);
    loaded.submit(text);
  }
  s.advance(1_000_000);
  loaded.advance(1_000_000);
  expect(viewOn(loaded, 'result').score).toEqual(viewOn(s, 'result').score);
  expect(loaded.view.game).toEqual(s.view.game);
});

for (const answer of ['n', '', 'Yes', 'h', 'H']) {
  test(`save continuation ${JSON.stringify(answer)} runs NEW`, () => {
    const s = setup();
    s.submit('keep');
    s.saved();
    s.submit(answer);
    expect(s.view.screen).toBe('cleared');
    expect(s.view.game).toBeUndefined();
  });
}

test('a save can be loaded after clearing and replaces transient match state', () => {
  const s = setup();
  const data = encodeSave(s.view.game!, 999);
  s.submit('99');
  s.submit('');
  s.submit('99');
  s.load(data);
  expect(s.view.screen).toBe('menu');
  expect(Object.keys(s.view).sort()).toEqual([
    'frames',
    'game',
    'paused',
    'screen'
  ]);
  s.submit('keep');
  s.saved();
  s.submit('n');
  s.load(data);
  expect(s.view.game!.seed).toBe(999);
  expect(s.view.frames).toBe(999);
  expect(s.view.paused).toBe(false);
});

test('a midseason cup campaign and league table produce the same next fixture after decoding', () => {
  const game = {
    ...fresh(),
    cupRound: 3,
    league: fresh().league.map((row, i) => ({
      ...row,
      against: i,
      for: i + 2,
      points: i,
      position: i + 1
    })),
    leagueHome: true,
    leagueMatches: 7,
    leaguePosition: 6,
    scheduleCounter: 11
  };
  const loaded = decodeSave(encodeSave(game, 300)).game;
  expect(loaded).toEqual(game);
  expect(prepareCupMatch(loaded)).toEqual(prepareCupMatch(game));
});

for (const answer of ['y', 'Y', 'yes', 'YES']) {
  test(`save continuation ${answer} resumes with a frame-based seed`, () => {
    const s = setup();
    s.submit('keep');
    s.saved();
    s.advance(65_540);
    s.submit(answer);
    expect(s.view.screen).toBe('menu');
    expect(s.view.game!.seed).toBe(s.view.frames & 65_535);
  });
}

test('save validation rejects unknown nested data and malformed carry or player records', () => {
  const baseline = JSON.parse(encodeSave(fresh(), 300));
  for (const change of [
    (v: typeof baseline) => {
      v.game.players[0].extra = { nested: 'unexpected' };
    },
    (v: typeof baseline) => {
      v.game.attackCarry.defenders[0].x = null;
    },
    (v: typeof baseline) => {
      v.game.players[1].id = 1;
    },
    (v: typeof baseline) => {
      v.game.league[0].points = '1';
    },
    (v: typeof baseline) => {
      v.game.seed = 65_536;
    }
  ]) {
    const value = structuredClone(baseline);
    change(value);
    expect(() => decodeSave(JSON.stringify(value))).toThrow();
  }
});
