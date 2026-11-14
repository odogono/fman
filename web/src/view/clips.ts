import type { Moment } from '../sim/moments';

// Modern mode's sprite highlights (#144): each moment plays as a clip, the
// build-up, the moment and the reaction, at real-world pace. Everything in a
// clip but the moment is made up for show from a seed of the clip's own, so
// the same moment always plays the same clip and nothing in it touches the
// game. A script is worked out whole, frame by frame, when it is made.

/** Frames a second, as the sim counts them. */
export const clipFps = 50;
/** The pitch, in metres: across the screen, then up and down it. */
export const pitchWidth = 68;
export const pitchLength = 105;
/** The goal mouth's half width, in metres. */
const goalHalf = 3.66;
/** The patch of pitch the camera shows across, in metres, and zoomed in. */
export const cameraWide = 40;
export const cameraZoomed = 30;
/** The camera's patch is this much taller than it is wide. */
export const cameraAspect = 5 / 4;
/** The minute caption shows over a clip's first half second. */
export const captionFrames = 25;

export type SaveOutcome = 'dive' | 'hold' | 'parry';
export type ClearanceOutcome = 'block' | 'interception';
export type MissOutcome = 'over' | 'post' | 'wide-left' | 'wide-right';
/**
 * How a moment plays out: a goal, a kind of save, a kind of clearance
 * (#150) or a kind of near miss.
 */
export type ClipOutcome = 'goal' | ClearanceOutcome | MissOutcome | SaveOutcome;
export const saveOutcomes: readonly SaveOutcome[] = ['dive', 'hold', 'parry'];
export const clearanceOutcomes: readonly ClearanceOutcome[] = [
  'interception',
  'block'
];
export const missOutcomes: readonly MissOutcome[] = [
  'post',
  'wide-left',
  'wide-right',
  'over'
];

/**
 * How the build-up starts: in open play, or from a free kick, a throw-in,
 * a goal kick or a corner.
 */
export type Restart =
  'corner' | 'free-kick' | 'goal-kick' | 'open-play' | 'throw-in';
export const restarts: readonly Restart[] = [
  'open-play',
  'free-kick',
  'throw-in',
  'goal-kick',
  'corner'
];
const restartNames: Record<Restart, string> = {
  corner: 'Corner',
  'free-kick': 'Free kick',
  'goal-kick': 'Goal kick',
  'open-play': '',
  'throw-in': 'Throw-in'
};

/** Where a player lines up. */
export type Line = 'attack' | 'defence' | 'keeper' | 'midfield';
export type ClipPlayer = Readonly<{
  /** Readiness to play, 1 to 20; a player without one is never tired. */
  energy?: number;
  label: string;
  line: Line;
}>;
/** One side in a clip: its kit, its goalkeeper's colour and its 11 or fewer. */
export type ClipSide = Readonly<{
  /** The home side, whose fans fill most of the stands (#157). */
  home?: boolean;
  keeper: string;
  kit: string;
  players: readonly ClipPlayer[];
}>;

export type ClipInput = Readonly<{
  /** The side that made the chance, and the side defending it. */
  attack: ClipSide;
  /** The attacking side shoots up the screen. */
  attackingUp: boolean;
  defence: ClipSide;
  kind: Moment['kind'];
  minute: number;
  /** Forces the outcome, for the debug page; the seed picks it otherwise. */
  outcome?: ClipOutcome;
  /** Forces how the build-up starts, for the debug page. */
  restart?: Restart;
  seed: number;
  /** The named player: an index into `attack.players`. */
  shooter: number;
}>;

/** What a player is doing, for the drawing. */
export type Pose =
  'celebrate' | 'dive' | 'head' | 'hold' | 'kick' | 'run' | 'stand';
const poses: readonly Pose[] = [
  'run',
  'dive',
  'celebrate',
  'head',
  'hold',
  'kick',
  'stand'
];
/** Which way a player faces on the screen. */
export type Facing = 'down' | 'left' | 'right' | 'up';
const facings: readonly Facing[] = ['up', 'down', 'left', 'right'];
/**
 * A state shown by a status icon over a player's head, in the zoomed view
 * only (#146). Only tiredness so far.
 */
export type Status = 'tired';
/** The most players a side shows tired in one clip. */
export const tiredPerSide = 3;
/** A kick shows for this many frames from the touch. */
const kickFrames = 10;
/** Passes longer than this, in metres, go in the air. */
const longestGroundPass = 30;
/** The final pass is played from no further than about this from the shooter's spot. */
const finalPassRange = 30;
/** A pass takes at least this long, in seconds. */
const passMinimum = 0.6;
/** How fast a receiver runs onto a pass, in metres a second. */
const receiverSpeed = 7;
/** A defender this close to a pass's path, in metres, blocks it. */
const laneWidth = 2;
/** Defenders keep at least this far from a pass along the ground. */
const laneClearance = 1;
/** The longest pass back, in metres, from the receiver's spot. */
const longestBackPass = 11;
/** The ball is this far ahead of a carrier's feet, in metres. */
const stride = 0.8;
/**
 * Players keep at least this far apart, in metres, about a sprite's width,
 * so no one is drawn standing inside anyone else.
 */
const personalSpace = 1.3;
/** A defender further than this from their place, in metres, sprints back. */
const recoveryGap = 3;
/** How far apart, in metres, a back line lets its players get as it moves. */
const backLineGive = 2;
/** How far a back line's players may sway out of line, in metres. */
const backLineSway = 0.4;

export type ClipPhase = 'build-up' | 'moment' | 'reaction' | 'zoom';

export type FramePlayer = Readonly<{
  facing: Facing;
  keeper: boolean;
  pose: Pose;
  side: 'attack' | 'defence';
  status?: Status;
  x: number;
  y: number;
}>;

/** One frame of a clip, in metres on a pitch whose top edge is y = 0. */
export type ClipFrame = Readonly<{
  /** `height` is 0 on the ground, up to 1 well over the bar. */
  ball: Readonly<{ height: number; x: number; y: number }>;
  /** The middle of the patch on show, and its width. */
  camera: Readonly<{ width: number; x: number; y: number }>;
  caption?: string;
  /** The crowd is on its feet, after a goal (#157). */
  cheer?: boolean;
  /** The named player's label, in the zoomed view only. */
  label?: Readonly<{ text: string; x: number; y: number }>;
  /** The overview of the whole pitch shows, except while zoomed in. */
  minimap: boolean;
  phase: ClipPhase;
  players: readonly FramePlayer[];
}>;

export type ClipPass = Readonly<{
  end: number;
  from: string;
  /** A pass in open play, or the restart that starts the build-up. */
  kind: 'pass' | Exclude<Restart, 'open-play'>;
  /** The passer and receiver: indexes into `attack.players`. */
  passer: number;
  receiver: number;
  start: number;
  to: string;
}>;

export type ClipScript = Readonly<{
  frame: (at: number) => ClipFrame;
  input: ClipInput;
  /** The clip's length in frames, as the sim holds it. */
  length: number;
  /** The frame the clip reaches its moment, when the score and ticker change. */
  momentFrame: number;
  outcome: ClipOutcome;
  passes: readonly ClipPass[];
  /** The frames each phase after the build-up starts. */
  phases: Readonly<{ moment: number; reaction: number; zoom: number }>;
  restart: Restart;
}>;

