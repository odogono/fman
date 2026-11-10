import { expect, test } from 'bun:test';

import { createJournal, openSave } from './journal';
import { encodeSave } from './save';

const state = (journal: ReturnType<typeof createJournal>) => {
  const view = journal.session.view;
  return JSON.stringify({
    ...view,
    playback:
      view.screen === 'highlights'
        ? [view.playback.key, view.playback.score]
        : undefined
  });
};

const setup = () => {
  const journal = createJournal();
  journal.advance(137);
  journal.skipPause();
  journal.submit('alex');
  journal.submit('1');
  journal.submit('1');
  journal.submit('0');
  return journal;
};

const toHighlights = (journal: ReturnType<typeof createJournal>) => {
  journal.submit('99');
  journal.submit('');
  journal.submit('99');
};

test('a snapshot before setup completes replays to the same screen', () => {
  const journal = createJournal();
  journal.advance(120);
  journal.advance(60);
  const restored = openSave(journal.snapshot());
  expect(state(restored)).toBe(state(journal));
  restored.advance(120);
  journal.advance(120);
  expect(state(restored)).toBe(state(journal));
  expect(restored.session.view.screen).toBe('manager');
});

test('reaching the management menu restarts the journal from that game', () => {
  const journal = setup();
  expect(journal.session.view.screen).toBe('menu');
  const data = JSON.parse(journal.snapshot());
  expect(data.base.kind).toBe('menu');
  expect(data.inputs).toEqual([]);
});

test('a snapshot mid-highlights resumes on the same playback frame', () => {
  const journal = setup();
  toHighlights(journal);
  expect(journal.session.view.screen).toBe('highlights');
  for (let i = 0; i < 40; i++) {
    journal.advance(3);
  }
  const data = journal.snapshot();
  expect(
    JSON.parse(data).inputs.filter(([kind]: [string]) => kind === 'advance')
  ).toHaveLength(1);
  const restored = openSave(data);
  expect(state(restored)).toBe(state(journal));
  for (
    let i = 0;
    i < 2000 && journal.session.view.screen === 'highlights';
    i++
  ) {
    journal.advance(7);
    restored.advance(7);
    expect(state(restored)).toBe(state(journal));
  }
  journal.submit('');
  restored.submit('');
  expect(state(restored)).toBe(state(journal));
});

test('the cleared program is restored as cleared', () => {
  const journal = setup();
  journal.submit('keep');
  expect(journal.saved()).toBe(true);
  journal.submit('n');
  expect(journal.session.view.screen).toBe('cleared');
  expect(openSave(journal.snapshot()).session.view.screen).toBe('cleared');
});

test('version-1 files still resume at the reseed boundary', () => {
  const journal = setup();
  const game = journal.session.view.game!;
  const restored = openSave(encodeSave(game, 1234));
  expect(restored.session.view.screen).toBe('menu');
  expect(restored.session.view.frames).toBe(1234);
});

test('invalid snapshots are rejected', () => {
  for (const data of [
    '',
    '{}',
    JSON.stringify({
      base: { kind: 'title' },
      format: 'fman-web',
      inputs: [['jump']],
      version: 2
    }),
    JSON.stringify({
      base: { kind: 'menu' },
      format: 'fman-web',
      inputs: [],
      version: 2
    }),
    JSON.stringify({
      base: { kind: 'title' },
      format: 'fman-web',
      inputs: [],
      version: 3
    })
  ]) {
    expect(() => openSave(data)).toThrow(RangeError);
  }
});
