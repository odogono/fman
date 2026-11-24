import {
  angleBetween,
  bent,
  clamp,
  distance,
  lineOrder,
  loftedHeight,
  nearestOnLine,
  perFrame,
  rotated,
  type Point
} from './geometry';
import { clipFps, pitchLength, pitchWidth, type ClipPass } from './model';
import {
  aimAt,
  finishFrame,
  kick,
  label,
  offsideLine,
  steer,
  type Clip
} from './pitch';
import {
  moveRuns,
  paceOf,
  place,
  planRunToward,
  reachableToward,
  stretchTo
} from './run';
import { byQuality, curl } from './setup';
import {
  ballSpinUp,
  ballTurn,
  bylineRun,
  carrierBrake,
  carrierPickUp,
  challengeOverrun,
  challengeRange,
  challengeSkip,
  challengeSlide,
  challengeSlides,
  farPass,
  gatherShare,
  holdingGap,
  kickFrames,
  laneWidth,
  lastWaitBy,
  lateWait,
  longRange,
  longestBackPass,
  longestForward,
  longestGroundPass,
  passLengthLean,
  passMinimum,
  runOntoIt,
  shooterWait,
  sitFrames,
  skipFrom,
  skipPace,
  stride,
  touchDrag,
  touchSpring,
  waitingPace,
  widestCarry
} from './tuning';

// The holder's play in the build-up: carrying the ball on, waiting on it
// for a team-mate, and passing it, out wide for a cross among others.

/**
 * Where the shooter waits for the final ball: at the shooting spot, but
 * for a low ball in, or one half-cleared, a few metres short of it, to run
 * onto it.
 */
export const waitingSpot = (clip: Clip): Point =>
  clip.cross === 'low' ||
  clip.cross === 'cut-back' ||
  clip.cross === 'half-clear'
    ? { d: clip.shootingSpot.d - runOntoIt, x: clip.shootingSpot.x }
    : clip.shootingSpot;

