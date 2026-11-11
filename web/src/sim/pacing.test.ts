import { expect, test } from 'bun:test';

import { beepRegisters, beeperT, executionBudget } from './execution';
import { spectrumFrameT } from './frame-clock';
import { simulateAttack, simulateHighlights } from './highlights';
import { createJournal, openSave } from './journal';
import { createNewGame } from './management';
import { createPauseKeyboard } from './pause-keyboard';
import { createPlayback } from './playback';
import { createSession } from './session';
import { cupPlayback, errorPlayback, titlePlayback } from './timed-screens';

type Values = {
  'a(5)': number[];
  aw: number;
  'f(3,2)': number[][];
  'g(3,2)': number[][];
  h: number;
  ho: number;
  's(2)': number[];
  tco: number;
  'u(5)': number[];
};
type Event = {
  de: number;
  down?: string[];
  hl: number;
  kind: string;
  line: number;
  returnedT: number;
  romFrames: number;
  seed: number;
  t: number;
  values: Values;
};
type Run = {
  events: Event[];
  name: string;
  path: [number, string, number, number][];
};
const capture: { runs: Run[] } = await Bun.file(
  new URL('./fixtures/spectrum-pacing.json', import.meta.url)
).json();
const timing: { runs: Run[] } = await Bun.file(
  new URL('./fixtures/spectrum-timing.json', import.meta.url)
).json();
const positions = (rows: number[][]) =>
  rows.map(([x, y]) => ({ x: x!, y: y! }));
const durationT = (duration: number) => Math.round(duration * spectrumFrameT);
const checkpoint = (run: Run, line: number) => {
  const event = run.events.find(
    e => e.kind === 'checkpoint' && e.line === line
  );
  if (!event) {
    throw new Error(`Missing ${run.name}:${line}`);
  }
  return event;
};

for (const run of capture.runs.filter(run =>
  ['black-natural', 'white-natural', 'black-level7', 'white-level7'].includes(
    run.name
  )
)) {
  test(`${run.name}: cumulative print timing, transitions, outcome and ROM ticks`, () => {
    const original = timing.runs.find(r => r.name === run.name)!;
    const entry = run.events.find(event => event.kind === 'highlight-entry')!;
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
    const attacks = original.events.filter(
      event => event.kind === 'checkpoint' && [300, 400].includes(event.line)
    );
    expect(result.attacks).toHaveLength(attacks.length);
    let t = entry.t;
    let maxPrintError = 0;
    let maxPitchError = 0;
    let maxTextError = 0;
    for (const [index, attack] of result.attacks.entries()) {
      const native = attacks[index]!;
      const end = original.events.find(
        e =>
          e.kind === 'checkpoint' &&
          e.t > native.t &&
          [290, 346, 446].includes(e.line)
      )!;
      const prints = run.path.filter(
        row => row[1] === 'print' && row[0] >= native.t && row[0] < end.t
      );
      const statements = run.path.filter(
        row => row[1] === 'statement' && row[0] >= native.t
      );
      const returnIndex = statements.findIndex(
        row => row[2] === native.line + 49
      );
      expect(attack.path).toEqual(
        statements.slice(0, returnIndex + 1).map(row => `${row[2]}:${row[3]}`)
      );
      const pitchPath = run.path.filter(
        row => row[1] === 'statement' && row[0] >= native.t && row[0] < end.t
      );
      // The final attack has no successor checkpoint.
      const textEnd = attacks[index + 1]?.t ?? checkpoint(original, 5110).t;
      const outcomePrints = run.path.filter(
        row =>
          row[1] === 'print' &&
          row[0] >= end.t &&
          row[0] < textEnd &&
          [292, 346, 446].includes(row[2])
      );
      const scorePrints = run.path.filter(
        row =>
          row[1] === 'print' &&
          row[0] >= end.t &&
          row[0] < textEnd &&
          row[2] === 1090
      );
      const pitchCompletions = new Set<number>();
      let draw = 0;
      for (const frame of attack.frames) {
        if (frame.draws.length > 0) {
          expect(frame.draws).toHaveLength(1);
          maxPrintError = Math.max(
            maxPrintError,
            Math.abs(t - prints[draw]![0] - 3000)
          );
          draw++;
        }
        if (
          frame.pitch !== undefined &&
          frame.pitch > 0 &&
          Number.isInteger(frame.pitch) &&
          !pitchCompletions.has(frame.pitch)
        ) {
          const progress = frame.pitch;
          pitchCompletions.add(progress);
          const line =
            native.line +
            (progress < 18 ? 1 : progress < 22 ? 2 : progress < 30 ? 3 : 4);
          const statement =
            progress < 18
              ? progress
              : progress < 22
                ? progress - 18
                : progress < 30
                  ? progress - 22
                  : 0;
          const boundary = pitchPath.find(
            row => row[2] === line && row[3] === statement
          )!;
          maxPitchError = Math.max(maxPitchError, Math.abs(t - boundary[0]));
        }
        for (const [count, samples] of [
          [frame.outcomeChars, outcomePrints],
          [frame.scoreChars, scorePrints]
        ] as const) {
          if (count) {
            expect(samples[count - 1]).toBeDefined();
            maxTextError = Math.max(
              maxTextError,
              Math.abs(t - samples[count - 1]![0] - 3000)
            );
          }
        }
        t += durationT(frame.duration);
      }
      expect(draw).toBe(prints.length);
    }
    // One alignment, at line 5000. No per-attack or per-sound realignment.
    expect(maxPrintError).toBeLessThan(2 * spectrumFrameT);
    expect(maxPitchError).toBeLessThan(2 * spectrumFrameT);
    expect(maxTextError).toBeLessThan(2 * spectrumFrameT);
    const final = checkpoint(original, 5110);
    expect(Math.abs(t - final.t)).toBeLessThan(2 * spectrumFrameT);
    expect(result.score).toEqual(final.values['s(2)']);
    expect(result.seed).toBe(final.seed);
    expect(result.carry.attackers).toEqual(positions(final.values['f(3,2)']));
    expect(result.carry.defenders).toEqual(positions(final.values['g(3,2)']));
    const playback = createPlayback(
      result,
      undefined,
      entry.t % spectrumFrameT
    );
    const missed = playback.advance(Math.ceil((t - entry.t) / spectrumFrameT));
    const originalMissed =
      Math.floor(final.t / spectrumFrameT) -
      Math.floor(entry.t / spectrumFrameT) -
      (final.romFrames - entry.romFrames);
    expect(Math.abs(missed - originalMissed)).toBeLessThanOrEqual(2);
    expect(playback.done).toBe(true);
    expect(playback.score).toEqual(result.score);
  });
}

