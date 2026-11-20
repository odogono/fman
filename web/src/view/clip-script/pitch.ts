import {
  clamp,
  distance,
  facingFor,
  lerp,
  offBoards,
  perFrame,
  standOff,
  type Mover,
  type Point
} from './geometry';
import {
  boardTop,
  cameraAspect,
  cameraWide,
  cardFrames,
  clipFps,
  facings,
  framedPoses,
  pitchLength,
  pitchWidth,
  poses,
  sideOn,
  type ClipPass
} from './model';
import { type Setup } from './setup';
import {
  backLineAhead,
  backLineGive,
  backLineSway,
  boardStops,
  boxDepth,
  boxHalf,
  facingSpeed,
  facingWindow,
  farSideReach,
  fastestRun,
  flatOut,
  highLine,
  jockeyGive,
  jockeyRange,
  keeperOffLine,
  keeperShuffle,
  kickFrames,
  laneClearance,
  laneWidth,
  offsideNudge,
  penaltyArc,
  personalSpace,
  playerStops,
  pressingGive,
  receiverSpeed,
  recoveryGap,
  runRamp,
  sitFrames,
  standingSpeed,
  turnFrames
} from './tuning';

/**
 * Everything a clip shares as it plays, passed to each stage: the setup's
 * decisions, the players and the ball, the frame and the logs written as
 * it plays, and what each stage leaves for the next.
 */
export type Clip = Setup & {
  aims: (Point | undefined)[];
  /**
   * The frame each player's latest kick shows until, and the frame they face
   * where they played the ball until, kicked or thrown.
   */
  aimUntil: number[];
  /**
   * The depth the back line holds while play goes on: where it wants to be,
   * but never more than `backLineGive` from any of its players but the one
   * closing the ball down, so it moves as one and waits for a laggard.
   */
  backLineDepth: number | undefined;
  ball: Point & { height: number };
  balls: [number, number, number][];
  /** The ball's turn round the carrier, in radians a frame. */
  ballSpin: number;
  /** Where the ball was when players were last steered, for its pace. */
  ballWas: Point | undefined;
  /** A ball played through has beaten the defence, for a one-on-one. */
  beaten: boolean;
  /** Until the zoom, when a challenge can still come. */
  buildingUp: boolean;
  camera: Point & { width: number };
  cameraFocus: () => Point;
  cameraTrack: [number, number, number][];
  cameraWidth: number;
  /** The match-time card shows until this frame. */
  cardEnd: number;
  /** The way the holder carries the ball, smoothed over a few frames. */
  carrying: Point;
  /** The carrier's pace, in metres a frame. */
  carryPace: number;
  /**
   * A defender's challenge in the build-up: who, the way and the pace they
   * slide, the frame it starts, the side the carrier skips to and how many
   * frames into the slide they start to.
   */
  challenge:
    | {
        at: number;
        pace: number;
        side: number;
        skipFrom: number;
        /** How many frames the slide takes. */
        slide: number;
        way: Point;
        who: number;
      }
    | undefined;
  /** For a clearance, the defender who meets the ball and clears it. */
  clearer: number;
  /** One more pass forward has been added, the ball being too far out. */
  extraPass: boolean;
  facingLog: number[][];
  /**
   * The first touch of the latest pass: how far the ball has run on ahead
   * of the receiver's stride, and how fast it still runs away from them, in
   * metres a frame.
   */
  firstTouch: { ahead: number; away: number } | undefined;
  /** Where the shooter took the final pass, for how far they carry it after. */
  foundAt: Point | undefined;
  frame: number;
  holder: number;
  /** The ball has gone over the boards into the crowd. */
  inCrowd: boolean;
  /** Defenders stand back this far from a free kick while it is set. */
  keepAway: Point | undefined;
  /** The defending side's keeper, from the moment on. */
  keeper: Mover | undefined;
  keepInShot: () => Point;
  kickUntil: number[];
  /** Whether a player's aim is only where they look, to turn in their time. */
  looking: boolean[];
  /** The frame the clip reaches its moment. */
  momentFrame: number;
  /** The frame the moment starts. */
  momentStart: number;
  movers: Mover[];
  /** Attackers stay onside until the shot. */
  offside: boolean;
  passes: ClipPass[];
  passesMade: number;
  /** A header's frame, or -1; and the ground each player has covered. */
  poseFrameLog: number[][];
  poseLog: number[][];
  /** The defender closing the ball down, as last chosen. */
  pressing: number;
  /** The frame the reaction starts. */
  reactionStart: number;
  /** Whether each player is running, for which way they face. */
  running: boolean[];
  /** Where each player was at the last frame, and their step since. */
  seen: Point[];
  /** For a tackle, the frame the shooter is up again by. */
  shooterUpAt: number;
  /** Where the shot, or the pass cut out, is struck from. */
  shotFrom: Point;
  /** The side of the goal the shot goes, -1 or 1, drawn as the moment starts. */
  side: number;
  /** Some blocks are made sliding in. */
  slidingBlock: boolean;
  /** For a block, the draw that decides whether it is made sliding in. */
  slidingBlockRoll: number | undefined;
  steps: Point[];
  travelled: number[];
  travelLog: number[][];
  /** The frame each player last turned. */
  turnedAt: number[];
  /**
   * Frames are written as they play: x and y on the screen, then poses
   * and facings.
   */
  xs: number[][];
  ys: number[][];
  /** The frame the zoom starts. */
  zoomStart: number;
};

