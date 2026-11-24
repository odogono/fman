import { expect, test } from 'bun:test';

import { distance, perFrame, type Point } from './clip-script/geometry';
import {
  pitchLength,
  pitchWidth,
  type ClipSide,
  type Line
} from './clip-script/model';
import { setThePitch, type Clip } from './clip-script/pitch';
import {
  arrived,
  chase,
  moveRuns,
  paceOf,
  planRun,
  reachableToward,
  type Run
} from './clip-script/run';
import { decideClip } from './clip-script/setup';
import { effortPaces, personalSpace, playerStops } from './clip-script/tuning';

const lines: readonly Line[] = [
  'keeper',
  'defence',
  'defence',
  'defence',
  'defence',
  'midfield',
  'midfield',
  'midfield',
  'midfield',
  'attack',
  'attack'
];
const side = (kit: string, skill?: number): ClipSide => ({
  keeper: '#ff8c1a',
  kit,
  players: lines.map((line, i) => ({
    label: `${kit} ${i}`,
    line,
    ...(skill === undefined ? {} : { skill })
  }))
});

/** A clip's pitch with everyone moved well out of the way. */
const emptyPitch = (skill?: number): Clip => {
  const clip = setThePitch(
    decideClip({
      attack: side('#d70000', skill),
      attackingUp: true,
      defence: side('#0000d7', skill),
      kind: 'goal',
      minute: 34,
      score: [1, 0],
      seed: 1,
      shooter: 9
    })
  );
  clip.movers.forEach((mover, i) => {
    mover.d = 2 + (i % 11) * 9;
    mover.x = i < 11 ? 1 : pitchWidth - 1;
  });
  clip.steps = clip.movers.map(() => ({ d: 0, x: 0 }));
  return clip;
};

const at = (clip: Clip, i: number, p: Point) => {
  clip.movers[i]!.d = p.d;
  clip.movers[i]!.x = p.x;
};

/** Moves `runs` on frame by frame, giving each runner's place each frame. */
const play = (clip: Clip, runs: readonly Run[], frames: number) => {
  const trail: Point[][] = runs.map(run => [{ ...clip.movers[run.i]! }]);
  for (let f = 0; f < frames; f++) {
    moveRuns(clip, runs);
    runs.forEach((run, k) => trail[k]!.push({ ...clip.movers[run.i]! }));
  }
  return trail;
};

const fastestStep = (trail: readonly Point[]) =>
  Math.max(...trail.slice(1).map((p, f) => distance(trail[f]!, p)));

test('a run is made only within the pace the player has at the effort', () => {
  const clip = emptyPitch();
  at(clip, 9, { d: 50, x: 34 });
  const top = paceOf(clip, 9, 'sprint');
  const frames = 50;
  const edge = { d: 50 + top * frames, x: 34 };
  expect(planRun(clip, 9, { by: frames, to: edge }).unreachable).toBe(false);
  const beyond = planRun(clip, 9, { by: frames - 1, to: edge });
  expect(beyond.unreachable).toBe(true);
  if (beyond.unreachable) {
    expect(beyond.stretch).toBeGreaterThan(1);
    expect(beyond.needed).toBeCloseTo(
      (top * frames) / (frames - 1) / perFrame(1)
    );
  }
  // At a jog, the same place takes far longer.
  expect(
    planRun(clip, 9, { by: frames * 2, effort: 'jog', to: edge }).unreachable
  ).toBe(true);
});

test('out of reach, a run goes as far along the way as the player can get', () => {
  const clip = emptyPitch();
  at(clip, 9, { d: 50, x: 34 });
  const top = paceOf(clip, 9, 'sprint');
  const near = { d: 55, x: 34 };
  expect(reachableToward(clip, 9, { by: 50, to: near })).toEqual(near);
  const short = reachableToward(clip, 9, { by: 50, to: { d: 90, x: 34 } });
  expect(short.d).toBeCloseTo(50 + top * 50, 3);
  expect(planRun(clip, 9, { by: 50, to: short }).unreachable).toBe(false);
});

test('an eased run is judged by its fastest, midway, not its average', () => {
  const clip = emptyPitch();
  at(clip, 9, { d: 50, x: 34 });
  const top = paceOf(clip, 9, 'sprint');
  const to = { d: 50 + top * 40, x: 34 };
  expect(planRun(clip, 9, { by: 40, to }).unreachable).toBe(false);
  expect(planRun(clip, 9, { by: 40, shape: 'eased', to }).unreachable).toBe(
    true
  );
  expect(planRun(clip, 9, { by: 60, shape: 'eased', to }).unreachable).toBe(
    false
  );
});

test("a player's pace from skill and energy decides what they can reach", () => {
  const weak = emptyPitch(1);
  const strong = emptyPitch(5);
  expect(paceOf(strong, 9, 'sprint')).toBeGreaterThan(
    paceOf(weak, 9, 'sprint')
  );
  const frames = 50;
  const to = { d: 50 + perFrame(effortPaces.sprint) * frames, x: 34 };
  at(weak, 9, { d: 50, x: 34 });
  at(strong, 9, { d: 50, x: 34 });
  expect(planRun(weak, 9, { by: frames, to }).unreachable).toBe(true);
  expect(planRun(strong, 9, { by: frames, to }).unreachable).toBe(false);
});