for (const name of ['black-new-key', 'black-held-key']) {
  test(`${name}: follows the timed matrix inputs without skipping drawing or sound`, () => {
    const run = capture.runs.find(run => run.name === name)!;
    const original = timing.runs.find(run => run.name === name)!;
    const entry = run.events.find(event => event.kind === 'highlight-entry')!;
    const v = entry.values;
    const result = simulateHighlights({
      awayInk: 7,
      carry: {
        attackers: positions(v['f(3,2)']),
        defenders: positions(v['g(3,2)'])
      },
      home: true,
      homeInk: 0,
      opponent: v['u(5)'],
      seed: entry.seed,
      startT: entry.t,
      strength: v['a(5)']
    });
    const observed: number[] = [];
    const keyboard = createPauseKeyboard();
    const phase = entry.t % spectrumFrameT;
    const playback = createPlayback(result, keyboard, phase, (frame, t) => {
      if (frame.draws.length > 0) {
        observed.push(entry.t + t - phase);
      }
    });
    let t = entry.t;
    let missed = 0;
    for (const event of original.events.filter(
      event => event.kind === 'keyboard' && event.t >= entry.t
    )) {
      missed += playback.advanceT(event.t - t);
      keyboard.set(event.down?.includes('SPACE') ? 'Space' : '');
      t = event.t;
    }
    const final = checkpoint(original, 5110);
    missed += playback.advanceT(final.t - 2 * spectrumFrameT - t);
    expect(playback.done).toBe(false);
    missed += playback.advanceT(4 * spectrumFrameT);
    const native: number[] = [];
    for (const attack of original.events.filter(
      event => event.kind === 'checkpoint' && [300, 400].includes(event.line)
    )) {
      const end = original.events.find(
        event =>
          event.kind === 'checkpoint' &&
          event.t > attack.t &&
          [290, 346, 446].includes(event.line)
      )!;
      native.push(
        ...run.path
          .filter(
            row => row[1] === 'print' && row[0] >= attack.t && row[0] < end.t
          )
          .map(row => row[0] + 3000)
      );
    }
    expect(observed).toHaveLength(native.length);
    expect(
      Math.max(...observed.map((t, i) => Math.abs(t - native[i]!)))
    ).toBeLessThan(2 * spectrumFrameT);
    expect(playback.done).toBe(true);
    expect(playback.score).toEqual(final.values['s(2)']);
    const originalMissed =
      Math.floor(final.t / spectrumFrameT) -
      Math.floor(entry.t / spectrumFrameT) -
      (final.romFrames - entry.romFrames);
    expect(Math.abs(missed - originalMissed)).toBeLessThanOrEqual(2);
  });
}

