import { bent, clamp, distance, lerp, perFrame, type Point } from './geometry';
import { headHeight, pitchLength, pitchWidth } from './model';
import {
  crossFlight,
  finishFrame,
  kick,
  label,
  steer,
  type Clip
} from './pitch';
import {
  chase,
  moveRuns,
  place,
  planRun,
  planRunToward,
  stretchTo,
  type Run
} from './run';
import { byQuality, curl } from './setup';
import {
  afterArrival,
  beatenBy,
  blockSitFrames,
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
  const flight = crossFlight(crossFrom, meet);
  // The nearest defender who can get there in time heads it; with none
  // who can, the nearest throws themselves at it.
  const rises = { d: meet.d + 0.4, x: meet.x };
  const byNearness = clip.defenders
    .flatMap((p, j) => (p.line === 'keeper' ? [] : [clip.attackers.length + j]))
    .sort(
      (a, b) =>
        distance(clip.movers[a]!, meet) - distance(clip.movers[b]!, meet)
    );
  const plans = byNearness.map(i => ({
    i,
    run: planRun(clip, i, { by: flight, meets: [clip.shooter], to: rises })
  }));
  const header = plans.find(({ run }) => !run.unreachable);
  clip.clearer = header?.i ?? byNearness[0] ?? clip.keeperSlot;
  const defenderRun: Run | undefined =
    header && !header.run.unreachable ? header.run : undefined;
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
  // From further off, only as far as a run takes them by then (#226).
  const shooterPlan = {
    by: flight,
    meets: [clip.clearer],
    shape: 'bent',
    to: runTo
  } as const;
  const shooterRun = planRunToward(clip, clip.shooter, shooterPlan);
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
    const run = clip.movers[clip.shooter]!;
    const was = { d: run.d, x: run.x };
    if (f <= flight) {
      moveRuns(clip, [
        defenderRun,
        checked || shooterRun.unreachable ? undefined : shooterRun
      ]);
    }
    if (f <= flight && !checked) {
      run.pose = 'run';
      // Both on runs of their own, the shooter checks their stride rather
      // than run into the defender, and once either's run brings them that
      // close, moves as anyone does, stepping clear at a run (#226).
      const near = distance(run, defender);
      if (near < personalSpace && near < lastGap) {
        if (near < distance(was, defender)) {
          place(clip, clip.shooter, was);
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
      const left = flight - f;
      if (defenderRun) {
        defender.pose = left < jumpFrames ? 'header' : 'run';
        defender.poseFrame = left < 2 ? 2 : left < jumpFrames / 2 ? 1 : 0;
      } else {
        // Out of reach on their feet, they throw themselves at it.
        place(clip, clip.clearer, {
          d: lerp(from.d, rises.d, u),
          x: lerp(from.x, rises.x, u)
        });
        defender.pose = 'tackle';
        defender.poseFrame = 0;
      }
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
  const meetsAt = (u: number) => {
    const at = pointAt(u);
    return { d: at.d + 0.6, x: at.x };
  };
  const stretch = (i: number, u: number) =>
    stretchTo(clip, i, { by: flightTo(u), to: meetsAt(u) });
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
      const needs = stretch(i, u);
      const off = Math.abs(u - drawn);
      if (needs <= 1 && off < best) {
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
  const planned =
    clip.clearer >= 0 && !lunge
      ? planRun(clip, clip.clearer, {
          by: flight,
          meets: [clip.holder, clip.shooter],
          to: meetsAt(along)
        })
      : undefined;
  // A keeper with no defender to do it, out of reach, throws themselves at
  // it too.
  const clearerRun = planned?.unreachable ? undefined : planned;
  lunge ||= clip.clearer >= 0 && !clearerRun;
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
  // Cutting out a pass, the receiver runs on for it until it is taken.
  // They aren't held: the defender cuts in at their feet, and `steer` still
  // steps them aside.
  const receiverRun = interception
    ? chase(clip, clip.shooter, { pace: 'run', target: towards })
    : undefined;
  let toBall: Run | undefined;
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
      moveRuns(clip, [clearerRun, receiverRun]);
      if (defender && from) {
        if (!clearerRun) {
          place(clip, clip.clearer, {
            d: lerp(from.d, meet.d + 0.6, u),
            x: lerp(from.x, meet.x, u)
          });
        }
        // Some blocks are made sliding in, over the last of the flight.
        if (lunge || (clip.slidingBlock && u > 0.55)) {
          defender.pose = 'tackle';
          defender.poseFrame = 0;
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
        toBall ??= chase(clip, clip.clearer, {
          pace: 'run',
          target: () => ({ d: clip.ball.d + 0.6, x: clip.ball.x })
        });
        moveRuns(clip, [toBall]);
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
