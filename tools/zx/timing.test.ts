import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { expect, test } from 'bun:test';

type Event = {
  count?: number;
  de?: number;
  down?: string[];
  edges?: [number, number, number, number][];
  enteredT?: number;
  kind: string;
  line?: number;
  requestedT?: number;
  returnedT?: number;
  romFrames?: number;
  seed?: number;
  t: number;
  values?: Record<string, unknown>;
};
type Run = {
  endT: number;
  entry: string;
  events: Event[];
  final: { values: Record<string, unknown> };
  imageHashes: string[];
  initialRegisters: number[];
  name: string;
  originT: number;
  patches: unknown[];
  sampling: { maxInputLatenessT: number; maxVideoLatenessT: number };
  snapshotSha256: string;
  video: [number, number, number, number][];
};
const reference: {
  basicSha256: string;
  clockHz: number;
  clockVerification: unknown[];
  frameT: number;
  intActiveT: number;
  pixels: Record<string, string>;
  romSha256: string;
  runs: Run[];
  schema: number;
  scriptSha256: string;
} = await Bun.file(
  new URL('../../web/src/sim/fixtures/spectrum-timing.json', import.meta.url)
).json();
const scriptFile = Bun.file(new URL('./inputs/timing.json', import.meta.url));
const script: {
  defaults: { snapshotSha256: string };
  runs: { name: string }[];
} = await scriptFile.json();
const sha256 = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');
const runNamed = (name: string) => {
  const run = reference.runs.find(run => run.name === name);
  if (!run) {
    throw new Error(`Missing capture: ${name}`);
  }
  return run;
};
const eventAt = (run: Run, kind: string, line: number, index = 0) => {
  const event = run.events.filter(
    event => event.kind === kind && event.line === line
  )[index];
  if (!event) {
    throw new Error(`${run.name}: missing ${kind} at BASIC ${line}`);
  }
  return event;
};
const pauseDuration = (run: Run, line: number, index = 0) => {
  const entry = eventAt(run, 'pause-enter', line, index);
  const exit = run.events.find(
    event => event.kind === 'pause-exit' && event.enteredT === entry.t
  );
  if (!exit) {
    throw new Error(`${run.name}: unfinished pause`);
  }
  return exit.t - entry.t;
};

test('pins the input script, original identities and verified 48K configuration', async () => {
  expect(reference.schema).toBe(1);
  expect(reference.scriptSha256).toBe(
    sha256(new Uint8Array(await scriptFile.arrayBuffer()))
  );
  expect(reference.romSha256).toBe(
    'd55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42'
  );
  expect(reference.basicSha256).toBe(
    '5289e111f8f041fa9a58ae41e0567e31951d41552702bd2f525acae71bf6ece6'
  );
  expect([reference.clockHz, reference.frameT, reference.intActiveT]).toEqual([
    3_500_000, 69_888, 32
  ]);
  expect(reference.clockVerification).toEqual([
    { core: 'CCMIOSimulator', passed: 38 },
    { core: 'CMIOSimulator', passed: 38 },
    {
      case: 'ROM BEEPER HL=10 DE=1',
      outInstructionT: [189, 347, 505, 663],
      returnT: 731
    }
  ]);
  expect(reference.runs.map(run => run.name)).toEqual(
    script.runs.map(run => run.name)
  );
  for (const run of reference.runs) {
    expect(run.snapshotSha256).toBe(script.defaults.snapshotSha256);
    expect(run.patches).toEqual([]);
    expect(run.initialRegisters[25]).toEqual(run.originT);
  }
});

test('captures every video sample and retains input quantization explicitly', () => {
  for (const run of reference.runs) {
    let previousFrame = Math.floor(run.originT / reference.frameT);
    let maxVideo = 0;
    let maxInput = 0;
    for (const [frame, t, image, border] of run.video) {
      const lateness = t - frame * reference.frameT;
      if (
        frame !== previousFrame + 1 ||
        lateness < 0 ||
        lateness >= reference.frameT ||
        !reference.pixels[run.imageHashes[image] ?? ''] ||
        border < 0 ||
        border > 7
      ) {
        throw new Error(`${run.name}: invalid video sample at ${t}`);
      }
      previousFrame = frame;
      maxVideo = Math.max(maxVideo, lateness);
    }
    expect(previousFrame).toBe(Math.floor(run.endT / reference.frameT));
    for (const event of run.events) {
      if (event.kind === 'keyboard') {
        if (event.requestedT === undefined) {
          throw new Error('Missing requested input time');
        }
        expect(event.t).toBeGreaterThanOrEqual(event.requestedT);
        maxInput = Math.max(maxInput, event.t - event.requestedT);
      }
    }
    expect(run.sampling).toEqual({
      maxInputLatenessT: maxInput,
      maxVideoLatenessT: maxVideo
    });
  }
});