test('manager, colour and skill validation costs and PAUSE 200/300 match the captured paths', () => {
  for (const [name, line, statement, endStatement, text, frames] of [
    ['manager-error', 9, 9, 13, 'Name is too long (max 20 chars.)', 200],
    ['colour-error', 8966, 3, 8, '0 or 7 please!', 200],
    ['level-error', 3240, 0, 4, '1 TO 7 please!', 300]
  ] as const) {
    const run = capture.runs.find(run => run.name === name)!;
    const start = run.path.find(
      row => row[1] === 'statement' && row[2] === line && row[3] === statement
    )!;
    const end = run.path.find(
      row =>
        row[1] === 'statement' && row[2] === line && row[3] === endStatement
    )!;
    const model = errorPlayback(
      createPauseKeyboard(),
      text,
      frames,
      start[0] % spectrumFrameT
    );
    expect(Math.abs(model.durationT - (end[0] - start[0]))).toBeLessThan(
      spectrumFrameT
    );
  }
  const cup = capture.runs.find(run => run.name === 'cup-victory-probe')!;
  const start = cup.path.find(
    row => row[1] === 'statement' && row[2] === 5213
  )!;
  const end = cup.path.find(row => row[1] === 'statement' && row[2] === 5218)!;
  expect(
    Math.abs(
      cupPlayback(createPauseKeyboard(), start[0] % spectrumFrameT).durationT -
        (end[0] - start[0])
    )
  ).toBeLessThan(spectrumFrameT);
});

test('BEEPER execution cost follows its operands and contention phase', () => {
  expect(beeperT(10, 1, 0)).toBe(731);
  expect(beepRegisters(0.15, -40)).toEqual({ de: 3, hl: 16_825 });
  expect(beepRegisters(0.25, -50)).toEqual({ de: 3, hl: 30_002 });
  for (const run of timing.runs) {
    for (const event of run.events.filter(
      event => event.kind === 'beep-enter'
    )) {
      expect(
        Math.abs(
          beeperT(event.hl, event.de, event.t) - (event.returnedT - event.t)
        )
      ).toBeLessThanOrEqual(32);
    }
  }
});

test('title drawing cannot be skipped; a fresh press and a pre-existing hold follow the reference', () => {
  const drawing = createSession();
  drawing.skipPause();
  expect(drawing.view.screen).toBe('title');
  expect(drawing.view.printed).toBe(0);
  drawing.advance(4);
  expect(drawing.view.printed).toBeGreaterThan(0);
  expect(drawing.view.printed).toBeLessThan(43);
  drawing.advance(299);
  expect(drawing.view.screen).toBe('title');
  drawing.advance(1);
  expect(drawing.view.screen).toBe('manager');

  const fresh = createSession();
  fresh.advance(24);
  fresh.setKey('Space');
  fresh.advance(1);
  expect(fresh.view.screen).toBe('manager');
  const held = createSession();
  held.setKey('Space');
  held.advance(35);
  expect(held.view.screen).toBe('title');
  held.advance(1);
  expect(held.view.screen).toBe('manager');
});

test('a pending key survives release, shortens PAUSE after HALT, and does not skip animation', () => {
  const keyboard = createPauseKeyboard();
  keyboard.set('Space');
  keyboard.scan();
  keyboard.set('');
  keyboard.scan();
  expect(keyboard.pending).toBe(true);
  const sequence = errorPlayback(keyboard, '0 or 7 please!', 200);
  sequence.skipPause();
  expect(sequence.done).toBe(false);
  // CLS clears the old flag; a later press during drawing is retained.
  sequence.advance(4);
  keyboard.set('Space');
  sequence.advance(1);
  expect(sequence.done).toBe(false);
  sequence.advance(3);
  expect(sequence.done).toBe(true);
});

test('cup victory prints its trophy/title and all nine rows and tones without a PAUSE', () => {
  const keyboard = createPauseKeyboard();
  keyboard.set('Space');
  const cup = cupPlayback(keyboard);
  cup.skipPause();
  expect(cup.progress.stars).toBe(0);
  let missed = 0;
  const tones: number[] = [];
  let key = -1;
  for (let frame = 0; frame < 134; frame++) {
    missed += cup.advance(1);
    if (cup.index !== key && cup.current?.tones.length) {
      tones.push(cup.current.tones[0]!.pitch);
    }
    key = cup.index;
    if (frame === 89) {
      expect(cup.done).toBe(false);
    }
  }
  expect(cup.done).toBe(true);
  expect(cup.progress).toEqual({ stars: 288, text: 64, trophy: 320 });
  expect(tones).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(missed).toBeGreaterThan(80);
});

