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

/**
 * A save: a dive, a catch or a parry, or the keeper coming off their line
 * to catch a cross before it can be headed.
 */
export type SaveOutcome = 'claim' | 'dive' | 'hold' | 'parry';
export type ClearanceOutcome = 'block' | 'interception';
export type MissOutcome = 'over' | 'post' | 'wide-left' | 'wide-right';
/**
 * How a moment plays out: a goal, a kind of save, a kind of clearance
 * (#150) or a kind of near miss.
 */
export type ClipOutcome = 'goal' | ClearanceOutcome | MissOutcome | SaveOutcome;
/**
 * The saves the seed picks from evenly. A claim is picked apart from them,
 * only for a cross, so every other save plays as it did before claims.
 */
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

/**
 * How the chance is finished: a shot from the edge of the box, a header
 * from a cross or a corner, a shot from long range, or a run through on
 * the keeper.
 */
export type Finish = 'header' | 'long-range' | 'one-on-one' | 'shot';
export const finishes: readonly Finish[] = [
  'shot',
  'header',
  'long-range',
  'one-on-one'
];

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
  /** Forces how the chance is finished, for the debug page. */
  finish?: Finish;
  kind: Moment['kind'];
  minute: number;
  /** Forces the outcome, for the debug page; the seed picks it otherwise. */
  outcome?: ClipOutcome;
  /** Forces a rebound, or none, for the debug page. */
  rebound?: boolean;
  /** Forces how the build-up starts, for the debug page. */
  restart?: Restart;
  seed: number;
  /** The named player: an index into `attack.players`. */
  shooter: number;
}>;

/** What a player is doing, for the drawing. */
export type Pose =
  'celebrate' | 'dive' | 'head' | 'header' | 'hold' | 'kick' | 'run' | 'stand';
const poses: readonly Pose[] = [
  'run',
  'header',
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
/**
 * The ball's height at a leaping header's forehead, as a frame's `height`
 * measures it: about 2 m up, just under the bar.
 */
export const headHeight = 0.8;
/** A header's crouch and leap take this many frames before the ball arrives. */
const jumpFrames = 16;
/** A clearance runs on this far, in metres, after it bounces. */
const clearRunOn = 4;
/**
 * A first touch takes the pace off the ball this fast, in metres a frame
 * each frame, and the receiver closes on it at this share of their pace.
 */
const touchDrag = 0.02;
const gatherShare = 0.7;
/** The fastest a first touch sends the ball on from the receiver, in metres a second. */
const touchSpring = 6;
/** A carrier turns the ball round at most this far a frame, in radians. */
const ballTurn = 0.1;
/** The ball's turn round a carrier quickens or eases by this, in radians a frame each frame. */
const ballSpinUp = 0.02;
/** A carrier this near, in metres, where they are going holds their way. */
const holdingGap = 0.5;
/**
 * A carrier speeds up and slows down by at most these, in metres a frame
 * each frame: about 6 and 10 metres a second each second.
 */
const carrierPickUp = 6 / clipFps / clipFps;
const carrierBrake = 10 / clipFps / clipFps;
/** A receiver takes their first touch at no less, nor more, than this pace, in metres a second. */
const firstTouchPace = [1.5, 3.5] as const;
/** How far off their line, in metres, a keeper stands: ball near, and far. */
const keeperOffLine = [1.5, 8] as const;
/** The share of saves from a cross where the keeper comes to catch it. */
const claimShare = 0.35;
/** The share of shots and headers parried back out for the shooter to strike again. */
const reboundShare = 0.2;
/** A parry runs out into the box at this pace, in metres a second. */
const spillPace = 9;
/** A shooter follows in for the rebound at this pace, in metres a second. */
const followPace = 7;
/** A rebound needs the first effort from within this far of goal, in metres. */
const reboundRange = 20;
/** Frames the ball sits loose before the rebound is struck. */
const reboundSettle = 3;
/** Frames a keeper lies down after the parry before scrambling up. */
const scrambleFrames = 15;
/** The defender chasing a rebound gets no nearer the ball than this, in metres. */
const lateBy = 2.5;
/** The furthest from goal, in metres, an ordinary shot and one from range are struck. */
const longestShot = 22;
const longestLongRange = 30;
/** A shooter found out of range carries it into range at this pace, in metres a second, done by this frame. */
const intoRangePace = 7;
const shooterReadyBy = 13.5 * clipFps;
/** A shooter found late takes the ball in this many frames at most. */
const quickTouch = 25;
/** The nearest to goal, in metres, a shot from range is set up. */
const longRange = 24;
/** The deepest a high back line holds, in metres up the pitch. */
const highLine = 86;
/** How far off their line, in metres, a keeper comes to meet a one-on-one. */
const keeperRushes = 6;
/** The furthest, in metres, a player carries the ball out wide to cross it. */
const widestCarry = 25;
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
  /**
   * Which of a header's frames shows: crouching to jump, in the air, then
   * meeting the ball.
   */
  poseFrame?: number;
  side: 'attack' | 'defence';
  status?: Status;
  /** The ground they have covered in the clip so far, in metres. */
  travelled: number;
  x: number;
  y: number;
}>;
/** A header's frames: crouching, in the air, meeting the ball. */
export const headerFrames = 3;

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
  /** The ball never reached the receiver: a keeper came and caught it. */
  cutOut?: true;
  end: number;
  from: string;
  /**
   * A pass in open play, the restart that starts the build-up, or a cross
   * from wide for a header.
   */
  kind: 'cross' | 'pass' | Exclude<Restart, 'open-play'>;
  /** The passer and receiver: indexes into `attack.players`. */
  passer: number;
  receiver: number;
  start: number;
  to: string;
}>;

export type ClipScript = Readonly<{
  finish: Finish;
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
  /** The first effort was parried back into the box, and the shooter struck again. */
  rebound: boolean;
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
    : outcome === 'claim' ||
        (saveOutcomes as readonly string[]).includes(outcome)
      ? 'save'
      : (clearanceOutcomes as readonly string[]).includes(outcome)
        ? 'clearance'
        : 'near-miss';

type Point = { d: number; x: number };
type Mover = Point & { pose: Pose; poseFrame?: number };

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));
const distance = (a: Point, b: Point) => Math.hypot(a.d - b.d, a.x - b.x);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
/** A unit direction turned by `angle` radians. */
const rotated = (from: Point, angle: number): Point => ({
  d: from.d * Math.cos(angle) - from.x * Math.sin(angle),
  x: from.d * Math.sin(angle) + from.x * Math.cos(angle)
});
/** The signed angle, in radians, from one unit direction to another. */
const angleBetween = (from: Point, to: Point) =>
  Math.atan2(from.d * to.x - from.x * to.d, from.d * to.d + from.x * to.x);
/**
 * A lofted ball's height `u` of the way along: up to `peak`, landing at
 * `landsAt` of the way, then bouncing once, a fifth as high.
 */
const loftedHeight = (u: number, peak: number, landsAt = 0.8) =>
  u < landsAt
    ? Math.sin((Math.PI * u) / landsAt) * peak
    : Math.sin((Math.PI * (u - landsAt)) / (1 - landsAt)) * peak * 0.2;

/**
 * Where a ball bending by `bend` metres at its widest is `u` of the way from
 * `a` to `b`: on the straight line at either end, off it to the side
 * between.
 */
const bent = (a: Point, b: Point, u: number, bend: number): Point => {
  const length = distance(a, b) || 1;
  const swing = bend * Math.sin(Math.PI * u);
  return {
    d: lerp(a.d, b.d, u) - ((b.x - a.x) / length) * swing,
    x: lerp(a.x, b.x, u) + ((b.d - a.d) / length) * swing
  };
};

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
/** A player's facing follows their movement over this many frames. */
const facingWindow = 10;
/**
 * A player faces the way they run once faster than `start`, in metres a
 * second, and faces the ball again once slower than `stop`.
 */