test('video observations decode to full 256×192 RGBA frames with matching hashes', () => {
  for (const [hash, data] of Object.entries(reference.pixels)) {
    const rgba = inflateSync(Buffer.from(data, 'base64'));
    expect(rgba.length).toBe(256 * 192 * 4);
    expect(sha256(rgba)).toBe(hash);
  }
});

test('covers both directions and kits, dribbles, kicks, collisions, goals and misses', () => {
  for (const [name, kit] of [
    ['black-level7', 0],
    ['white-level7', 7]
  ] as const) {
    const run = runNamed(name);
    expect(run.final.values.tco).toBe(kit);
    expect(run.final.values.l1).toBe(7);
    for (const line of [300, 400, 368, 468, 290, 346, 446]) {
      eventAt(run, 'checkpoint', line);
    }
    for (const line of [343, 443, 352, 452]) {
      eventAt(run, 'beep-enter', line);
    }
  }
});

test('distinguishes natural expiry, a fresh press, and a key held before a pause', () => {
  const natural = runNamed('black-natural');
  const fresh = runNamed('black-new-key');
  const held = runNamed('black-held-key');
  expect(pauseDuration(natural, 447)).toBe(13_948_293);
  expect(pauseDuration(fresh, 447)).toBe(1_438_790);
  // The hold starts before the second pause (the first miss). That pending
  // key flag and later repeats can also affect pauses after release.
  expect(pauseDuration(held, 447)).toBe(pauseDuration(natural, 447));
  expect(pauseDuration(held, 447, 1)).toBe(16_348);
  expect(
    held.events.some(
      event =>
        event.kind === 'pause-exit' &&
        event.enteredT !== undefined &&
        event.t - event.enteredT < reference.frameT
    )
  ).toBe(true);
  for (const run of [fresh, held]) {
    const press = run.events.find(
      event => event.kind === 'keyboard' && event.down?.includes('SPACE')
    );
    if (!press) {
      throw new Error('Missing pause input');
    }
    const entry = eventAt(run, 'pause-enter', 447, run === held ? 1 : 0);
    expect(press.t > entry.t).toBe(run === fresh);
    expect(eventAt(run, 'checkpoint', 400).seed).toBe(
      eventAt(natural, 'checkpoint', 400).seed
    );
  }
});

test('includes title/error timing and nine original cup-victory tones', () => {
  expect(pauseDuration(runNamed('black-natural'), 8)).toBe(20_908_136);
  expect(pauseDuration(runNamed('title-new-key'), 8)).toBeLessThan(
    pauseDuration(runNamed('black-natural'), 8)
  );
  expect(pauseDuration(runNamed('title-held-key'), 8)).toBe(2_176_971);
  expect(eventAt(runNamed('colour-error'), 'pause-enter', 8966).count).toBe(
    200
  );
  const cup = runNamed('cup-victory-probe');
  expect(cup.entry).toContain('isolated probe');
  expect(
    cup.events.filter(
      event => event.kind === 'beep-enter' && event.line === 5216
    )
  ).toHaveLength(9);
});

test('retains variable BEEPER costs, output transitions and lost ROM clock ticks', () => {
  const durations = new Set<number>();
  let disabledInterruptsObserved = false;
  for (const run of reference.runs) {
    for (const event of run.events) {
      if (event.kind !== 'beep-enter') {
        continue;
      }
      if (event.returnedT === undefined || !event.edges) {
        throw new Error(`${run.name}: unfinished BEEPER`);
      }
      durations.add(event.returnedT - event.t);
      let previous = event.t;
      for (const [start, end, port, level] of event.edges) {
        expect(start).toBeGreaterThanOrEqual(previous);
        expect(end).toBeGreaterThan(start);
        expect(end).toBeLessThan(event.returnedT);
        expect(port & 1).toBe(0);
        expect(level === 0 || level === 1).toBe(true);
        previous = start;
      }
      const exit = run.events.find(
        exit => exit.kind === 'beep-exit' && exit.enteredT === event.t
      );
      if (
        exit &&
        event.returnedT - event.t > reference.frameT &&
        exit.romFrames === event.romFrames
      ) {
        disabledInterruptsObserved = true;
      }
    }
  }
  expect(durations.size).toBeGreaterThan(20);
  expect(disabledInterruptsObserved).toBe(true);
});
