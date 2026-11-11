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

test('the original adds the level itself; even-difficulty climbs in shrinking steps to 4', () => {
  const levels = [1, 2, 3, 4, 5, 6, 7];
  expect(levels.map(l => opponentBonus('original', l))).toEqual(levels);
  expect(levels.map(l => opponentBonus('even-difficulty', l))).toEqual([
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
      const even = prepareLeagueMatch(game(level, 'even-difficulty', seed));
      expect(even.game.seed).toBe(original.game.seed);
      expect(even.opponent).toBe(original.opponent);
      const gap = level - opponentBonus('even-difficulty', level);
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
      const cupEven = prepareCupMatch(cupGame('even-difficulty'));
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

test('Genius under even-difficulty fields weaker opponents than the original', () => {
  expect(geniusStrength('even-difficulty')).toBeLessThan(
    geniusStrength('original')
  );
});

test("a session's ruleset applies to the games it starts", () => {
  const session = createSession(2 ** 24 - 5, 0, 'even-difficulty');
  session.advance(5);
  session.skipPause();
  for (const text of ['alex', '1', '1', '0']) {
    submitInput(session, text);
  }
  expect(session.view.game!.ruleset).toBe('even-difficulty');
});

test('saves keep the ruleset, and saves from before rulesets play the original', () => {
  const even = game(3, 'even-difficulty');
  expect(decodeSave(encodeSave(even, 99)).game.ruleset).toBe('even-difficulty');
  expect(openSave(encodeSave(even, 99)).session.view.game!.ruleset).toBe(
    'even-difficulty'
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
    'even-difficulty'
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
