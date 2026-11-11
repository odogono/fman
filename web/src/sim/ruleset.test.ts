import { expect, test } from 'bun:test';

import { submitInput } from '../test/input';
import { prepareCupMatch } from './cup';
import { createJournal, openSave } from './journal';
import { prepareLeagueMatch } from './league';
import { createNewGame } from './management';
import { opponentBonus, type Ruleset } from './ruleset';
import { decodeSave, encodeSave } from './save';
import { createSession } from './session';

const game = (level: number, ruleset: Ruleset, seed = 219) =>
  createNewGame({ club: 1, colour: 0, level, manager: 'alex', ruleset, seed });

test('the original adds the level itself; Enhanced climbs in shrinking steps to 4', () => {
  const levels = [1, 2, 3, 4, 5, 6, 7];
  expect(levels.map(l => opponentBonus('original', l))).toEqual(levels);
  expect(levels.map(l => opponentBonus('enhanced-1', l))).toEqual([
    1, 2, 2.75, 3, 3.5, 3.75, 4
  ]);
});

test('a new game plays the original ruleset unless told otherwise', () => {
  const { ruleset: _, ...setup } = {
    club: 1,
    colour: 0,
    level: 1,
    manager: 'alex',
    ruleset: undefined,
    seed: 219
  };
  expect(createNewGame(setup).ruleset).toBe('original');
  expect(() => game(1, 'harder' as Ruleset)).toThrow(RangeError);
});

test('rulesets draw the same numbers and differ only in opponent strength', () => {
  for (let seed = 0; seed < 200; seed++) {
    for (const level of [1, 4, 7]) {
      const original = prepareLeagueMatch(game(level, 'original', seed));
      const even = prepareLeagueMatch(game(level, 'enhanced-1', seed));
      expect(even.game.seed).toBe(original.game.seed);
      expect(even.opponent).toBe(original.opponent);
      const gap = level - opponentBonus('enhanced-1', level);
      even.opponentStrength.forEach((strength, i) => {
        const before = original.opponentStrength[i]!;
        expect(strength).toBeLessThanOrEqual(before);
        expect(strength).toBeGreaterThanOrEqual(
          Math.max(1, before - Math.ceil(gap))
        );
      });
      if (level === 1) {
        expect(even.opponentStrength).toEqual(original.opponentStrength);
      }

      const cupGame = (ruleset: Ruleset) => ({
        ...game(level, ruleset, seed),
        scheduleCounter: 2
      });
      const cupOriginal = prepareCupMatch(cupGame('original'));
      const cupEven = prepareCupMatch(cupGame('enhanced-1'));
      expect(cupEven.game.seed).toBe(cupOriginal.game.seed);
      expect(cupEven.opponent).toBe(cupOriginal.opponent);
      expect(cupEven.home).toBe(cupOriginal.home);
      if (level === 1) {
        expect(cupEven.opponentStrength).toEqual(cupOriginal.opponentStrength);
      }
    }
  }
});

const geniusStrength = (ruleset: Ruleset) => {
  let sum = 0;
  for (let seed = 0; seed < 200; seed++) {
    sum += prepareLeagueMatch(game(7, ruleset, seed)).opponentStrength.reduce(
      (a, b) => a + b
    );
  }
  return sum;
};

test('Genius under Enhanced rules fields weaker opponents than the original', () => {
  expect(geniusStrength('enhanced-1')).toBeLessThan(geniusStrength('original'));
});

test("a session's ruleset applies to the games it starts", () => {
  const session = createSession(2 ** 24 - 5, 0, 'enhanced-1');
  session.advance(5);
  session.skipPause();
  for (const text of ['alex', '1', '1', '0']) {
    submitInput(session, text);
  }
  expect(session.view.game!.ruleset).toBe('enhanced-1');
});

const setUp = (session: ReturnType<typeof createSession>) => {
  session.advance(400);
  session.skipPause();
  for (const text of ['alex', '1', '1', '0']) {
    submitInput(session, text);
  }
};

test("the original's NEW restarts under the rules of the game it clears", () => {
  // The session would start Original games; the resumed game is Enhanced.
  const session = createSession();
  session.resumeMenu(99, game(3, 'enhanced-1'));
  expect(session.ruleset).toBe('enhanced-1');
  expect(session.saved()).toBe(true);
  submitInput(session, 'n');
  expect(session.view.screen).toBe('cleared');
  expect(session.ruleset).toBe('enhanced-1');
  expect(session.reload()).toBe(true);
  setUp(session);
  expect(session.view.game!.ruleset).toBe('enhanced-1');
});

test('a journal started at the title keeps the chosen rules through a save', () => {
  const journal = createJournal({ kind: 'title', ruleset: 'enhanced-1' });
  journal.advance(100);
  const snapshot = JSON.parse(journal.snapshot());
  expect(snapshot.version).toBe(7);
  expect(snapshot.base).toEqual({ kind: 'title', ruleset: 'enhanced-1' });
  const restored = openSave(journal.snapshot());
  expect(restored.session.ruleset).toBe('enhanced-1');
  setUp(restored.session);
  expect(restored.session.view.game!.ruleset).toBe('enhanced-1');

  // Before rule choice, a title-screen journal named no rules: Original.
  for (const version of [4, 5, 6]) {
    const older = { ...snapshot, base: { kind: 'title' }, version };
    expect(openSave(JSON.stringify(older)).session.ruleset).toBe('original');
  }
  for (const invalid of [
    { ...snapshot, base: { kind: 'title' } },
    { ...snapshot, base: { kind: 'title', ruleset: 'harder' } },
    { ...snapshot, version: 6 }
  ]) {
    expect(() => openSave(JSON.stringify(invalid))).toThrow(RangeError);
  }
});

test('saves keep the ruleset, and saves from before rulesets play the original', () => {
  const even = game(3, 'enhanced-1');
  expect(decodeSave(encodeSave(even, 99)).game.ruleset).toBe('enhanced-1');
  expect(openSave(encodeSave(even, 99)).session.view.game!.ruleset).toBe(
    'enhanced-1'
  );

  const kept = JSON.parse(encodeSave(even, 99));
  const { ruleset: _, ...legacyGame } = kept.game;
  const legacy = { ...kept, game: legacyGame, version: 1 };
  expect(decodeSave(JSON.stringify(legacy)).game.ruleset).toBe('original');
  expect(openSave(JSON.stringify(legacy)).session.view.game!.ruleset).toBe(
    'original'
  );
  for (const invalid of [
    { ...kept, game: legacyGame },
    { ...legacy, game: kept.game },
    { ...kept, game: { ...kept.game, ruleset: 'harder' } }
  ]) {
    expect(() => decodeSave(JSON.stringify(invalid))).toThrow(RangeError);
  }

  const journal = createJournal({ frames: 99, game: even, kind: 'menu' });
  const snapshot = JSON.parse(journal.snapshot());
  expect(openSave(journal.snapshot()).session.view.game!.ruleset).toBe(
    'enhanced-1'
  );
  const { ruleset: __, ...journalGame } = snapshot.base.game;
  const older = { ...snapshot, base: { ...snapshot.base, game: journalGame } };
  for (const version of [4, 5]) {
    expect(
      openSave(JSON.stringify({ ...older, version })).session.view.game!.ruleset
    ).toBe('original');
    expect(() => openSave(JSON.stringify({ ...snapshot, version }))).toThrow(
      RangeError
    );
  }
  expect(() => openSave(JSON.stringify(older))).toThrow(RangeError);
});
