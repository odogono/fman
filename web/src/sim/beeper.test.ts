import { expect, test } from 'bun:test';

import { beepRegisters, beeperSignal } from './beeper';
import { spectrumFrameT } from './frame-clock';
import { simulateHighlights } from './highlights';
import { createJournal, openSave } from './journal';
import { createPauseKeyboard } from './pause-keyboard';
import { createPlayback } from './playback';
import { createSession } from './session';
import { cupPlayback } from './timed-screens';
import { createTimeline } from './timeline';

type Beep = {
  de: number;
  edges: [number, number, number, number][];
  hl: number;
  kind: string;
  line: number;
  returnedT: number;
  returnPc: number;
  seed: number;
  t: number;
};
const timing: { runs: { events: Beep[]; name: string }[] } = await Bun.file(
  new URL('./fixtures/spectrum-timing.json', import.meta.url)
).json();
const sound: { runs: { events: Beep[]; name: string }[] } = await Bun.file(
  new URL('./fixtures/spectrum-sound.json', import.meta.url)
).json();
const tones = [
  ...Array.from({ length: 36 }, (_, i) => ({ duration: 0.05, pitch: i + 1 })),
  ...Array.from({ length: 10 }, (_, i) => ({ duration: 0.2, pitch: i })),
  { duration: 0.15, pitch: -40 },
  { duration: 0.15, pitch: -30 },
  { duration: 0.08, pitch: -40 },
  { duration: 0.25, pitch: -50 }
];

test('every captured BEEPER edge and blocking duration match exactly at the original ULA phase', () => {
  let count = 0;
  for (const run of [...timing.runs, ...sound.runs]) {
    for (const event of run.events.filter(
      event => event.kind === 'beep-enter'
    )) {
      const signal = beeperSignal(event.hl, event.de, event.t);
      expect(signal.starts).toEqual(event.edges.map(edge => edge[0] - event.t));
      expect(signal.edges).toEqual(event.edges.map(edge => edge[1] - event.t));
      expect(signal.durationT).toBe(event.returnedT - event.t);
      expect(event.edges.map(edge => edge[3])).toEqual(
        event.edges.map((_, i) => 1 - (i % 2))
      );
      if (event.returnPc === 3911) {
        expect({ de: event.de, hl: event.hl }).toEqual({ de: 0, hl: 200 });
      } else {
        expect(
          tones.some(tone => {
            const registers = beepRegisters(tone.duration, tone.pitch);
            return registers.hl === event.hl && registers.de === event.de;
          })
        ).toBe(true);
      }
      count++;
    }
  }
  expect(count).toBeGreaterThan(400);
});

test('all nine cup tones are delivered in order even in one delayed advance', async () => {
  const pacing: {
    runs: { name: string; path: [number, string, number, number][] }[];
  } = await Bun.file(
    new URL('./fixtures/spectrum-pacing.json', import.meta.url)
  ).json();
  const entry = pacing.runs
    .find(run => run.name === 'cup-victory-probe')!
    .path.find(row => row[1] === 'statement' && row[2] === 5213)![0];
  const cup = cupPlayback(createPauseKeyboard(), entry);
  const planned = cup.sounds;
  expect(planned.map(({ de, hl }) => ({ de, hl }))).toEqual(
    Array.from({ length: 9 }, (_, i) => beepRegisters(0.2, i + 1))
  );
  for (let i = 1; i < planned.length; i++) {
    const previous = planned[i - 1]!;
    expect(planned[i]!.t).toBeGreaterThan(
      previous.t + beeperSignal(previous.hl, previous.de, previous.t).durationT
    );
  }
  const original = timing.runs
    .find(run => run.name === 'cup-victory-probe')!
    .events.filter(event => event.kind === 'beep-enter' && event.line === 5216);
  expect(
    Math.max(...planned.map((event, i) => Math.abs(event.t - original[i]!.t)))
  ).toBeLessThan(spectrumFrameT);
  cup.advance(1000);
  expect(cup.done).toBe(true);
});

test('forecasting a held or pending key agrees with actual shortened PAUSE and changes no keyboard state', () => {
  const keyboard = createPauseKeyboard();
  const tone = { duration: 0.2, pitch: 0 };
  const events = [
    { duration: 0.3, kind: 'draw', tones: [] },
    { duration: 200, kind: 'pause', tones: [] },
    { duration: 10, interrupts: false, kind: 'draw', tones: [tone] }
  ];
  const delivered: number[] = [];
  const timeline = createTimeline(events, keyboard, (event, t) => {
    if (event.tones.length) {
      delivered.push(t);
    }
  });
  const natural = timeline.sounds[0]!.t;
  keyboard.set('Space');
  const state = keyboard.state;
  const early = timeline.sounds[0]!.t;
  expect(keyboard.state).toEqual(state);
  expect(early).toBeLessThan(natural);
  timeline.advance(1);
  expect(delivered).toEqual([early]);
  expect(timeline.sounds[0]!.t).toBe(early);
  timeline.skipPause(); // A key never skips an active BEEPER.
  expect(timeline.done).toBe(false);
});