/** Where the back line wants to stand, given the ball. */
const backLineFor = (clip: Clip, ball: Point) =>
  // Caught by a ball through, the defence was playing a high line.
  clip.finish === 'one-on-one'
    ? clamp(ball.d + 8, 50, highLine)
    : clamp(ball.d + backLineAhead, 55, 99);

// Where each player wants to be, given the ball.
export const target = (
  clip: Clip,
  i: number,
  ball: Point,
  frame: number
): Point => {
  const quirk = clip.quirks[i]!;
  const sway = Math.sin(quirk.phase + (frame / quirk.period) * Math.PI * 2);
  if (i < clip.attackers.length) {
    const { line } = clip.attackers[i]!;
    if (line === 'keeper') {
      return { d: clamp(ball.d - 45, 6, 20), x: 34 };
    }
    const depth =
      line === 'defence'
        ? clamp(ball.d - 20, 12, 60)
        : line === 'midfield'
          ? // In support, ahead of the ball, but for a ball through.
            clamp(ball.d + (clip.finish === 'one-on-one' ? 0 : 8), 25, 80)
          : clamp(ball.d + 16, 40, 92);
    const across = pitchWidth * clip.attackSpots[i]! + 0.25 * (ball.x - 34);
    return {
      d: depth + quirk.d + sway * 1.5,
      x: clamp(across + quirk.x, 3, pitchWidth - 3)
    };
  }
  const j = i - clip.attackers.length;
  const { line } = clip.defenders[j]!;
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
      ? (clip.backLineDepth ?? backLineFor(clip, ball))
      : line === 'midfield'
        ? clamp(ball.d + 2, 40, 90)
        : clamp(ball.d - 12, 30, 75);
  // Beaten by a ball through, everyone chases from behind the shooter.
  const depth = clip.beaten
    ? Math.min(shape, clip.movers[clip.shooter]!.d - 2)
    : shape;
  const across =
    34 +
    (pitchWidth * clip.defenceSpots[j]! - 34) * 0.75 +
    0.35 * (ball.x - 34);
  return {
    // The back line holds one depth, to keep the attackers offside.
    d:
      line === 'defence'
        ? depth + sway * backLineSway
        : depth + quirk.d + sway * 1.5,
    x: clamp(across + quirk.x, 3, pitchWidth - 3)
  };
};

