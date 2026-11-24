/**
 * Directed runs: a player the clip sends somewhere of their own, out of
 * `steer`'s hands. A run to a place by a frame is planned before it starts,
 * so a stage knows whether it can be made and can pick a dive, a later
 * frame or another player when it can't. A chase follows a target that
 * moves, with no frame to make. Every frame, `moveRuns` moves all the runs
 * on together, within each player's own pace, round anyone in their way
 * and inside the boards.
 *
 * A player on a run is held: the stage keeps them out of `steer`.
 */
import { clamp, distance, ease, lerp, perFrame, type Point } from './geometry';
import { pitchLength, pitchWidth } from './model';
import { type Clip } from './pitch';
import { effortPaces, personalSpace, playerStops, runRamp } from './tuning';

export type Effort = keyof typeof effortPaces;
/** How hard a run goes: an effort, or a pace of its own in metres a second. */
export type Pace = Effort | number;
/**
 * The way a run to a place goes: `bent` out of the stride the player is in,
 * `eased` setting off and pulling up gently, as a keeper across their goal,
 * or `straight` at one pace.
 */
export type RunShape = 'bent' | 'eased' | 'straight';

const metresASecond = (pace: Pace) =>
  typeof pace === 'number' ? pace : effortPaces[pace];

/** Player `i`'s pace at `pace`, in metres a frame, by their skill and energy (#236). */
export const paceOf = (clip: Clip, i: number, pace: Pace) =>
  perFrame(metresASecond(pace)) * clip.runPaces[i]!;

/** Puts player `i` at `p`, but never through the boards. */
export const place = (clip: Clip, i: number, p: Point) => {
  const mover = clip.movers[i]!;
  mover.d = clamp(p.d, -playerStops.d, pitchLength + playerStops.d);
  mover.x = clamp(p.x, -playerStops.x, pitchWidth + playerStops.x);
};

/**
 * A run onto a ball, from where player `i` stands to `to` over `frames`:
 * out of the stride they are in, so they don't turn sharply as the ball is
 * played. It gives their place `u` of the way along, and their fastest
 * pace along it, in metres a frame.
 *
 * They get from the pace they are going at to a steady pace over the first
 * part of the run and hold it, rather than speeding up all the way and
 * meeting the ball at a sprint no one could run. Any part of their stride
 * not towards the ball carries them on at first, then fades.
 */
const bentPath = (clip: Clip, i: number, to: Point, frames: number) => {
  const from = { d: clip.movers[i]!.d, x: clip.movers[i]!.x };
  const step = clip.steps[i] ?? { d: 0, x: 0 };
  const metres = distance(from, to);
  if (!metres) {
    return { at: (): Point => ({ ...to }), peak: 0 };
  }
  const way = { d: (to.d - from.d) / metres, x: (to.x - from.x) / metres };
  const needed = metres / frames;
  /** Their pace towards the ball, as a share of the pace the run needs. */
  const starting = clamp((step.d * way.d + step.x * way.x) / needed, 0, 2);
  const steady = (1 - (runRamp * starting) / 2) / (1 - runRamp / 2);
  const aside = {
    d: step.d - starting * needed * way.d,
    x: step.x - starting * needed * way.x
  };
  return {
    at: (u: number): Point => {
      const along =
        u < runRamp
          ? starting * u + ((steady - starting) * u * u) / (2 * runRamp)
          : (runRamp * (starting + steady)) / 2 + steady * (u - runRamp);
      const drift = frames * u * (1 - u) ** 2;
      return {
        d: lerp(from.d, to.d, along) + aside.d * drift,
        x: lerp(from.x, to.x, along) + aside.x * drift
      };
    },
    // The pace the run holds: setting off already going faster, they ease
    // down to it, which asks nothing of them.
    peak: steady * needed
  };
};

const pathFor = (
  clip: Clip,
  i: number,
  to: Point,
  frames: number,
  shape: RunShape
) => {
  if (shape === 'bent') {
    return bentPath(clip, i, to, frames);
  }
  const from = { d: clip.movers[i]!.d, x: clip.movers[i]!.x };
  const metres = distance(from, to);
  const way = shape === 'eased' ? ease : (u: number) => u;
  return {
    at: (u: number): Point => ({
      d: lerp(from.d, to.d, way(u)),
      x: lerp(from.x, to.x, way(u))
    }),
    // Eased in and out, a run's fastest is half as fast again as its
    // average, midway.
    peak: (metres / frames) * (shape === 'eased' ? 1.5 : 1)
  };
};

