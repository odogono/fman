import { expect, test } from 'bun:test';

import { createJournal } from '../sim/journal';
import { latestEnhanced } from '../sim/ruleset';
import type { View } from '../sim/session';
import { submitInput } from '../test/input';
import { modernScreenFor } from './modern-screen';
import { namesFor, renameAnswer } from './name-screens';

/** A new Enhanced game at the menu, then `inputs` into the name editor. */
const names = (...inputs: string[]): View => {
  const journal = createJournal({ kind: 'title', ruleset: latestEnhanced });
  journal.advance(137);
  journal.skipPause();
  for (const text of ['alex', '1', '1', 'change', ...inputs]) {
    submitInput(journal, text);
  }
  return journal.session.view;
};

test('each phase of name editing shows the Modern screen', () => {
  for (const view of [
    names(),
    names('y'),
    names('y', '3'),
    names('y', '3', 'Reds'),
    names('n'),
    names('n', 'y'),
    names('n', 'y', '2')
  ]) {
    expect(view.screen).toBe('names');
    expect(modernScreenFor(view)?.kind).toBe('names');
  }
});

test('the questions offer Change and Skip, then Rename another and Done', () => {
  expect(namesFor(names())).toEqual({
    kind: 'question',
    no: { id: 'names.no', label: 'Skip' },
    text: 'Change club names?',
    yes: { id: 'names.yes', label: 'Change' }
  });
  expect(namesFor(names('n'))).toMatchObject({ text: 'Change player names?' });
  expect(namesFor(names('y', '3', 'Reds'))).toEqual({
    kind: 'question',
    no: { id: 'names.no', label: 'Done' },
    text: 'Any more changes?',
    yes: { id: 'names.yes', label: 'Rename another' }
  });
});

test('the club list is one division a page, the players eight a page', () => {
  const clubs = namesFor(names('y'));
  if (clubs?.kind !== 'list') {
    throw new Error('No list');
  }
  expect(clubs.title).toBe('Division 1');
  expect(clubs.entries).toHaveLength(16);
  expect(clubs.entries[2]).toMatchObject({ id: 'names.club.3' });
  expect(clubs.next).toEqual({
    id: 'names.next-page',
    label: 'Next: Division 2'
  });
  const players = namesFor(names('n', 'y'));
  if (players?.kind !== 'list') {
    throw new Error('No list');
  }
  expect(players.entries).toHaveLength(8);
  expect(players.entries[0]).toMatchObject({ id: 'names.player.1' });
  expect(players.title).toBe('Players 1–8');
  expect(players.next.label).toBe('Next: Players 9–16');
});

test("renaming a club offers its colours, starting on the club's own", () => {
  const view = names('y', '3');
  const screen = namesFor(view);
  if (screen?.kind !== 'rename' || view.screen !== 'names') {
    throw new Error('No rename');
  }
  const club = view.game.clubs[2]!;
  expect(screen.target).toBe('club');
  expect(screen.current.name).toBe(club.name.trim());
  expect(screen.colour).toBe(club.ink ?? 'plain');
  expect(screen.colours).toEqual([
    { ink: 0, name: 'Black' },
    { ink: 1, name: 'Blue' },
    { ink: 2, name: 'Red' },
    { ink: 3, name: 'Magenta' },
    { ink: 4, name: 'Green' }
  ]);
  expect(screen.maxLength).toEqual({ coloured: 10, plain: 12 });
  expect(screen.loses).toBe(club.paper !== undefined);
});

test('renaming a player takes eight characters, without colours', () => {
  const screen = namesFor(names('n', 'y', '2'));
  if (screen?.kind !== 'rename') {
    throw new Error('No rename');
  }
  expect(screen.target).toBe('player');
  expect(screen.colours).toEqual([]);
  expect(screen.maxLength).toEqual({ coloured: 8, plain: 8 });
});

test("an invalid name keeps the screen, with the original's message", () => {
  const screen = namesFor(names('y', '3', '1abc'));
  expect(screen).toMatchObject({ error: 'INVALID TEAM NAME', kind: 'rename' });
});

test('a colour prefix and the name make the original answer', () => {
  expect(renameAnswer('Reds', 2)).toBe(`${String.fromCharCode(16, 2)}Reds`);
  const view = names('y', '3', renameAnswer('Reds', 2));
  if (view.screen !== 'names') {
    throw new Error('Not names');
  }
  expect(view.game.clubs[2]).toMatchObject({ ink: 2, name: 'Reds' });
});

test('a plain name is the answer by itself, leaving no ink', () => {
  expect(renameAnswer('Reds', 'plain')).toBe('Reds');
  const view = names('y', '3', renameAnswer('Reds', 'plain'));
  if (view.screen !== 'names') {
    throw new Error('Not names');
  }
  expect(view.game.clubs[2]).toMatchObject({ ink: null, name: 'Reds' });
});
