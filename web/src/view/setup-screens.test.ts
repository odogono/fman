import { expect, test } from 'bun:test';

import { levels } from '../sim/catalogue';
import { createJournal } from '../sim/journal';
import { latestEnhanced, type Ruleset } from '../sim/ruleset';
import type { View } from '../sim/session';
import { submitInput } from '../test/input';
import { modernScreenFor } from './modern-screen';
import { setupFor } from './setup-screens';

/** A new game under `ruleset` after `inputs`, from the manager's name. */
const after = (ruleset: Ruleset, ...inputs: string[]): View => {
  const journal = createJournal({ kind: 'title', ruleset });
  journal.advance(137);
  journal.skipPause();
  for (const text of inputs) {
    submitInput(journal, text);
  }
  return journal.session.view;
};

const enhanced = (...inputs: string[]) => after(latestEnhanced, ...inputs);

/** After a save from the menu, once the save is written. */
const afterSave = () => {
  const journal = createJournal({ kind: 'title', ruleset: latestEnhanced });
  journal.advance(137);
  journal.skipPause();
  for (const text of ['alex', '1', '1', 'keep']) {
    submitInput(journal, text);
  }
  journal.saved();
  return journal.session.view;
};

test('each setup screen shows the Modern setup screen', () => {
  for (const view of [
    enhanced(),
    enhanced('alex'),
    enhanced('alex', '1'),
    after('original', 'alex', '1', '1'),
    enhanced('alex', '1', '1', 'level'),
    afterSave()
  ]) {
    expect(modernScreenFor(view)?.kind).toBe('setup');
  }
});

test('the manager types a name of up to 20 characters', () => {
  expect(setupFor(enhanced())).toEqual({ kind: 'manager', maxLength: 20 });
});

test('the clubs show a division at a time, with the next division a tap away', () => {
  const first = setupFor(enhanced('alex'));
  if (first?.kind !== 'clubs') {
    throw new Error('No clubs');
  }
  expect(first.division).toBe(1);
  expect(first.clubs).toHaveLength(16);
  expect(first.clubs[0]).toMatchObject({ id: 'clubs.club.1', number: 1 });
  expect(first.next).toEqual({
    id: 'clubs.next-page',
    label: 'Next: Division 2'
  });
  expect(first.note).toBe("You'll start in Division 4");
  const last = setupFor(enhanced('alex', '99', '99', '99'));
  if (last?.kind !== 'clubs') {
    throw new Error('No clubs');
  }
  expect(last.division).toBe(4);
  expect(last.clubs[0]!.number).toBe(49);
  expect(last.next.label).toBe('Next: Division 1');
});

test('the levels are seven choices; changing marks the current one', () => {
  const choosing = setupFor(enhanced('alex', '1'));
  if (choosing?.kind !== 'level') {
    throw new Error('No level');
  }
  expect(choosing.levels.map(l => [l.number, l.name, l.id])).toEqual(
    levels.map((name, i) => [i + 1, name, `level.${i + 1}`])
  );
  expect(choosing.levels.some(l => l.current)).toBe(false);
  const changing = setupFor(enhanced('alex', '1', '3', 'level'));
  if (changing?.kind !== 'level') {
    throw new Error('No level');
  }
  expect(changing.levels.filter(l => l.current).map(l => l.number)).toEqual([
    3
  ]);
});

test('colours and playing on are two choices each', () => {
  expect(setupFor(after('original', 'alex', '1', '1'))).toEqual({
    choices: [
      { id: 'colours.black', label: 'Black' },
      { id: 'colours.white', label: 'White' }
    ],
    kind: 'colours'
  });
  expect(setupFor(afterSave())).toEqual({
    choices: [
      { id: 'save-question.yes', label: 'Keep playing' },
      { id: 'save-question.no', label: 'Stop' }
    ],
    kind: 'play-on'
  });
});