/** The holder keeps the ball at their feet, a stride ahead the way they go. */
export const dribble = (
  clip: Clip,
  frames: number,
  to: Point,
  speed: number,
  chase: ReadonlyMap<number, Point> = new Map()
) => {
  const step = perFrame(speed);
  for (let f = 0; f < frames; f++) {
    const mover = clip.movers[clip.holder]!;
    const gap = distance(mover, to);
    // Holding about where they are, they keep the way they were going.
    const heading =
      gap > holdingGap
        ? { d: (to.d - mover.d) / gap, x: (to.x - mover.x) / gap }
        : clip.carrying;
    // The carrier picks up speed and slows down over a few strides, and
    // slows to turn while the ball comes round with them, so it never
    // trails nor jumps to the other side of their feet. They ease up
    // before where they are going rather than stop dead.
    const along = clip.carrying.d * heading.d + clip.carrying.x * heading.x;
    const wanted = Math.min(
      step * Math.max(0.1, along) ** 2,
      Math.sqrt(2 * carrierBrake * gap)
    );
    clip.carryPace = clamp(
      wanted,
      clip.carryPace - carrierBrake,
      clip.carryPace + carrierPickUp
    );
    // The ball's swing round them eases in and out, and they run the way
    // it goes, so they curve round rather than turn on the spot; holding
    // where they are, they coast to a stop.
    const swing = angleBetween(clip.carrying, heading);
    const spinWanted =
      Math.sign(swing) *
      Math.min(ballTurn, Math.sqrt(2 * ballSpinUp * Math.abs(swing)));
    clip.ballSpin = clamp(
      spinWanted,
      clip.ballSpin - ballSpinUp,
      clip.ballSpin + ballSpinUp
    );
    clip.carrying =
      Math.abs(swing) <= Math.abs(clip.ballSpin) && swing * clip.ballSpin >= 0
        ? heading
        : rotated(clip.carrying, clip.ballSpin);
    const moved = clip.carryPace;
    place(clip, clip.holder, {
      d: mover.d + clip.carrying.d * moved,
      x: mover.x + clip.carrying.x * moved
    });
    // A defender in front slides in on the ball, while the carrier is on
    // the move and carries on long enough for the defender to be up
    // again before the zoom.
    if (
      clip.wantsChallenge &&
      !clip.challenge &&
      clip.buildingUp &&
      clip.carryPace >= perFrame(4) &&
      frames - f > challengeSlide + sitFrames &&
      clip.frame + 2 * clipFps < clip.maxBuildUp
    ) {
      let nearest = Infinity;
      let who = -1;
      clip.defenders.forEach((p, j) => {
        const i = clip.attackers.length + j;
        const gap = distance(clip.movers[i]!, clip.ball);
        const ahead =
          (clip.carrying.d * (clip.movers[i]!.d - clip.ball.d) +
            clip.carrying.x * (clip.movers[i]!.x - clip.ball.x)) /
          (gap || 1);
        if (
          p.line !== 'keeper' &&
          gap >= challengeRange[0] &&
          gap <= challengeRange[1] &&
          ahead > 0 &&
          gap < nearest
        ) {
          nearest = gap;
          who = i;
        }
      });
      if (who >= 0) {
        // Aimed just behind where the ball will be, so it is knocked on
        // past the slide, which runs on a metre further.
        const from = clip.movers[who]!;
        const meet = {
          d: clip.ball.d + clip.carrying.d * moved * 3,
          x: clip.ball.x + clip.carrying.x * moved * 3
        };
        const length = distance(from, meet) || 1;
        const way = {
          d: (meet.d - from.d) / length,
          x: (meet.x - from.x) / length
        };
        // The slide's run, slowing to a stop, covers it all, and runs on
        // past the ball further for a weaker challenger (#238).
        const quality = clip.qualities[who]!;
        const overrun = byQuality(quality, challengeOverrun);
        const slide = Math.round(byQuality(quality, challengeSlides));
        const pace = Math.min(perFrame(14), (2 * (length + overrun)) / slide);
        // The carrier skips to the side the slide doesn't end on.
        const end = {
          d: from.d + way.d * length,
          x: from.x + way.x * length
        };
        const across =
          -clip.carrying.x * (end.d - mover.d) +
          clip.carrying.d * (end.x - mover.x);
        clip.challenge = {
          at: clip.frame,
          pace,
          side: across > 0 ? -1 : 1,
          slide,
          // A skilled carrier skips aside sooner, a weak one later.
          skipFrom: Math.round(
            byQuality(clip.qualities[clip.holder]!, skipFrom)
          ),
          way,
          who
        };
      }
    }
    if (clip.challenge) {
      const t = clip.frame - clip.challenge.at - clip.challenge.skipFrom;
      if (t >= 0 && t < challengeSkip) {
        const hop =
          perFrame(skipPace) * Math.sin((Math.PI * t) / challengeSkip);
        const aside = {
          d: -clip.carrying.x * clip.challenge.side * hop,
          x: clip.carrying.d * clip.challenge.side * hop
        };
        place(clip, clip.holder, {
          d: mover.d + aside.d,
          x: mover.x + aside.x
        });
      }
    }
    // Off the first touch the ball runs on ahead, slowing, and the
    // receiver comes onto it: it never runs back to them.
    if (clip.firstTouch) {
      clip.firstTouch.ahead = Math.max(
        0,
        clip.firstTouch.ahead + clip.firstTouch.away
      );
      clip.firstTouch.away = Math.max(
        -gatherShare * moved,
        clip.firstTouch.away - touchDrag
      );
      if (clip.firstTouch.ahead === 0 && clip.firstTouch.away <= 0) {
        clip.firstTouch = undefined;
      }
    }
    const ahead = stride + (clip.firstTouch?.ahead ?? 0);
    clip.ball.d = mover.d + clip.carrying.d * ahead;
    clip.ball.x = mover.x + clip.carrying.x * ahead;
    const overrides = new Map<number, Point>(chase);
    if (clip.holder !== clip.shooter && passesLeft(clip) <= 1) {
      overrides.set(clip.shooter, waitingSpot(clip));
    }
    steer(clip, new Set([clip.holder]), overrides);
    finishFrame(clip);
  }
};

export const passesLeft = (clip: Clip) => clip.passCount - clip.passesMade;

/**
 * Waiting on the ball while a team-mate gets into place, for up to
 * `maxWaitFrames` while `waiting` holds: the holder never stands on
 * it, but carries it on slowly, the way they were going, upfield and away
 * from the nearest defender, as if shielding it. The way is picked once,
 * so the ball doesn't swing round their feet as defenders move.
 */
