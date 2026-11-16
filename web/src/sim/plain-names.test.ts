import { expect, test } from 'bun:test';

import reference from './fixtures/name-print.json';
import { createNewGame } from './management';
import { createNameEditor } from './name-editor';
import {
  NameRuntimeError,
  decodeName,
  renameClub,
  renamePlayer
} from './names';
import {
  clearances,
  clubSquads,
  gracePeriodWeeks,
  lastingSkill,
  latestEnhanced,
  matchInjuries,
  momentHighlights,
  opponentBonus,
  plainNames,
  presentDay,
  tiringInjuries,
  type Ruleset
} from './ruleset';

const game = (ruleset: Ruleset) =>
  createNewGame({
    club: 1,
    // Present-day clubs wear their own kits, so only the original asks.
    ...(presentDay(ruleset) ? {} : { colour: 0 }),
    level: 1,
    manager: 'alex',
    ruleset,
    seed: 219
  });

/** Text whose Spectrum bytes are `bytes`. */
const text = (...bytes: number[]) => decodeName(bytes);
const letters = (word: string) => [...word].map(c => c.charCodeAt(0));

const enhanced = game(latestEnhanced);
const original = game('original');

test('plain names join Enhanced in version 10, which new Enhanced games start with', () => {
  expect(plainNames('original')).toBe(false);
  expect(plainNames('enhanced-9')).toBe(false);
  expect(plainNames('enhanced-10')).toBe(true);
  expect(latestEnhanced).toBe('enhanced-10');
});

test('Enhanced version 10 is version 9 with plain names', () => {
  for (const accessor of [
    clearances,
    clubSquads,
    gracePeriodWeeks,
    lastingSkill,
    matchInjuries,
    momentHighlights,
    presentDay,
    tiringInjuries
  ]) {
    expect(accessor('enhanced-10')).toEqual(accessor('enhanced-9'));
  }
  for (const level of [1, 4, 7]) {
    expect(opponentBonus('enhanced-10', level)).toBe(
      opponentBonus('enhanced-9', level)
    );
  }
});

test('a club name may not carry a control code after its first letter', () => {
  // AT 23,0 would stop the original with B Integer out of range.
  const at = text(...letters('Ab'), 22, 23, 0);
  expect(() => renameClub(enhanced, 3, at)).toThrow('INVALID TEAM NAME');
  expect(() => renameClub(original, 3, at)).not.toThrow();
  for (const code of [6, 8, 13, 16, 17, 18, 19, 20, 21, 22, 23]) {
    expect(() =>
      renameClub(enhanced, 3, text(...letters('Ab'), code, 1))
    ).toThrow('INVALID TEAM NAME');
  }
});

test("a club's leading colour still sets its name colour", () => {
  const renamed = renameClub(enhanced, 3, text(16, 2, ...letters('Reds')));
  expect(renamed.clubs[2]).toMatchObject({ ink: 2, name: 'Reds' });
  expect(() =>
    renameClub(enhanced, 3, text(16, 2, ...letters('Re'), 17, 9))
  ).toThrow('INVALID TEAM NAME');
});

test('a colour without a name is refused rather than stopping the game', () => {
  expect(() => renameClub(enhanced, 3, text(16))).toThrow('INVALID TEAM NAME');
  expect(() => renameClub(enhanced, 3, text(16, 2))).toThrow(
    'INVALID TEAM NAME'
  );
  expect(() => renameClub(original, 3, text(16))).toThrow(NameRuntimeError);
  expect(() => renameClub(original, 3, text(16, 2))).toThrow(NameRuntimeError);
});

test('a player name may not carry a control code', () => {
  const ink = text(...letters('Al'), 16, 9);
  expect(() => renamePlayer(enhanced, 2, ink)).toThrow('INVALID PLAYER NAME');
  expect(() => renamePlayer(original, 2, ink)).not.toThrow();
});

test('graphics and tokens still make a name', () => {
  // A quadrant block and the token RANDOMIZE.
  const name = text(...letters('Ab'), 135, 249);
  expect(renameClub(enhanced, 3, name).clubs[2]!.name).toBe(name);
  expect(renamePlayer(enhanced, 2, name).players[1]!.name).toBe(name);
});

/** Every name captured from the original, including those that stop it. */
const captured = [
  ...reference.edits,
  ...reference.relists,
  ...reference.resultFaults.map(fault => ({ ...fault, kind: 'club' })),
  ...reference.seasonFaults.map(fault => ({ ...fault, kind: 'club' }))
];

test("no name captured from the original stops an Enhanced 10 game's editor", () => {
  // Edits the original stops on with a PRINT report.
  expect(
    reference.edits.filter(edit => [9478, 9575].includes(edit.line)).length
  ).toBeGreaterThan(0);
  for (const edit of captured) {
    const editor = createNameEditor(enhanced);
    if (edit.kind === 'player') {
      editor.submit('n');
    }
    for (const input of ['y', '1', decodeName(edit.input)]) {
      editor.submit(input);
    }
    expect(editor.phase).not.toBe('fault');
    // Listing the names again prints the accepted one.
    if (editor.phase === 'more') {
      editor.submit('y');
      expect(editor.phase).not.toBe('fault');
    }
  }
});