test('a run gets there on its frame, never faster than the player can go', () => {
  for (const shape of ['straight', 'eased', 'bent'] as const) {
    const clip = emptyPitch();
    at(clip, 9, { d: 40, x: 20 });
    clip.steps[9] = { d: 0.05, x: 0.1 };
    const to = { d: 60, x: 30 };
    const run = planRun(clip, 9, { by: 200, shape, to });
    if (run.unreachable) {
      throw new Error(`a ${shape} run should be made`);
    }
    const [trail] = play(clip, [run], 199);
    expect(arrived(clip, run)).toBe(false);
    expect(distance(trail!.at(-1)!, to)).toBeGreaterThan(0);
    play(clip, [run], 1);
    expect(arrived(clip, run)).toBe(true);
    expect(clip.movers[9]!.d).toBeCloseTo(to.d);
    expect(clip.movers[9]!.x).toBeCloseTo(to.x);
    expect(fastestStep(trail!)).toBeLessThanOrEqual(
      paceOf(clip, 9, 'sprint') + 1e-9
    );
    // Once there, they stay.
    play(clip, [run], 10);
    expect(clip.movers[9]!.d).toBeCloseTo(to.d);
  }
});

test('a runner steps round a player standing in their way, and still gets there', () => {
  const clip = emptyPitch();
  at(clip, 9, { d: 40, x: 34 });
  at(clip, 15, { d: 50, x: 34 });
  const to = { d: 60, x: 34 };
  const run = planRun(clip, 9, { by: 200, to });
  if (run.unreachable) {
    throw new Error('the run should be made');
  }
  const [trail] = play(clip, [run], 200);
  const nearest = Math.min(...trail!.map(p => distance(p, clip.movers[15]!)));
  expect(nearest).toBeGreaterThanOrEqual(personalSpace - 1e-6);
  expect(distance(clip.movers[9]!, to)).toBeLessThan(1e-6);
  expect(fastestStep(trail!)).toBeLessThanOrEqual(
    paceOf(clip, 9, 'sprint') + 1e-9
  );
});

test('a runner goes straight through someone they are meant to meet', () => {
  const clip = emptyPitch();
  at(clip, 9, { d: 40, x: 34 });
  at(clip, 15, { d: 50, x: 34 });
  const run = planRun(clip, 9, { by: 200, meets: [15], to: { d: 60, x: 34 } });
  if (run.unreachable) {
    throw new Error('the run should be made');
  }
  const [trail] = play(clip, [run], 200);
  expect(trail!.every(p => Math.abs(p.x - 34) < 1e-9)).toBe(true);
});

test('of two runners crossing, the one with more pace to spare goes round', () => {
  const clip = emptyPitch();
  at(clip, 9, { d: 40, x: 34 });
  at(clip, 15, { d: 50, x: 24 });
  const a = planRun(clip, 9, { by: 200, to: { d: 60, x: 34 } });
  const b = planRun(clip, 15, { by: 200, to: { d: 50, x: 44 } });
  if (a.unreachable || b.unreachable) {
    throw new Error('both runs should be made');
  }
  const [ta, tb] = play(clip, [a, b], 200);
  const nearest = Math.min(...ta!.map((p, f) => distance(p, tb![f]!)));
  expect(nearest).toBeGreaterThanOrEqual(personalSpace - 0.05);
  // Both are pressed as hard, so the later in the side gives way.
  expect(Math.max(...ta!.map(p => Math.abs(p.x - 34)))).toBe(0);
  expect(Math.max(...tb!.map(p => Math.abs(p.d - 50)))).toBeGreaterThan(0.5);
  expect(arrived(clip, a) && arrived(clip, b)).toBe(true);
  expect(distance(clip.movers[9]!, { d: 60, x: 34 })).toBeLessThan(1e-6);
});

test('with no time to step round, a runner keeps to their run', () => {
  const clip = emptyPitch();
  at(clip, 9, { d: 40, x: 34 });
  at(clip, 15, { d: 50, x: 34 });
  const top = paceOf(clip, 9, 'sprint');
  const run = planRun(clip, 9, {
    by: Math.ceil(20 / top),
    to: { d: 60, x: 34 }
  });
  if (run.unreachable) {
    throw new Error('the run should be made');
  }
  const [trail] = play(clip, [run], run.kind === 'arrive' ? run.frames : 0);
  expect(arrived(clip, run)).toBe(true);
  expect(fastestStep(trail!)).toBeLessThanOrEqual(top + 1e-9);
});

test('a chase follows a moving target at its pace and stops short of it', () => {
  const clip = emptyPitch();
  at(clip, 9, { d: 40, x: 34 });
  const ball = { d: 50, x: 34 };
  const run = chase(clip, 9, {
    pace: 'run',
    target: () => ball,
    within: 0.6
  });
  const pace = paceOf(clip, 9, 'run');
  const trail: Point[] = [{ ...clip.movers[9]! }];
  for (let f = 0; f < 200; f++) {
    ball.x += f < 50 ? 0.05 : 0;
    moveRuns(clip, [run]);
    trail.push({ ...clip.movers[9]! });
  }
  expect(fastestStep(trail)).toBeLessThanOrEqual(pace + 1e-9);
  expect(arrived(clip, run)).toBe(true);
  expect(distance(clip.movers[9]!, ball)).toBeCloseTo(0.6);
});

test('no run takes a player through the boards', () => {
  const clip = emptyPitch();
  at(clip, 9, { d: pitchLength - 5, x: pitchWidth - 3 });
  const run = planRun(clip, 9, {
    by: 200,
    to: { d: pitchLength + 10, x: pitchWidth + 10 }
  });
  if (run.unreachable) {
    throw new Error('the run should be made');
  }
  const [trail] = play(clip, [run], 200);
  for (const p of trail!) {
    expect(p.d).toBeLessThanOrEqual(pitchLength + playerStops.d);
    expect(p.x).toBeLessThanOrEqual(pitchWidth + playerStops.x);
  }
});