export const waitOnIt = (
  clip: Clip,
  waiting: () => boolean,
  chase?: ReadonlyMap<number, Point>,
  maxWaitFrames = shooterWait
) => {
  const mover = clip.movers[clip.holder]!;
  let nearest: Point | undefined;
  for (let i = clip.attackers.length; i < clip.count; i++) {
    if (
      !nearest ||
      distance(clip.movers[i]!, clip.ball) < distance(nearest, clip.ball)
    ) {
      nearest = clip.movers[i]!;
    }
  }
  const away = nearest ? distance(mover, nearest) || 1 : 1;
  const way = {
    d: clip.carrying.d + 0.5 + (nearest ? (mover.d - nearest.d) / away : 0),
    x: clip.carrying.x + (nearest ? (mover.x - nearest.x) / away : 0)
  };
  const size = Math.hypot(way.d, way.x) || 1;
  const metres = perFrame(waitingPace) * maxWaitFrames + 2;
  const to = {
    d: clamp(mover.d + (way.d / size) * metres, 3, pitchLength - 3),
    x: clamp(mover.x + (way.x / size) * metres, 3, pitchWidth - 3)
  };
  for (let f = 0; f < maxWaitFrames && waiting(); f++) {
    dribble(clip, 1, to, waitingPace, chase);
  }
};

/**
 * How a pass from the ball to `end` travels: along the ground, or in the
 * air for a restart other than a short free kick, or for any pass over
 * `longestGroundPass`; and the frames it takes at that pace.
 */
