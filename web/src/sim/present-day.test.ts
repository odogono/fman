import { expect, test } from 'bun:test';

import { submitInput } from '../test/input';
import {
  clubs,
  playerNames,
  presentDayClubs,
  presentDayPlayerNames,
  type Club
} from './catalogue';
import cases from './fixtures/first-matches.json';
import { simulateHighlights } from './highlights';
import { createNewGame } from './management';
import { matchInks } from './matchday';
import { encodeClubName, nameBytes, renameClub } from './names';
import { presentDay, startingClubs, type Ruleset } from './ruleset';
import { decodeSave, encodeSave } from './save';
import { createSession } from './session';

const fresh = (ruleset: Ruleset, club = 1) =>
  createNewGame({
    club,
    ...(presentDay(ruleset) ? {} : { colour: 0 }),
    level: 1,
    manager: 'alex',
    ruleset,
    seed: 0
  });

test('only enhanced-3 onwards starts with the present-day clubs and players', () => {
  for (const ruleset of ['original', 'enhanced-1', 'enhanced-2'] as const) {
    const game = fresh(ruleset);
    expect(game.clubs.slice(1, 63)).toEqual(clubs.slice(1, 63));
    expect(game.players.map(p => p.name)).toEqual([...playerNames]);
    expect(game.colour).toBe(0);
  }
  const game = fresh('enhanced-3');
  expect(game.clubs[63]).toEqual(presentDayClubs[0]!);
  expect(game.clubs[0]).toEqual(presentDayClubs[63]!);
  expect(game.players.map(p => p.name)).toEqual([...presentDayPlayerNames]);
  expect(game.colour).toBeUndefined();
});

test('a colour is chosen exactly when the clubs have no kits of their own', () => {
  const setup = { club: 1, level: 1, manager: 'alex', seed: 0 };
  expect(() =>
    createNewGame({ ...setup, colour: 0, ruleset: 'enhanced-3' })
  ).toThrow('Invalid game setup');
  expect(() => createNewGame({ ...setup, ruleset: 'enhanced-2' })).toThrow(
    'Invalid game setup'
  );
});

test('present-day clubs fit the original screens, in four alphabetical divisions', () => {
  expect(presentDayClubs).toHaveLength(64);
  expect(new Set(presentDayClubs.map(c => c.name)).size).toBe(64);
  for (const club of presentDayClubs) {
    expect(nameBytes(club.name).length).toBeLessThanOrEqual(10);
    expect(club.ink).not.toBe(club.paper);
  }
  for (let division = 0; division < 4; division++) {
    const names = presentDayClubs
      .slice(division * 16, division * 16 + 16)
      .map(c => c.name);
    expect(names).toEqual(names.toSorted((a, b) => a.localeCompare(b)));
  }
  expect(presentDayPlayerNames).toHaveLength(24);
  for (const name of presentDayPlayerNames) {
    expect(nameBytes(name).length).toBeLessThanOrEqual(8);
  }
});

test('kits are never the grass or the pitch, and change when they clash', () => {
  for (const { kit } of presentDayClubs) {
    for (const ink of [kit!.home, kit!.change]) {
      expect([4, 6]).not.toContain(ink);
    }
    expect(kit!.change).not.toBe(kit!.home);
  }
  // Every pairing, home and away, leaves the sides on different inks.
  const game = fresh('enhanced-3');
  for (let opponent = 1; opponent <= 63; opponent++) {
    for (const home of [true, false]) {
      const inks = matchInks(game, { home, opponent });
      expect(inks.home).not.toBe(inks.away);
    }
  }
  // Arsenal (managed, slot 64) away at Liverpool: both red at home.
  const liverpool = game.clubs.findIndex(c => c.name === 'Liverpool') + 1;
  expect(matchInks(game, { home: false, opponent: liverpool })).toEqual({
    away: 7,
    home: 2
  });
  const chelsea = game.clubs.findIndex(c => c.name === 'Chelsea') + 1;
  expect(matchInks(game, { home: true, opponent: chelsea })).toEqual({
    away: 1,
    home: 2
  });
});

test('distinct kits play every recorded match exactly as black and white', () => {
  for (const game of cases) {
    const play = (homeInk: number, awayInk: number) =>
      simulateHighlights({
        awayInk,
        home: true,
        homeInk,
        opponent: game.opponentStrength,
        seed: game.highlightSeed!,
        strength: game.strength
      });
    const reference = play(0, 7);
    for (const [homeInk, awayInk] of [
      [2, 7],
      [1, 5],
      [3, 0]
    ] as const) {
      const result = play(homeInk, awayInk);
      expect(result.score).toEqual(reference.score);
      expect(result.seed).toBe(reference.seed);
      expect(result.carry).toEqual(reference.carry);
    }
  }
});

test('a new enhanced-3 game goes from the level straight to the menu', () => {
  const session = createSession(0, 0, 'enhanced-3');
  session.advance(400);
  session.skipPause();
  expect(session.view.screen).toBe('manager');
  submitInput(session, 'alex');
  const view = session.view;
  expect(view.screen === 'clubs' && view.clubs).toEqual(
    startingClubs('enhanced-3')
  );
  for (const text of ['1', '1']) {
    submitInput(session, text);
  }
  expect(session.view.screen).toBe('menu');
  expect(session.view.game!.clubs[63]!.name).toBe('Arsenal');
});

test('a renamed club keeps its kit and loses its paper', () => {
  const game = fresh('enhanced-3');
  const fulham = game.clubs.findIndex(c => c.name === 'Fulham') + 1;
  const renamed = renameClub(game, fulham, 'Cottagers');
  expect(renamed.clubs[fulham - 1]).toEqual({
    ink: null,
    kit: { change: 0, home: 7 },
    name: 'Cottagers',
    width: 12
  });
});

test('a name on its own paper hands the line back to the screen', () => {
  const fulham: Club = presentDayClubs.find(c => c.name === 'Fulham')!;
  expect(encodeClubName(fulham)).toEqual([
    17,
    0,
    16,
    7,
    ...nameBytes('Fulham    '),
    17,
    8,
    16,
    8
  ]);
});

test('an enhanced-3 game saves and loads with its kits', () => {
  const game = fresh('enhanced-3');
  expect(decodeSave(encodeSave(game, 0)).game).toEqual(game);
  const clash = {
    ...game,
    clubs: game.clubs.map((c, i) =>
      i === 0 ? { ...c, kit: { change: 2, home: 6 } } : c
    )
  };
  expect(() => decodeSave(encodeSave(clash, 0))).toThrow();
  const coloured = { ...game, colour: 0 };
  expect(() => decodeSave(encodeSave(coloured, 0))).toThrow();
});