export type Run = {
  /** The frames the run has taken. */
  done: number;
  readonly i: number;
  /** Who the run is meant to meet, and so goes no way round. */
  readonly meets: readonly number[];
  /** How far the player stands off the run's way, stepping round someone. */
  offset: Point;
  /**
   * How hard the run is pressed, its fastest as a share of the top pace:
   * of two runners in each other's way, the one with more to spare gives
   * way.
   */
  readonly stretch: number;
  /** How fast they are moving off or back onto the run's way, a frame. */
  sway: Point;
  /** The player's top pace on this run, in metres a frame. */
  readonly top: number;
  readonly unreachable: false;
} & (
  | Readonly<{
      at: (u: number) => Point;
      /**
       * How far off the run's way they could stand after each frame and
       * still get back onto it by the last, at their top pace.
       */
      backBy: readonly number[];
      frames: number;
      kind: 'arrive';
      /** The pace each frame leaves to spare, for standing off the way. */
      spare: readonly number[];
      to: Point;
    }>
  | Readonly<{ kind: 'chase'; target: () => Point; within: number }>
);

/** A run that can't be made: the pace it calls for, and its share of the player's top pace. */
export type Unreachable = Readonly<{
  /** In metres a second. */
  needed: number;
  stretch: number;
  unreachable: true;
}>;

export type RunPlan = Readonly<{
  /** The frames to get there in, from now. */
  by: number;
  /** The most the run may call for; flat out unless said. */
  effort?: Pace;
  meets?: readonly number[];
  shape?: RunShape;
  to: Point;
}>;

/**
 * How far over player `i`'s top pace at `effort` a run to `to` in `by`
 * frames would take them: 1 is flat out, more can't be made.
 */
export const stretchTo = (
  clip: Clip,
  i: number,
  { by, effort = 'sprint', shape = 'straight', to }: RunPlan
) =>
  pathFor(clip, i, to, Math.max(1, by), shape).peak / paceOf(clip, i, effort);

/**
 * `plan.to`, or if player `i` can't get there in time, the furthest along
 * the way to it they can.
 */
export const reachableToward = (
  clip: Clip,
  i: number,
  plan: RunPlan
): Point => {
  if (stretchTo(clip, i, plan) <= 1) {
    return { ...plan.to };
  }
  const from = clip.movers[i]!;
  const along = (u: number): Point => ({
    d: lerp(from.d, plan.to.d, u),
    x: lerp(from.x, plan.to.x, u)
  });
  let low = 0;
  let high = 1;
  for (let k = 0; k < 30; k++) {
    const u = (low + high) / 2;
    if (stretchTo(clip, i, { ...plan, to: along(u) }) <= 1) {
      low = u;
    } else {
      high = u;
    }
  }
  return along(low);
};

/**
 * Plans player `i`'s run from where they stand to `to`, there `by` frames
 * from now, or says it can't be made at `effort`.
 */
export const planRun = (
  clip: Clip,
  i: number,
  plan: RunPlan
): Run | Unreachable => {
  const frames = Math.max(1, Math.round(plan.by));
  const shape = plan.shape ?? 'straight';
  const top = paceOf(clip, i, plan.effort ?? 'sprint');
  const path = pathFor(clip, i, plan.to, frames, shape);
  if (path.peak > top + 1e-9) {
    return {
      needed: path.peak / perFrame(1),
      stretch: path.peak / top,
      unreachable: true
    };
  }
  // Each frame's step along the run, and what that leaves to spare.
  const spare = [0];
  for (let k = 1; k <= frames; k++) {
    spare.push(
      Math.max(
        0,
        top - distance(path.at((k - 1) / frames), path.at(k / frames))
      )
    );
  }
  const backBy = new Array<number>(frames + 1).fill(0);
  for (let k = frames - 1; k >= 0; k--) {
    backBy[k] = backBy[k + 1]! + spare[k + 1]!;
  }
  return {
    at: path.at,
    backBy,
    done: 0,
    frames,
    i,
    kind: 'arrive',
    meets: plan.meets ?? [],
    offset: { d: 0, x: 0 },
    spare,
    stretch: path.peak / top,
    sway: { d: 0, x: 0 },
    to: { ...plan.to },
    top,
    unreachable: false
  };
};

/**
 * Player `i` after `target` at `pace`, stopping `within` metres of it,
 * with no frame to make.
 */
export const chase = (
  clip: Clip,
  i: number,
  {
    meets = [],
    pace,
    target,
    within = 0
  }: Readonly<{
    meets?: readonly number[];
    pace: Pace;
    target: Point | (() => Point);
    within?: number;
  }>
): Run => ({
  done: 0,
  i,
  kind: 'chase',
  meets,
  offset: { d: 0, x: 0 },
  stretch: 1,
  sway: { d: 0, x: 0 },
  target: typeof target === 'function' ? target : () => target,
  top: paceOf(clip, i, pace),
  unreachable: false,
  within
});

