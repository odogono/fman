import { expect, test } from 'bun:test';

import { createSession } from '../sim/session';
import { makeScreen } from './screen';

const session = () => {
  const game = createSession(2 ** 24 - 5);
  game.advance(5);
  game.skipPause();
  for (const input of ['alex', '1', '1', '0']) {
    game.submit(input);
  }
  return game;
};

test('renders the original menu in 32 columns with the copy prompt on row 21', () => {
  const screen = makeScreen(session().view);
  expect(screen.lines).toHaveLength(22);
  expect(screen.lines.every(line => line.length === 32)).toBe(true);
  expect(screen.lines[0]).toBe('TO -            TYPE -          ');
  expect(screen.lines[19]?.trim()).toBe('OR type 99 to continue');
  expect(screen.lines[21]?.trim()).toBe('(h=copy)');
});

test('status and squad render actual game state and preserve the player columns', () => {
  const game = session();
  game.submit('s');
  expect(makeScreen(game.view).lines.join('\n')).toContain("You've £100000");
  expect(makeScreen(game.view).lines[0]).toContain('Arsenal');
  game.submit('');
  game.submit('a');
  const screen = makeScreen(game.view);
  expect(screen.lines[1]).toContain('SKILL ENERGY VALUE');
  expect(screen.lines[2]?.slice(2, 10)).toBe('P.Parkes');
  expect(screen.lines[2]?.[15]).toBe('3');
  expect(screen.lines.join('\n')).toContain('PLAYERS PICKED=11');
});

test('difficulty names retain the original PAPER 9 contrast, including white Genius', () => {
  const game = createSession(2 ** 24 - 5);
  game.advance(5);
  game.skipPause();
  game.submit('alex');
  game.submit('1');
  const display = makeScreen(game.view);
  expect(display.cells[6 * 32 + 16]?.ink).toBe(7);
  expect(display.cells[6 * 32 + 16]?.paper).toBe(0);
  expect(display.cells[0 * 32 + 16]?.paper).toBe(7);
  expect(display.cells[6 * 32 + 31]?.paper).toBe(0);
});

test('saving asks the original continuation question and declining shows NEW', () => {
  const game = session();
  game.submit('keep');
  game.saved();
  const screen = makeScreen(game.view);
  expect(screen.prompt).toBe('Do you want to play some more?');
  expect(screen.label).toBe('Continue playing, y or n');
  expect(screen.paused).toBe(false);
  game.submit('h');
  expect(makeScreen(game.view).lines[23]).toContain(
    '© 1982 Sinclair Research Ltd'
  );
});

test('a skill level change prints the new level under its heading', () => {
  const game = session();
  game.submit('level');
  game.submit('3');
  const view = game.view;
  expect(view).toMatchObject({
    message: { kind: 'skill-level', level: 3 },
    screen: 'message'
  });
  const screen = makeScreen(view);
  expect(screen.lines[0]?.trim()).toBe('Your new skill level is -');
  expect(screen.lines[1]).toContain('Level 3');
});

test('a view carries only its own screen data', () => {
  const game = session().view.game!;
  const still = { frames: 0, game, paused: false };
  makeScreen({ ...still, screen: 'menu' });
  // @ts-expect-error: a sale offer belongs to the sale screen
  makeScreen({ ...still, offer: undefined, screen: 'menu' });
});
