import { expect, test } from 'bun:test';

import observations from '../sim/fixtures/names.json';
import { prepareLeagueMatch } from '../sim/league';
import { createNewGame, makeSaleOffer } from '../sim/management';
import { createNameEditor } from '../sim/name-editor';
import { decodeName, renameClub } from '../sim/names';
import { makeScreen } from './screen';

const fresh = () =>
  createNewGame({ club: 1, colour: 0, level: 1, manager: 'alex', seed: 0 });

for (const observed of observations.cases) {
  test(`name screen matches original ${observed.kind} input ${observed.input.join(',')}`, () => {
    const editor = createNameEditor(fresh());
    if (observed.kind === 'player') {
      editor.submit('n');
    }
    editor.submit('y');
    editor.submit('1');
    editor.submit(decodeName(observed.input));
    const display = makeScreen({
      frames: 0,
      game: editor.game,
      nameEditor: editor,
      paused: false,
      screen: 'names'
    });
    expect(display.lines.slice(0, 22).map(line => line.trimEnd())).toEqual(
      observed.screen.slice(0, 22)
    );
    if (editor.phase === 'fault') {
      expect(display.lines[23]!.trimEnd()).toBe(observed.screen[23]!);
      expect(display.paused).toBe(true);
    }
  });
}

test('renamed fixture clubs preserve native padding and inherited or explicit ink', () => {
  for (const observed of observations.pairs) {
    const game = renameClub(fresh(), 49, decodeName(observed.input));
    const fixture = prepareLeagueMatch(game);
    const display = makeScreen({
      fixture,
      frames: 0,
      game: fixture.game,
      paused: false,
      screen: 'fixture'
    });
    expect(display.lines[2]!.trimEnd()).toBe(observed.line);
    expect(display.cells[2 * 32 + 6]!.ink).toBe(observed.homeInk);
    expect(display.cells[2 * 32 + 19]!.ink).toBe(observed.awayInk);
  }
});

test('a renamed buyer retains its identity even when two clubs have the same name', () => {
  let game = { ...fresh(), seed: 219 };
  const original = makeSaleOffer(game, 1);
  game = renameClub(
    game,
    original.buyerId,
    String.fromCharCode(16, 4) + 'Same'
  );
  game = renameClub(game, original.buyerId === 1 ? 2 : 1, 'Same');
  const offer = makeSaleOffer(game, 1);
  const display = makeScreen({
    frames: 0,
    game: offer.game,
    offer,
    paused: false,
    screen: 'sale'
  });
  expect(display.lines[0]).toContain('Same       have offered');
  expect(display.cells[0]!.ink).toBe(4);
  expect(offer.game.seed).toBe(original.game.seed);
});