/** FNV-1a over a string: the clip's seed. */
export const hashSeed = (text: string) => {
  let hash = 0x81_1c_9d_c5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01_00_01_93);
  }
  return hash >>> 0;
};

/** mulberry32: a small stream of its own, apart from the game's RND. */
const createClipRng = (seed: number) => {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d_2b_79_f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  return {
    between: (low: number, high: number) => low + (high - low) * next(),
    int: (low: number, high: number) =>
      low + Math.floor(next() * (high - low + 1)),
    next,
    pick: <T>(list: readonly T[]) => list[Math.floor(next() * list.length)]!
  };
};
type ClipRng = ReturnType<typeof createClipRng>;

/**
 * A near miss goes wide most often, as in the original, where only a few
 * hit the post (#150): wide 60%, split by side, over the bar 25%, post 15%.
 */
const drawMiss = (rng: ClipRng): MissOutcome => {
  const roll = rng.next();
  return roll < 0.3
    ? 'wide-left'
    : roll < 0.6
      ? 'wide-right'
      : roll < 0.85
        ? 'over'
        : 'post';
};

/** The outcome the seed picks for a kind. */
const drawOutcome = (rng: ClipRng, kind: Moment['kind']): ClipOutcome =>
  kind === 'goal'
    ? 'goal'
    : kind === 'save'
      ? rng.pick(saveOutcomes)
      : kind === 'clearance'
        ? rng.pick(clearanceOutcomes)
        : drawMiss(rng);

/** The outcome a clip's seed picks for a kind: the clip's first draw. */
export const seededOutcome = (seed: number, kind: Moment['kind']) =>
  drawOutcome(createClipRng(seed), kind);

/** The kind of moment an outcome plays. */
export const outcomeKind = (outcome: ClipOutcome): Moment['kind'] =>
  outcome === 'goal'
    ? 'goal'
    : (saveOutcomes as readonly string[]).includes(outcome)
      ? 'save'
      : (clearanceOutcomes as readonly string[]).includes(outcome)
        ? 'clearance'
        : 'near-miss';