/** Whether a run has got there: by its frame, or within reach of what it chases. */
export const arrived = (clip: Clip, run: Run) =>
  run.kind === 'arrive'
    ? run.done >= run.frames
    : distance(clip.movers[run.i]!, run.target()) <= run.within + 1e-6;

/** The part of `v` across `way`, a unit vector. */
const across = (v: Point, way: Point) => v.x * way.d - v.d * way.x;
const along = (v: Point, way: Point) => v.d * way.d + v.x * way.x;

const length = (v: Point) => Math.hypot(v.d, v.x);
const unit = (v: Point): Point | undefined => {
  const size = length(v);
  return size ? { d: v.d / size, x: v.x / size } : undefined;
};

/** How far ahead, in frames, a runner looks for anyone in their way. */
const lookAhead = 75;
/** A runner leans into stepping round someone over this many frames. */
const swayFrames = 6;

/**
 * Where across `way`, from a run's way at `p`, a runner must stand to pass
 * `other` a personal space apart: 0 if the way passes clear. They go round
 * on `side`, -1 or 1 across `way`.
 */
const standOffFor = (p: Point, other: Point, way: Point, side: number) => {
  const off = { d: other.d - p.d, x: other.x - p.x };
  const ahead = along(off, way);
  if (Math.abs(ahead) >= personalSpace) {
    return 0;
  }
  const aside = across(off, way);
  const wanted = Math.sqrt(personalSpace ** 2 - ahead ** 2);
  return Math.abs(aside) >= wanted ? 0 : aside + side * wanted;
};

/**
 * Moves every run on a frame, together, before `steer`.
 *
 * A runner to a place aims for where their run has got to by this frame.
 * Looking ahead along it, they stand off it to pass anyone in their way a
 * personal space apart, and come back onto it once past. Of two runners
 * in each other's way, the one with more pace to spare goes round. They never go faster than their top pace, and
 * stand off only as far as they can come back from by their frame, so a
 * runner with no pace to spare keeps to their run and whoever is in the way
 * is pushed aside by `steer`. No one is gone round where the run ends, or
 * who the run meets.
 *
 * A chase heads for its target, or for the side of anyone in the way.
 */
export const moveRuns = (clip: Clip, runs: readonly (Run | undefined)[]) => {
  const live = runs.filter((run): run is Run => run !== undefined);
  const running = new Map(live.map(run => [run.i, run]));
  /** Where player `j` will be `ahead` frames on, as far as anyone can tell. */
  const whereWill = (j: number, ahead: number): Point => {
    const run = running.get(j);
    if (run?.kind !== 'arrive') {
      return clip.movers[j]!;
    }
    // Still standing off their way as far as now.
    const on = run.at(Math.min(1, (run.done + ahead) / run.frames));
    return { d: on.d + run.offset.d, x: on.x + run.offset.x };
  };
  /** Whether `a` gives way to `b`: the one with more pace to spare does. */
  const givesWay = (a: Run, j: number) => {
    const b = running.get(j);
    return (
      b === undefined ||
      a.stretch < b.stretch ||
      (a.stretch === b.stretch && a.i > b.i)
    );
  };
  const ahead: Ahead = { givesWay, whereWill };
  const moves = live.map(run =>
    run.kind === 'arrive'
      ? arriveStep(clip, run, ahead)
      : chaseStep(clip, run, ahead)
  );
  live.forEach((run, k) => {
    run.done++;
    place(clip, run.i, moves[k]!);
  });
};

/** What a runner can tell of everyone else's runs. */
type Ahead = Readonly<{
  /** Whether a runner goes round player `j`, who may be on a run too. */
  givesWay: (run: Run, j: number) => boolean;
  /** Where player `j` will be `ahead` frames on, as far as anyone can tell. */
  whereWill: (j: number, ahead: number) => Point;
}>;

/** Who runner `run` goes round: not themselves, nor who they meet. */
const inTheWay = (clip: Clip, run: Run, end: Point) => {
  const them: number[] = [];
  for (let j = 0; j < clip.count; j++) {
    if (
      j !== run.i &&
      !run.meets.includes(j) &&
      distance(clip.movers[j]!, end) >= personalSpace
    ) {
      them.push(j);
    }
  }
  return them;
};

