import { expect, test } from 'bun:test';

import { createFrameClock, framePeriod } from '../sim/frame-clock';
import { createJournal, openSave } from '../sim/journal';
import { createNewGame } from '../sim/management';
import { encodeSave } from '../sim/save';
import { createFrameSampler } from './frame-sampler';

const frameMs = 19.968;
const game = createNewGame({
  club: 1,
  colour: 0,
  level: 1,
  manager: 'alex',
  seed: 0
});

test('input dispatch samples the reseed frame even when RAF is late or stale', () => {
  const journal = createJournal({
    frames: 65_535,
    game: { ...game, seed: 42 },
    kind: 'menu'
  });
  const sample = createFrameSampler(0);
  const advanceTo = (now: number) => journal.advance(sample(now));
  advanceTo(10); // Last rendered callback, still before the next ULA frame.
  journal.submit('keep');
  journal.saved();
  advanceTo(frameMs); // ENTER dispatch, before the next RAF callback.
  journal.submit('yes');
  expect(journal.session.view.frames).toBe(65_536);
  expect(journal.session.view.game!.seed).toBe(0);
  advanceTo(16); // A previously scheduled RAF must not undo the input sample.
  expect(journal.session.view.frames).toBe(65_536);
  expect(openSave(journal.snapshot()).session.view).toEqual(
    journal.session.view
  );
});

const replaySetup = (callbacks: boolean) => {
  const journal = createJournal();
  const sample = createFrameSampler(0);
  const advanceTo = (now: number) => journal.advance(sample(now));
  for (const [index, text] of ['alex', '1', '1', '0'].entries()) {
    const now = (framePeriod + 300 + index * 50) * frameMs;
    if (callbacks) {
      advanceTo(now - 11.3);
      advanceTo(now - 2.7);
    }
    advanceTo(now);
    journal.submit(text);
  }
  return journal;
};

test('timed setup and a 24-bit wrap give identical state with uneven or absent callbacks', () => {
  const chunked = replaySetup(true);
  const single = replaySetup(false);
  expect(chunked.session.view).toEqual(single.session.view);
  expect(chunked.session.view.frames).toBe(450);
  expect(chunked.session.view.game!.seed).toBe(450);
  expect(openSave(chunked.snapshot()).session.view).toEqual(
    chunked.session.view
  );
});

test('whole-frame advances remain associative through multiple counter wraps', () => {
  const chunks = [1, 65_535, framePeriod - 1, framePeriod + 123];
  const chunked = createFrameClock(framePeriod - 1);
  const single = createFrameClock(framePeriod - 1);
  for (const frames of chunks) {
    chunked.advance(frames);
  }
  single.advance(chunks.reduce((sum, frames) => sum + frames, 0));
  expect(chunked.frames).toBe(single.frames);
});

test('journals restore a raw seed; kept games deliberately reseed from saved frames', () => {
  const raw = { ...game, seed: 42 };
  const exact = createJournal({ frames: 65_536, game: raw, kind: 'menu' });
  expect(JSON.parse(exact.snapshot()).version).toBe(8);
  const restored = openSave(exact.snapshot());
  expect(restored.session.view.game!.seed).toBe(42);
  const legacy = encodeSave(raw, 65_536);
  expect(JSON.parse(legacy).version).toBe(8);
  expect(openSave(legacy).session.view.game!.seed).toBe(0);
  const sample = createFrameSampler(0);
  restored.advance(sample(frameMs));
  expect(restored.session.view.frames).toBe(65_537);
  expect(restored.session.view.game!.seed).toBe(42);
});
