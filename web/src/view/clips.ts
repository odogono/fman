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
export type MissOutcome = 'over' | 'post' | 'wide-left' | 'wide-right';
/** How a moment plays out: a goal, a kind of save or a kind of near miss. */
export type ClipOutcome = 'goal' | MissOutcome | SaveOutcome;
export const saveOutcomes: readonly SaveOutcome[] = ['dive', 'hold', 'parry'];
export const missOutcomes: readonly MissOutcome[] = [
  'post',
  'wide-left',
  'wide-right',
  'over'
];

/** How the build-up starts: in open play, or from a free kick or a throw-in. */
export type Restart = 'free-kick' | 'open-play' | 'throw-in';
export const restarts: readonly Restart[] = [
  'open-play',
  'free-kick',
  'throw-in'
];
const restartNames: Record<Restart, string> = {
  'free-kick': 'Free kick',
  'open-play': '',
  'throw-in': 'Throw-in'
};

/** Where a player lines up. */
export type Line = 'attack' | 'defence' | 'keeper' | 'midfield';
export type ClipPlayer = Readonly<{ label: string; line: Line }>;
/** One side in a clip: its kit, its goalkeeper's colour and its 11 or fewer. */
export type ClipSide = Readonly<{
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
export type Pose = 'celebrate' | 'dive' | 'head' | 'hold' | 'run';
const poses: readonly Pose[] = ['run', 'dive', 'celebrate', 'head', 'hold'];

export type ClipPhase = 'build-up' | 'moment' | 'reaction' | 'zoom';

export type FramePlayer = Readonly<{
  keeper: boolean;
  pose: Pose;
  side: 'attack' | 'defence';
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
  kind: 'free-kick' | 'pass' | 'throw-in';
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

/** The outcome the seed picks for a kind, each equally likely. */
const drawOutcome = (rng: ClipRng, kind: Moment['kind']): ClipOutcome =>
  kind === 'goal'
    ? 'goal'
    : kind === 'save'
      ? rng.pick(saveOutcomes)
      : rng.pick(missOutcomes);

/** The kind of moment an outcome plays. */
export const outcomeKind = (outcome: ClipOutcome): Moment['kind'] =>
  outcome === 'goal'
    ? 'goal'
    : (saveOutcomes as readonly string[]).includes(outcome)
      ? 'save'
      : 'near-miss';

type Point = { d: number; x: number };
type Mover = Point & { pose: Pose };

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));
const distance = (a: Point, b: Point) => Math.hypot(a.d - b.d, a.x - b.x);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const ease = (u: number) => u * u * (3 - 2 * u);
/** Metres a frame from metres a second. */
const perFrame = (speed: number) => speed / clipFps;

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
 * Plays out a clip. Positions are worked out in the attacking side's own
 * terms, `d` metres up from its own goal line and `x` across from its left,
 * then turned to the screen.
 */
