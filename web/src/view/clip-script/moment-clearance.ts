import { bent, clamp, distance, lerp, perFrame, type Point } from './geometry';
import { headHeight, pitchLength, pitchWidth } from './model';
import {
  bentRun,
  crossFlight,
  finishFrame,
  kick,
  label,
  steer,
  type Clip
} from './pitch';
import { byQuality, curl } from './setup';
import {
  afterArrival,
  beatenBy,
  blockSitFrames,
  clearerPace,
  goalHalf,
  jumpFrames,
  landingFrames,
  personalSpace,
  slidingBlockShare
} from './tuning';

/** A cross headed clear by a defender before it reaches the shooter. */
export const playHeadedClear = (clip: Clip) => {
  // The cross comes in towards the shooter, and the defender nearest
  // where it drops rises a little short of them and heads it away.
  const crossFrom = { d: clip.ball.d, x: clip.ball.x };
  const meet = {
    d: lerp(
      crossFrom.d,
      clip.shootingSpot.d,
      clip.crossRng.between(0.82, 0.92)
    ),
    x: lerp(crossFrom.x, clip.shootingSpot.x, clip.crossRng.between(0.82, 0.92))
  };
  let nearest = Infinity;
  clip.defenders.forEach((p, j) => {
    const i = clip.attackers.length + j;
    const gap = distance(clip.movers[i]!, meet);
    if (p.line !== 'keeper' && gap < nearest) {
      nearest = gap;
      clip.clearer = i;
    }
  });
  if (clip.clearer < 0) {
    clip.clearer = clip.keeperSlot;
  }
  const flight = crossFlight(crossFrom, meet);
  clip.passes.push({
    cutOut: true,
    end: clip.frame + flight,
    from: label(clip, clip.holder),
    kind: 'cross',
    passer: clip.holder,
    receiver: clip.shooter,
    start: clip.frame,
    to: label(clip, clip.shooter)
  });
  clip.momentFrame = clip.momentStart + flight - 1;
  const from = { ...clip.movers[clip.clearer]! };
  const away = {
    d: meet.d - clip.crossRng.between(14, 22),
    x: clamp(meet.x + clip.crossRng.between(-10, 10), 4, pitchWidth - 4)
  };
  const swing = curl(clip, 0.8, 2);
  kick(clip, clip.holder, meet);
  clip.cameraFocus = () => ({
    d: (clip.ball.d + pitchLength) / 2,
    x: clip.ball.x
  });
  // The shooter runs on for it, out of the stride they are in, beaten
  // to it a stride short of where the defender meets it; already that
  // close, they hold where they are rather than turn back.
  const runner = clip.movers[clip.shooter]!;
  const short = distance(runner, meet) || 1;
  const stopAt = Math.min(short, beatenBy);
  const runTo = {
    d: meet.d + ((runner.d - meet.d) / short) * stopAt,
    x: meet.x + ((runner.x - meet.x) / short) * stopAt
  };
  // From further off, only as far as a run takes them by then (#226).
  const runFor = distance(runner, runTo);
  const runMost = perFrame(clearerPace) * flight;
  if (runFor > runMost) {
    runTo.d = runner.d + ((runTo.d - runner.d) / runFor) * runMost;
    runTo.x = runner.x + ((runTo.x - runner.x) / runFor) * runMost;
  }
  // Already past where it is met, or nearer it than their stride takes
  // them, they pull up, their stride carrying them on a little, rather
  // than overrun it and turn back for it.
  const striding = clip.steps[clip.shooter] ?? { d: 0, x: 0 };
  const carriesOn = Math.min(10, flight / 3);
  if (
    striding.d * (runTo.d - runner.d) + striding.x * (runTo.x - runner.x) < 0 ||
    distance(runner, runTo) < Math.hypot(striding.d, striding.x) * carriesOn
  ) {
    runTo.d = runner.d + striding.d * carriesOn;
    runTo.x = runner.x + striding.x * carriesOn;
  }
  const runAt = bentRun(clip, clip.shooter, runTo, flight);
  const held = new Set([clip.clearer, clip.shooter]);
  /** The shooter has checked their stride, off their run, and where. */
  let checked = false;
  let checkedAt: Point = { d: 0, x: 0 };
  /** How far the shooter was from the defender last frame. */
  let lastGap = distance(
    clip.movers[clip.shooter]!,
    clip.movers[clip.clearer]!
  );
  for (let f = 1; f <= flight + afterArrival; f++) {
    const defender = clip.movers[clip.clearer]!;
    if (f <= flight && !checked) {
      const run = clip.movers[clip.shooter]!;
      const was = { d: run.d, x: run.x };
      Object.assign(run, runAt(f / flight));
      run.pose = 'run';
      // Both on runs of their own, the shooter checks their stride rather
      // than run into the defender, and once either's run brings them that
      // close, moves as anyone does, stepping clear at a run (#226).
      const near = distance(run, defender);
      if (near < personalSpace && near < lastGap) {
        if (near < distance(was, defender)) {
          Object.assign(run, was);
        }
        checked = true;
        checkedAt = { d: run.d, x: run.x };
        held.delete(clip.shooter);
      }
      lastGap = near;
    } else if (f === flight + 1) {
      held.delete(clip.shooter);
    }
    if (f <= flight) {
      const u = f / flight;
      Object.assign(clip.ball, bent(crossFrom, meet, u, swing));
      clip.ball.height = Math.sin(Math.PI * u) * 0.6 + headHeight * u;
      defender.d = lerp(from.d, meet.d + 0.4, u);
      defender.x = lerp(from.x, meet.x, u);
      const left = flight - f;
      defender.pose = left < jumpFrames ? 'header' : 'run';
      defender.poseFrame = left < 2 ? 2 : left < jumpFrames / 2 ? 1 : 0;
    } else {
      // Off the forehead it loops away from goal and lands.
      const u = Math.min(1, (f - flight) / afterArrival);
      clip.ball.d = lerp(meet.d, away.d, u);
      clip.ball.x = lerp(meet.x, away.x, u);
      clip.ball.height = headHeight * (1 - u) + Math.sin(Math.PI * u) * 0.4;
      defender.pose = f - flight < landingFrames ? 'header' : 'run';
      defender.poseFrame = 0;
    }
    // Off their run, they stay where they checked, stepping clear of the
    // defender only as they must.
    steer(
      clip,
      held,
      checked && f <= flight ? new Map([[clip.shooter, checkedAt]]) : undefined
    );
    finishFrame(clip);
  }
};