test('prompt blocks input, withholds ROM ticks and consumes no randomness', () => {
  const session = createSession();
  session.advance(304);
  for (const text of ['alex', '1', '1', '0']) {
    session.submit(text);
  }
  const game = session.view.game!;
  const frames = session.view.frames;
  const event = session.sounds[0]!;
  expect({ de: event.de, hl: event.hl }).toEqual({ de: 51, hl: 1642 });
  expect(session.view.paused).toBe(true);
  session.submit('s');
  session.skipPause();
  session.advance(9);
  expect(session.view.screen).toBe('menu');
  expect(session.view.frames).toBe(frames);
  expect(session.view.game).toBe(game);
  session.advance(1);
  expect(session.view.paused).toBe(false);
  expect(session.view.frames).toBe(frames + 1);
  session.submit('s');
  expect(session.view.screen).toBe('status');
  expect(session.view.game!.seed).toBe(game.seed);
});

test('mid-prompt saves resume the remaining sound; older active timing journals are rejected', () => {
  const journal = createJournal();
  journal.advance(304);
  for (const text of ['alex', '1', '1', '0']) {
    journal.submit(text);
  }
  journal.advance(4);
  const saved = journal.snapshot();
  const restored = openSave(saved);
  expect(restored.session.view).toEqual(journal.session.view);
  expect(restored.session.sounds).toEqual(journal.session.sounds);
  for (const version of [2, 3]) {
    expect(() =>
      openSave(JSON.stringify({ ...JSON.parse(saved), version }))
    ).toThrow();
  }
  journal.advance(6);
  restored.advance(6);
  expect(restored.session.view).toEqual(journal.session.view);
  expect(restored.session.view.paused).toBe(false);
  expect(JSON.parse(journal.snapshot()).version).toBe(6);
});

const positions = (rows: number[][]) =>
  rows.map(([x, y]) => ({ x: x!, y: y! }));

test('highlight sound event order and start times follow the original without changing the RNG draws', async () => {
  type Entry = {
    seed: number;
    t: number;
    values: {
      'a(5)': number[];
      'f(3,2)': number[][];
      'g(3,2)': number[][];
      h: number;
      tco: number;
      'u(5)': number[];
    };
  };
  const pacing: {
    runs: { events: (Entry & { kind: string })[]; name: string }[];
  } = await Bun.file(
    new URL('./fixtures/spectrum-pacing.json', import.meta.url)
  ).json();
  for (const name of [
    'black-natural',
    'white-natural',
    'black-level7',
    'white-level7'
  ]) {
    const entry = pacing.runs
      .find(run => run.name === name)!
      .events.find(event => event.kind === 'highlight-entry')!;
    const v = entry.values;
    const homeInk = v.h === 1 ? v.tco : 7 - v.tco;

    const result = simulateHighlights({
      awayInk: 7 - homeInk,
      carry: {
        attackers: positions(v['f(3,2)']),
        defenders: positions(v['g(3,2)'])
      },
      home: v.h === 1,
      homeInk,
      opponent: v['u(5)'],
      seed: entry.seed,
      startT: entry.t,
      strength: v['a(5)']
    });
    const planned = createPlayback(result, undefined, entry.t).sounds;
    const original = timing.runs
      .find(run => run.name === name)!
      .events.filter(
        event =>
          event.kind === 'beep-enter' &&
          event.t >= entry.t &&
          event.line !== 1030
      );
    expect(planned.map(({ de, hl }) => ({ de, hl }))).toEqual(
      original.map(({ de, hl }) => ({ de, hl }))
    );
    expect(
      Math.max(...planned.map((event, i) => Math.abs(event.t - original[i]!.t)))
    ).toBeLessThan(2 * spectrumFrameT);
    const final = timing.runs
      .find(run => run.name === name)!
      .events.find(
        event => event.kind === 'checkpoint' && event.line === 5110
      )!;
    expect(result.seed).toBe(final.seed);
  }
});

const highlightJournal = () => {
  const journal = createJournal();
  journal.advance(304);
  for (const text of ['alex', '1', '1', '0']) {
    journal.submit(text);
  }
  journal.advance(10);
  journal.submit('99');
  journal.advance(10);
  journal.submit('');
  journal.advance(10);
  journal.submit('99');
  return journal;
};

test('chunking across highlight completion and its following prompt preserves clocks, keyboard and state', () => {
  const chunked = highlightJournal();
  const single = highlightJournal();
  const total =
    Math.ceil(
      (single.session.sounds.at(-1)!.startT - single.session.soundTimeT) /
        spectrumFrameT
    ) + 5;
  single.advance(total);
  for (let i = 0; i < total; i++) {
    chunked.advance(1);
  }
  expect(chunked.session.view).toEqual(single.session.view);
  expect(chunked.session.timingState).toEqual(single.session.timingState);
  expect(chunked.session.sounds).toEqual(single.session.sounds);
  expect(single.session.view.screen).toBe('result');
  expect(single.session.view.paused).toBe(true);
});

test('the reachable management prompt sequence matches the original calls, including silent INPUT retries', () => {
  const session = createSession();
  session.advance(304);
  for (const text of ['alex', '1', '1']) {
    session.submit(text);
  }
  const observed: { de: number; hl: number }[] = [];
  for (const text of ['0', 's', '', 'a', '99', '99', '', 'c', '99']) {
    session.submit(text);
    observed.push(...session.sounds.map(({ de, hl }) => ({ de, hl })));
    session.advance(10);
  }
  const original = sound.runs
    .find(run => run.name === 'reachable-prompts')!
    .events.filter(
      event => event.kind === 'beep-enter' && event.returnPc === 7030
    );
  expect(observed).toEqual(original.map(({ de, hl }) => ({ de, hl })));
  session.submit('c');
  session.advance(10);
  session.submit('100');
  expect(session.sounds).toEqual([]);
});