/**
 * How far up the pitch an attacker may wait without being offside: level
 * with the second-last defender, the ball, or halfway, whichever is
 * furthest forward. Only a run onto a pass already played goes beyond it.
 */
export const offsideLine = (clip: Clip) => {
  const depths = clip.movers
    .slice(clip.attackers.length)
    .map(m => m.d)
    .sort((a, b) => b - a);
  return Math.max(pitchLength / 2, clip.ball.d, depths[1] ?? 0);
};

/** Sets both sides out on the pitch for the clip's first frame. */
export const setThePitch = (setup: Setup): Clip => {
  const { ballStart, count } = setup;
  const clip: Clip = {
    ...setup,
    aims: new Array(count),
    aimUntil: new Array<number>(count).fill(-1),
    backLineDepth: undefined,
    ball: { ...ballStart, height: 0 },
    balls: [],
    ballSpin: 0,
    ballWas: undefined,
    beaten: false,
    buildingUp: true,
    camera: { d: ballStart.d + 8, width: cameraWide, x: ballStart.x },
    cameraFocus: () => ({ d: clip.ball.d + 8, x: clip.ball.x }),
    cameraTrack: [],
    cameraWidth: cameraWide,
    cardEnd: cardFrames,
    carrying: { d: 1, x: 0 },
    carryPace: 0,
    challenge: undefined,
    clearer: -1,
    extraPass: false,
    facingLog: [],
    firstTouch: undefined,
    foundAt: undefined,
    frame: 0,
    holder: setup.starter,
    inCrowd: false,
    keepAway: undefined,
    keeper: undefined,
    keepInShot: () => clip.ball,
    kickUntil: new Array<number>(count).fill(-1),
    looking: new Array<boolean>(count).fill(false),
    momentFrame: 0,
    momentStart: 0,
    movers: [],
    offside: true,
    passes: [],
    passesMade: 0,
    poseFrameLog: [],
    poseLog: [],
    pressing: -1,
    reactionStart: 0,
    running: new Array<boolean>(count).fill(false),
    seen: [],
    shooterUpAt: 0,
    shotFrom: { d: 0, x: 0 },
    side: 0,
    slidingBlock: false,
    slidingBlockRoll: undefined,
    steps: [],
    travelled: new Array<number>(count).fill(0),
    travelLog: [],
    turnedAt: new Array<number>(count).fill(-Infinity),
    xs: [],
    ys: [],
    zoomStart: 0
  };
  clip.movers = Array.from({ length: clip.count }, (_, i) => ({
    ...target(clip, i, clip.ballStart, 0),
    pose: 'run'
  }));
  clip.movers[clip.starter]!.d =
    clip.ballStart.d -
    (clip.restart === 'free-kick' || clip.restart === 'goal-kick'
      ? 1.5
      : clip.restart === 'corner'
        ? -0.6
        : 0.8);
  clip.movers[clip.starter]!.x =
    clip.restart === 'throw-in' || clip.restart === 'corner'
      ? clip.touchline + (clip.touchline === 0 ? -0.8 : 0.8)
      : clip.ballStart.x;
  {
    const line = offsideLine(clip);
    clip.movers.forEach((mover, i) => {
      if (i < clip.attackers.length && i !== clip.starter) {
        mover.d = Math.min(mover.d, line - 0.5);
      }
    });
  }
  if (clip.restart === 'penalty') {
    // The taker stands a few steps back from the spot, the keeper on their
    // line, and everyone else outside the box and the D: along its edge
    // either side, then behind the D, then a row further back, the two
    // sides mixed in.
    const taker = clip.movers[clip.shooter]!;
    taker.d = clip.ballStart.d - clip.penaltyRng.between(2.6, 3.4);
    taker.x = clip.ballStart.x + clip.penaltyRng.between(-1.2, 1.2);
    if (clip.keeperSlot >= 0) {
      Object.assign(clip.movers[clip.keeperSlot]!, {
        d: pitchLength - 0.4,
        x: 34
      });
    }
    const edge = pitchLength - boxDepth - 1;
    const byCentre = (row: number, xs: readonly number[]) =>
      xs
        .map(x => ({ d: row, x }))
        .toSorted((a, b) => Math.abs(a.x - 34) - Math.abs(b.x - 34));
    const wide = (from: number, to: number, gap: number) => {
      const xs: number[] = [];
      for (let off = from; off <= to; off += gap) {
        xs.push(34 - off, 34 + off);
      }
      return xs;
    };
    const behindD = clip.ballStart.d - penaltyArc - 1.2;
    const slots = [
      ...byCentre(edge, wide(penaltyArc, boxHalf - 1, 2.3)),
      ...byCentre(behindD, [31.5, 34, 36.5, 29, 39]),
      ...byCentre(edge - 2.6, wide(penaltyArc - 0.5, boxHalf + 1, 2.3))
    ];
    const lining = [
      ...clip.others,
      ...clip.defenders.flatMap((p, j) =>
        p.line === 'keeper' ? [] : [clip.attackers.length + j]
      )
    ];
    // Attackers and defenders take turns, so the two sides mix.
    const attackersIn = lining.filter(i => i < clip.attackers.length);
    const defendersIn = lining.filter(i => i >= clip.attackers.length);
    const mixed: number[] = [];
    for (let k = 0; k < Math.max(attackersIn.length, defendersIn.length); k++) {
      for (const from of [defendersIn, attackersIn]) {
        if (k < from.length) {
          mixed.push(from[k]!);
        }
      }
    }
    mixed.forEach((i, k) => {
      const slot = slots[k] ?? {
        d: edge - 5 - Math.floor((k - slots.length) / 8) * 2.6,
        x: 20 + ((k - slots.length) % 8) * 4
      };
      Object.assign(clip.movers[i]!, {
        d: slot.d - clip.penaltyRng.between(0, 0.5),
        x: slot.x + clip.penaltyRng.between(-0.3, 0.3)
      });
    });
  }
  return clip;
};

