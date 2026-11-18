import {
  clipFps,
  type ClipPlayer,
  type Facing,
  type Line,
  type Pose
} from './model';
import { boardBounce } from './tuning';

/**
 * Where a ball running on past `low` or `high` ends up, having come back off
 * the boards there.
 */
export const offBoards = (at: number, low: number, high: number) =>
  at < low
    ? low + (low - at) * boardBounce
    : at > high
      ? high - (at - high) * boardBounce
      : at;

export type Point = { d: number; x: number };
export type Mover = Point & { pose: Pose; poseFrame?: number };

export const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.d - b.d, a.x - b.x);
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
/** A unit direction turned by `angle` radians. */
export const rotated = (from: Point, angle: number): Point => ({
  d: from.d * Math.cos(angle) - from.x * Math.sin(angle),
  x: from.d * Math.sin(angle) + from.x * Math.cos(angle)
});
/** The signed angle, in radians, from one unit direction to another. */
export const angleBetween = (from: Point, to: Point) =>
  Math.atan2(from.d * to.x - from.x * to.d, from.d * to.d + from.x * to.x);
/**
 * A lofted ball's height `u` of the way along: up to `peak`, landing at
 * `landsAt` of the way, then bouncing once, a fifth as high.
 */
export const loftedHeight = (u: number, peak: number, landsAt = 0.8) =>
  u < landsAt
    ? Math.sin((Math.PI * u) / landsAt) * peak
    : Math.sin((Math.PI * (u - landsAt)) / (1 - landsAt)) * peak * 0.2;

/**
 * Where a ball bending by `bend` metres at its widest is `u` of the way from
 * `a` to `b`: on the straight line at either end, off it to the side
 * between.
 */
export const bent = (a: Point, b: Point, u: number, bend: number): Point => {
  const length = distance(a, b) || 1;
  const swing = bend * Math.sin(Math.PI * u);
  return {
    d: lerp(a.d, b.d, u) - ((b.x - a.x) / length) * swing,
    x: lerp(a.x, b.x, u) + ((b.d - a.d) / length) * swing
  };
};

/** The nearest point to `p` on the line from `a` to `b`. */
export const nearestOnLine = (p: Point, a: Point, b: Point): Point => {
  const length = distance(a, b) ** 2;
  const u = length
    ? clamp(
        ((p.d - a.d) * (b.d - a.d) + (p.x - a.x) * (b.x - a.x)) / length,
        0,
        1
      )
    : 0;
  return { d: lerp(a.d, b.d, u), x: lerp(a.x, b.x, u) };
};
/** Moves `p` out to `gap` from the line from `a` to `b`, square to it. */
export const standOff = (p: Point, a: Point, b: Point, gap: number) => {
  const near = nearestOnLine(p, a, b);
  const now = distance(p, near);
  if (now >= gap) {
    return;
  }
  // Exactly on the line, step to its left.
  const length = distance(a, b) || 1;
  const [ud, ux] = now
    ? [(p.d - near.d) / now, (p.x - near.x) / now]
    : [-(b.x - a.x) / length, (b.d - a.d) / length];
  p.d = near.d + ud * gap;
  p.x = near.x + ux * gap;
};
export const ease = (u: number) => u * u * (3 - 2 * u);
/** Metres a frame from metres a second. */
export const perFrame = (speed: number) => speed / clipFps;

/**
 * The facing for a heading on the screen: along its larger part, keeping
 * the facing before unless the heading has clearly turned.
 */
export const facingFor = (
  dx: number,
  dy: number,
  previous?: Facing
): Facing => {
  const across: Facing = dx < 0 ? 'left' : 'right';
  const along: Facing = dy < 0 ? 'up' : 'down';
  if (previous === across && Math.abs(dx) * 1.5 >= Math.abs(dy)) {
    return across;
  }
  if (previous === along && Math.abs(dy) * 1.5 >= Math.abs(dx)) {
    return along;
  }
  return Math.abs(dx) > Math.abs(dy) ? across : along;
};

export const lineOrder: readonly Line[] = [
  'keeper',
  'defence',
  'midfield',
  'attack'
];

/**
 * Where each player stands in their line: spread evenly across the pitch,
 * as a fraction of its width.
 */
export const lateralSpots = (players: readonly ClipPlayer[]) => {
  const spots = new Array<number>(players.length).fill(0.5);
  for (const line of lineOrder) {
    const inLine = players.flatMap((p, i) => (p.line === line ? [i] : []));
    inLine.forEach((i, k) => {
      spots[i] = (k + 1) / (inLine.length + 1);
    });
  }
  return spots;
};
