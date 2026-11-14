import { expect, test } from 'bun:test';

import { finishPrompt, submitInput } from '../test/input';
import { spectrumFrameT } from './frame-clock';
import { createJournal, openSave, type Journal } from './journal';
import { presentDay, type Ruleset } from './ruleset';
import { encodeSave, saveVersion } from './save';
import { tickerLeadIn, tickerPause } from './ticker';

const state = (journal: ReturnType<typeof createJournal>) => {
  const view = journal.session.view;
  return JSON.stringify({
    ...view,
    highlights:
      view.screen === 'highlights'
        ? view.highlights.kind === 'moments'
          ? [
              view.highlights.timeline.key,
              view.highlights.timeline.score,
              view.highlights.timeline.shown
            ]
          : [view.highlights.timeline.key, view.highlights.timeline.score]
        : undefined
  });
};

const setup = (ruleset: Ruleset = 'original') => {
  const journal = createJournal({ kind: 'title', ruleset });
  journal.advance(137);
  journal.skipPause();
  submitInput(journal, 'alex');
  submitInput(journal, '1');
  submitInput(journal, '1');
  // Clubs in their own kits ask no colour question.
  if (!presentDay(ruleset)) {
    submitInput(journal, '0');
  }
  return journal;
};

const withoutRuleset = ({ ruleset: _, ...game }: Record<string, unknown>) =>
  game;

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
      version: 7
    })
  ]) {
    expect(() => openSave(data)).toThrow(RangeError);
  }
});