/** The final pass cut out, or the shot blocked. */
export const playClearance = (clip: Clip) => {
  // The final pass cut out, or the shot blocked by a defender stepping
  // into its line; the clip reaches its moment as they meet the ball.
  const interception = clip.outcome === 'interception';
  const runner = clip.movers[clip.shooter]!;
  const towards = interception
    ? { d: Math.min(runner.d + 2, 100), x: runner.x }
    : {
        d: pitchLength,
        x: 34 + clip.side * clip.rng.between(0, goalHalf - 0.5)
      };
  const drawn = interception
    ? clip.rng.between(0.45, 0.7)
    : clip.rng.between(0.3, 0.55);
  const ballPace = perFrame(interception ? 15 : 25);
  const pointAt = (u: number) => ({
    d: lerp(clip.shotFrom.d, towards.d, u),
    x: lerp(clip.shotFrom.x, towards.x, u)
  });
  const flightTo = (u: number) =>
    Math.max(10, Math.ceil(distance(clip.shotFrom, pointAt(u)) / ballPace));
  // The defender who meets it, and where: as near the drawn point as a
  // defender can get to at a sprint by the time the ball does (#226). With
  // none who can, whoever needs the least pace, wherever that is. They
  // meet it a little goal side of where it passes.
  const pace = (i: number, u: number) => {
    const at = pointAt(u);
    return distance(clip.movers[i]!, { d: at.d + 0.6, x: at.x }) / flightTo(u);
  };
  let along = drawn;
  let best = Infinity;
  let easiest = Infinity;
  let easiestAt = { i: -1, u: drawn };
  clip.defenders.forEach((p, j) => {
    const i = clip.attackers.length + j;
    if (p.line === 'keeper') {
      return;
    }
    // A block well short of goal; a pass cut out short of the shooter.
    const [low, high] = interception ? [0.3, 0.85] : [0.25, 0.75];
    for (let u = low; u <= high; u += 0.025) {
      const needs = pace(i, u);
      const off = Math.abs(u - drawn);
      if (needs <= perFrame(clearerPace) && off < best) {
        best = off;
        along = u;
        clip.clearer = i;
      }
      if (needs < easiest) {
        easiest = needs;
        easiestAt = { i, u };
      }
    }
  });
  // A pass or shot no one can get to at a run, the nearest throws
  // themselves at, sliding the whole way.
  let lunge = false;
  if (clip.clearer < 0 && easiestAt.i >= 0) {
    clip.clearer = easiestAt.i;
    along = easiestAt.u;
    lunge = true;
  }
  if (clip.clearer < 0) {
    clip.clearer = clip.keeperSlot;
  }
  // A weak blocker slides in more often, a strong one less (#238).
  clip.slidingBlock =
    clip.slidingBlockRoll !== undefined &&
    clip.slidingBlockRoll <
      byQuality(clip.qualities[clip.clearer] ?? 0, slidingBlockShare);
  const meet = pointAt(along);
  const flight = flightTo(along);
  clip.momentFrame = clip.momentStart + flight - 1;
  const from =
    clip.clearer >= 0 ? { ...clip.movers[clip.clearer]! } : undefined;
  // Off a block the ball runs loose, back the way it came.
  const loose = interception
    ? meet
    : {
        d: meet.d - clip.rng.between(3, 6),
        x: meet.x + clip.rng.between(-4, 4)
      };
  // Only the defender runs to a script; the passer and the receiver (or
  // the shooter) stay where their own moves leave them, but step aside
  // rather than stand inside anyone.
  const held = new Set([clip.clearer]);
  const where = (i: number) => ({ d: clip.movers[i]!.d, x: clip.movers[i]!.x });
  // The final pass, or the shot, is struck.
  kick(clip, clip.holder, meet);
  clip.cameraFocus = () => ({ d: clip.ball.d + 4, x: clip.ball.x });
  for (let f = 1; f <= flight + afterArrival; f++) {
    const defender = clip.clearer >= 0 ? clip.movers[clip.clearer]! : undefined;
    if (f <= flight) {
      const u = f / flight;
      clip.ball.d = lerp(clip.shotFrom.d, meet.d, u);
      clip.ball.x = lerp(clip.shotFrom.x, meet.x, u);
      clip.ball.height = interception ? 0 : Math.sin(Math.PI * u) * 0.25;
      if (defender && from) {
        defender.d = lerp(from.d, meet.d + 0.6, u);
        defender.x = lerp(from.x, meet.x, u);
        // Some blocks are made sliding in, over the last of the flight.
        if (lunge || (clip.slidingBlock && u > 0.55)) {
          defender.pose = 'tackle';
          defender.poseFrame = 0;
        }
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
      clip.ball.d = lerp(meet.d, loose.d, u);
      clip.ball.x = lerp(meet.x, loose.x, u);
      clip.ball.height = 0;
      const down = clip.slidingBlock && f - flight < 8 + blockSitFrames;
      if (defender && down) {
        // Down from the slide, the defender sits up a moment.
        defender.pose = 'tackle';
        defender.poseFrame = f - flight < 8 ? 0 : 1;
      } else if (defender) {
        // The defender gets to the ball, facing upfield.
        defender.pose = 'run';
        const to = { d: clip.ball.d + 0.6, x: clip.ball.x };
        const gap = distance(defender, to);
        const step = perFrame(5);
        if (gap > step) {
          defender.d += ((to.d - defender.d) / gap) * step;
          defender.x += ((to.x - defender.x) / gap) * step;
        }
      }
    }
    steer(
      clip,
      held,
      new Map([
        [clip.holder, where(clip.holder)],
        [clip.shooter, where(clip.shooter)]
      ])
    );
    finishFrame(clip);
  }
};