const facingSpeed = { start: 2.5, stop: 1.5 };
/** Another defender must be this much nearer the ball to take over pressing it. */
const pressingGive = 1.5;
/** After the moment, players walk or jog back at these paces, in metres a second. */
const walkPace = 1.5;
const jogPace = 3.5;
/** Hands on heads for this many of the reaction's frames. */
const despairFrames = 60;
/** The reaction's frame the keeper sets off for the ball in the net. */
const fetchFrom = 30;
/** The reaction's frame the attackers start back. */
const turnBackFrom = 15;
/** A scorer's arms go up this many frames before they wheel away. */
const leapFrames = 15;
/** A scorer wheels away at this pace, in metres a second. */
const celebrationPace = 8;
/** A scorer celebrates where they wheel to for at least this many frames. */
const celebrateFor = 30;
/** The furthest a scorer wheels away, in metres, so team-mates catch them. */
const longestWheel = 12;
/** Team-mates crowd a celebrating scorer this close, in metres. */
const huddleGap = 1.1;
/** A keeper down after a save is up again after this many frames. */
const getUpFrames = 25;
/** A keeper with the ball walks out at this pace, in metres a second. */
const keeperStride = 2;
/** A header shows its contact, then its landing, this many frames each. */
const landingFrames = 8;
/** The longest a passer holds the final pass for the shooter to get in reach. */
const shooterWait = clipFps;
/** A player turns at most once in this many frames, but to kick or aim. */
const turnFrames = 20;

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
  const backLineFor = (ball: Point) =>
    // Caught by a ball through, the defence was playing a high line.
    finish === 'one-on-one'
      ? clamp(ball.d + 8, 50, highLine)
      : clamp(ball.d + 14, 55, 99);
  /**
   * The depth the back line holds while play goes on: where it wants to be,
   * but never more than `backLineGive` from any of its players but the one
   * closing the ball down, so it moves as one and waits for a laggard.
   */
  let backLineDepth: number | undefined;
  /** A ball played through has beaten the defence, for a one-on-one. */
  let beaten = false;
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
      // On the angle: on the line from the middle of the goal to the ball,
      // further off it the further off the ball is.
      const away = Math.hypot(pitchLength - ball.d, ball.x - 34) || 1;
      const off = clamp(away * 0.12, keeperOffLine[0], keeperOffLine[1]);
      return {
        d: pitchLength - ((pitchLength - ball.d) / away) * off,
        x: 34 + ((ball.x - 34) / away) * off
      };
    }
    const shape =
      line === 'defence'
        ? (backLineDepth ?? backLineFor(ball))
        : line === 'midfield'
          ? clamp(ball.d + 2, 40, 90)
          : clamp(ball.d - 12, 30, 75);
    // Beaten by a ball through, everyone chases from behind the shooter.
    const depth = beaten ? Math.min(shape, movers[shooter]!.d - 2) : shape;
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

  // How the chance is finished, from a stream of its own so a shot plays
  // as it would without the others. Every corner, and a defender's or
  // keeper's free kick, is headed in; a clearance and a lone player always
  // shoot.
  const finishRng = createClipRng(hashSeed(`${input.seed}|finish`));
  /** How much each ball in the air bends, from a stream of its own. */
  const curlRng = createClipRng(hashSeed(`${input.seed}|curl`));
  const curl = (low: number, high: number) =>
    curlRng.between(low, high) * (curlRng.next() < 0.5 ? -1 : 1);
  const finishRoll = finishRng.next();
  const odds: readonly (readonly [Finish, number])[] =
    attackers[shooter]?.line === 'attack'
      ? [
          ['header', 0.25],
          ['one-on-one', 0.2],
          ['long-range', 0.05]
        ]
      : [
          ['header', 0.15],
          ['one-on-one', 0.1],
          ['long-range', 0.3]
        ];
  let roll = finishRoll;
  const drawnFinish: Finish =
    restart === 'corner' || setPiece
      ? 'header'
      : (odds.find(([, chance]) => (roll -= chance) < 0)?.[0] ?? 'shot');
  let finish: Finish =
    outcomeKind(outcome) === 'clearance'
      ? 'shot'
      : restart === 'corner'
        ? 'header'
        : (input.finish ?? drawnFinish);
  // Catching a cross needs a cross.
  if (outcome === 'claim') {
    finish = 'header';
  }
  if (finish === 'header' && !others.length) {
    finish = 'shot';
  }
  if (outcome === 'claim' && (finish !== 'header' || keeperSlot < 0)) {
    outcome = 'hold';
  }
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
  /** A header's frame, or -1; and the ground each player has covered. */
  const poseFrameLog: number[][] = [];
  const travelLog: number[][] = [];
  const travelled = new Array<number>(count).fill(0);
  /**
   * The frame each player's latest kick shows until, and the frame they face
   * where they played the ball until, kicked or thrown.
   */
  const kickUntil = new Array<number>(count).fill(-1);
  const aimUntil = new Array<number>(count).fill(-1);
  const aims: (Point | undefined)[] = new Array(count);
  /** Whether a player's aim is only where they look, to turn in their time. */
  const looking = new Array<boolean>(count).fill(false);
  const aimAt = (i: number, aim: Point, look = false) => {
    if (i >= 0) {
      aimUntil[i] = frame + kickFrames;
      aims[i] = { ...aim };
      looking[i] = look;
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
  let keepInShot: () => Point = () => ball;
  let cameraWidth = cameraWide;
  /** The frame each player last turned. */
  const turnedAt = new Array<number>(count).fill(-Infinity);
  /** Whether each player is running, for which way they face. */
  const running = new Array<boolean>(count).fill(false);
  /** Where each player was at the last frame, and their step since. */
  const seen: Point[] = [];
  const steps: Point[] = [];
  const record = () => {
    movers.forEach((mover, i) => {
      const last = seen[i] ?? mover;
      steps[i] = { d: mover.d - last.d, x: mover.x - last.x };
      seen[i] = { d: mover.d, x: mover.x };
      travelled[i] = travelled[i]! + Math.hypot(steps[i]!.d, steps[i]!.x);
    });
    xs.push([]);
    ys.push([]);
    poseLog.push([]);
    facingLog.push([]);
    poseFrameLog.push([]);
    travelLog.push([...travelled]);
    const at = xs.length - 1;
    const [bx, by] = toScreen(ball);
    movers.forEach((mover, i) => {
      const [x, y] = toScreen(mover);
      xs[at]!.push(x);
      ys[at]!.push(y);
      // A player who has just played the ball faces where it went; otherwise they
      // face the way they move, or else the ball. Standing still, a runner
      // stands, and a touch shows as a kick.
      // Judged over the last few frames, so a player hovering around a
      // walk doesn't flip between the way they move and the ball.
      const back = Math.min(at, facingWindow);
      const dx = back ? x - xs[at - back]![i]! : 0;
      const dy = back ? y - ys[at - back]![i]! : 0;
      const pace = back ? Math.hypot(dx, dy) / back : 0;
      const moving = pace > perFrame(standingSpeed);
      // Shuffling about their place, a player keeps their eye on the ball;
      // they face the way they go once they are running, and until they
      // have clearly slowed, so a pace near the line doesn't flip them.
      running[i] = running[i]
        ? pace > perFrame(facingSpeed.stop)
        : pace > perFrame(facingSpeed.start);
      const previous = at ? facings[facingLog[at - 1]![i]!]! : undefined;
      const aim = at < aimUntil[i]! ? aims[i] : undefined;
      const [ax, ay] = aim ? toScreen(aim) : [bx, by];
      const wanted = facings.indexOf(
        aim
          ? facingFor(ax - x, ay - y, previous)
          : running[i]
            ? facingFor(dx, dy, previous)
            : facingFor(bx - x, by - y, previous)
      );
      // A turn waits until the last has settled, but a kick or a throw
      // faces its aim at once.
      const kept = at ? facingLog[at - 1]![i]! : wanted;
      const turns =
        wanted !== kept &&
        ((aim && !looking[i]) || at - turnedAt[i]! >= turnFrames);
      if (turns) {
        turnedAt[i] = at;
      }
      facingLog[at]!.push(turns || !at ? wanted : kept);
      const pose =
        (mover.pose === 'run' || mover.pose === 'hold') && at < kickUntil[i]!
          ? 'kick'
          : mover.pose === 'run' && !moving
            ? 'stand'
            : mover.pose;
      poseLog[at]!.push(poses.indexOf(pose));
      poseFrameLog[at]!.push(pose === 'header' ? (mover.poseFrame ?? 0) : -1);
    });
    balls.push([bx, by, ball.height]);
    const focus = cameraFocus();
    const halfWidth = cameraWidth / 2;
    const halfLength = (cameraWidth * cameraAspect) / 2;
    // The camera eases after its focus, but never lets the ball, or after
    // a goal the scorer, out of shot.
    const subject = keepInShot();
    const inShot = (p: Point): Point => ({
      d: clamp(p.d, subject.d - halfLength + 3, subject.d + halfLength - 3),
      x: clamp(p.x, subject.x - halfWidth + 3, subject.x + halfWidth - 3)
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

  /** The defender closing the ball down, as last chosen. */
  let pressing = -1;
  // Every player not told otherwise heads for their place in the shape.
  const steer = (
    frame: number,
    held: ReadonlySet<number>,
    overrides: ReadonlyMap<number, Point> = new Map(),
    /** A pass along the ground, from the ball to where it goes. */
    lane?: Readonly<{ from: Point; to: Point }>,
    /** Players who walk or jog, and how fast, in metres a second. */
    paces: ReadonlyMap<number, number> = new Map()
  ) => {
    const line = offside ? offsideLine() - 0.5 : Infinity;
    // The defender nearest the ball closes it down, but never tackles. The
    // one already doing it keeps on unless another is clearly nearer, so
    // two about as near don't take turns.
    let presser = -1;
    let nearest = Infinity;
    for (let j = 0; j < defenders.length; j++) {
      const i = attackers.length + j;
      if (defenders[j]!.line === 'keeper') {
        continue;
      }
      const gap =
        distance(movers[i]!, ball) - (i === pressing ? pressingGive : 0);
      if (gap < nearest) {
        nearest = gap;
        presser = i;
      }
    }
    pressing = presser;
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
      // A shooter from range waits deep for the ball to come to them. Once
      // beaten, no one closes the ball down: they all chase.
      const goal = {
        ...(overrides.get(i) ??
          (i === shooter && finish === 'long-range'
            ? shootingSpot
            : i === presser && !beaten
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
        paces.get(i) ??
          (i < attackers.length
            ? 6
            : i === keeperSlot
              ? 4
              : gap > recoveryGap
                ? 7.5
                : 5.5)
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
  } else if (finish === 'header') {
    // A cross is met six to eleven metres out.
    shootingSpot.d = pitchLength - finishRng.between(6, 11);
    shootingSpot.x = 34 + finishRng.between(-6, 6);
  } else if (finish === 'long-range') {
    shootingSpot.d = pitchLength - finishRng.between(22, 30);
    shootingSpot.x = 34 + finishRng.between(-12, 12);
  } else if (finish === 'one-on-one') {
    // Through on goal, centrally, with the keeper to beat.
    shootingSpot.d = pitchLength - finishRng.between(14, 18);
    shootingSpot.x = 34 + finishRng.between(-5, 5);
  }
  // Of the saves from a cross, some are the keeper coming to catch it.
  if (
    finish === 'header' &&
    keeperSlot >= 0 &&
    input.outcome === undefined &&
    (saveOutcomes as readonly string[]).includes(outcome) &&
    finishRng.next() < claimShare
  ) {
    outcome = 'claim';
  }
  // Of the shots and headers that reach the keeper's goal, some are first
  // parried back out for the shooter to strike again, from a stream of
  // their own so every other clip plays as before.
  const reboundRng = createClipRng(hashSeed(`${input.seed}|rebound`));
  let rebound =
    (finish === 'shot' || finish === 'header') &&
    keeperSlot >= 0 &&
    outcome !== 'claim' &&
    outcomeKind(outcome) !== 'clearance' &&
    (input.rebound ?? reboundRng.next() < reboundShare);
  const passCount = others.length ? rng.int(2, 4) : 0;
  const minBuildUp = 6 * clipFps;
  /**
   * Past this, no one carries the ball on; past the next, the shooter is
   * found. A cross or a ball through takes time of its own after, so its
   * build-up is cut shorter.
   */
  const setUp = finish === 'one-on-one' ? 3 : finish === 'header' ? 2 : 0;
  const lastCarry = (7 - setUp) * clipFps;
  const maxBuildUp = (8 - setUp) * clipFps;
  let frame = 0;
  let holder = starter;
  const label = (i: number) => attackers[i]!.label;

  /**
   * The first touch of the latest pass: how far the ball has run on ahead
   * of the receiver's stride, and how fast it still runs away from them, in
   * metres a frame.
   */
  let firstTouch: { ahead: number; away: number } | undefined;
  /** The way the holder carries the ball, smoothed over a few frames. */
  let carrying: Point = { d: 1, x: 0 };
  /** The carrier's pace, in metres a frame, and the ball's turn round them, in radians a frame. */
  let carryPace = 0;
  let ballSpin = 0;
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
      // Holding about where they are, they keep the way they were going.
      const heading =
        gap > holdingGap
          ? { d: (to.d - mover.d) / gap, x: (to.x - mover.x) / gap }
          : carrying;
      // The carrier picks up speed and slows down over a few strides, and
      // slows to turn while the ball comes round with them, so it never
      // trails nor jumps to the other side of their feet. They ease up
      // before where they are going rather than stop dead.
      const along = carrying.d * heading.d + carrying.x * heading.x;
      const wanted = Math.min(
        step * Math.max(0.1, along) ** 2,
        Math.sqrt(2 * carrierBrake * gap)
      );
      carryPace = clamp(
        wanted,
        carryPace - carrierBrake,
        carryPace + carrierPickUp
      );
      // The ball's swing round them eases in and out, and they run the way
      // it goes, so they curve round rather than turn on the spot; holding
      // where they are, they coast to a stop.
      const swing = angleBetween(carrying, heading);
      const spinWanted =
        Math.sign(swing) *
        Math.min(ballTurn, Math.sqrt(2 * ballSpinUp * Math.abs(swing)));
      ballSpin = clamp(
        spinWanted,
        ballSpin - ballSpinUp,
        ballSpin + ballSpinUp
      );
      carrying =
        Math.abs(swing) <= Math.abs(ballSpin) && swing * ballSpin >= 0
          ? heading
          : rotated(carrying, ballSpin);
      const moved = carryPace;
      mover.d += carrying.d * moved;
      mover.x += carrying.x * moved;
      // Off the first touch the ball runs on ahead, slowing, and the
      // receiver comes onto it: it never runs back to them.
      if (firstTouch) {
        firstTouch.ahead = Math.max(0, firstTouch.ahead + firstTouch.away);
        firstTouch.away = Math.max(
          -gatherShare * moved,
          firstTouch.away - touchDrag
        );
        if (firstTouch.ahead === 0 && firstTouch.away <= 0) {
          firstTouch = undefined;
        }
      }
      const ahead = stride + (firstTouch?.ahead ?? 0);
      ball.d = mover.d + carrying.d * ahead;
      ball.x = mover.x + carrying.x * ahead;
      const overrides = new Map<number, Point>(chase);
      if (holder !== shooter && passesLeft() <= 1) {
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
   * Where the final pass finds the shooter, for a finish that needs it.
   * From range, the shooter drops off or pushes on along their own line from
   * goal to 23 to 30 m out. Through on goal, the ball goes in behind the
   * deepest defender, or there is no one-on-one and they shoot instead.
   */
  const placeFinish = (end: Point) => {
    const runner = movers[shooter]!;
    if (finish === 'long-range') {
      const out = Math.hypot(runner.d - pitchLength, runner.x - 34) || 1;
      const reach = clamp(out, longRange, 30);
      end.d = pitchLength + ((runner.d - pitchLength) / out) * reach;
      end.x = clamp(34 + ((runner.x - 34) / out) * reach, 18, 50);
    } else if (finish === 'one-on-one') {
      const deepest = Math.max(
        ...defenders.flatMap((p, j) =>
          p.line === 'keeper' ? [] : [movers[attackers.length + j]!.d]
        )
      );
      end.d = Math.max(end.d, deepest + 4);
      if (end.d > pitchLength - 9) {
        finish = 'shot';
        end.d = shootingSpot.d;
      }
    }
    shootingSpot.d = end.d;
    shootingSpot.x = end.x;
  };

  /**
   * A run onto a ball, from where player `i` stands to `to` over `frames`:
   * bent out of the stride they are in, so they don't turn sharply as the
   * ball is played. It gives their place `u` of the way along.
   */
  const bentRun = (i: number, to: Point, frames: number) => {
    const from = { d: movers[i]!.d, x: movers[i]!.x };
    const step = steps[i] ?? { d: 0, x: 0 };
    const ahead = Math.hypot(step.d, step.x) * (frames / 2);
    const most = distance(from, to) / 2;
    const bend = ahead > most ? most / ahead : 1;
    const via = {
      d: from.d + step.d * (frames / 2) * bend,
      x: from.x + step.x * (frames / 2) * bend
    };
    return (u: number): Point => ({
      d: lerp(lerp(from.d, via.d, u), lerp(via.d, to.d, u), u),
      x: lerp(lerp(from.x, via.x, u), lerp(via.x, to.x, u), u)
    });
  };

  /**
   * A pass to a receiver running onto it, at the ball's own pace: the
   * receiver is played in where they can get to it. The passer holds the
   * final pass back a moment while the shooter gets within reach.
   */
  const pass = (
    receiver: number,
    kind: ClipPass['kind'] = 'pass',
    /** Where it is played, if not to the receiver's feet or run. */
    into?: Point
  ) => {
    const runner = movers[receiver]!;
    const lead = kind === 'throw-in' ? rng.between(0.5, 2) : rng.between(2, 6);
    const end = into
      ? { ...into }
      : receiver === shooter
        ? { ...shootingSpot }
        : {
            d: clamp(runner.d + lead, 10, 95),
            x: clamp(runner.x + rng.between(-3, 3), 3, pitchWidth - 3)
          };
    if (receiver === shooter && !into) {
      placeFinish(end);
    }
    if (receiver === shooter && kind === 'pass' && frame <= maxBuildUp) {
      const chase = new Map([[shooter, end]]);
      for (
        let f = 0;
        f < shooterWait &&
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
    const { frames, lofted } = flightTo(end, kind);
    // The receiver meets the ball a stride behind it, the way it came.
    const came = distance(from, end);
    const way = came
      ? { d: (end.d - from.d) / came, x: (end.x - from.x) / came }
      : { d: 1, x: 0 };
    const runTo = { d: end.d - way.d * stride, x: end.x - way.x * stride };
    const runAt = bentRun(receiver, runTo, frames);
    passes.push({
      end: frame + frames,
      from: label(holder),
      kind,
      passer: holder,
      receiver,
      start: frame,
      to: label(receiver)
    });
    if (receiver === shooter && finish === 'one-on-one') {
      beaten = true;
    }
    const thrower = holder;
    if (kind === 'throw-in') {
      aimAt(thrower, end);
    } else {
      kick(thrower, end);
    }
    // A ball in the air bends a little and, but for a throw, lands and
    // bounces before it is controlled; one along the ground runs straight.
    const thrown = kind === 'throw-in';
    const bend = lofted && !thrown ? curl(0.3, 1) : 0;
    /** How far the ball came in the last frame, along the way it came. */
    let arriving = 0;
    for (let f = 1; f <= frames; f++) {
      const u = f / frames;
      const before = { d: ball.d, x: ball.x };
      const rolled = lofted ? u : u * (1.3 - 0.3 * u);
      Object.assign(ball, bent(from, end, rolled, bend));
      arriving = (ball.d - before.d) * way.d + (ball.x - before.x) * way.x;
      ball.height = !lofted
        ? 0
        : thrown
          ? Math.sin(Math.PI * u) * 0.5
          : loftedHeight(u, 0.5);
      // A throw is let go with the ball still held over the head.
      movers[thrower]!.pose =
        kind === 'throw-in' && f <= kickFrames ? 'hold' : 'run';
      Object.assign(runner, runAt(u));
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
    // The receiver takes the ball on the way it came, and the touch takes
    // the pace off it. A lofted ball has bounced, and comes down dead.
    const running = steps[receiver] ?? { d: 0, x: 0 };
    firstTouch = {
      ahead: 0,
      away: lofted
        ? 0
        : clamp(
            arriving - (running.d * way.d + running.x * way.x),
            0,
            perFrame(touchSpring)
          )
    };
    carrying = way;
    carryPace = Math.min(Math.hypot(running.d, running.x), perFrame(8));
    ballSpin = 0;
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
      for (let f = 0; f < shooterWait && !onside(shooter); f++) {
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
          ? // A corner to be headed takes longer, as the box fills.
            finish === 'header'
            ? rng.int(150, 200)
            : rng.int(90, 130)
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
    // A corner to be headed, or cut out, is crossed in the moment.
    if (
      restart !== 'corner' ||
      (outcome !== 'interception' && finish !== 'header')
    ) {
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

  /**
   * For a header, the ball goes wide for a cross: the holder carries it to
   * the wing if it is near, or else plays it out there to whoever is
   * nearest, while the shooter makes for the box.
   */
  const goWide = () => {
    // Never more than a few metres back from a holder already deep.
    const wing = {
      d: Math.max(pitchLength - finishRng.between(10, 20), ball.d - 3),
      x: ball.x < 34 ? 5 : pitchWidth - 5
    };
    const gap = distance(movers[holder]!, wing);
    // Out to someone level or ahead, never a long way back.
    const near = others
      .filter(i => i !== holder && movers[i]!.d >= ball.d - 5)
      .toSorted(
        (a, b) => distance(movers[a]!, wing) - distance(movers[b]!, wing)
      );
    // Over time, only a short carry: otherwise it goes out there at once.
    const carryUpTo = frame > maxBuildUp ? widestCarry / 2 : widestCarry;
    if (gap > carryUpTo && near.length) {
      pass(near[0]!, 'pass', wing);
      dribble(
        rng.int(15, 30),
        { d: ball.d + carrying.d, x: ball.x + carrying.x },
        1.5
      );
    } else {
      // With no one to find, they carry it no further than they would
      // otherwise, and cross from there.
      const speed = rng.between(5.5, 7);
      const metres = Math.min(gap, carryUpTo);
      dribble(Math.max(1, Math.round((metres / speed) * clipFps)), wing, speed);
    }
  };

  // The build-up: each player takes the ball under control, may carry it
  // on, then passes; the last pass reaches the shooter in shooting range.
  // A corner's cross has already found the shooter.
  while (restart !== 'corner') {
    // The first touch takes the ball on the way it came, the receiver
    // slowing to it from the pace they came at.
    // Found late, the shooter's touch is a quick one.
    const drawnTouch = rng.int(25, 50);
    const touchFrames =
      holder === shooter && frame > maxBuildUp
        ? Math.min(drawnTouch, quickTouch)
        : drawnTouch;
    const last = steps[holder] ?? { d: 0, x: 0 };
    const touchPace = clamp(
      Math.hypot(last.d, last.x) * clipFps,
      ...firstTouchPace
    );
    // Far enough on that they ease down to it, however fast they came.
    const touchRun = Math.max(
      (touchPace * touchFrames) / clipFps + 1,
      carryPace ** 2 / (2 * carrierBrake) + 1
    );
    dribble(
      touchFrames,
      {
        d: ball.d + carrying.d * touchRun,
        x: ball.x + carrying.x * touchRun
      },
      touchPace
    );
    const towards = holder === shooter ? { d: 101, x: 34 } : shootingSpot;
    // Before the final pass the ball is carried only as far as it must be,
    // into range or out wide, so the holder doesn't dwell on it.
    const final =
      holder !== shooter && (passesLeft() <= 1 || frame > maxBuildUp);
    const carries = rng.next() < 0.6 && frame < lastCarry && !final;
    if (carries || (holder === shooter && frame < minBuildUp)) {
      const seconds =
        holder === shooter
          ? Math.max(1, Math.min(4, (minBuildUp - frame) / clipFps))
          : rng.between(1, 2.5);
      const speed = rng.between(5, 7);
      // A shooter from range carries it no nearer than they mean to shoot.
      const range =
        holder === shooter && finish === 'long-range'
          ? Math.max(0, distance(movers[holder]!, towards) - longRange)
          : Infinity;
      const reach = Math.min(
        seconds * speed,
        Math.max(0, distance(movers[holder]!, towards) - 4),
        range
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
      // Found out of range, the shooter carries it on until they are in it.
      // With too little time left for that, they try their luck from range,
      // carrying it only to 30 m.
      const goal = { d: pitchLength, x: 34 };
      const out = distance(movers[shooter]!, goal);
      const reach =
        perFrame(intoRangePace) *
        Math.max(0, shooterReadyBy - frame - clipFps / 2);
      // A blocked shot stays a shot, carried only as far as there is time.
      const blocked = outcomeKind(outcome) === 'clearance';
      if (finish === 'shot' && !blocked && out - reach > longestShot - 2) {
        finish = 'long-range';
      }
      const furthest = finish === 'long-range' ? longestLongRange : longestShot;
      if ((finish === 'shot' || finish === 'long-range') && out > furthest) {
        const metres = out - (furthest - 2);
        const way = distance(movers[shooter]!, shootingSpot) || 1;
        // A shot from range is carried into range whatever the time.
        const along = Math.min(metres, way, blocked ? reach : Infinity);
        const to = {
          d:
            movers[shooter]!.d +
            ((shootingSpot.d - movers[shooter]!.d) / way) * along,
          x:
            movers[shooter]!.x +
            ((shootingSpot.x - movers[shooter]!.x) / way) * along
        };
        dribble(
          Math.ceil((along / intoRangePace) * clipFps) + clipFps / 2,
          to,
          intoRangePace
        );
      }
      break;
    }
    if (frame > maxBuildUp) {
      passesMade = Math.max(passesMade, passCount - 1);
    }
    // Over time, the holder plays it at once, in the air if it is long.
    const overTime = frame > maxBuildUp;
    if (passesLeft() <= 1 && finish !== 'header' && !overTime) {
      // Far from goal, the holder carries the ball on before the final pass.
      const mover = movers[holder]!;
      const gap = distance(mover, shootingSpot);
      if (gap > finalPassRange) {
        const speed = rng.between(5.5, 7);
        const metres = Math.min(gap - finalPassRange + 2, 2 * speed);
        const to = {
          d: mover.d + ((shootingSpot.d - mover.d) / gap) * metres,
          x: mover.x + ((shootingSpot.x - mover.x) / gap) * metres
        };
        dribble(Math.round((metres / speed) * clipFps), to, speed);
      }
    }
    if (finish === 'header' && passesLeft() <= 1) {
      goWide();
      break;
    }
    const receiver = nextReceiver();
    if (finish === 'header' && receiver === shooter) {
      // The shooter waits in the box for the cross.
      goWide();
      break;
    }
    if (receiver === shooter && outcome === 'interception') {
      // The final pass is the one cut out.
      break;
    }
    pass(receiver);
  }
  if (holder === shooter && outcome === 'interception') {
    outcome = 'block';
  }
  // Left with the ball themselves, the shooter can't head a cross.
  if (finish === 'header' && holder === shooter) {
    finish = 'shot';
    if (outcome === 'claim') {
      outcome = 'hold';
    }
  }

  // Through on goal from further out, the shooter runs on with the ball.
  if (finish === 'one-on-one' && holder === shooter) {
    // At most a few seconds' run: from further out, the shot comes sooner.
    const runOn = Math.min(pitchLength - 16 - movers[shooter]!.d, 7 * 4);
    if (runOn > 0) {
      // Time to get up to speed, too.
      dribble(
        Math.round((runOn / 7) * clipFps) + clipFps / 2,
        { d: pitchLength - 16, x: lerp(ball.x, 34, 0.5) },
        7
      );
    }
  }

  // The zoom: the shooter takes a touch towards goal as the camera closes in.
  // Offside no longer matters once the shooter has the ball in range.
  const zoomStart = frame;
  // Running late, the camera closes in quicker.
  const zoomFrames = frame > shooterReadyBy ? clipFps / 2 : clipFps;
  // Before an interception the passer has the ball; a corner taker waits.
  // Through on goal, the shooter carries it on and the keeper comes out;
  // waiting for a cross, the shooter makes for the spot to meet it.
  const through = finish === 'one-on-one' && holder === shooter;
  const touch = through
    ? {
        d: Math.min(movers[shooter]!.d + 6, pitchLength - 10),
        x: lerp(ball.x, 34, 0.3)
      }
    : holder === shooter
      ? { d: Math.min(movers[shooter]!.d + 1.5, 100), x: ball.x }
      : restart === 'corner'
        ? { d: movers[holder]!.d, x: movers[holder]!.x }
        : { d: Math.min(movers[holder]!.d + 1, 100), x: ball.x };
  const waiting = restart === 'corner' && holder !== shooter;
  const zoomChase = new Map<number, Point>();
  if (finish === 'header') {
    zoomChase.set(shooter, shootingSpot);
  }
  for (let f = 0; f < zoomFrames; f++) {
    cameraWidth = lerp(cameraWide, cameraZoomed, ease(f / zoomFrames));
    if (through && keeperSlot >= 0) {
      zoomChase.set(keeperSlot, {
        d: pitchLength - keeperRushes,
        x: lerp(34, ball.x, 0.5)
      });
    }
    if (waiting) {
      // The ball stays on the corner spot until it is crossed.
      steer(frame, new Set([holder]), zoomChase);
      record();
      frame++;
    } else {
      dribble(1, touch, through ? 5.5 : 1.5, zoomChase);
    }
  }
  cameraWidth = cameraZoomed;

  // The moment: the shot, and how it ends.
  const momentStart = frame;
  offside = false;
  /**
   * The moment goes on this long after the ball arrives, so it settles in
   * the net, the keeper's hands or behind, before the reaction.
   */
  const afterArrival = Math.round(0.8 * clipFps);
  /** A header lands: the contact for a few frames, then the crouch. */
  const land = (f: number, met: boolean) => {
    const header = movers[shooter]!;
    const contact = met ? landingFrames : 0;
    header.pose = f <= contact + landingFrames ? 'header' : 'run';
    header.poseFrame = f <= contact ? 2 : 0;
  };
  const side = rng.next() < 0.5 ? -1 : 1;
  let shotFrom = { d: ball.d, x: ball.x };
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
    for (let f = 1; f <= flight + afterArrival; f++) {
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
    // For a header the cross comes first: from the crosser, or the corner
    // flag, to the shooter, who runs on, crouches and leaps to meet it.
    let crossFrames = 0;
    /** For a claim, the frame of the cross the keeper catches it on. */
    let claimFrame = 0;
    let headed = finish === 'header';
    /** The frames the first effort and the rebound take. */
    let reboundFrames = 0;
    if (headed) {
      const crosser = holder;
      const headAt = { ...shootingSpot };
      const crossFrom = { d: ball.d, x: ball.x };
      const header = movers[shooter]!;
      crossFrames = Math.ceil(
        Math.max(distance(crossFrom, headAt) / perFrame(18), clipFps * 0.8)
      );
      // Coming for it, the keeper sets off as it is struck and catches it
      // a few metres short of the header.
      const claim = outcome === 'claim' && keeper ? keeper : undefined;
      claimFrame = claim
        ? Math.round(crossFrames * finishRng.between(0.8, 0.88))
        : 0;
      const claimFrom = claim ? { d: claim.d, x: claim.x } : undefined;
      // A cross swings in or away.
      const swing = curl(0.8, 2);
      const crossAt = (u: number) => bent(crossFrom, headAt, u, swing);
      const caught = crossAt(claimFrame / crossFrames);
      passes.push({
        ...(claim ? { cutOut: true as const } : {}),
        end: frame + crossFrames,
        from: label(crosser),
        kind: restart === 'corner' ? 'corner' : 'cross',
        passer: crosser,
        receiver: shooter,
        start: frame,
        to: label(shooter)
      });
      kick(crosser, headAt);
      cameraFocus = () => ({ d: (ball.d + pitchLength) / 2, x: ball.x });
      const runAt = bentRun(shooter, headAt, crossFrames);
      for (let f = 1; f <= crossFrames; f++) {
        const u = f / crossFrames;
        Object.assign(ball, crossAt(u));
        ball.height = Math.sin(Math.PI * u) * 0.6 + headHeight * u;
        if (claim && claimFrom) {
          if (f <= claimFrame) {
            Object.assign(claim, {
              d: lerp(claimFrom.d, caught.d, ease(f / claimFrame)),
              x: lerp(claimFrom.x, caught.x, ease(f / claimFrame))
            });
          } else {
            // In the keeper's hands, over their head.
            Object.assign(ball, { d: claim.d, height: 0.5, x: claim.x });
          }
          claim.pose = f > claimFrame - 8 ? 'hold' : 'run';
        }
        Object.assign(header, runAt(u));
        const left = crossFrames - f;
        header.pose = left < jumpFrames ? 'header' : 'run';
        header.poseFrame = left < jumpFrames / 2 ? 1 : 0;
        steer(frame, new Set([shooter, ...(claim ? [keeperSlot] : [])]));
        record();
        frame++;
      }
      shotFrom = { d: ball.d, x: ball.x };
    }
    if (outcome === 'claim' && keeper) {
      // Caught: the clip reaches its moment in the keeper's hands, and they
      // hold it while the header lands.
      momentFrame = momentStart + claimFrame - 1;
      cameraFocus = () => ({ d: (ball.d + pitchLength) / 2, x: ball.x });
      for (let f = 1; f <= afterArrival; f++) {
        land(f, false);
        keeper.pose = 'hold';
        Object.assign(ball, { d: keeper.d, height: 0.5, x: keeper.x });
        steer(frame, new Set([keeperSlot]));
        record();
        frame++;
      }
    } else {
      // Only a chance from close in comes back to the shooter.
      rebound &&=
        keeper !== undefined &&
        distance(shotFrom, { d: pitchLength, x: 34 }) < reboundRange;
      if (rebound && keeper) {
        // The keeper gets down to the first effort but only pushes it back
        // out into the box. The shooter follows in, beating the nearest
        // defender to it, as the keeper scrambles up.
        const striker = movers[shooter]!;
        const firstAim = {
          d: pitchLength - 0.8,
          x: 34 + side * reboundRng.between(1.5, goalHalf - 0.4)
        };
        const firstFlight = Math.max(
          10,
          Math.ceil(distance(shotFrom, firstAim) / perFrame(headed ? 14 : 25))
        );
        const spill = {
          d: pitchLength - reboundRng.between(5, 8),
          x: clamp(
            lerp(firstAim.x, striker.x, reboundRng.between(0.3, 0.7)) +
              reboundRng.between(-2.5, 2.5),
            34 - 9,
            34 + 9
          )
        };
        const spillFrames = Math.ceil(
          distance(firstAim, spill) / perFrame(spillPace)
        );
        // The shooter strikes from just behind the ball, once a header has
        // landed.
        const strikeSpot = { d: spill.d - 0.6, x: spill.x };
        const setOff = headed ? 2 * landingFrames : kickFrames;
        const followFrames =
          setOff +
          Math.ceil(distance(striker, strikeSpot) / perFrame(followPace));
        reboundFrames =
          Math.max(firstFlight + spillFrames, followFrames) + reboundSettle;
        const keeperFrom = { d: keeper.d, x: keeper.x };
        const recover = {
          d: pitchLength - 0.8,
          x: lerp(firstAim.x, 34, 0.6)
        };
        let chaser = -1;
        let nearest = Infinity;
        defenders.forEach((p, j) => {
          const i = attackers.length + j;
          const gap = distance(movers[i]!, spill);
          if (p.line !== 'keeper' && gap < nearest) {
            nearest = gap;
            chaser = i;
          }
        });
        const firstBend = headed ? 0 : curl(0.2, 1);
        if (headed) {
          aimAt(shooter, firstAim);
        } else {
          kick(shooter, firstAim);
        }
        const wasHeaded = headed;
        for (let f = 1; f <= reboundFrames; f++) {
          if (wasHeaded) {
            land(f, true);
          }
          if (f <= firstFlight) {
            const u = f / firstFlight;
            Object.assign(ball, bent(shotFrom, firstAim, u, firstBend));
            ball.height = wasHeaded
              ? headHeight * (1 - u) + Math.sin(Math.PI * u) * 0.12
              : Math.sin(Math.PI * u) * 0.35;
            const k = ease(Math.min(1, f / Math.max(1, firstFlight - 2)));
            keeper.d = lerp(keeperFrom.d, firstAim.d, k);
            keeper.x = lerp(keeperFrom.x, firstAim.x, k);
            keeper.pose = f > firstFlight * 0.4 ? 'dive' : 'run';
          } else {
            // Off the keeper it pops up and runs out, and stops.
            const u = Math.min(1, (f - firstFlight) / spillFrames);
            const out = 1 - (1 - u) * (1 - u);
            ball.d = lerp(firstAim.d, spill.d, out);
            ball.x = lerp(firstAim.x, spill.x, out);
            ball.height = Math.sin(Math.PI * u) * 0.5;
            if (f - firstFlight > scrambleFrames) {
              keeper.pose = 'run';
              const gap = distance(keeper, recover);
              const step = perFrame(5);
              if (gap > step) {
                keeper.d += ((recover.d - keeper.d) / gap) * step;
                keeper.x += ((recover.x - keeper.x) / gap) * step;
              }
            }
          }
          if (f > setOff) {
            if (!wasHeaded) {
              striker.pose = 'run';
            }
            // Eyes on goal, they come back for it rather than turn about.
            aimAt(shooter, firstAim, true);
            const gap = distance(striker, strikeSpot);
            const step = perFrame(followPace);
            if (gap > step) {
              striker.d += ((strikeSpot.d - striker.d) / gap) * step;
              striker.x += ((strikeSpot.x - striker.x) / gap) * step;
            } else {
              Object.assign(striker, strikeSpot);
            }
          }
          // The defender chases, but is too late.
          const overrides = new Map<number, Point>();
          if (chaser >= 0) {
            const at = movers[chaser]!;
            const gap = distance(at, spill) || 1;
            overrides.set(chaser, {
              d: spill.d + ((at.d - spill.d) / gap) * lateBy,
              x: spill.x + ((at.x - spill.x) / gap) * lateBy
            });
          }
          steer(frame, new Set([shooter, keeperSlot]), overrides);
          record();
          frame++;
        }
        shotFrom = { d: ball.d, x: ball.x };
        headed = false;
      }
      // Through on goal, the keeper has come out to meet the shooter.
      const outFor = finish === 'one-on-one' && keeper ? keeper : undefined;
      let aim: Point;
      let rest: Point;
      let stopsAtKeeper = false;
      // A rebound scored goes in the side the keeper has left.
      const shotSide = rebound && keeper ? (keeper.x <= 34 ? 1 : -1) : side;
      switch (outcome) {
        case 'goal': {
          const x = 34 + shotSide * rng.between(0.6, goalHalf - 0.4);
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
          aim = outFor
            ? {
                d: outFor.d - 0.5,
                x: outFor.x + side * (outcome === 'hold' ? 0.3 : 1.4)
              }
            : { d: pitchLength - 0.8, x };
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
        case 'claim':
          throw new Error('A claim plays above');
        case 'over': {
          const x = 34 + side * rng.between(0, goalHalf - 0.5);
          aim = { d: pitchLength, x };
          rest = { d: pitchLength + 5, x };
          break;
        }
      }
      // A header is slower than a shot, a shot from range faster.
      const pace = headed ? 14 : finish === 'long-range' ? 28 : 25;
      const flight = Math.max(
        10,
        Math.ceil(distance(shotFrom, aim) / perFrame(pace))
      );
      // The frame the ball arrives, the cross's frames included.
      momentFrame = momentStart + crossFrames + reboundFrames + flight - 1;
      const keeperFrom = keeper ? { d: keeper.d, x: keeper.x } : undefined;
      const keeperTo =
        keeper && keeperFrom
          ? stopsAtKeeper
            ? { d: aim.d, x: aim.x }
            : outcome === 'goal'
              ? outFor
                ? // Rounded or beaten, the keeper is left where they came to.
                  { d: keeperFrom.d, x: lerp(keeperFrom.x, aim.x, 0.35) }
                : {
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
      if (headed) {
        aimAt(shooter, aim);
      } else {
        kick(shooter, aim);
      }
      const scorer = movers[shooter]!;
      // A shot bends a little; a header doesn't.
      const shotBend = headed ? 0 : curl(0.2, 1);
      for (let f = 1; f <= flight + afterArrival; f++) {
        if (headed) {
          // The forehead meets it, then the header lands and runs on.
          land(f, true);
        }
        if (f <= flight) {
          const u = f / flight;
          Object.assign(ball, bent(shotFrom, aim, u, shotBend));
          // A header starts at head height and goes down, or over the bar.
          const from = headed ? headHeight : 0.4;
          ball.height =
            outcome === 'over'
              ? from + (1 - from) * u
              : headed
                ? headHeight * (1 - u) + Math.sin(Math.PI * u) * 0.12
                : Math.sin(Math.PI * u) * 0.35;
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
  // After a catch, the keeper throws it or rolls it out to a team-mate
  // between 12 and 25 m away, or kicks it long, as the seed picks.
  const caughtIt =
    keeper !== undefined &&
    outcomeKind(outcome) === 'save' &&
    outcome !== 'parry';
  const mates = caughtIt
    ? defenders.flatMap((p, j) => {
        const i = attackers.length + j;
        const gap = distance(movers[i]!, keeper);
        return p.line !== 'keeper' && gap > 12 && gap < 25 ? [i] : [];
      })
    : [];
  const wayOut = rng.next();
  const playOut: 'kick' | 'roll' | 'throw' = !mates.length
    ? 'kick'
    : wayOut < 0.45
      ? 'throw'
      : wayOut < 0.8
        ? 'roll'
        : 'kick';
  const mate = mates.length ? rng.pick(mates) : -1;
  /** The reaction's frame the keeper lets it go on. */
  const release = 50;
  // How everyone else takes it. After a goal, the defenders nearest their
  // goal despair, they all trudge back, and the keeper fetches the ball
  // from the net. After a save, a miss or a clearance, the attackers turn
  // back, the shooter holding their head first after a save or a miss.
  const conceded = outcome === 'goal';
  const goalMouth = { d: pitchLength, x: 34 };
  const halfway = { d: pitchLength / 2 - 7, x: 34 };
  const despairing = conceded
    ? defenders
        .flatMap((p, j) => (p.line === 'keeper' ? [] : [attackers.length + j]))
        .toSorted(
          (a, b) =>
            distance(movers[a]!, goalMouth) - distance(movers[b]!, goalMouth)
        )
        .slice(0, 2)
    : [];
  const rues =
    outcomeKind(outcome) === 'save' || outcomeKind(outcome) === 'near-miss';
  // The scorer wheels away towards the corner flag, to the fans behind the
  // goal, or back to their team-mates, as the seed picks, going only as far
  // as leaves them time to celebrate there. The nearest team-mates chase
  // them down and pile in.
  const awayFrom = scorer.x < 34 ? -1 : 1;
  const wheelsTo = rng.pick(['corner', 'fans', 'mates'] as const);
  const wheelRange = Math.min(
    longestWheel,
    perFrame(celebrationPace) * (reactionFrames - leapFrames - celebrateFor)
  );
  const wheelTowards: Point =
    wheelsTo === 'corner'
      ? corner
      : wheelsTo === 'fans'
        ? { d: pitchLength - 1, x: 34 + awayFrom * rng.between(9, 14) }
        : { d: scorer.d - rng.between(8, 12), x: lerp(scorer.x, 34, 0.3) };
  const wheel = Math.min(1, wheelRange / (distance(scorer, wheelTowards) || 1));
  const celebrateAt: Point = {
    d: lerp(scorer.d, wheelTowards.d, wheel),
    x: lerp(scorer.x, wheelTowards.x, wheel)
  };
  /** Where the scorer turns to celebrate: to the fans, or their team. */
  const salute: Point =
    wheelsTo === 'corner'
      ? { d: corner.d + 4, x: corner.x + awayFrom * 6 }
      : wheelsTo === 'fans'
        ? { d: pitchLength + 6, x: celebrateAt.x }
        : { d: celebrateAt.d - 6, x: celebrateAt.x };
  const joiners = conceded
    ? others
        .toSorted(
          (a, b) => distance(movers[a]!, scorer) - distance(movers[b]!, scorer)
        )
        .slice(0, 3)
    : [];
  // After a catch, the team-mate the keeper looks for breaks wide, and the
  // rest push up the pitch. After a parry the keeper gets up and back to
  // their line, and an attacker goes to take the corner.
  const wideFor =
    mate >= 0
      ? {
          d: (keeper?.d ?? pitchLength) - 16,
          x: movers[mate]!.x < 34 ? 18 : pitchWidth - 18
        }
      : undefined;
  const pushUp = { d: pitchLength - 35, x: 34 };
  const flag = {
    d: pitchLength - 0.5,
    x: ball.x < 34 ? 0.5 : pitchWidth - 0.5
  };
  const cornerTaker =
    outcome === 'parry'
      ? (others.toSorted(
          (a, b) => distance(movers[a]!, flag) - distance(movers[b]!, flag)
        )[0] ?? -1)
      : -1;
  const huddled = new Set<number>();
  let fetched = false;
  let mateSpot: Point | undefined;
  let keeperSpot: Point | undefined;
  let outFrames = 0;
  for (let f = 0; f < reactionFrames; f++) {
    cameraWidth =
      f < 50
        ? cameraZoomed
        : lerp(cameraZoomed, cameraWide, ease(Math.min(1, (f - 50) / 50)));
    const overrides = new Map<number, Point>();
    const paces = new Map<number, number>();
    if (outcome === 'goal') {
      // Arms up where they scored, then away, then arms up again there.
      const gap = distance(scorer, celebrateAt);
      const step = perFrame(celebrationPace);
      const off = f >= leapFrames && gap > step;
      if (off) {
        scorer.d += ((celebrateAt.d - scorer.d) / gap) * step;
        scorer.x += ((celebrateAt.x - scorer.x) / gap) * step;
      } else if (f >= leapFrames) {
        Object.assign(scorer, celebrateAt);
        aimAt(shooter, salute, true);
      }
      scorer.pose = off ? 'run' : 'celebrate';
      joiners.forEach((i, k) => {
        const angle = Math.PI * (0.25 + (k * 2) / 3);
        // They make for where the scorer is going, to meet them there.
        overrides.set(i, {
          d: celebrateAt.d - Math.sin(angle) * huddleGap,
          x: celebrateAt.x + Math.cos(angle) * huddleGap
        });
        paces.set(i, celebrationPace);
      });
      // The rest jog over and applaud from a few metres off.
      for (const i of others) {
        if (!joiners.includes(i)) {
          const from = movers[i]!;
          const gap = distance(from, scorer) || 1;
          overrides.set(i, {
            d: scorer.d + ((from.d - scorer.d) / gap) * 4,
            x: scorer.x + ((from.x - scorer.x) / gap) * 4
          });
          paces.set(i, jogPace);
        }
      }
      cameraFocus = () => ({ d: scorer.d, x: scorer.x });
      keepInShot = () => scorer;
    } else if (outcomeKind(outcome) === 'clearance') {
      scorer.pose = 'run';
      if (f === 25) {
        kick(clearer, cleared);
      }
      if (f >= 25 && f < 25 + clearFrames) {
        const u = (f - 25) / clearFrames;
        ball.d = lerp(ballAtRest.d, cleared.d, u);
        ball.x = lerp(ballAtRest.x, cleared.x, u);
        ball.height = loftedHeight(u, 0.6);
      } else if (f >= 25 + clearFrames) {
        // Landed, it runs on a few metres and stops.
        const run = Math.min(1, (f - 25 - clearFrames) / 30);
        const on = (1 - (1 - run) * (1 - run)) * clearRunOn;
        const gap = distance(ballAtRest, cleared) || 1;
        ball.d = cleared.d + ((cleared.d - ballAtRest.d) / gap) * on;
        ball.x = cleared.x + ((cleared.x - ballAtRest.x) / gap) * on;
        ball.height = 0;
        // Cleared, the defender is free to rejoin the shape.
        reactionHeld.delete(clearer);
      }
      cameraFocus = () => ({ d: ball.d, x: ball.x });
    } else {
      scorer.pose = outcomeKind(outcome) === 'near-miss' ? 'head' : 'run';
      if (keeper && outcomeKind(outcome) === 'save') {
        if (outcome === 'parry') {
          // Up off the ground, and back to the line for the corner.
          keeper.pose = f < getUpFrames ? 'dive' : 'run';
          if (f === getUpFrames) {
            reactionHeld.delete(keeperSlot);
          }
          if (f >= getUpFrames) {
            overrides.set(keeperSlot, { d: pitchLength - 1, x: 34 });
            paces.set(keeperSlot, walkPace);
          }
          if (cornerTaker >= 0 && f >= turnBackFrom) {
            overrides.set(cornerTaker, flag);
          }
        } else if (f < release) {
          // Held: down after a dive, then up in the hands, or ready to bowl,
          // coming out a few steps as the team spreads to take it.
          const down = outcome === 'dive' && f < getUpFrames;
          keeper.pose = down
            ? 'dive'
            : playOut === 'roll' && f >= release - 8
              ? 'kick'
              : 'hold';
          if (!down) {
            keeper.d -= perFrame(keeperStride);
          }
          ball.d = keeper.d;
          ball.x = keeper.x;
          if (wideFor) {
            overrides.set(mate, wideFor);
            paces.set(mate, 5);
          }
        } else if (playOut === 'kick') {
          // Kicked long, to land and bounce in midfield.
          if (f === release) {
            kick(keeperSlot, outlet);
            keeperSpot = { d: keeper.d, x: keeper.x };
          }
          keeper.pose = 'run';
          if (f < release + 30) {
            const u = ease((f - release) / 30);
            ball.d = lerp(keeperSpot!.d, outlet.d, u);
            ball.x = lerp(keeperSpot!.x, outlet.x, u);
            ball.height = loftedHeight(u, 0.5);
          } else {
            ball.height = 0;
          }
        } else {
          // Thrown or rolled to a team-mate, who stands to take it.
          if (f === release) {
            mateSpot = { d: movers[mate]!.d, x: movers[mate]!.x };
            keeperSpot = { d: keeper.d, x: keeper.x };
            outFrames = Math.ceil(
              distance(keeperSpot, mateSpot) /
                perFrame(playOut === 'throw' ? 14 : 13)
            );
            aimAt(keeperSlot, mateSpot);
          }
          overrides.set(mate, mateSpot!);
          const u = Math.min(1, (f - release) / outFrames);
          if (u < 1) {
            ball.d = lerp(keeperSpot!.d, mateSpot!.d, u);
            ball.x = lerp(keeperSpot!.x, mateSpot!.x, u);
            // A throw comes down from over the head; a roll stays on the grass.
            ball.height =
              playOut === 'throw'
                ? 0.35 * (1 - u) + Math.sin(Math.PI * u) * 0.1
                : 0;
          } else {
            const at = movers[mate]!;
            const gap = distance(keeperSpot!, at) || 1;
            ball.d = at.d + ((at.d - keeperSpot!.d) / gap) * 0.5;
            ball.x = at.x + ((at.x - keeperSpot!.x) / gap) * 0.5;
            ball.height = 0;
          }
          keeper.pose =
            f < release + 8 ? (playOut === 'throw' ? 'hold' : 'kick') : 'run';
        }
      }
      cameraFocus =
        outcomeKind(outcome) === 'save'
          ? () => ({ d: (ball.d + pitchLength) / 2, x: ball.x })
          : () => ({ d: scorer.d + 4, x: scorer.x });
    }
    if (conceded) {
      for (const i of despairing) {
        if (f < despairFrames) {
          movers[i]!.pose = 'head';
          reactionHeld.add(i);
        } else if (f === despairFrames) {
          movers[i]!.pose = 'run';
          reactionHeld.delete(i);
        }
      }
      defenders.forEach((p, j) => {
        const i = attackers.length + j;
        if (p.line !== 'keeper' && !reactionHeld.has(i)) {
          overrides.set(i, target(i, halfway, frame));
          paces.set(i, walkPace);
        }
      });
      if (keeper && f >= fetchFrom) {
        // Into the net for the ball, then out with it in their hands.
        const to = fetched
          ? { d: pitchLength - 4, x: 34 }
          : { d: ball.d, x: ball.x };
        const gap = distance(keeper, to);
        const step = perFrame(walkPace + 1);
        if (gap > step) {
          keeper.d += ((to.d - keeper.d) / gap) * step;
          keeper.x += ((to.x - keeper.x) / gap) * step;
        }
        fetched ||= distance(keeper, ball) < 0.6;
        keeper.pose = fetched ? 'hold' : 'run';
        if (fetched) {
          Object.assign(ball, { d: keeper.d, height: 0.5, x: keeper.x });
        }
      }
    } else {
      if (rues) {
        scorer.pose = f < despairFrames ? 'head' : 'run';
      }
      if (f === (rues ? despairFrames : 0)) {
        reactionHeld.delete(shooter);
      }
      // Waiting on a corner, the attackers stay up.
      outfield.forEach(i => {
        if (
          outcome !== 'parry' &&
          !reactionHeld.has(i) &&
          !overrides.has(i) &&
          f >= turnBackFrom
        ) {
          overrides.set(i, target(i, halfway, frame));
          paces.set(i, jogPace);
        }
      });
      if (caughtIt && f >= turnBackFrom) {
        defenders.forEach((p, j) => {
          const i = attackers.length + j;
          if (p.line !== 'keeper' && !overrides.has(i)) {
            overrides.set(i, target(i, pushUp, frame));
            paces.set(i, jogPace);
          }
        });
      }
    }
    steer(frame, reactionHeld, overrides, undefined, paces);
    for (const i of joiners) {
      // Once both are there, they throw their arms up and stay.
      if (
        f >= leapFrames &&
        distance(scorer, celebrateAt) < 0.01 &&
        distance(movers[i]!, scorer) < huddleGap + 0.8
      ) {
        huddled.add(i);
        reactionHeld.add(i);
      }
      // Chasing or arrived, they look at the scorer.
      movers[i]!.pose = huddled.has(i) ? 'celebrate' : 'run';
      aimAt(i, scorer, true);
    }
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
      ...(poseFrameLog[low]![i]! >= 0
        ? { poseFrame: poseFrameLog[low]![i]! }
        : {}),
      side,
      ...(zoomed && tired.has(i) ? { status: 'tired' as const } : {}),
      travelled: lerp(travelLog[low]![i]!, travelLog[high]![i]!, u),
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
    finish,
    frame: frameAt,
    input,
    length,
    momentFrame,
    outcome,
    passes,
    phases: { moment: momentStart, reaction: reactionStart, zoom: zoomStart },
    rebound,
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
        travelled: 0,
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