const arriveStep = (
  clip: Clip,
  run: Run & { kind: 'arrive' },
  { givesWay, whereWill }: Ahead
): Point => {
  const mover = clip.movers[run.i]!;
  const done = Math.min(run.done + 1, run.frames);
  const left = run.frames - done;
  const aim = run.at(done / run.frames);
  // The pace they have to spare now, and how far off their way they could
  // stand and still get back onto it in time.
  const spare = run.spare[done]!;
  const reach = run.backBy[done]!;
  // How far off their way they want to stand, looking ahead along it.
  let wanted: Point = { d: 0, x: 0 };
  if (left > 0 && spare > 0) {
    const others = inTheWay(clip, run, run.to).filter(j => givesWay(run, j));
    let most = 0;
    for (let k = 0; k <= Math.min(lookAhead, left); k++) {
      const p = run.at((done + k) / run.frames);
      const next = run.at(Math.min(1, (done + k + 1) / run.frames));
      const way = unit({ d: next.d - p.d, x: next.x - p.x });
      if (!way) {
        continue;
      }
      const now = across(run.offset, way);
      for (const j of others) {
        const other = whereWill(j, k + 1);
        const aside = across({ d: other.d - p.d, x: other.x - p.x }, way);
        // The side they have started round. Else, round one on the move,
        // behind them, on the side they come from; round one standing,
        // away from where they stand off the way; dead ahead, the left.
        const standing = clip.movers[j]!;
        const moving = distance(standing, other) > 0.3;
        const from = across({ d: standing.d - p.d, x: standing.x - p.x }, way);
        const side =
          Math.abs(now) > 0.01
            ? Math.sign(now)
            : moving && Math.abs(from) > 0.01
              ? Math.sign(from)
              : Math.abs(aside) > 0.01
                ? -Math.sign(aside)
                : 1;
        const off = standOffFor(p, other, way, side);
        if (Math.abs(off) > Math.abs(most)) {
          most = off;
          wanted = { d: -way.x * off, x: way.d * off };
        }
      }
    }
    // Never further off than they can come back from in time.
    if (length(wanted) > reach) {
      const size = length(wanted);
      wanted = { d: (wanted.d / size) * reach, x: (wanted.x / size) * reach };
    }
  }
  // Towards where they want to stand off, as fast as their spare pace
  // lets, but leaning into it over a few frames rather than stepping
  // sideways at once.
  const change = { d: wanted.d - run.offset.d, x: wanted.x - run.offset.x };
  const changeSize = length(change);
  const wantedSway = changeSize
    ? {
        d: (change.d / changeSize) * Math.min(changeSize, spare),
        x: (change.x / changeSize) * Math.min(changeSize, spare)
      }
    : { d: 0, x: 0 };
  const turn = {
    d: wantedSway.d - run.sway.d,
    x: wantedSway.x - run.sway.x
  };
  const turnSize = length(turn);
  const lean = spare / swayFrames;
  let sway =
    turnSize > lean
      ? {
          d: run.sway.d + (turn.d / turnSize) * lean,
          x: run.sway.x + (turn.x / turnSize) * lean
        }
      : wantedSway;
  const swaySize = length(sway);
  if (swaySize > spare) {
    sway = { d: (sway.d / swaySize) * spare, x: (sway.x / swaySize) * spare };
  }
  let offset = { d: run.offset.d + sway.d, x: run.offset.x + sway.x };
  const size = length(offset);
  if (left === 0) {
    offset = { d: 0, x: 0 };
  } else if (size > reach) {
    offset = { d: (offset.d / size) * reach, x: (offset.x / size) * reach };
  }
  run.sway = { d: offset.d - run.offset.d, x: offset.x - run.offset.x };
  run.offset = offset;
  return { d: aim.d + offset.d, x: aim.x + offset.x };
};

const chaseStep = (
  clip: Clip,
  run: Run & { kind: 'chase' },
  { givesWay, whereWill }: Ahead
): Point => {
  const mover = clip.movers[run.i]!;
  const target = run.target();
  const gap = distance(mover, target);
  const go = clamp(gap - run.within, 0, run.top);
  if (!go) {
    return { d: mover.d, x: mover.x };
  }
  const way = { d: (target.d - mover.d) / gap, x: (target.x - mover.x) / gap };
  // The nearest player in the way before the target, gone round on the
  // side the chaser is already on.
  let towards = target;
  let nearest = Infinity;
  for (const j of inTheWay(clip, run, target).filter(j => givesWay(run, j))) {
    const other = whereWill(j, 1);
    const off = { d: other.d - mover.d, x: other.x - mover.x };
    const ahead = along(off, way);
    const aside = across(off, way);
    if (
      ahead <= 0 ||
      ahead >= gap ||
      Math.abs(aside) >= personalSpace ||
      ahead >= nearest
    ) {
      continue;
    }
    nearest = ahead;
    const side = aside > 0 ? -1 : 1;
    const clear = personalSpace * 1.05;
    towards = {
      d: other.d - way.x * side * clear,
      x: other.x + way.d * side * clear
    };
  }
  const reach = distance(mover, towards);
  const step = Math.min(go, reach);
  return reach
    ? {
        d: mover.d + ((towards.d - mover.d) / reach) * step,
        x: mover.x + ((towards.x - mover.x) / reach) * step
      }
    : { d: mover.d, x: mover.x };
};
