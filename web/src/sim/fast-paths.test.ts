import { expect, test } from 'bun:test';

import { beepRegisters, beeperSignal, beeperT } from './beeper';
import { spectrumFrameT } from './frame-clock';
import { simulateHighlights } from './highlights';
import { createPauseKeyboard, type PauseKeyboard } from './pause-keyboard';
import { createPlayback } from './playback';

test('beeperT is the traced BEEPER duration at every phase', () => {
  const tones = [
    [0.2, 0],
    [0.05, 12],
    [0.1, -10],
    [0.5, 24]
  ] as const;
  for (const [duration, pitch] of tones) {
    const { de, hl } = beepRegisters(duration, pitch);
    for (
      let startT = -spectrumFrameT;
      startT < 2 * spectrumFrameT;
      startT += 97
    ) {
      expect(beeperT(hl, de, startT)).toBe(
        beeperSignal(hl, de, startT).durationT
      );
      // A second call comes from the cache.
      expect(beeperT(hl, de, startT)).toBe(
        beeperSignal(hl, de, startT).durationT
      );
    }
  }
});

const highlights = () =>
  simulateHighlights({
    awayInk: 7,
    home: true,
    homeInk: 0,
    opponent: [12, 10, 9, 11, 8],
    seed: 4321,
    strength: [10, 12, 11, 9, 13]
  });

/** A keyboard that never reports idle, forcing interrupt-by-interrupt play. */
const neverIdle = (keyboard: PauseKeyboard): PauseKeyboard =>
  new Proxy(keyboard, {
    get: (target, property) =>
      property === 'idle' ? false : Reflect.get(target, property)
  });

/** Plays highlights in `step`-frame calls, pressing a key at `pressAt`. */
const play = (fast: boolean, step: number, pressAt?: number) => {
  const keyboard = createPauseKeyboard();
  const playback = createPlayback(
    highlights(),
    fast ? keyboard : neverIdle(keyboard)
  );
  let missed = 0;
  let frames = 0;
  const trace: string[] = [];
  while (!playback.done) {
    if (pressAt !== undefined && frames >= pressAt && frames < pressAt + 6) {
      keyboard.set('Space');
    } else {
      keyboard.set('');
    }
    missed += playback.advance(step);
    frames += step;
    trace.push(`${playback.key}:${playback.elapsedT}`);
  }
  return { keyboard: keyboard.state, missed, score: playback.score, trace };
};

test('crossing idle interrupts in one step matches scanning each one', () => {
  for (const step of [1, 7, 50]) {
    for (const pressAt of [undefined, 40, 300, 900]) {
      expect(play(true, step, pressAt)).toEqual(play(false, step, pressAt));
    }
  }
});

test('bounded playback stops at the end the forecast predicts', () => {
  const playback = createPlayback(highlights(), createPauseKeyboard());
  playback.advance(100);
  const remainingT = playback.remainingT;
  const played = playback.advanceWithinT(remainingT + 5 * spectrumFrameT);
  expect(played.usedT).toBe(remainingT);
  expect(playback.done).toBe(true);
  expect(playback.advanceWithinT(spectrumFrameT)).toEqual({
    missed: 0,
    usedT: 0
  });
});
