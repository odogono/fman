import { expect, test } from 'bun:test';

import observations from './fixtures/names.json';
import { createNewGame } from './management';
import {
  NameRuntimeError,
  decodeName,
  encodeClubName,
  encodePlayerName,
  renameClub,
  renamePlayer
} from './names';

for (const observed of observations.cases) {
  test(`original ${observed.kind} edit bytes ${observed.input.join(',')}`, () => {
    const game = {
      ...createNewGame({
        club: 1,
        colour: 0,
        level: 1,
        manager: 'alex',
        seed: 0
      }),
      seed: 219
    };
    const change = () =>
      observed.kind === 'club'
        ? renameClub(game, 1, decodeName(observed.input))
        : renamePlayer(game, 1, decodeName(observed.input));
    const accepted = observed.line === 9479 || observed.line === 9580;
    if (accepted || observed.input.length === 0) {
      const edited = change();
      expect(
        observed.kind === 'club'
          ? encodeClubName(edited.clubs[0]!)
          : encodePlayerName(edited.players[0]!.name)
      ).toEqual(observed.stored);
      expect(edited.seed).toBe(observed.seed);
      expect(edited.cash).toBe(game.cash);
    } else if (observed.line === 9472 || observed.line === 9473) {
      expect(change).toThrow(NameRuntimeError);
      try {
        change();
      } catch (error) {
        expect((error as Error).message).toBe(observed.screen[23]!);
      }
    } else {
      const error = observed.screen.find(
        row => row.includes('INVALID') || row.includes('TOO LONG')
      )!;
      try {
        change();
        throw new Error('Expected refusal');
      } catch (error_) {
        expect(error).toContain((error_ as Error).message);
      }
    }
  });
}

test('fixed-width names retain non-space trailing bytes', () => {
  const game = createNewGame({
    club: 1,
    colour: 0,
    level: 1,
    manager: 'alex',
    seed: 0
  });
  const edited = renamePlayer(renameClub(game, 1, 'Town\t'), 1, 'Name\t');
  expect(encodeClubName(edited.clubs[0]!)).toEqual([
    84, 111, 119, 110, 9, 32, 32, 32, 32, 32, 32, 32
  ]);
  expect(encodePlayerName(edited.players[0]!.name)).toEqual([
    78, 97, 109, 101, 9, 32, 32, 32
  ]);
});