export const aimAt = (clip: Clip, i: number, aim: Point, look = false) => {
  if (i >= 0) {
    clip.aimUntil[i] = clip.frame + kickFrames;
    clip.aims[i] = { ...aim };
    clip.looking[i] = look;
  }
};
export const kick = (clip: Clip, i: number, aim: Point) => {
  if (i >= 0) {
    clip.kickUntil[i] = clip.frame + kickFrames;
    aimAt(clip, i, aim);
  }
};
const toScreen = (clip: Clip, p: Point): [number, number] =>
  clip.input.attackingUp ? [p.x, pitchLength - p.d] : [pitchWidth - p.x, p.d];

/** Whether the challenger is down, sliding or sitting, at `at`. */
const challengerDown = (clip: Clip, at: number) =>
  clip.challenge !== undefined &&
  at - clip.challenge.at < clip.challenge.slide + sitFrames;

const record = (clip: Clip) => {
  // The challenger slides, slowing, then sits up until they get up.
  if (clip.challenge) {
    const t = clip.frame - clip.challenge.at;
    const slider = clip.movers[clip.challenge.who]!;
    const { slide } = clip.challenge;
    if (t < slide) {
      const step = clip.challenge.pace * (1 - t / slide);
      slider.d += clip.challenge.way.d * step;
      slider.x += clip.challenge.way.x * step;
      slider.pose = 'tackle';
      slider.poseFrame = 0;
    } else if (t < slide + sitFrames) {
      slider.pose = 'tackle';
      slider.poseFrame = 1;
    } else if (t === slide + sitFrames) {
      // Up again, and from now on posed by the clip like anyone else.
      slider.pose = 'run';
    }
  }
  clip.movers.forEach((mover, i) => {
    const last = clip.seen[i] ?? mover;
    clip.steps[i] = { d: mover.d - last.d, x: mover.x - last.x };
    clip.seen[i] = { d: mover.d, x: mover.x };
    clip.travelled[i] =
      clip.travelled[i]! + Math.hypot(clip.steps[i]!.d, clip.steps[i]!.x);
  });
  clip.xs.push([]);
  clip.ys.push([]);
  clip.poseLog.push([]);
  clip.facingLog.push([]);
  clip.poseFrameLog.push([]);
  clip.travelLog.push([...clip.travelled]);
  const at = clip.xs.length - 1;
  // Nothing goes through the advertising boards: a ball running on past
  // them comes back off them, unless it reaches them high enough to go
  // over into the crowd. Every frame is placed afresh, so this moves the
  // ball itself, and whatever follows starts where it came to rest.
  if (!clip.inCrowd) {
    const d = offBoards(clip.ball.d, -boardStops.d, pitchLength + boardStops.d);
    const x = offBoards(clip.ball.x, -boardStops.x, pitchWidth + boardStops.x);
    if (
      (d !== clip.ball.d || x !== clip.ball.x) &&
      clip.ball.height >= boardTop
    ) {
      clip.inCrowd = true;
    } else {
      clip.ball.d = d;
      clip.ball.x = x;
    }
  }
  const [bx, by] = toScreen(clip, clip.ball);
  clip.movers.forEach((mover, i) => {
    const [x, y] = toScreen(clip, mover);
    clip.xs[at]!.push(x);
    clip.ys[at]!.push(y);
    // A player who has just played the ball faces where it went; otherwise they
    // face the way they move, or else the ball. Standing still, a runner
    // stands, and a touch shows as a kick.
    // Judged over the last few frames, so a player hovering around a
    // walk doesn't flip between the way they move and the ball.
    const back = Math.min(at, facingWindow);
    const dx = back ? x - clip.xs[at - back]![i]! : 0;
    const dy = back ? y - clip.ys[at - back]![i]! : 0;
    const pace = back ? Math.hypot(dx, dy) / back : 0;
    const moving = pace > perFrame(standingSpeed);
    // Shuffling about their place, a player keeps their eye on the ball;
    // they face the way they go once they are running, and until they
    // have clearly slowed, so a pace near the line doesn't flip them.
    clip.running[i] = clip.running[i]
      ? pace > perFrame(facingSpeed.stop)
      : pace > perFrame(facingSpeed.start);
    const previous = at ? facings[clip.facingLog[at - 1]![i]!]! : undefined;
    const aim = at < clip.aimUntil[i]! ? clip.aims[i] : undefined;
    const [ax, ay] = aim ? toScreen(clip, aim) : [bx, by];
    // Drawn side on, a player on the ground faces left or right: the way
    // they go, or else the way they were.
    const across = aim ? ax - x : dx;
    const stillDown = at > 0 && poses[clip.poseLog[at - 1]![i]!] === mover.pose;
    const wanted = facings.indexOf(
      sideOn.has(mover.pose) && mover.pose !== 'dive'
        ? stillDown && (previous === 'left' || previous === 'right')
          ? previous
          : Math.abs(across) > 0.05
            ? across < 0
              ? 'left'
              : 'right'
            : previous === 'right'
              ? 'right'
              : 'left'
        : aim
          ? facingFor(ax - x, ay - y, previous)
          : clip.running[i]
            ? facingFor(dx, dy, previous)
            : facingFor(bx - x, by - y, previous)
    );
    // A turn waits until the last has settled, but a kick or a throw
    // faces its aim at once.
    const kept = at ? clip.facingLog[at - 1]![i]! : wanted;
    const turns =
      wanted !== kept &&
      ((aim && !clip.looking[i]) ||
        at - clip.turnedAt[i]! >= turnFrames ||
        (sideOn.has(mover.pose) && mover.pose !== 'dive'));
    if (turns) {
      clip.turnedAt[i] = at;
    }
    clip.facingLog[at]!.push(turns || !at ? wanted : kept);
    const pose =
      (mover.pose === 'run' || mover.pose === 'hold') && at < clip.kickUntil[i]!
        ? 'kick'
        : mover.pose === 'run' && !moving
          ? 'stand'
          : mover.pose === 'cheer' && !moving
            ? 'celebrate'
            : mover.pose;
    clip.poseLog[at]!.push(poses.indexOf(pose));
    clip.poseFrameLog[at]!.push(
      framedPoses.has(pose) ? (mover.poseFrame ?? 0) : -1
    );
  });
  clip.balls.push([bx, by, clip.ball.height]);
  const focus = clip.cameraFocus();
  const halfWidth = clip.cameraWidth / 2;
  const halfLength = (clip.cameraWidth * cameraAspect) / 2;
  // The camera eases after its focus, but never lets the ball, or after
  // a goal the scorer, out of shot.
  const subject = clip.keepInShot();
  const inShot = (p: Point): Point => ({
    d: clamp(p.d, subject.d - halfLength + 3, subject.d + halfLength - 3),
    x: clamp(p.x, subject.x - halfWidth + 3, subject.x + halfWidth - 3)
  });
  clip.camera = {
    ...inShot({
      d: lerp(clip.camera.d, focus.d, at === 0 ? 1 : 0.08),
      x: lerp(clip.camera.x, focus.x, at === 0 ? 1 : 0.08)
    }),
    width: clip.cameraWidth
  };
  const shown = inShot({
    d: clamp(clip.camera.d, halfLength - 8, pitchLength - halfLength + 8),
    x: clamp(clip.camera.x, halfWidth - 8, pitchWidth - halfWidth + 8)
  });
  const [cx, cy] = toScreen(clip, shown);
  clip.cameraTrack.push([cx, cy, clip.cameraWidth]);
};