export const createClipScript = (input: ClipInput): ClipScript => {
  const rng = createClipRng(input.seed);
  const outcome = input.outcome ?? drawOutcome(rng, input.kind);
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
        ? clamp(ball.d + 14, 55, 99)
        : line === 'midfield'
          ? clamp(ball.d + 2, 40, 90)
          : clamp(ball.d - 12, 30, 75);
    const across =
      34 + (pitchWidth * defenceSpots[j]! - 34) * 0.75 + 0.35 * (ball.x - 34);
    return {
      d: depth + quirk.d + sway * 1.5,
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
  const deep = others.filter(i => attackers[i]!.line !== 'attack');
  const starter = others.length
    ? rng.pick(deep.length ? deep : others)
    : shooter;
  // About half the build-ups start in open play, a quarter each from a
  // free kick and a throw-in.
  const restartRoll = rng.next();
  const restart: Restart = !others.length
    ? 'open-play'
    : (input.restart ??
      (restartRoll < 0.5
        ? 'open-play'
        : restartRoll < 0.75
          ? 'free-kick'
          : 'throw-in'));
  const touchline = rng.next() < 0.5 ? 0 : pitchWidth;
  if (restart === 'throw-in') {
    ballStart.d = rng.between(20, 80);
    ballStart.x = touchline;
  } else if (restart === 'free-kick') {
    ballStart.d = rng.between(30, 70);
    ballStart.x = rng.between(12, 56);
  }
  const movers: Mover[] = Array.from({ length: count }, (_, i) => ({
    ...target(i, ballStart, 0),
    pose: 'run'
  }));
  movers[starter]!.d = ballStart.d - (restart === 'free-kick' ? 1.5 : 0.8);
  movers[starter]!.x =
    restart === 'throw-in'
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

  // Frames are written as they play: x and y on the screen, then poses.
  const xs: number[][] = [];
  const ys: number[][] = [];
  const poseLog: number[][] = [];
  const balls: [number, number, number][] = [];
  const cameraTrack: [number, number, number][] = [];
  const toScreen = (p: Point): [number, number] =>
    input.attackingUp ? [p.x, pitchLength - p.d] : [pitchWidth - p.x, p.d];
  let camera = { d: ball.d + 8, width: cameraWide, x: ball.x };
  let cameraFocus: () => Point = () => ({ d: ball.d + 8, x: ball.x });
  let cameraWidth = cameraWide;
  const record = () => {
    xs.push([]);
    ys.push([]);
    poseLog.push([]);
    const at = xs.length - 1;
    for (const mover of movers) {
      const [x, y] = toScreen(mover);
      xs[at]!.push(x);
      ys[at]!.push(y);
      poseLog[at]!.push(poses.indexOf(mover.pose));
    }
    const [bx, by] = toScreen(ball);
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

  // Every player not told otherwise heads for their place in the shape.
  const steer = (
    frame: number,
    held: ReadonlySet<number>,
    overrides: ReadonlyMap<number, Point> = new Map()
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
      } else if (keepAway && i !== keeperSlot) {
        standBack(goal, keepAway);
      }
      const speed = perFrame(
        i < attackers.length ? 6 : i === keeperSlot ? 4 : 5.5
      );
      const gap = distance(mover, goal);
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
    });
  };

  const passes: ClipPass[] = [];
  const shootingSpot = {
    d: pitchLength - rng.between(11, 22),
    x: 34 + rng.between(-14, 14)
  };
  const passCount = others.length ? rng.int(2, 5) : 0;
  const minBuildUp = 6 * clipFps;
  /** Past this, no one carries the ball on; past the next, the shooter is found. */
  const lastCarry = 11 * clipFps;
  const maxBuildUp = 13 * clipFps;
  let frame = 0;
  let holder = starter;
  const label = (i: number) => attackers[i]!.label;

  /** The holder keeps the ball at their feet, a stride ahead. */
  const dribble = (frames: number, to: Point, speed: number) => {
    const step = perFrame(speed);
    for (let f = 0; f < frames; f++) {
      const mover = movers[holder]!;
      const gap = distance(mover, to);
      if (gap > step) {
        mover.d += ((to.d - mover.d) / gap) * step;
        mover.x += ((to.x - mover.x) / gap) * step;
      }
      ball.d = mover.d + 0.8;
      ball.x = mover.x;
      const overrides = new Map<number, Point>();
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
   * A pass to a receiver running onto it: along the ground, or in the air
   * for a throw-in or a long free kick.
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
    const from = { d: ball.d, x: ball.x };
    const runFrom = { d: runner.d, x: runner.x };
    const lofted =
      kind === 'throw-in' || (kind === 'free-kick' && distance(from, end) > 25);
    const speed = kind === 'throw-in' ? 12 : lofted ? 18 : 15;
    const frames = Math.ceil(
      Math.max(
        distance(from, end) / perFrame(speed),
        distance(runFrom, end) / perFrame(7),
        clipFps * 0.6
      )
    );
    passes.push({
      end: frame + frames,
      from: label(holder),
      kind,
      start: frame,
      to: label(receiver)
    });
    const thrower = holder;
    for (let f = 1; f <= frames; f++) {
      const u = f / frames;
      const rolled = lofted ? u : u * (1.3 - 0.3 * u);
      ball.d = lerp(from.d, end.d, rolled);
      ball.x = lerp(from.x, end.x, rolled);
      ball.height = lofted ? Math.sin(Math.PI * u) * 0.5 : 0;
      movers[thrower]!.pose = 'run';
      runner.d = lerp(runFrom.d, end.d - 0.8, u);
      runner.x = lerp(runFrom.x, end.x, u);
      const overrides = new Map<number, Point>();
      if (receiver !== shooter && passesLeft() <= 2) {
        overrides.set(shooter, shootingSpot);
      }
      steer(frame, new Set([receiver]), overrides);
      record();
      frame++;
    }
    ball.height = 0;
    holder = receiver;
    passesMade++;
  };

  const onside = (i: number) => movers[i]!.d <= offsideLine();

  /**
   * The next to receive: onside, and ahead of the ball and within reach if
   * anyone is. The shooter, last, may need a moment to get back onside.
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
    const weights = choices.map(i => {
      const gap = distance(movers[i]!, ball);
      const ahead = movers[i]!.d - ball.d;
      return (gap > 6 && gap < 35 ? 3 : 0.5) * (ahead > -5 ? 2 : 0.5);
    });
    let roll = rng.between(
      0,
      weights.reduce((a, b) => a + b, 0)
    );
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
    const waits = restart === 'throw-in' ? rng.int(50, 80) : rng.int(75, 110);
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
      steer(frame, new Set([holder]));
      record();
      frame++;
    }
    keepAway = undefined;
    const near = others.filter(i => {
      const gap = distance(movers[i]!, ball);
      return i !== holder && gap > 6 && gap < 20;
    });
    pass(
      restart === 'throw-in' && near.length ? rng.pick(near) : nextReceiver(),
      restart
    );
  }

  // The build-up: each player takes the ball under control, may carry it
  // on, then passes; the last pass reaches the shooter in shooting range.
  for (;;) {
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
    pass(nextReceiver());
  }

  // The zoom: the shooter takes a touch towards goal as the camera closes in.
  // Offside no longer matters once the shooter has the ball in range.
  const zoomStart = frame;
  const zoomFrames = clipFps;
  const touch = { d: Math.min(movers[shooter]!.d + 1.5, 100), x: ball.x };
  for (let f = 0; f < zoomFrames; f++) {
    cameraWidth = lerp(cameraWide, cameraZoomed, ease(f / zoomFrames));
    dribble(1, touch, 1.5);
  }
  cameraWidth = cameraZoomed;

  // The moment: the shot, and how it ends.
  const momentStart = frame;
  offside = false;
  const momentFrames = 2 * clipFps;
  const side = rng.next() < 0.5 ? -1 : 1;
  const shotFrom = { d: ball.d, x: ball.x };
  const keeper = keeperSlot >= 0 ? movers[keeperSlot]! : undefined;
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
  const momentFrame = momentStart + flight - 1;
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
        outcome === 'over' ? Math.max(0, 1 - settle) : stopsAtKeeper ? 0.2 : 0;
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
  const reactionHeld = new Set([shooter, keeperSlot]);
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
    } else {
      scorer.pose = outcomeKind(outcome) === 'near-miss' ? 'head' : 'run';
      if (keeper && outcomeKind(outcome) === 'save') {
        if (outcome !== 'parry' && f >= 50 && f < 80) {
          // The keeper plays it out to a team-mate.
          const u = ease((f - 50) / 30);
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

  const frameAt = (at: number): ClipFrame => {
    const clamped = clamp(at, 0, length - 1);
    const low = Math.floor(clamped);
    const high = Math.min(length - 1, low + 1);
    const u = clamped - low;
    const players = sides.map((side, i): FramePlayer => ({
      keeper: keepers.has(i),
      pose: poses[poseLog[low]![i]!]!,
      side,
      x: lerp(xs[low]![i]!, xs[high]![i]!, u),
      y: lerp(ys[low]![i]!, ys[high]![i]!, u)
    }));
    const [bx0, by0, bh0] = balls[low]!;
    const [bx1, by1, bh1] = balls[high]!;
    const [cx0, cy0, cw0] = cameraTrack[low]!;
    const [cx1, cy1, cw1] = cameraTrack[high]!;
    const width = lerp(cw0, cw1, u);
    const named = players[shooter];
    return {
      ball: {
        height: lerp(bh0, bh1, u),
        x: lerp(bx0, bx1, u),
        y: lerp(by0, by1, u)
      },
      camera: { width, x: lerp(cx0, cx1, u), y: lerp(cy0, cy1, u) },
      ...(low < captionEnd
        ? {
            caption: [`${input.minute}′`, restartNames[restart]]
              .filter(Boolean)
              .join(' ')
          }
        : {}),
      ...(named && width < cameraWide - 0.01
        ? { label: { text: shooterLabel, x: named.x, y: named.y } }
        : {}),
      minimap: width >= cameraWide - 0.01,
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
        keeper: p.line === 'keeper',
        pose: 'run',
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