test('version-2 migration accepts only the original idle menu checkpoint', () => {
  const data = JSON.parse(setup().snapshot());
  const legacy = {
    ...data,
    base: {
      frames: data.base.frames,
      game: withoutRuleset(data.base.game),
      kind: 'menu'
    },
    version: 2
  };
  const restored = openSave(JSON.stringify(legacy));
  expect(restored.session.view.game).toEqual(data.base.game);
  expect(restored.session.view.frames).toBe(data.base.frames);
  expect(JSON.parse(restored.snapshot()).version).toBe(saveVersion);
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

const keyboard = (journal: Journal) => journal.session.timingState.keyboard;

/** A new game at the name prompt, its beep finished. */
const atNameEntry = () => {
  const journal = createJournal();
  journal.advance(137);
  journal.skipPause();
  finishPrompt(journal);
  return journal;
};

test('a brief keypress comes up once the original has scanned it', () => {
  const whole = atNameEntry();
  const frameByFrame = atNameEntry();
  const byHand = atNameEntry();
  whole.submit('alex', 'brief');
  frameByFrame.submit('alex', 'brief');
  byHand.press('Enter', 'held');
  byHand.submit('alex');
  expect(keyboard(whole).key).toBe('Enter');
  whole.advance(60);
  for (let i = 0; i < 60; i++) {
    frameByFrame.advance(1);
  }
  let frames = 0;
  while (keyboard(byHand).scanned !== 'Enter') {
    byHand.advance(1);
    frames++;
  }
  byHand.release();
  byHand.advance(60 - frames);
  expect(keyboard(whole).key).toBe('');
  expect(keyboard(whole)).toEqual(keyboard(byHand));
  expect(keyboard(frameByFrame)).toEqual(keyboard(byHand));
  expect(state(whole)).toBe(state(byHand));
});

test('a reload just after a soft keyboard answer does not leave Enter down', () => {
  const live = atNameEntry();
  live.submit('alex', 'brief');
  const restored = openSave(live.snapshot());
  expect(keyboard(restored).key).toBe('Enter');
  live.advance(60);
  restored.advance(60);
  expect(keyboard(restored).key).toBe('');
  expect(keyboard(restored)).toEqual(keyboard(live));
  expect(state(restored)).toBe(state(live));
});

test('a resume lets go of a held keypress, and saving again replays the same', () => {
  const live = createJournal();
  live.press('Space', 'held');
  const resumed = openSave(live.snapshot());
  expect(keyboard(resumed).key).toBe('Space');
  resumed.advance(40);
  expect(keyboard(resumed).key).toBe('');
  live.advance(40);
  expect(keyboard(live).key).toBe('Space');
  const again = openSave(resumed.snapshot());
  expect(keyboard(again)).toEqual(keyboard(resumed));
  expect(state(again)).toBe(state(resumed));
});

test('letting go mid-session is replayed from the save', () => {
  const live = atNameEntry();
  live.press('Enter', 'held');
  live.submit('alex');
  live.letGo();
  live.advance(30);
  const restored = openSave(live.snapshot());
  expect(keyboard(restored)).toEqual(keyboard(live));
  expect(state(restored)).toBe(state(live));
});

test('a release lifts only a held keypress', () => {
  const journal = atNameEntry();
  journal.submit('alex', 'brief');
  journal.release();
  expect(keyboard(journal).key).toBe('Enter');
  journal.press('Space', 'held');
  journal.release();
  expect(keyboard(journal).key).toBe('');
});

test('an answer presses Enter only when no key is already down', () => {
  const journal = atNameEntry();
  journal.press('NumpadEnter', 'held');
  journal.submit('alex', 'held');
  expect(keyboard(journal).key).toBe('NumpadEnter');
});

test('a brief keypress at the menu replays from the checkpoint before it', () => {
  const live = setup();
  live.press('KeyS', 'brief');
  expect(JSON.parse(live.snapshot()).inputs).toEqual([['press', 'KeyS']]);
  const restored = openSave(live.snapshot());
  live.advance(10);
  restored.advance(10);
  expect(keyboard(live).key).toBe('');
  expect(keyboard(restored)).toEqual(keyboard(live));
  expect(JSON.parse(live.snapshot()).inputs).toEqual([]);
});

test('version-4 saves replay their logged keypresses unchanged', () => {
  const live = atNameEntry();
  live.press('Enter', 'held');
  live.submit('alex');
  live.advance(3);
  live.release();
  live.advance(20);
  const data = {
    ...JSON.parse(live.snapshot()),
    base: { kind: 'title' },
    version: 4
  };
  expect(data.inputs).toContainEqual(['key', 'Enter']);
  const restored = openSave(JSON.stringify(data));
  expect(keyboard(restored)).toEqual(keyboard(live));
  expect(state(restored)).toBe(state(live));
  expect(JSON.parse(restored.snapshot()).version).toBe(saveVersion);
  for (const input of [['press', 'Enter'], ['let-go']]) {
    expect(() =>
      openSave(JSON.stringify({ ...data, inputs: [...data.inputs, input] }))
    ).toThrow(RangeError);
  }
});

/** The ticker on screen, under moment highlights (#108). */
const tickerOf = (journal: Journal) => {
  const view = journal.session.view;
  if (view.screen !== 'highlights' || view.highlights.kind !== 'moments') {
    throw new Error(`No ticker on ${view.screen}`);
  }
  return view.highlights.timeline;
};

test('moment highlights show the ticker, then the result', () => {
  const journal = setup('enhanced-7');
  toHighlights(journal);
  expect(tickerOf(journal).shown).toEqual([]);
  journal.advance(tickerLeadIn + tickerPause);
  expect(tickerOf(journal).shown).toHaveLength(1);
  for (let i = 0; i < 40 && journal.session.view.screen === 'highlights'; i++) {
    journal.advance(tickerPause);
  }
  expect(journal.session.view.screen).toBe('result');
});

test('a snapshot mid-ticker resumes at the same moment', () => {
  const journal = setup('enhanced-7');
  toHighlights(journal);
  journal.advance(tickerPause + 30);
  const restored = openSave(journal.snapshot());
  expect(tickerOf(restored).shown).toEqual(tickerOf(journal).shown);
  expect(state(restored)).toBe(state(journal));
  for (
    let i = 0;
    i < 200 && journal.session.view.screen === 'highlights';
    i++
  ) {
    journal.advance(7);
    restored.advance(7);
    expect(state(restored)).toBe(state(journal));
  }
  expect(restored.session.view.screen).toBe('result');
});

test('skipping the ticker is kept in the journal', () => {
  const journal = setup('enhanced-7');
  toHighlights(journal);
  journal.advance(10);
  journal.skipPause();
  const ticker = tickerOf(journal);
  expect(ticker.done).toBe(false);
  const restored = openSave(journal.snapshot());
  expect(state(restored)).toBe(state(journal));
  expect(tickerOf(restored).shown.length).toBeGreaterThan(0);
  journal.advance(tickerPause);
  restored.advance(tickerPause);
  expect(journal.session.view.screen).toBe('result');
  expect(state(restored)).toBe(state(journal));
});

/** One clip length per moment, as a view hands over at kick-off. */
const clipsFor = (journal: Journal) =>
  tickerOf(journal).moments.map((_, i) => 100 + 37 * i);

test('clip lengths are kept in the journal, and resume mid-clip', () => {
  const journal = setup('enhanced-7');
  toHighlights(journal);
  const clips = clipsFor(journal);
  expect(clips.length).toBeGreaterThan(1);
  expect(journal.holdClips(clips)).toBe(true);
  expect(tickerOf(journal).lengths).toEqual(clips);
  // Into the first clip, partway.
  journal.advance(tickerLeadIn + tickerPause + 40);
  expect(tickerOf(journal).shown).toHaveLength(1);
  const restored = openSave(journal.snapshot());
  expect(tickerOf(restored).lengths).toEqual(clips);
  expect(state(restored)).toBe(state(journal));
  expect(tickerOf(restored).elapsedT).toBe(tickerOf(journal).elapsedT);
  expect(tickerOf(restored).pauseElapsedT).toBe(40 * spectrumFrameT);
  journal.advance(clips[0]! - 41);
  restored.advance(clips[0]! - 41);
  expect(tickerOf(journal).shown).toHaveLength(1);
  journal.advance(1);
  restored.advance(1);
  expect(tickerOf(journal).shown).toHaveLength(2);
  expect(state(restored)).toBe(state(journal));
  const rest = clips.slice(1).reduce((a, b) => a + b, 0) + tickerPause;
  journal.advance(rest - 1);
  restored.advance(rest - 1);
  expect(journal.session.view.screen).toBe('highlights');
  journal.advance(1);
  restored.advance(1);
  expect(journal.session.view.screen).toBe('result');
  expect(state(restored)).toBe(state(journal));
});

test('clip lengths are taken only at kick-off, one per moment', () => {
  const journal = setup('enhanced-7');
  expect(journal.holdClips([75])).toBe(false);
  toHighlights(journal);
  const clips = clipsFor(journal);
  expect(() => journal.holdClips(clips.slice(1))).toThrow(RangeError);
  journal.advance(1);
  expect(journal.holdClips(clips)).toBe(false);
  expect(tickerOf(journal).lengths).toBeUndefined();
  expect(JSON.parse(journal.snapshot()).inputs).not.toContainEqual([
    'clips',
    clips
  ]);
});

test('skipping after clip lengths still keeps the final hold', () => {
  const journal = setup('enhanced-7');
  toHighlights(journal);
  journal.holdClips(clipsFor(journal));
  journal.advance(10);
  journal.skipPause();
  const restored = openSave(journal.snapshot());
  expect(state(restored)).toBe(state(journal));
  journal.advance(tickerPause - 1);
  expect(journal.session.view.screen).toBe('highlights');
  journal.advance(1);
  expect(journal.session.view.screen).toBe('result');
});

test('saves reject clip lengths that do not fit the match', () => {
  const journal = setup('enhanced-7');
  toHighlights(journal);
  const clips = clipsFor(journal);
  journal.holdClips(clips);
  const data = JSON.parse(journal.snapshot());
  const withClips = (lengths: unknown, version = saveVersion) =>
    JSON.stringify({
      ...data,
      inputs: data.inputs.map((input: unknown[]) =>
        input[0] === 'clips' ? ['clips', lengths] : input
      ),
      version
    });
  expect(() => openSave(withClips(clips))).not.toThrow();
  for (const bad of [
    clips.slice(1),
    [...clips, 75],
    [0, ...clips.slice(1)],
    'x'
  ]) {
    expect(() => openSave(withClips(bad))).toThrow(RangeError);
  }
  expect(() => openSave(withClips(clips, 11))).toThrow(RangeError);
});