type Point = { d: number; x: number };
type Mover = Point & { pose: Pose };

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));
const distance = (a: Point, b: Point) => Math.hypot(a.d - b.d, a.x - b.x);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
/** The nearest point to `p` on the line from `a` to `b`. */
const nearestOnLine = (p: Point, a: Point, b: Point): Point => {
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
const standOff = (p: Point, a: Point, b: Point, gap: number) => {
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
const ease = (u: number) => u * u * (3 - 2 * u);
/** Metres a frame from metres a second. */
const perFrame = (speed: number) => speed / clipFps;
/** Slower than this, in metres a second, a player is standing. */
const standingSpeed = 0.5;
/** Slower than this, in metres a second, a player is walking. */
const walkingSpeed = 2.5;

/**
 * The facing for a heading on the screen: along its larger part, keeping
 * the facing before unless the heading has clearly turned.
 */
const facingFor = (dx: number, dy: number, previous?: Facing): Facing => {
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

const lineOrder: readonly Line[] = ['keeper', 'defence', 'midfield', 'attack'];

/**
 * Where each player stands in their line: spread evenly across the pitch,
 * as a fraction of its width.
 */
const lateralSpots = (players: readonly ClipPlayer[]) => {
  const spots = new Array<number>(players.length).fill(0.5);
  for (const line of lineOrder) {
    const inLine = players.flatMap((p, i) => (p.line === line ? [i] : []));
    inLine.forEach((i, k) => {
      spots[i] = (k + 1) / (inLine.length + 1);
    });
  }
  return spots;
};

/**
 * Who shows tired in a clip: each player with a chance of
 * `(1 - energy / 20) * minute / 90`, so more often late on and when
 * spent, and at most three a side. It draws from a stream of its own off
 * the clip's seed, so the rest of the clip plays as it would without it.
 */
const tiredPlayers = (input: ClipInput) => {
  const rng = createClipRng(hashSeed(`${input.seed}|tired`));
  const late = clamp(input.minute / 90, 0, 1);
  const tired = new Set<number>();
  let offset = 0;
  for (const side of [input.attack, input.defence]) {
    const rolled = side.players.flatMap((p, i) => {
      const roll = rng.next();
      if (p.energy === undefined) {
        return [];
      }
      const chance = (1 - clamp(p.energy, 0, 20) / 20) * late;
      return roll < chance ? [{ i: offset + i, margin: roll / chance }] : [];
    });
    for (const { i } of rolled
      .toSorted((a, b) => a.margin - b.margin)
      .slice(0, tiredPerSide)) {
      tired.add(i);
    }
    offset += side.players.length;
  }
  return tired;
};

/**
 * Plays out a clip. Positions are worked out in the attacking side's own
 * terms, `d` metres up from its own goal line and `x` across from its left,
 * then turned to the screen.
 */
export const createClipScript = (input: ClipInput): ClipScript => {
  const rng = createClipRng(input.seed);
  const drawnOutcome = input.outcome ?? drawOutcome(rng, input.kind);
  const attackers = input.attack.players;
  const defenders = input.defence.players;
  const count = attackers.length + defenders.length;
  const attackSpots = lateralSpots(attackers);
  const defenceSpots = lateralSpots(defenders);
  // Each player has a little way of their own: a set offset and a sway.
  const quirks = Array.from({ length: count }, () => ({
    d: rng.between(-3, 3),
    period: rng.between(3, 5) * clipFps,
    phase: rng.between(0, Math.PI * 2),
    x: rng.between(-2.5, 2.5)
  }));
  const shooter = clamp(input.shooter, 0, Math.max(0, attackers.length - 1));
  const attackKeeper = attackers.findIndex(p => p.line === 'keeper');
  const defenceKeeper = defenders.findIndex(p => p.line === 'keeper');
  const keeperSlot = defenceKeeper < 0 ? -1 : attackers.length + defenceKeeper;

  /** Where the back line wants to stand, given the ball. */
  const backLineFor = (ball: Point) => clamp(ball.d + 14, 55, 99);
  /**
   * The depth the back line holds while play goes on: where it wants to be,
   * but never more than `backLineGive` from any of its players but the one
   * closing the ball down, so it moves as one and waits for a laggard.
   */
  let backLineDepth: number | undefined;
  // Where each player wants to be, given the ball.
  const target = (i: number, ball: Point, frame: number): Point => {
    const quirk = quirks[i]!;
    const sway = Math.sin(quirk.phase + (frame / quirk.period) * Math.PI * 2);
    if (i < attackers.length) {
      const { line } = attackers[i]!;
      if (line === 'keeper') {
        return { d: clamp(ball.d - 45, 6, 20), x: 34 };
      }
      const depth =
        line === 'defence'
          ? clamp(ball.d - 20, 12, 60)
          : line === 'midfield'
            ? clamp(ball.d, 25, 80)
            : clamp(ball.d + 16, 40, 92);
      const across = pitchWidth * attackSpots[i]! + 0.25 * (ball.x - 34);
      return {
        d: depth + quirk.d + sway * 1.5,
        x: clamp(across + quirk.x, 3, pitchWidth - 3)
      };
    }
    const j = i - attackers.length;
    const { line } = defenders[j]!;
    if (line === 'keeper') {
      return { d: 104, x: 34 + (ball.x - 34) * 0.15 };
    }
    const depth =
      line === 'defence'
        ? (backLineDepth ?? backLineFor(ball))
        : line === 'midfield'
          ? clamp(ball.d + 2, 40, 90)
          : clamp(ball.d - 12, 30, 75);
    const across =
      34 + (pitchWidth * defenceSpots[j]! - 34) * 0.75 + 0.35 * (ball.x - 34);
    return {
      // The back line holds one depth, to keep the attackers offside.
      d:
        line === 'defence'
          ? depth + sway * backLineSway
          : depth + quirk.d + sway * 1.5,
      x: clamp(across + quirk.x, 3, pitchWidth - 3)
    };
  };

  // The ball starts in the attacking side's own half, with a player who
  // isn't the shooter if anyone else can start it.
  const ballStart = { d: rng.between(20, 45), x: rng.between(10, 58) };
  const outfield = attackers.flatMap((p, i) =>
    p.line === 'keeper' && i !== shooter ? [] : [i]
  );
  const others = outfield.filter(i => i !== shooter);
  // An interception needs someone to make the final pass; alone, the
  // shooter is blocked instead.
  let outcome: ClipOutcome =
    drawnOutcome === 'interception' && !others.length ? 'block' : drawnOutcome;
  const deep = others.filter(i => attackers[i]!.line !== 'attack');
  let starter = others.length ? rng.pick(deep.length ? deep : others) : shooter;
  // Of the build-ups, 40% start in open play, 20% each from a free kick and
  // a throw-in, and 10% each from a goal kick and a corner. A side with no
  // keeper but the shooter takes no goal kick.
  const restartRoll = rng.next();
  const goalKicker =
    attackKeeper >= 0 && attackKeeper !== shooter ? attackKeeper : -1;
  // A defender or keeper who shoots has come up for a set piece: a corner
  // 60% of the time, a free kick 40%.
  const setPiece =
    attackers[shooter]?.line === 'defence' ||
    attackers[shooter]?.line === 'keeper';
  const drawn: Restart =
    input.restart ??
    (setPiece ? (restartRoll < 0.6 ? 'corner' : 'free-kick') : undefined) ??
    (restartRoll < 0.4
      ? 'open-play'
      : restartRoll < 0.6
        ? 'free-kick'
        : restartRoll < 0.8
          ? 'throw-in'
          : restartRoll < 0.9
            ? 'goal-kick'
            : 'corner');
  const restart: Restart =
    !others.length || (drawn === 'goal-kick' && goalKicker < 0)
      ? 'open-play'
      : drawn;
  const touchline = rng.next() < 0.5 ? 0 : pitchWidth;
  if (restart === 'throw-in') {
    ballStart.d = rng.between(20, 80);
    ballStart.x = touchline;
  } else if (restart === 'free-kick') {
    ballStart.d = rng.between(30, 70);
    ballStart.x = rng.between(12, 56);
  } else if (restart === 'goal-kick') {
    starter = goalKicker;
    ballStart.d = 5.5;
    ballStart.x = 34 + (touchline === 0 ? -9.16 : 9.16);
  } else if (restart === 'corner') {
    ballStart.d = pitchLength - 0.3;
    ballStart.x = touchline === 0 ? 0.3 : pitchWidth - 0.3;
  }
  const movers: Mover[] = Array.from({ length: count }, (_, i) => ({
    ...target(i, ballStart, 0),
    pose: 'run'
  }));
  movers[starter]!.d =
    ballStart.d -
    (restart === 'free-kick' || restart === 'goal-kick'
      ? 1.5
      : restart === 'corner'
        ? -0.6
        : 0.8);
  movers[starter]!.x =
    restart === 'throw-in' || restart === 'corner'
      ? touchline + (touchline === 0 ? -0.8 : 0.8)
      : ballStart.x;
  const ball = { ...ballStart, height: 0 };
  /** Defenders stand back this far from a free kick while it is set. */
  let keepAway: Point | undefined;
  /** Attackers stay onside until the shot. */
  let offside = true;

  /**
   * How far up the pitch an attacker may wait without being offside: level
   * with the second-last defender, the ball, or halfway, whichever is
   * furthest forward. Only a run onto a pass already played goes beyond it.
   */
  const offsideLine = () => {
    const depths = movers
      .slice(attackers.length)
      .map(m => m.d)
      .sort((a, b) => b - a);
    return Math.max(pitchLength / 2, ball.d, depths[1] ?? 0);
  };
  {
    const line = offsideLine();
    movers.forEach((mover, i) => {
      if (i < attackers.length && i !== starter) {
        mover.d = Math.min(mover.d, line - 0.5);
      }
    });
  }

  // Frames are written as they play: x and y on the screen, then poses
  // and facings.
  const xs: number[][] = [];
  const ys: number[][] = [];
  const poseLog: number[][] = [];
  const facingLog: number[][] = [];
  /**
   * The frame each player's latest kick shows until, and the frame they face
   * where they played the ball until, kicked or thrown.
   */
  const kickUntil = new Array<number>(count).fill(-1);
  const aimUntil = new Array<number>(count).fill(-1);
  const aims: (Point | undefined)[] = new Array(count);
  const aimAt = (i: number, aim: Point) => {
    if (i >= 0) {
      aimUntil[i] = frame + kickFrames;
      aims[i] = { ...aim };
    }
  };
  const kick = (i: number, aim: Point) => {
    if (i >= 0) {
      kickUntil[i] = frame + kickFrames;
      aimAt(i, aim);
    }
  };
  const balls: [number, number, number][] = [];
  const cameraTrack: [number, number, number][] = [];
  const toScreen = (p: Point): [number, number] =>
    input.attackingUp ? [p.x, pitchLength - p.d] : [pitchWidth - p.x, p.d];
  let camera = { d: ball.d + 8, width: cameraWide, x: ball.x };
  let cameraFocus: () => Point = () => ({ d: ball.d + 8, x: ball.x });
  let cameraWidth = cameraWide;
  /** Where each player was at the last frame, and their step since. */
  const seen: Point[] = [];
  const steps: Point[] = [];
  const record = () => {
    movers.forEach((mover, i) => {
      const last = seen[i] ?? mover;
      steps[i] = { d: mover.d - last.d, x: mover.x - last.x };
      seen[i] = { d: mover.d, x: mover.x };
    });
    xs.push([]);
    ys.push([]);
    poseLog.push([]);
    facingLog.push([]);
    const at = xs.length - 1;
    const [bx, by] = toScreen(ball);
    movers.forEach((mover, i) => {
      const [x, y] = toScreen(mover);
      xs[at]!.push(x);
      ys[at]!.push(y);
      // A player who has just played the ball faces where it went; otherwise they
      // face the way they move, or else the ball. Standing still, a runner
      // stands, and a touch shows as a kick.
      const dx = at ? x - xs[at - 1]![i]! : 0;
      const dy = at ? y - ys[at - 1]![i]! : 0;
      const moving = Math.hypot(dx, dy) > perFrame(standingSpeed);
      const previous = at ? facings[facingLog[at - 1]![i]!]! : undefined;
      const aim = at < aimUntil[i]! ? aims[i] : undefined;
      const [ax, ay] = aim ? toScreen(aim) : [bx, by];
      facingLog[at]!.push(
        facings.indexOf(
          aim
            ? facingFor(ax - x, ay - y, previous)
            : moving
              ? facingFor(dx, dy, previous)
              : facingFor(bx - x, by - y, previous)
        )
      );
      const pose =
        (mover.pose === 'run' || mover.pose === 'hold') && at < kickUntil[i]!
          ? 'kick'
          : mover.pose === 'run' && !moving
            ? 'stand'
            : mover.pose;
      poseLog[at]!.push(poses.indexOf(pose));
    });
    balls.push([bx, by, ball.height]);
    const focus = cameraFocus();
    const halfWidth = cameraWidth / 2;
    const halfLength = (cameraWidth * cameraAspect) / 2;
    // The camera eases after its focus, but never lets the ball out of shot.
    const inShot = (p: Point): Point => ({
      d: clamp(p.d, ball.d - halfLength + 3, ball.d + halfLength - 3),
      x: clamp(p.x, ball.x - halfWidth + 3, ball.x + halfWidth - 3)
    });
    camera = {
      ...inShot({
        d: lerp(camera.d, focus.d, at === 0 ? 1 : 0.08),
        x: lerp(camera.x, focus.x, at === 0 ? 1 : 0.08)
      }),
      width: cameraWidth
    };
    const shown = inShot({
      d: clamp(camera.d, halfLength - 8, pitchLength - halfLength + 8),
      x: clamp(camera.x, halfWidth - 8, pitchWidth - halfWidth + 8)
    });
    const [cx, cy] = toScreen(shown);
    cameraTrack.push([cx, cy, cameraWidth]);
  };

  /** Moves `point` out to 9.15 m from a free kick at `spot`. */
  const standBack = (point: Point, spot: Point) => {
    const gap = distance(point, spot);
    if (gap < 9.15) {
      point.d = spot.d + (gap ? (point.d - spot.d) / gap : 1) * 9.15;
      point.x = spot.x + (gap ? (point.x - spot.x) / gap : 0) * 9.15;
    }
  };

  /**
   * Players closer than `personalSpace` step apart, each half the way, or
   * all of it when the other is `held` to a run of their own.
   */
  const separate = (held: ReadonlySet<number>) => {
    for (let i = 0; i < count; i++) {
      const a = movers[i]!;
      for (let j = i + 1; j < count; j++) {
        const b = movers[j]!;
        // Most pairs are far apart on one axis or the other: skip them
        // before working out how far apart they are, as this runs for
        // every pair in every frame.
        const dd = b.d - a.d;
        const dx = b.x - a.x;
        if (dd >= personalSpace || dd <= -personalSpace) {
          continue;
        }
        if (dx >= personalSpace || dx <= -personalSpace) {
          continue;
        }
        const squared = dd * dd + dx * dx;
        if (squared >= personalSpace * personalSpace) {
          continue;
        }
        const heldA = held.has(i);
        const heldB = held.has(j);
        if (heldA && heldB) {
          continue;
        }
        const gap = Math.sqrt(squared);
        // Exactly on top of each other, they step apart across the pitch.
        const ud = gap ? dd / gap : 0;
        const ux = gap ? dx / gap : 1;
        const push = personalSpace - gap;
        const shareA = heldA ? 0 : heldB ? 1 : 0.5;
        a.d -= ud * push * shareA;
        a.x -= ux * push * shareA;
        b.d += ud * push * (1 - shareA);
        b.x += ux * push * (1 - shareA);
      }
    }
  };

  // Every player not told otherwise heads for their place in the shape.
  const steer = (
    frame: number,
    held: ReadonlySet<number>,
    overrides: ReadonlyMap<number, Point> = new Map(),
    /** A pass along the ground, from the ball to where it goes. */
    lane?: Readonly<{ from: Point; to: Point }>
  ) => {
    const line = offside ? offsideLine() - 0.5 : Infinity;
    // The defender nearest the ball closes it down, but never tackles.
    let presser = -1;
    let nearest = Infinity;
    for (let j = 0; j < defenders.length; j++) {
      const i = attackers.length + j;
      if (defenders[j]!.line === 'keeper') {
        continue;
      }
      const gap = distance(movers[i]!, ball);
      if (gap < nearest) {
        nearest = gap;
        presser = i;
      }
    }
    const inLine = defenders.flatMap((p, j) =>
      p.line === 'defence' && attackers.length + j !== presser
        ? [movers[attackers.length + j]!.d]
        : []
    );
    const wanted = backLineFor(ball);
    if (inLine.length) {
      const low = Math.max(...inLine) - backLineGive;
      const high = Math.min(...inLine) + backLineGive;
      backLineDepth = low <= high ? clamp(wanted, low, high) : (low + high) / 2;
    }
    movers.forEach((mover, i) => {
      if (held.has(i)) {
        return;
      }
      const goal = {
        ...(overrides.get(i) ??
          (i === presser
            ? { d: ball.d + 3, x: ball.x + (34 - ball.x) * 0.05 }
            : target(i, ball, frame)))
      };
      if (i < attackers.length) {
        goal.d = Math.min(goal.d, line);
        // Caught beyond the line, a player first drops straight back.
        if (mover.d > line) {
          goal.x = mover.x;
        }
      } else {
        if (keepAway && i !== keeperSlot) {
          standBack(goal, keepAway);
        }
        // Defenders never cut out a pass: they keep out of its way.
        if (lane) {
          standOff(goal, lane.from, lane.to, laneWidth);
        }
      }
      const gap = distance(mover, goal);
      // A defender out of position, such as one the ball has gone past,
      // sprints to get back.
      const speed = perFrame(
        i < attackers.length
          ? 6
          : i === keeperSlot
            ? 4
            : gap > recoveryGap
              ? 7.5
              : 5.5
      );
      if (gap <= speed) {
        mover.d = goal.d;
        mover.x = goal.x;
      } else {
        mover.d += ((goal.d - mover.d) / gap) * speed;
        mover.x += ((goal.x - mover.x) / gap) * speed;
      }
      if (keepAway && i >= attackers.length && i !== keeperSlot) {
        standBack(mover, keepAway);
      }
      if (lane && i >= attackers.length) {
        standOff(mover, lane.from, lane.to, laneClearance);
      }
    });
    separate(held);
    // Stepping apart never takes a defender into a pass's way.
    if (lane) {
      for (let i = attackers.length; i < count; i++) {
        if (!held.has(i)) {
          standOff(movers[i]!, lane.from, lane.to, laneClearance);
        }
      }
    }
  };

  const passes: ClipPass[] = [];
  const shootingSpot = {
    d: pitchLength - rng.between(11, 22),
    x: 34 + rng.between(-14, 14)
  };
  if (restart === 'corner') {
    // From a corner the shooter meets the cross in the box.
    shootingSpot.d = pitchLength - rng.between(6, 12);
    shootingSpot.x = 34 + rng.between(-6, 6);
  }
  const passCount = others.length ? rng.int(2, 5) : 0;
  const minBuildUp = 6 * clipFps;
  /** Past this, no one carries the ball on; past the next, the shooter is found. */
  const lastCarry = 11 * clipFps;
  const maxBuildUp = 13 * clipFps;
  let frame = 0;
  let holder = starter;
  const label = (i: number) => attackers[i]!.label;

  /** The way the holder carries the ball, smoothed over a few frames. */
  let carrying: Point = { d: 1, x: 0 };
  /** The holder keeps the ball at their feet, a stride ahead the way they go. */
  const dribble = (
    frames: number,
    to: Point,
    speed: number,
    chase: ReadonlyMap<number, Point> = new Map()
  ) => {
    const step = perFrame(speed);
    for (let f = 0; f < frames; f++) {
      const mover = movers[holder]!;
      const gap = distance(mover, to);
      if (gap > step) {
        mover.d += ((to.d - mover.d) / gap) * step;
        mover.x += ((to.x - mover.x) / gap) * step;
        // From a walk the carrier turns with the ball at once; at a run the
        // ball comes round over a few frames.
        const last = steps[holder];
        const walking =
          !last || Math.hypot(last.d, last.x) < perFrame(walkingSpeed);
        const turn = walking ? 1 : 0.5;
        const turned = {
          d: lerp(carrying.d, (to.d - mover.d) / gap, turn),
          x: lerp(carrying.x, (to.x - mover.x) / gap, turn)
        };
        const length = Math.hypot(turned.d, turned.x);
        if (length > 0.01) {
          carrying = { d: turned.d / length, x: turned.x / length };
        }
      }
      ball.d = mover.d + carrying.d * stride;
      ball.x = mover.x + carrying.x * stride;
      const overrides = new Map<number, Point>(chase);
      if (holder !== shooter && passesLeft() === 1) {
        overrides.set(shooter, shootingSpot);
      }
      steer(frame, new Set([holder]), overrides);
      record();
      frame++;
    }
  };
  let passesMade = 0;
  const passesLeft = () => passCount - passesMade;

  /**
   * How a pass from the ball to `end` travels: along the ground, or in the
   * air for a restart other than a short free kick, or for any pass over
   * `longestGroundPass`; and the frames it takes at that pace.
   */
  const flightTo = (end: Point, kind: ClipPass['kind']) => {
    const metres = distance(ball, end);
    const lofted =
      kind === 'throw-in' ||
      kind === 'corner' ||
      kind === 'goal-kick' ||
      (kind === 'free-kick' && metres > 25) ||
      metres > longestGroundPass;
    const speed =
      kind === 'throw-in' ? 12 : kind === 'goal-kick' ? 22 : lofted ? 18 : 15;
    const frames = Math.ceil(
      Math.max(metres / perFrame(speed), clipFps * passMinimum)
    );
    return { frames, lofted };
  };
  /** How far a receiver can run in `frames` to meet a pass. */
  const reach = (frames: number) => frames * perFrame(receiverSpeed);

  /**
   * A pass to a receiver running onto it, at the ball's own pace: the
   * receiver is played in where they can get to it. The passer holds the
   * final pass back a moment while the shooter gets within reach.
   */
  const pass = (receiver: number, kind: ClipPass['kind'] = 'pass') => {
    const runner = movers[receiver]!;
    const lead = kind === 'throw-in' ? rng.between(0.5, 2) : rng.between(2, 6);
    const end =
      receiver === shooter
        ? { ...shootingSpot }
        : {
            d: clamp(runner.d + lead, 10, 95),
            x: clamp(runner.x + rng.between(-3, 3), 3, pitchWidth - 3)
          };
    if (receiver === shooter && kind === 'pass') {
      const chase = new Map([[shooter, end]]);
      for (
        let f = 0;
        f < 2 * clipFps &&
        distance(runner, end) > reach(flightTo(end, kind).frames);
        f++
      ) {
        dribble(1, { d: movers[holder]!.d, x: movers[holder]!.x }, 1, chase);
      }
    }
    // Played into space the receiver can't reach in time, the ball goes
    // shorter, towards them.
    for (let k = 0; k < 4; k++) {
      const gap = distance(runner, end);
      const most = reach(flightTo(end, kind).frames);
      if (gap <= most) {
        break;
      }
      end.d = runner.d + ((end.d - runner.d) / gap) * most;
      end.x = runner.x + ((end.x - runner.x) / gap) * most;
    }
    const from = { d: ball.d, x: ball.x };
    const runFrom = { d: runner.d, x: runner.x };
    const { frames, lofted } = flightTo(end, kind);
    // The receiver meets the ball a stride behind it, the way it came.
    const came = distance(from, end);
    const way = came
      ? { d: (end.d - from.d) / came, x: (end.x - from.x) / came }
      : { d: 1, x: 0 };
    const runTo = { d: end.d - way.d * stride, x: end.x - way.x * stride };
    // The receiver bends their run out of the stride they are in, so they
    // don't turn sharply as the ball is played.
    const step = steps[receiver] ?? { d: 0, x: 0 };
    const ahead = Math.hypot(step.d, step.x) * (frames / 2);
    const most = distance(runFrom, runTo) / 2;
    const bend = ahead > most ? most / ahead : 1;
    const bendAt = {
      d: runFrom.d + step.d * (frames / 2) * bend,
      x: runFrom.x + step.x * (frames / 2) * bend
    };
    passes.push({
      end: frame + frames,
      from: label(holder),
      kind,
      passer: holder,
      receiver,
      start: frame,
      to: label(receiver)
    });
    const thrower = holder;
    if (kind === 'throw-in') {
      aimAt(thrower, end);
    } else {
      kick(thrower, end);
    }
    for (let f = 1; f <= frames; f++) {
      const u = f / frames;
      const rolled = lofted ? u : u * (1.3 - 0.3 * u);
      ball.d = lerp(from.d, end.d, rolled);
      ball.x = lerp(from.x, end.x, rolled);
      ball.height = lofted ? Math.sin(Math.PI * u) * 0.5 : 0;
      // A throw is let go with the ball still held over the head.
      movers[thrower]!.pose =
        kind === 'throw-in' && f <= kickFrames ? 'hold' : 'run';
      runner.d = lerp(
        lerp(runFrom.d, bendAt.d, u),
        lerp(bendAt.d, runTo.d, u),
        u
      );
      runner.x = lerp(
        lerp(runFrom.x, bendAt.x, u),
        lerp(bendAt.x, runTo.x, u),
        u
      );
      const overrides = new Map<number, Point>();
      if (receiver !== shooter && passesLeft() <= 2) {
        overrides.set(shooter, shootingSpot);
      }
      steer(
        frame,
        new Set([receiver]),
        overrides,
        lofted ? undefined : { from: { d: ball.d, x: ball.x }, to: end }
      );
      record();
      frame++;
    }
    ball.height = 0;
    holder = receiver;
    // The receiver takes the ball on the way it came.
    carrying = way;
    passesMade++;
  };

  const onside = (i: number) => movers[i]!.d <= offsideLine();

  /** A defender stands within `laneWidth` of the way from the ball to `to`. */
  const blocked = (to: Point) =>
    movers
      .slice(attackers.length)
      .some(m => distance(m, nearestOnLine(m, ball, to)) < laneWidth);

  /**
   * The next to receive: onside, ahead of the ball, within reach and in an
   * open lane if anyone is. A pass back goes only a short way, to the
   * holder's own line or the one behind. The shooter, last, may need a
   * moment to get back onside.
   */
  const nextReceiver = () => {
    if (passesLeft() <= 1) {
      for (let f = 0; f < 2 * clipFps && !onside(shooter); f++) {
        dribble(1, { d: ball.d, x: ball.x }, 1);
      }
      return shooter;
    }
    const choices = others.filter(i => i !== holder && onside(i));
    if (!choices.length) {
      return shooter;
    }
    const holderLine = lineOrder.indexOf(attackers[holder]!.line);
    const weights = choices.map(i => {
      const gap = distance(movers[i]!, ball);
      const ahead = movers[i]!.d - ball.d;
      const back =
        ahead > -5
          ? 2
          : gap <= longestBackPass &&
              holderLine - lineOrder.indexOf(attackers[i]!.line) <= 1
            ? 0.4
            : 0;
      return (
        (gap > 6 && gap < 35 ? 3 : 0.5) *
        back *
        (blocked(movers[i]!) ? 0.15 : 1)
      );
    });
    const total = weights.reduce((a, b) => a + b, 0);
    if (!total) {
      return shooter;
    }
    let roll = rng.between(0, total);
    for (const [k, weight] of weights.entries()) {
      roll -= weight;
      if (roll <= 0) {
        return choices[k]!;
      }
    }
    return choices.at(-1)!;
  };

  // A restart: the thrower holds the ball over their head, or the taker
  // waits with the defenders back, while both sides set; then the ball is
  // played to a team-mate.
  let captionEnd = captionFrames;
  if (restart !== 'open-play') {
    const waits =
      restart === 'throw-in'
        ? rng.int(50, 80)
        : restart === 'corner'
          ? rng.int(90, 130)
          : rng.int(75, 110);
    // For a corner, the shooter and up to four more attack the box.
    const box = new Map<number, Point>();
    if (restart === 'corner') {
      box.set(shooter, shootingSpot);
      for (const i of others
        .filter(i => i !== starter && attackers[i]!.line !== 'defence')
        .slice(0, 4)) {
        box.set(i, {
          d: pitchLength - rng.between(5, 13),
          x: 34 + rng.between(-10, 10)
        });
      }
      for (const [i, spot] of box) {
        movers[i]!.d = spot.d - rng.between(3, 6);
        movers[i]!.x = spot.x + rng.between(-3, 3);
      }
    }
    captionEnd = Math.max(captionFrames, waits);
    keepAway = restart === 'free-kick' ? { d: ball.d, x: ball.x } : undefined;
    if (keepAway) {
      // The clip opens with the defenders already back.
      for (let i = attackers.length; i < count; i++) {
        if (i !== keeperSlot) {
          standBack(movers[i]!, keepAway);
        }
      }
    }
    const taker = movers[holder]!;
    for (let f = 0; f < waits; f++) {
      taker.pose = restart === 'throw-in' ? 'hold' : 'run';
      ball.height = restart === 'throw-in' ? 0.3 : 0;
      steer(frame, new Set([holder]), box);
      record();
      frame++;
    }
    keepAway = undefined;
    const near = others.filter(i => {
      const gap = distance(movers[i]!, ball);
      return i !== holder && gap > 6 && gap < 20;
    });
    // A goal kick goes long, to someone onside in the middle of the pitch.
    const long = others.filter(
      i => onside(i) && movers[i]!.d > 30 && movers[i]!.d < 75
    );
    if (restart !== 'corner' || outcome !== 'interception') {
      pass(
        restart === 'corner'
          ? shooter
          : restart === 'throw-in' && near.length
            ? rng.pick(near)
            : restart === 'goal-kick' && long.length
              ? rng.pick(long)
              : nextReceiver(),
        restart
      );
    }
  }

  // The build-up: each player takes the ball under control, may carry it
  // on, then passes; the last pass reaches the shooter in shooting range.
  // A corner's cross has already found the shooter.
  while (restart !== 'corner') {
    dribble(rng.int(25, 50), { d: ball.d + 1, x: ball.x }, 1.5);
    const towards = holder === shooter ? { d: 101, x: 34 } : shootingSpot;
    const carries = rng.next() < 0.6 && frame < lastCarry;
    if (carries || (holder === shooter && frame < minBuildUp)) {
      const seconds =
        holder === shooter
          ? Math.max(1, Math.min(4, (minBuildUp - frame) / clipFps))
          : rng.between(1, 4);
      const speed = rng.between(5, 7);
      const reach = Math.min(
        seconds * speed,
        Math.max(0, distance(movers[holder]!, towards) - 4)
      );
      const gap = distance(movers[holder]!, towards) || 1;
      const to = {
        d: movers[holder]!.d + ((towards.d - movers[holder]!.d) / gap) * reach,
        x: clamp(
          movers[holder]!.x +
            ((towards.x - movers[holder]!.x) / gap) * reach +
            rng.between(-3, 3),
          3,
          pitchWidth - 3
        )
      };
      dribble(Math.round(seconds * clipFps), to, speed);
    }
    if (holder === shooter) {
      break;
    }
    if (frame > maxBuildUp) {
      passesMade = Math.max(passesMade, passCount - 1);
    }
    if (passesLeft() <= 1) {
      // Far from goal, the holder carries the ball on before the final pass.
      const mover = movers[holder]!;
      const gap = distance(mover, shootingSpot);
      if (gap > finalPassRange) {
        const speed = rng.between(5.5, 7);
        const metres = Math.min(gap - finalPassRange + 2, 3 * speed);
        const to = {
          d: mover.d + ((shootingSpot.d - mover.d) / gap) * metres,
          x: mover.x + ((shootingSpot.x - mover.x) / gap) * metres
        };
        dribble(Math.round((metres / speed) * clipFps), to, speed);
      }
    }
    const receiver = nextReceiver();
    if (receiver === shooter && outcome === 'interception') {
      // The final pass is the one cut out.
      break;
    }
    pass(receiver);
  }
  if (holder === shooter && outcome === 'interception') {
    outcome = 'block';
  }

  // The zoom: the shooter takes a touch towards goal as the camera closes in.
  // Offside no longer matters once the shooter has the ball in range.
  const zoomStart = frame;
  const zoomFrames = clipFps;
  // Before an interception the passer has the ball; a corner taker waits.
  const touch =
    holder === shooter
      ? { d: Math.min(movers[shooter]!.d + 1.5, 100), x: ball.x }
      : restart === 'corner'
        ? { d: movers[holder]!.d, x: movers[holder]!.x }
        : { d: Math.min(movers[holder]!.d + 1, 100), x: ball.x };
  const waiting = restart === 'corner' && holder !== shooter;
  for (let f = 0; f < zoomFrames; f++) {
    cameraWidth = lerp(cameraWide, cameraZoomed, ease(f / zoomFrames));
    if (waiting) {
      // The ball stays on the corner spot until it is crossed.
      steer(frame, new Set([holder]));
      record();
      frame++;
    } else {
      dribble(1, touch, 1.5);
    }
  }
  cameraWidth = cameraZoomed;

  // The moment: the shot, and how it ends.
  const momentStart = frame;
  offside = false;
  const momentFrames = 2 * clipFps;
  const side = rng.next() < 0.5 ? -1 : 1;
  const shotFrom = { d: ball.d, x: ball.x };
  const keeper = keeperSlot >= 0 ? movers[keeperSlot]! : undefined;
  let momentFrame: number;
  /** For a clearance, the defender who meets the ball and clears it. */
  let clearer = -1;
  if (outcomeKind(outcome) === 'clearance') {
    // The final pass cut out, or the shot blocked by a defender stepping
    // into its line; the clip reaches its moment as they meet the ball.
    const interception = outcome === 'interception';
    const runner = movers[shooter]!;
    const towards = interception
      ? { d: Math.min(runner.d + 2, 100), x: runner.x }
      : { d: pitchLength, x: 34 + side * rng.between(0, goalHalf - 0.5) };
    const along = interception
      ? rng.between(0.45, 0.7)
      : rng.between(0.3, 0.55);
    const meet = {
      d: lerp(shotFrom.d, towards.d, along),
      x: lerp(shotFrom.x, towards.x, along)
    };
    let nearest = Infinity;
    defenders.forEach((p, j) => {
      const i = attackers.length + j;
      const gap = distance(movers[i]!, meet);
      if (p.line !== 'keeper' && gap < nearest) {
        nearest = gap;
        clearer = i;
      }
    });
    if (clearer < 0) {
      clearer = keeperSlot;
    }
    const flight = Math.max(
      10,
      Math.ceil(distance(shotFrom, meet) / perFrame(interception ? 15 : 25))
    );
    momentFrame = momentStart + flight - 1;
    const from = clearer >= 0 ? { ...movers[clearer]! } : undefined;
    // Off a block the ball runs loose, back the way it came.
    const loose = interception
      ? meet
      : { d: meet.d - rng.between(3, 6), x: meet.x + rng.between(-4, 4) };
    // Only the defender runs to a script; the passer and the receiver (or
    // the shooter) stay where their own moves leave them, but step aside
    // rather than stand inside anyone.
    const held = new Set([clearer]);
    const where = (i: number) => ({ d: movers[i]!.d, x: movers[i]!.x });
    // The final pass, or the shot, is struck.
    kick(holder, meet);
    cameraFocus = () => ({ d: ball.d + 4, x: ball.x });
    for (let f = 1; f <= momentFrames; f++) {
      const defender = clearer >= 0 ? movers[clearer]! : undefined;
      if (f <= flight) {
        const u = f / flight;
        ball.d = lerp(shotFrom.d, meet.d, u);
        ball.x = lerp(shotFrom.x, meet.x, u);
        ball.height = interception ? 0 : Math.sin(Math.PI * u) * 0.25;
        if (defender && from) {
          defender.d = lerp(from.d, meet.d + 0.6, u);
          defender.x = lerp(from.x, meet.x, u);
        }
        if (interception) {
          const gap = distance(runner, towards);
          const step = perFrame(6);
          if (gap > step) {
            runner.d += ((towards.d - runner.d) / gap) * step;
            runner.x += ((towards.x - runner.x) / gap) * step;
          }
        }
      } else {
        const settle = Math.min(1, (f - flight) / 30);
        const u = 1 - (1 - settle) * (1 - settle);
        ball.d = lerp(meet.d, loose.d, u);
        ball.x = lerp(meet.x, loose.x, u);
        ball.height = 0;
        if (defender) {
          // The defender gets to the ball, facing upfield.
          const to = { d: ball.d + 0.6, x: ball.x };
          const gap = distance(defender, to);
          const step = perFrame(5);
          if (gap > step) {
            defender.d += ((to.d - defender.d) / gap) * step;
            defender.x += ((to.x - defender.x) / gap) * step;
          }
        }
      }
      steer(
        frame,
        held,
        new Map([
          [holder, where(holder)],
          [shooter, where(shooter)]
        ])
      );
      record();
      frame++;
    }
  } else {
    let aim: Point;
    let rest: Point;
    let stopsAtKeeper = false;
    switch (outcome) {
      case 'goal': {
        const x = 34 + side * rng.between(0.6, goalHalf - 0.4);
        aim = { d: pitchLength, x };
        rest = { d: pitchLength + 1.8, x: x + side * 0.4 };
        break;
      }
      case 'hold':
      case 'dive':
      case 'parry': {
        const x =
          34 +
          side *
            (outcome === 'hold'
              ? rng.between(0, 1.2)
              : rng.between(2, goalHalf - 0.3));
        aim = { d: pitchLength - 0.8, x };
        stopsAtKeeper = true;
        rest =
          outcome === 'parry'
            ? { d: pitchLength + 2, x: 34 + side * rng.between(8, 12) }
            : aim;
        break;
      }
      case 'post': {
        const x = 34 + side * goalHalf;
        aim = { d: pitchLength, x };
        rest = { d: pitchLength - rng.between(7, 10), x: x - side * 3 };
        break;
      }
      case 'wide-left':
      case 'wide-right': {
        const out = outcome === 'wide-left' ? -1 : 1;
        const x = 34 + out * (goalHalf + rng.between(0.8, 3.5));
        aim = { d: pitchLength, x };
        rest = { d: pitchLength + 5, x: x + out * 1.5 };
        break;
      }
      case 'block':
      case 'interception':
        throw new Error('A clearance plays above');
      case 'over': {
        const x = 34 + side * rng.between(0, goalHalf - 0.5);
        aim = { d: pitchLength, x };
        rest = { d: pitchLength + 5, x };
        break;
      }
    }
    const flight = Math.max(
      10,
      Math.ceil(distance(shotFrom, aim) / perFrame(25))
    );
    // The frame the ball arrives: the moment's frames are recorded from 0.
    momentFrame = momentStart + flight - 1;
    const keeperFrom = keeper ? { d: keeper.d, x: keeper.x } : undefined;
    const keeperTo =
      keeper && keeperFrom
        ? stopsAtKeeper
          ? { d: aim.d, x: aim.x }
          : outcome === 'goal'
            ? {
                d: pitchLength - 0.5,
                x: lerp(keeperFrom.x, aim.x, 0.55)
              }
            : keeperFrom
        : undefined;
    const dives =
      outcome === 'dive' ||
      outcome === 'parry' ||
      (outcome === 'goal' && Math.abs(aim.x - (keeperFrom?.x ?? 34)) > 1.5);
    cameraFocus = () => ({ d: (ball.d + pitchLength) / 2, x: ball.x });
    kick(shooter, aim);
    for (let f = 1; f <= momentFrames; f++) {
      if (f <= flight) {
        const u = f / flight;
        ball.d = lerp(shotFrom.d, aim.d, u);
        ball.x = lerp(shotFrom.x, aim.x, u);
        ball.height =
          outcome === 'over' ? 0.4 + 0.6 * u : Math.sin(Math.PI * u) * 0.35;
      } else {
        const after = f - flight;
        const settle = Math.min(1, after / 40);
        const u = 1 - (1 - settle) * (1 - settle);
        ball.d = lerp(aim.d, rest.d, u);
        ball.x = lerp(aim.x, rest.x, u);
        ball.height =
          outcome === 'over'
            ? Math.max(0, 1 - settle)
            : stopsAtKeeper
              ? 0.2
              : 0;
      }
      if (keeper && keeperFrom && keeperTo) {
        const u = Math.min(1, f / Math.max(1, flight - 2));
        keeper.d = lerp(keeperFrom.d, keeperTo.d, ease(u));
        keeper.x = lerp(keeperFrom.x, keeperTo.x, ease(u));
        keeper.pose = dives && f > flight * 0.4 ? 'dive' : 'run';
        if (stopsAtKeeper && f > flight && outcome !== 'parry') {
          keeper.pose = 'hold';
          ball.d = keeper.d;
          ball.x = keeper.x;
        }
      }
      steer(frame, new Set([shooter, keeperSlot]), new Map());
      record();
      frame++;
    }
  }

  // The reaction: the scorer celebrates, the keeper plays the ball out, or
  // the shooter holds their head.
  const reactionStart = frame;
  const reactionFrames = rng.int(150, 200);
  const scorer = movers[shooter]!;
  const corner = {
    d: pitchLength - 2,
    x: scorer.x < 34 ? 2 : pitchWidth - 2
  };
  const outlet = {
    d: rng.between(55, 70),
    x: rng.between(12, 56)
  };
  const ballAtRest = { d: ball.d, x: ball.x };
  // A clearance goes long upfield or into touch, as the seed picks.
  const upfield = rng.next() < 0.5;
  const cleared = upfield
    ? {
        d: clamp(ball.d - rng.between(30, 45), 5, 100),
        x: rng.between(8, 60)
      }
    : {
        d: clamp(ball.d - rng.between(5, 20), 5, 100),
        x: ball.x < 34 ? -3 : pitchWidth + 3
      };
  const clearFrames = Math.max(
    20,
    Math.ceil(distance(ballAtRest, cleared) / perFrame(20))
  );
  const reactionHeld = new Set([shooter, keeperSlot]);
  if (clearer >= 0) {
    reactionHeld.add(clearer);
  }
  for (let f = 0; f < reactionFrames; f++) {
    cameraWidth =
      f < 50
        ? cameraZoomed
        : lerp(cameraZoomed, cameraWide, ease(Math.min(1, (f - 50) / 50)));
    const overrides = new Map<number, Point>();
    if (outcome === 'goal') {
      scorer.pose = 'celebrate';
      const gap = distance(scorer, corner);
      const step = perFrame(6);
      if (gap > step) {
        scorer.d += ((corner.d - scorer.d) / gap) * step;
        scorer.x += ((corner.x - scorer.x) / gap) * step;
      }
      outfield.forEach((i, k) => {
        if (i !== shooter) {
          overrides.set(i, {
            d: scorer.d - 2 - (k % 3),
            x: scorer.x + ((k % 5) - 2) * 1.2
          });
        }
      });
      cameraFocus = () => ({ d: scorer.d, x: scorer.x });
    } else if (outcomeKind(outcome) === 'clearance') {
      scorer.pose = 'run';
      if (f === 25) {
        kick(clearer, cleared);
      }
      if (f >= 25 && f < 25 + clearFrames) {
        const u = (f - 25) / clearFrames;
        ball.d = lerp(ballAtRest.d, cleared.d, u);
        ball.x = lerp(ballAtRest.x, cleared.x, u);
        ball.height = Math.sin(Math.PI * u) * 0.6;
      } else if (f >= 25 + clearFrames) {
        ball.height = 0;
        // Cleared, the defender is free to rejoin the shape.
        reactionHeld.delete(clearer);
      }
      cameraFocus = () => ({ d: ball.d, x: ball.x });
    } else {
      scorer.pose = outcomeKind(outcome) === 'near-miss' ? 'head' : 'run';
      if (keeper && outcomeKind(outcome) === 'save') {
        if (outcome !== 'parry' && f >= 50 && f < 80) {
          // The keeper plays it out to a team-mate.
          const u = ease((f - 50) / 30);
          if (f === 50) {
            kick(keeperSlot, outlet);
          }
          keeper.pose = 'run';
          ball.d = lerp(ballAtRest.d, outlet.d, u);
          ball.x = lerp(ballAtRest.x, outlet.x, u);
          ball.height = Math.sin(Math.PI * u) * 0.5;
        } else if (outcome === 'parry' || f < 50) {
          keeper.pose = f < 25 && outcome !== 'hold' ? 'dive' : 'hold';
          if (outcome === 'parry') {
            keeper.pose = f < 25 ? 'dive' : 'run';
          }
        }
      }
      cameraFocus =
        outcomeKind(outcome) === 'save'
          ? () => ({ d: (ball.d + pitchLength) / 2, x: ball.x })
          : () => ({ d: scorer.d + 4, x: scorer.x });
    }
    steer(frame, reactionHeld, overrides);
    record();
    frame++;
  }

  const length = frame;
  const sides = Array.from({ length: count }, (_, i) =>
    i < attackers.length ? ('attack' as const) : ('defence' as const)
  );
  const keepers = new Set([
    attackKeeper,
    defenceKeeper < 0 ? -1 : attackers.length + defenceKeeper
  ]);
  const phaseAt = (at: number): ClipPhase =>
    at < zoomStart
      ? 'build-up'
      : at < momentStart
        ? 'zoom'
        : at < reactionStart
          ? 'moment'
          : 'reaction';
  const shooterLabel = attackers[shooter]?.label ?? '';
  const tired = tiredPlayers(input);

  const frameAt = (at: number): ClipFrame => {
    const clamped = clamp(at, 0, length - 1);
    const low = Math.floor(clamped);
    const high = Math.min(length - 1, low + 1);
    const u = clamped - low;
    const [cx0, cy0, cw0] = cameraTrack[low]!;
    const [cx1, cy1, cw1] = cameraTrack[high]!;
    const width = lerp(cw0, cw1, u);
    const zoomed = width < cameraWide - 0.01;
    const players = sides.map((side, i): FramePlayer => ({
      facing: facings[facingLog[low]![i]!]!,
      keeper: keepers.has(i),
      pose: poses[poseLog[low]![i]!]!,
      side,
      ...(zoomed && tired.has(i) ? { status: 'tired' as const } : {}),
      x: lerp(xs[low]![i]!, xs[high]![i]!, u),
      y: lerp(ys[low]![i]!, ys[high]![i]!, u)
    }));
    const [bx0, by0, bh0] = balls[low]!;
    const [bx1, by1, bh1] = balls[high]!;
    const named = players[shooter];
    return {
      ball: {
        height: lerp(bh0, bh1, u),
        x: lerp(bx0, bx1, u),
        y: lerp(by0, by1, u)
      },
      camera: { width, x: lerp(cx0, cx1, u), y: lerp(cy0, cy1, u) },
      ...(outcome === 'goal' && low >= reactionStart ? { cheer: true } : {}),
      ...(low < captionEnd
        ? {
            caption: [`${input.minute}′`, restartNames[restart]]
              .filter(Boolean)
              .join(' ')
          }
        : {}),
      ...(named && zoomed
        ? { label: { text: shooterLabel, x: named.x, y: named.y } }
        : {}),
      minimap: !zoomed,
      phase: phaseAt(low),
      players
    };
  };

  return {
    frame: frameAt,
    input,
    length,
    momentFrame,
    outcome,
    passes,
    phases: { moment: momentStart, reaction: reactionStart, zoom: zoomStart },
    restart
  };
};

/**
 * Both sides standing in shape with the ball on the centre spot, as under
 * the "Kick-off" and "Full time" captions. `home` shoots up the screen.
 */
export const kickOffFrame = (
  home: ClipSide,
  away: ClipSide,
  caption: string
): ClipFrame => {
  const depths: Record<Line, number> = {
    attack: 48,
    defence: 20,
    keeper: 4,
    midfield: 35
  };
  const place = (side: ClipSide, up: boolean, team: 'attack' | 'defence') => {
    const spots = lateralSpots(side.players);
    return side.players.map((p, i): FramePlayer => {
      const d = depths[p.line];
      const x = pitchWidth * spots[i]!;
      return {
        facing: up ? 'up' : 'down',
        keeper: p.line === 'keeper',
        pose: 'stand',
        side: team,
        x: up ? x : pitchWidth - x,
        y: up ? pitchLength - d : d
      };
    });
  };
  return {
    ball: { height: 0, x: pitchWidth / 2, y: pitchLength / 2 },
    camera: { width: cameraWide, x: pitchWidth / 2, y: pitchLength / 2 },
    caption,
    minimap: true,
    phase: 'build-up',
    players: [...place(home, true, 'attack'), ...place(away, false, 'defence')]
  };
};
