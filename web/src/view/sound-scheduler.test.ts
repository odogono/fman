import { expect, test } from 'bun:test';

import { beepRegisters, beeperSignal, type SoundEvent } from '../sim/beeper';
import { spectrumClockHz } from '../sim/frame-clock';
import { createPauseKeyboard } from '../sim/pause-keyboard';
import { cupPlayback } from '../sim/timed-screens';
import { sampleBeeper } from './beeper';
import { createSoundScheduler, type Signal } from './sound-scheduler';

const host = () => {
  let now = 0;
  const calls: {
    offset: number;
    signal: Signal;
    stopped: boolean;
    when: number;
  }[] = [];
  const scheduler = createSoundScheduler({
    now: () => now,
    play: (signal, when, offset) => {
      const call = { offset, signal, stopped: false, when };
      calls.push(call);
      return {
        stop: () => {
          call.stopped = true;
        }
      };
    }
  });
  return {
    calls,
    scheduler,
    setTime: (value: number) => {
      now = value;
    }
  };
};
const event = (id: string, startT: number): SoundEvent => ({
  ...beepRegisters(0.2, 0),
  id,
  phaseT: startT,
  startT
});

test('audio-clock scheduling retains all cup tones through a delayed browser frame with no duplicates or overlaps', () => {
  const h = host();
  const cup = cupPlayback(createPauseKeyboard());
  const sounds = cup.sounds.map(sound => ({
    ...sound,
    id: String(sound.index),
    phaseT: sound.t,
    startT: sound.t
  }));
  h.scheduler.sync(sounds, 0);
  expect(h.calls).toHaveLength(9);
  for (let i = 1; i < h.calls.length; i++) {
    expect(h.calls[i]!.when).toBeGreaterThan(
      h.calls[i - 1]!.when + h.calls[i - 1]!.signal.durationT / spectrumClockHz
    );
  }
  h.setTime(0.75);
  cup.advanceT(0.75 * spectrumClockHz);
  h.scheduler.sync(
    cup.sounds.map(sound => ({
      ...sound,
      id: String(sound.index),
      phaseT: sound.t,
      startT: sound.t
    })),
    0.75 * spectrumClockHz
  );
  expect(h.calls).toHaveLength(9);
  expect(h.calls.every(call => !call.stopped)).toBe(true);
});

test('shortening a pause cancels the obsolete future sound and schedules its new time once', () => {
  const h = host();
  h.scheduler.sync([event('next', 14_000_000)], 0);
  h.setTime(0.1);
  h.scheduler.sync([event('next', 700_000)], 350_000);
  expect(h.calls[0]!.stopped).toBe(true);
  expect(h.calls[1]!.when).toBe(0.2);
  h.scheduler.sync([event('next', 700_000)], 350_000);
  expect(h.calls).toHaveLength(2);
});

test('unlocking late drops expired sounds and trims the active signal instead of replaying it', () => {
  const h = host();
  h.scheduler.sync([], 0);
  h.setTime(1);
  h.scheduler.sync(
    [event('expired', 0), event('active', 3_150_000)],
    3_500_000
  );
  expect(h.calls).toHaveLength(1);
  expect(h.calls[0]!.when).toBe(1);
  expect(h.calls[0]!.offset).toBeCloseTo(0.1, 10);
});

test('menu, load, reset and mute cancellation stop both current and queued sources and reset the audio origin', () => {
  const h = host();
  h.scheduler.sync([event('active', 0), event('future', 14_000_000)], 0);
  h.setTime(0.1);
  h.scheduler.reset();
  expect(h.calls.every(call => call.stopped)).toBe(true);
  h.setTime(30);
  h.scheduler.sync([event('new', 0)], 0);
  expect(h.calls[2]!.when).toBe(30);
});

test('44.1/48/96 kHz signal samples preserve the measured pulse area, fractional edges and duration', () => {
  for (const sampleRate of [44_100, 48_000, 96_000]) {
    const signal = beeperSignal(1642, 51, 96_491_119);
    const samples = sampleBeeper(signal, sampleRate);
    expect(samples.length).toBe(
      Math.ceil((signal.durationT * sampleRate) / spectrumClockHz)
    );
    const areaT = signal.edges.reduce(
      (sum, t, i) => (i % 2 ? sum + t - signal.edges[i - 1]! : sum),
      0
    );
    expect(
      samples.reduce((sum, sample) => sum + sample, 0) / sampleRate
    ).toBeCloseTo((0.05 * areaT) / spectrumClockHz, 8);
    expect(samples[0]).toBe(0);
    expect(samples.some(sample => sample > 0 && sample < 0.049)).toBe(true);
  }
});