const flightTo = (clip: Clip, end: Point, kind: ClipPass['kind']) => {
  const metres = distance(clip.ball, end);
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

/**
 * Where the final pass finds the shooter, for a finish that needs it.
 * From range, the shooter drops off or pushes on along their own line from
 * goal to 23 to 30 m out. Through on goal, the ball goes in behind the
 * deepest defender, or there is no one-on-one and they shoot instead.
 */
const placeFinish = (clip: Clip, end: Point) => {
  const runner = clip.movers[clip.shooter]!;
  if (clip.finish === 'long-range') {
    const out = Math.hypot(runner.d - pitchLength, runner.x - 34) || 1;
    const reach = clamp(out, longRange, 30);
    end.d = pitchLength + ((runner.d - pitchLength) / out) * reach;
    end.x = clamp(34 + ((runner.x - 34) / out) * reach, 18, 50);
  } else if (clip.finish === 'one-on-one') {
    const deepest = Math.max(
      ...clip.defenders.flatMap((p, j) =>
        p.line === 'keeper' ? [] : [clip.movers[clip.attackers.length + j]!.d]
      )
    );
    end.d = Math.max(end.d, deepest + 4);
    if (end.d > pitchLength - 9) {
      clip.finish = 'shot';
      end.d = clip.shootingSpot.d;
    }
  }
  clip.shootingSpot.d = end.d;
  clip.shootingSpot.x = end.x;
};

/**
 * A pass to a receiver running onto it, at the ball's own pace: the
 * receiver is played in where they can get to it. The passer holds the
 * final pass back a moment while the shooter gets within reach.
 */
export const pass = (
  clip: Clip,
  receiver: number,
  kind: ClipPass['kind'] = 'pass',
  /** Where it is played, if not to the receiver's feet or run. */
  into?: Point
) => {
  const runner = clip.movers[receiver]!;
  /** How far the receiver can run in `frames` to meet a pass. */
  const reach = (frames: number) => paceOf(clip, receiver, 'run') * frames;
  const lead =
    kind === 'throw-in' ? clip.rng.between(0.5, 2) : clip.rng.between(2, 6);
  const end = into
    ? { ...into }
    : receiver === clip.shooter
      ? { ...clip.shootingSpot }
      : {
          d: clamp(runner.d + lead, 10, 95),
          x: clamp(runner.x + clip.rng.between(-3, 3), 3, pitchWidth - 3)
        };
  if (receiver === clip.shooter && !into) {
    placeFinish(clip, end);
  }
  // Even running late, the final pass waits a moment for the shooter: a
  // pass that finds them far out only sends them on a long run.
  // A ball through for a one-on-one goes before the defence recovers.
  const through = clip.finish === 'one-on-one';
  if (
    receiver === clip.shooter &&
    kind === 'pass' &&
    clip.frame <= clip.maxBuildUp + (through ? 0 : lateWait)
  ) {
    // Never so long that the moment can't start in time.
    waitOnIt(
      clip,
      () =>
        clip.frame < lastWaitBy &&
        distance(runner, end) > reach(flightTo(clip, end, kind).frames),
      new Map([[clip.shooter, end]]),
      // A shooter still coming up from behind the ball needs longer.
      through ? shooterWait : (runner.d < clip.ball.d ? 3 : 2) * shooterWait
    );
  }
  // Played into space the receiver can't reach in time, the ball goes
  // shorter, towards them. They meet it a stride short of where it goes,
  // which may be a stride further to run (#226).
  const from = { d: clip.ball.d, x: clip.ball.x };
  // The receiver meets the ball a stride behind it, the way it came.
  const runTo = (to: Point) => {
    const came = distance(from, to);
    const way = came
      ? { d: (to.d - from.d) / came, x: (to.x - from.x) / came }
      : { d: 1, x: 0 };
    return {
      by: flightTo(clip, to, kind).frames,
      shape: 'bent',
      to: { d: to.d - way.d * stride, x: to.x - way.x * stride },
      way
    } as const;
  };
  for (let k = 0; k < 6; k++) {
    const gap = distance(runner, end);
    const most = Math.max(0, reach(flightTo(clip, end, kind).frames) - stride);
    if (gap > most) {
      end.d = runner.d + ((end.d - runner.d) / gap) * most;
      end.x = runner.x + ((end.x - runner.x) / gap) * most;
      continue;
    }
    // Still turning out of a stride the other way, they may not get there
    // even so: it goes as much shorter as they fall short.
    const plan = runTo(end);
    if (stretchTo(clip, receiver, plan) <= 1) {
      break;
    }
    const near = reachableToward(clip, receiver, plan);
    end.d -= plan.to.d - near.d;
    end.x -= plan.to.x - near.x;
  }
  const { frames, lofted } = flightTo(clip, end, kind);
  const { way, ...runPlan } = runTo(end);
  const run = planRunToward(clip, receiver, runPlan);
  clip.passes.push({
    end: clip.frame + frames,
    from: label(clip, clip.holder),
    kind,
    passer: clip.holder,
    receiver,
    start: clip.frame,
    to: label(clip, receiver)
  });
  if (receiver === clip.shooter && clip.finish === 'one-on-one') {
    clip.beaten = true;
  }
  const thrower = clip.holder;
  if (kind === 'throw-in') {
    aimAt(clip, thrower, end);
  } else {
    kick(clip, thrower, end);
  }
  // A ball in the air bends a little and, but for a throw, lands and
  // bounces before it is controlled; one along the ground runs straight.
  const thrown = kind === 'throw-in';
  const bend = lofted && !thrown ? curl(clip, 0.3, 1) : 0;
  /** How far the ball came in the last frame, along the way it came. */
  let arriving = 0;
  for (let f = 1; f <= frames; f++) {
    const u = f / frames;
    const before = { d: clip.ball.d, x: clip.ball.x };
    const rolled = lofted ? u : u * (1.3 - 0.3 * u);
    Object.assign(clip.ball, bent(from, end, rolled, bend));
    arriving =
      (clip.ball.d - before.d) * way.d + (clip.ball.x - before.x) * way.x;
    clip.ball.height = !lofted
      ? 0
      : thrown
        ? Math.sin(Math.PI * u) * 0.5
        : loftedHeight(u, 0.5);
    // A throw is let go with the ball still held over the head.
    clip.movers[thrower]!.pose =
      kind === 'throw-in' && f <= kickFrames ? 'hold' : 'run';
    moveRuns(clip, [run.unreachable ? undefined : run]);
    const overrides = new Map<number, Point>();
    if (receiver !== clip.shooter && passesLeft(clip) <= 2) {
      overrides.set(clip.shooter, waitingSpot(clip));
    }
    steer(
      clip,
      new Set([receiver]),
      overrides,
      lofted ? undefined : { from: { d: clip.ball.d, x: clip.ball.x }, to: end }
    );
    finishFrame(clip);
  }
  clip.ball.height = 0;
  clip.holder = receiver;
  if (receiver === clip.shooter) {
    clip.foundAt = { d: clip.ball.d, x: clip.ball.x };
  }
  // The receiver takes the ball on the way it came, and the touch takes
  // the pace off it. A lofted ball has bounced, and comes down dead.
  const running = clip.steps[receiver] ?? { d: 0, x: 0 };
  clip.firstTouch = {
    ahead: 0,
    away: lofted
      ? 0
      : clamp(
          arriving - (running.d * way.d + running.x * way.x),
          0,
          perFrame(touchSpring)
        )
  };
  clip.carrying = way;
  clip.carryPace = Math.min(Math.hypot(running.d, running.x), perFrame(8));
  clip.ballSpin = 0;
  clip.passesMade++;
};

export const onside = (clip: Clip, i: number) =>
  clip.movers[i]!.d <= offsideLine(clip);

/** A defender stands within `laneWidth` of the way from the ball to `to`. */
const blocked = (clip: Clip, to: Point) =>
  clip.movers
    .slice(clip.attackers.length)
    .some(m => distance(m, nearestOnLine(m, clip.ball, to)) < laneWidth);

/**
 * The next to receive: onside, ahead of the ball, within reach and in an
 * open lane if anyone is. A pass back goes only a short way, to the
 * holder's own line or the one behind. The shooter, last, may need a
 * moment to get back onside.
 */
export const nextReceiver = (clip: Clip) => {
  if (passesLeft(clip) <= 1) {
    waitOnIt(clip, () => !onside(clip, clip.shooter));
    return clip.shooter;
  }
  const choices = clip.others.filter(i => i !== clip.holder && onside(clip, i));
  if (!choices.length) {
    return clip.shooter;
  }
  // The pass before the final one goes forward, to whoever is furthest up
  // ahead of the ball, so the back line drops off and the shooter, waiting
  // onside, can be found in range. An open lane comes first.
  if (passesLeft(clip) === 2 && clip.finish !== 'one-on-one') {
    const forward = choices
      .filter(
        i =>
          i !== clip.shooter &&
          clip.movers[i]!.d > clip.ball.d &&
          distance(clip.movers[i]!, clip.ball) < longestForward
      )
      .toSorted(
        (a, b) =>
          Number(blocked(clip, clip.movers[a]!)) -
            Number(blocked(clip, clip.movers[b]!)) ||
          clip.movers[b]!.d - clip.movers[a]!.d
      );
    if (forward.length) {
      return forward[0]!;
    }
  }
  const holderLine = lineOrder.indexOf(clip.attackers[clip.holder]!.line);
  const weights = choices.map(i => {
    const gap = distance(clip.movers[i]!, clip.ball);
    const ahead = clip.movers[i]!.d - clip.ball.d;
    const back =
      ahead > -5
        ? 2
        : gap <= longestBackPass &&
            holderLine - lineOrder.indexOf(clip.attackers[i]!.line) <= 1
          ? 0.4
          : 0;
    // A strong side looks further for a pass, a weak one nearer (#237).
    const reach =
      1 + passLengthLean * clip.buildUpQuality * (gap > farPass ? 1 : -1);
    return (
      (gap > 6 && gap < 35 ? 3 : 0.5) *
      back *
      reach *
      (blocked(clip, clip.movers[i]!) ? 0.15 : 1)
    );
  });
  const total = weights.reduce((a, b) => a + b, 0);
  if (!total) {
    return clip.shooter;
  }
  let roll = clip.rng.between(0, total);
  for (const [k, weight] of weights.entries()) {
    roll -= weight;
    if (roll <= 0) {
      return choices[k]!;
    }
  }
  return choices.at(-1)!;
};

/**
 * For a header, the ball goes wide for a cross: the holder carries it to
 * the wing if it is near, or else plays it out there to whoever is
 * nearest, while the shooter makes for the box.
 */
export const goWide = (clip: Clip) => {
  // Never more than a few metres back from a holder already deep. For a
  // cut-back, all the way to the byline, inside the width of the box.
  const cutBack = clip.cross === 'cut-back';
  const wing = cutBack
    ? {
        d: pitchLength - clip.crossRng.between(0, 0.8),
        x: 34 + (clip.ball.x < 34 ? -1 : 1) * clip.crossRng.between(12, 19)
      }
    : {
        d: Math.max(
          pitchLength - clip.finishRng.between(10, 20),
          clip.ball.d - 3
        ),
        x: clip.ball.x < 34 ? 5 : pitchWidth - 5
      };
  const gap = distance(clip.movers[clip.holder]!, wing);
  // Out to someone level or ahead, never a long way back.
  const near = clip.others
    .filter(i => i !== clip.holder && clip.movers[i]!.d >= clip.ball.d - 5)
    .toSorted(
      (a, b) =>
        distance(clip.movers[a]!, wing) - distance(clip.movers[b]!, wing)
    );
  // Over time, only a short carry: otherwise it goes out there at once.
  const carryUpTo =
    clip.frame > clip.maxBuildUp ? widestCarry / 2 : widestCarry;
  if (gap > carryUpTo && near.length) {
    pass(clip, near[0]!, 'pass', wing);
    dribble(
      clip,
      clip.rng.int(25, 35),
      { d: clip.ball.d + clip.carrying.d, x: clip.ball.x + clip.carrying.x },
      1.5
    );
  }
  // Played short of the wing, or with no one to find, they carry it on
  // towards it, no further than they would otherwise, and cross from there.
  // A cut-back needs the byline within a winger's run down the line;
  // further off, the ball goes in low from where they get to instead.
  const left = distance(clip.movers[clip.holder]!, wing);
  if (cutBack && left > bylineRun) {
    clip.cross = 'low';
  }
  if (left > 3) {
    const speed = clip.rng.between(5.5, 7);
    const metres = clip.cross === 'cut-back' ? left : Math.min(left, carryUpTo);
    dribble(
      clip,
      Math.max(1, Math.round((metres / speed) * clipFps)),
      wing,
      speed
    );
  }
};