test('chunking, held keys, lost interrupts and mid-animation save replay agree', () => {
  const game = createNewGame({
    club: 1,
    colour: 0,
    level: 7,
    manager: 'alex',
    seed: 1360
  });
  const single = createJournal({ frames: 123, game, kind: 'menu' });
  const chunked = createJournal({ frames: 123, game, kind: 'menu' });
  for (const journal of [single, chunked]) {
    for (const text of ['99', '', '99']) {
      journal.submit(text);
    }
    journal.press('Space', 'held');
  }
  single.advance(300);
  for (let frame = 0; frame < 300; frame++) {
    chunked.advance(1);
  }
  expect(chunked.session.view.frames).toBe(single.session.view.frames);
  expect(chunked.session.timingState).toEqual(single.session.timingState);
  // A resumed save lets go of the held key, as the others now do.
  const saved = openSave(single.snapshot());
  single.letGo();
  chunked.letGo();
  expect(saved.session.timingState).toEqual(single.session.timingState);
  for (const journal of [single, chunked, saved]) {
    journal.advance(5000);
  }
  expect(JSON.stringify(saved.session.view)).toBe(
    JSON.stringify(single.session.view)
  );
  expect(JSON.stringify(chunked.session.view)).toBe(
    JSON.stringify(single.session.view)
  );
  expect(single.session.view.frames).toBeLessThan(123 + 5300);
});

test('timing remains defined beyond the captured RNG states and kit profiles', () => {
  for (let seed = 0; seed < 1000; seed++) {
    const attack = simulateAttack({
      awayInk: seed % 2 ? 0 : 7,
      carry: {
        attackers: positions([
          [0, 0],
          [0, 0],
          [0, 0]
        ]),
        defenders: positions([
          [0, 0],
          [0, 0],
          [0, 0]
        ])
      },
      direction: seed % 2 ? 'left' : 'right',
      homeInk: seed % 2 ? 7 : 0,
      seed
    });
    expect(
      attack.frames.every(
        frame => Number.isFinite(frame.duration) && frame.duration >= 0
      )
    ).toBe(true);
  }
});

test('invalid advances leave both counters and playback unchanged', () => {
  const session = createSession();
  const before = JSON.stringify({
    timing: session.timingState,
    view: session.view
  });
  for (const frames of [
    -1,
    0.5,
    Number.NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER
  ]) {
    expect(() => session.advance(frames)).toThrow(RangeError);
    expect(
      JSON.stringify({ timing: session.timingState, view: session.view })
    ).toBe(before);
  }
});

test('an unmeasured statement reports the gap without recursive mirror lookup', () => {
  expect(() => executionBudget('399:99', '400:0')).toThrow(
    'Unmeasured execution statement 399:99'
  );
});

test('natural title cost matches the original entry phase', () => {
  const run = capture.runs.find(run => run.name === 'black-natural')!;
  const start = run.path.find(row => row[1] === 'statement' && row[2] === 8)!;
  const end = run.path.find(row => row[1] === 'statement' && row[2] === 9)!;
  expect(
    Math.abs(
      titlePlayback(createPauseKeyboard()).durationT - (end[0] - start[0])
    )
  ).toBeLessThan(spectrumFrameT);
});

test('title fresh/held-key completion agrees with the timed keyboard traces', () => {
  for (const name of ['title-new-key', 'title-held-key']) {
    const original = timing.runs.find(run => run.name === name)!;
    const run = capture.runs.find(run => run.name === name)!;
    const origin = run.path.find(
      row => row[1] === 'statement' && row[2] === 8
    )![0];
    const end = run.path.find(
      row => row[1] === 'statement' && row[2] === 9
    )![0];
    const keyboard = createPauseKeyboard();
    const title = titlePlayback(keyboard);
    let t = origin;
    const inputs = original.events.filter(
      event => event.kind === 'keyboard' && event.t >= origin
    );
    for (const target of [end - spectrumFrameT, end + spectrumFrameT]) {
      while (inputs[0] && inputs[0].t <= target) {
        const event = inputs.shift()!;
        title.advanceT(event.t - t);
        keyboard.set(event.down?.includes('SPACE') ? 'Space' : '');
        t = event.t;
      }
      title.advanceT(target - t);
      t = target;
      expect(title.done).toBe(target > end);
    }
  }
});
