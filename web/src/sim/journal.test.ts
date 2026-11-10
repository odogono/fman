import { expect, test } from 'bun:test';

import { submitInput } from '../test/input';
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
  submitInput(journal, 'alex');
  submitInput(journal, '1');
  submitInput(journal, '1');
  submitInput(journal, '0');
  return journal;
};

const toHighlights = (journal: ReturnType<typeof createJournal>) => {
  submitInput(journal, '99');
  submitInput(journal, '');
  submitInput(journal, '99');
};

test('a snapshot before setup completes replays to the same screen', () => {
  const journal = createJournal();
  journal.advance(120);
  journal.advance(60);
  const restored = openSave(journal.snapshot());
  expect(state(restored)).toBe(state(journal));
  restored.advance(124);
  journal.advance(124);
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
  const priorInputCount = JSON.parse(journal.snapshot()).inputs.length;
  for (let i = 0; i < 40; i++) {
    journal.advance(3);
  }
  const data = journal.snapshot();
  expect(JSON.parse(data).inputs).toHaveLength(priorInputCount + 1);
  expect(JSON.parse(data).inputs.at(-1)).toEqual(['advance', 120]);
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
  submitInput(journal, '');
  submitInput(restored, '');
  expect(state(restored)).toBe(state(journal));
});

test('the cleared program is restored as cleared', () => {
  const journal = setup();
  submitInput(journal, 'keep');
  expect(journal.saved()).toBe(true);
  submitInput(journal, 'n');
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
      version: 5
    })
  ]) {
    expect(() => openSave(data)).toThrow(RangeError);
  }
});

test('version-2 migration accepts only the original idle menu checkpoint', () => {
  const data = JSON.parse(setup().snapshot());
  const legacy = {
    ...data,
    base: { frames: data.base.frames, game: data.base.game, kind: 'menu' },
    version: 2
  };
  const restored = openSave(JSON.stringify(legacy));
  expect(restored.session.view.game).toEqual(data.base.game);
  expect(restored.session.view.frames).toBe(data.base.frames);
  expect(JSON.parse(restored.snapshot()).version).toBe(4);
  for (const invalid of [
    { ...legacy, inputs: [['advance', 1]] },
    { ...legacy, base: { kind: 'title' } },
    { ...data, version: 2 }
  ]) {
    expect(() => openSave(JSON.stringify(invalid))).toThrow(RangeError);
  }
});

test('menu checkpoints reject extra fields and incomplete or invalid keyboard state', () => {
  const data = JSON.parse(setup().snapshot());
  const base = data.base;
  for (const invalid of [
    {
      frames: base.frames,
      game: base.game,
      kind: 'menu',
      other: 2,
      unexpected: 1
    },
    { ...base, unexpected: 1 },
    { ...base, keyboard: undefined },
    { ...base, ulaFrames: undefined },
    { ...base, ulaFrames: 2 ** 24 },
    { ...base, keyboard: { ...base.keyboard, repeat: 36 } },
    { ...base, keyboard: { ...base.keyboard, pending: 'yes' } }
  ]) {
    expect(() => openSave(JSON.stringify({ ...data, base: invalid }))).toThrow(
      RangeError
    );
  }
});
