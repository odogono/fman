import { expect, test } from 'bun:test';

import { createNewGame, startingDivision, type Game } from './management';
import { renameClub } from './names';
import { decodeSave, encodeSave, originSaveVersion } from './save';
import { completeSeason } from './season';

// Each club keeps its place in the catalogue all game (#273), which picks
// its ground, and the division it began in sizes the ground's stands.

const fresh = (club = 6) =>
  createNewGame({ club, colour: 0, level: 1, manager: 'alex', seed: 219 });

/** A season the managed club won, so it went up, and others went down. */
const promoted = (game: Game) =>
  completeSeason({
    ...game,
    cupFinished: true,
    cupRound: 8,
    leagueMatches: 15,
    leaguePosition: 1
  }).game;

const origins = (game: Game) => game.clubs.map(club => club.origin);

test("a new game's clubs keep their places in the catalogue, the managed club's swapped into the 64th place", () => {
  const game = fresh(6);
  expect(game.clubs[63]!.origin).toBe(6);
  expect(game.clubs[5]!.origin).toBe(64);
  expect(new Set(origins(game)).size).toBe(64);
  expect(
    game.clubs.every((club, i) => i === 5 || i === 63 || club.origin === i + 1)
  ).toBe(true);
});

const byOrigin = (g: Game) =>
  new Map(g.clubs.map(club => [club.origin, club.name]));

test('a club keeps its place in the catalogue as it changes division and name', () => {
  const game = fresh(6);
  const season = promoted(game);
  const next = renameClub(season, 1, 'Greens');
  expect(next.club).not.toBe(game.club);
  const before = byOrigin(game);
  const after = byOrigin(next);
  for (const [origin, name] of after) {
    if (name !== 'Greens') {
      expect(name).toBe(before.get(origin)!);
    }
  }
  expect(next.clubs[0]!.origin).toBe(season.clubs[0]!.origin);
});

const started = (g: Game, origin: number) =>
  startingDivision(g, g.clubs.findIndex(c => c.origin === origin) + 1);

test('each club is shown in the division it began the game in', () => {
  const game = fresh(6);
  for (const g of [game, promoted(game), promoted(promoted(game))]) {
    // The managed club began in the Fourth, and the club it swapped with in
    // the First, where the managed club's place was.
    expect(started(g, 6)).toBe(4);
    expect(started(g, 64)).toBe(1);
    expect(started(g, 1)).toBe(1);
    expect(started(g, 20)).toBe(2);
    expect(started(g, 40)).toBe(3);
    expect(started(g, 63)).toBe(4);
  }
});

test('a save from before the places loads with each club at the place it holds', () => {
  const game = promoted(fresh(6));
  const saved = JSON.parse(encodeSave(game, 0));
  const old = {
    ...saved,
    game: {
      ...saved.game,
      clubs: saved.game.clubs.map(
        ({ origin: _, ...club }: Record<string, unknown>) => club
      )
    },
    version: originSaveVersion - 1
  };
  const loaded = decodeSave(JSON.stringify(old)).game;
  expect(origins(loaded)).toEqual(Array.from({ length: 64 }, (_, i) => i + 1));
  expect(() =>
    decodeSave(JSON.stringify({ ...old, version: originSaveVersion }))
  ).toThrow(RangeError);
});

test('a save whose clubs share a place is rejected', () => {
  const saved = JSON.parse(encodeSave(fresh(), 0));
  const clubs = saved.game.clubs.map(
    (club: Record<string, unknown>, i: number) =>
      i === 1 ? { ...club, origin: 1 } : club
  );
  expect(() =>
    decodeSave(JSON.stringify({ ...saved, game: { ...saved.game, clubs } }))
  ).toThrow(RangeError);
});