/** Moves `point` out to 9.15 m from a free kick at `spot`. */
export const standBack = (point: Point, spot: Point) => {
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
const separate = (clip: Clip, held: ReadonlySet<number>) => {
  for (let i = 0; i < clip.count; i++) {
    const a = clip.movers[i]!;
    for (let j = i + 1; j < clip.count; j++) {
      const b = clip.movers[j]!;
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

/**
 * Moves `spot` across the pitch, if it is in `other`'s personal space, to
 * stand beside them, on the side `mover` is already on, so that a spot
 * about level with them doesn't swap from side to side as they sway. A
 * spot up to `farSideReach` beyond them, on the far side, comes round too:
 * the way to it goes through them.
 */
const besideOf = (spot: Point, other: Point, mover: Point) => {
  const dd = spot.d - other.d;
  const dx = spot.x - other.x;
  const side = mover.x < other.x ? -1 : 1;
  const reach = dx * side < 0 ? farSideReach : personalSpace;
  if (dd * dd + dx * dx < reach * reach && Math.abs(dd) < personalSpace) {
    spot.x =
      other.x + side * Math.sqrt(personalSpace * personalSpace - dd * dd);
  }
};

/**
 * Finishes the frame: records it as the players and ball now stand, then
 * moves the clock on to the next. Every stage ends each of its frames with
 * this, once the players have moved and taken their poses.
 */
export const finishFrame = (clip: Clip) => {
  record(clip);
  clip.frame++;
};

// Every player not told otherwise heads for their place in the shape.
export const steer = (
  clip: Clip,
  held: ReadonlySet<number>,
  overrides: ReadonlyMap<number, Point> = new Map(),
  /** A pass along the ground, from the ball to where it goes. */
  lane?: Readonly<{ from: Point; to: Point }>,
  /** Players who walk or jog, and how fast, in metres a second. */
  paces: ReadonlyMap<number, number> = new Map()
) => {
  const frame = clip.frame;
  const line = clip.offside ? offsideLine(clip) - 0.5 : Infinity;
  // The defender nearest the ball closes it down, tackling only in a
  // challenge. The one already doing it keeps on unless another is clearly
  // nearer, so two about as near don't take turns.
  let presser = -1;
  let nearest = Infinity;
  for (let j = 0; j < clip.defenders.length; j++) {
    const i = clip.attackers.length + j;
    if (
      clip.defenders[j]!.line === 'keeper' ||
      (challengerDown(clip, frame) && clip.challenge!.who === i)
    ) {
      continue;
    }
    const gap =
      distance(clip.movers[i]!, clip.ball) -
      (i === clip.pressing ? pressingGive : 0);
    if (gap < nearest) {
      nearest = gap;
      presser = i;
    }
  }
  clip.pressing = presser;
  const inLine = clip.defenders.flatMap((p, j) =>
    p.line === 'defence' && clip.attackers.length + j !== presser
      ? [clip.movers[clip.attackers.length + j]!.d]
      : []
  );
  const wanted = backLineFor(clip, clip.ball);
  if (inLine.length) {
    const low = Math.max(...inLine) - backLineGive;
    const high = Math.min(...inLine) + backLineGive;
    clip.backLineDepth =
      low <= high ? clamp(wanted, low, high) : (low + high) / 2;
  }
  // A challenger down on the ground stays there.
  const down = challengerDown(clip, frame) ? clip.challenge!.who : -1;
  const ballPace = clip.ballWas ? distance(clip.ball, clip.ballWas) : 0;
  clip.ballWas = { d: clip.ball.d, x: clip.ball.x };
  clip.movers.forEach((mover, i) => {
    if (held.has(i) || i === down) {
      return;
    }
    // A shooter from range waits deep for the ball to come to them. Once
    // beaten, no one closes the ball down: they all chase.
    const goal = {
      ...(overrides.get(i) ??
        (i === clip.shooter && clip.finish === 'long-range'
          ? clip.shootingSpot
          : i === presser && !clip.beaten
            ? { d: clip.ball.d + 3, x: clip.ball.x + (34 - clip.ball.x) * 0.05 }
            : target(clip, i, clip.ball, frame)))
    };
    if (i < clip.attackers.length) {
      goal.d = Math.min(
        goal.d,
        line,
        // An injured player's runs stop short of the box, or for a foul,
        // of the six-yard box.
        i === clip.shooter
          ? clip.injuredLimit - (clip.keptOut ? 3 : 0)
          : Infinity
      );
      // Caught beyond the line, a player first drops straight back; one
      // only nudged over it, by a defender stepping into them, doesn't
      // turn to, and turn back once onside again (#229).
      if (mover.d > line + offsideNudge) {
        goal.x = mover.x;
      }
      // They wait beside an opponent rather than in their space, as one
      // who did would be pushed out, step back in and take turns with
      // them (#229). Opponents keep their shape whoever is near them.
      for (let j = clip.attackers.length; j < clip.count; j++) {
        besideOf(goal, clip.movers[j]!, mover);
      }
    } else {
      if (clip.keepAway && i !== clip.keeperSlot) {
        standBack(goal, clip.keepAway);
      }
      // Defenders never cut out a pass: they keep out of its way.
      if (lane) {
        standOff(goal, lane.from, lane.to, laneWidth);
      }
    }
    // No one walks through the boards, even to get goal side of a ball
    // that has gone behind.
    goal.d = clamp(goal.d, -playerStops.d, pitchLength + playerStops.d);
    goal.x = clamp(goal.x, -playerStops.x, pitchWidth + playerStops.x);
    // Goal side of the ball and close to it, a defender jockeys: they keep
    // pace with it, a little quicker, rather than sprinting in.
    const jockeying =
      i >= clip.attackers.length &&
      i !== clip.keeperSlot &&
      !overrides.has(i) &&
      !paces.has(i) &&
      mover.d > clip.ball.d &&
      distance(mover, clip.ball) < jockeyRange;
    const gap = distance(mover, goal);
    // A defender out of position, such as one the ball has gone past,
    // sprints to get back. Each goes at their own pace (#236).
    const speed = Math.min(
      perFrame(
        paces.get(i) ??
          (i < clip.attackers.length
            ? 6
            : i === clip.keeperSlot
              ? keeperShuffle
              : gap > recoveryGap
                ? 7.5
                : 5.5)
      ) * clip.runPaces[i]!,
      jockeying ? ballPace + perFrame(jockeyGive) : Infinity
    );
    if (gap <= speed) {
      mover.d = goal.d;
      mover.x = goal.x;
    } else {
      mover.d += ((goal.d - mover.d) / gap) * speed;
      mover.x += ((goal.x - mover.x) / gap) * speed;
    }
    if (clip.keepAway && i >= clip.attackers.length && i !== clip.keeperSlot) {
      standBack(mover, clip.keepAway);
    }
    if (lane && i >= clip.attackers.length) {
      standOff(mover, lane.from, lane.to, laneClearance);
    }
  });
  separate(clip, down >= 0 ? new Set([...held, down]) : held);
  // Stepping apart never takes a defender into a pass's way.
  if (lane) {
    for (let i = clip.attackers.length; i < clip.count; i++) {
      if (!held.has(i)) {
        standOff(clip.movers[i]!, lane.from, lane.to, laneClearance);
      }
    }
  }
  // Out of a pass's way, or pushed by a player on a run of their own,
  // they go there at no more than a run, from where they were last shown,
  // whatever moved them this frame (#226); out of a pass's way, flat out.
  const most = perFrame(lane ? flatOut : fastestRun);
  clip.movers.forEach((mover, i) => {
    const from = clip.seen[i];
    if (held.has(i) || i === down || !from) {
      return;
    }
    const moved = distance(from, mover);
    if (moved > most) {
      mover.d = from.d + ((mover.d - from.d) / moved) * most;
      mover.x = from.x + ((mover.x - from.x) / moved) * most;
    }
  });
};

export const label = (clip: Clip, i: number) => clip.attackers[i]!.label;

/** How far a receiver can run in `frames` to meet a pass. */
export const reach = (frames: number) => frames * perFrame(receiverSpeed);
/** The frames a cross takes, from `from` to the header at `to`. */
export const crossFlight = (from: Point, to: Point) =>
  Math.ceil(Math.max(distance(from, to) / perFrame(18), clipFps * 0.8));

/**
 * A run onto a ball, from where player `i` stands to `to` over `frames`:
 * out of the stride they are in, so they don't turn sharply as the ball is
 * played. It gives their place `u` of the way along.
 *
 * They get from the pace they are going at to a steady pace over the first
 * part of the run and hold it, rather than speeding up all the way and
 * meeting the ball at a sprint no one could run. Any part of their stride
 * not towards the ball carries them on at first, then fades.
 */
export const bentRun = (clip: Clip, i: number, to: Point, frames: number) => {
  const from = { d: clip.movers[i]!.d, x: clip.movers[i]!.x };
  const step = clip.steps[i] ?? { d: 0, x: 0 };
  const metres = distance(from, to);
  if (!metres) {
    return (): Point => ({ ...to });
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
  return (u: number): Point => {
    const along =
      u < runRamp
        ? starting * u + ((steady - starting) * u * u) / (2 * runRamp)
        : (runRamp * (starting + steady)) / 2 + steady * (u - runRamp);
    const drift = frames * u * (1 - u) ** 2;
    return {
      d: lerp(from.d, to.d, along) + aside.d * drift,
      x: lerp(from.x, to.x, along) + aside.x * drift
    };
  };
};
