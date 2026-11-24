import { bent, clamp, distance, lerp, perFrame, type Point } from './geometry';
import { clipFps, headHeight, pitchLength, pitchWidth } from './model';
import {
  crossFlight,
  finishFrame,
  kick,
  label,
  steer,
  type Clip
} from './pitch';
import {
  moveRuns,
  paceOf,
  place,
  planRun,
  reachableToward,
  stretchTo,
  type Run
} from './run';
import { curl } from './setup';
import {
  beatenBy,
  boxDepth,
  claimGap,
  floatedCross,
  furthestHeader,
  halfClearPace,
  jumpFrames,
  landingFrames,
  lowCrossPace,
  punchFlight,
  punchFrames,
  punchRange
} from './tuning';

/**
 * The ball in from wide before the finish, if there is one: a cross to be
 * headed, a low ball in or a cut-back, or a cross half-cleared to the edge
 * of the box; and the keeper coming to catch or punch a cross.
 */
export const playCrossIn = (clip: Clip) => {
  let crossFrames = 0;
  /** For a claim, the frame of the cross the keeper catches it on. */
  let claimFrame = 0;
  /** For a punch, where the ball is so many frames after it. */
  let punched = (_t: number) => ({
    d: clip.ball.d,
    height: clip.ball.height,
    x: clip.ball.x
  });
  const headed = clip.finish === 'header';
  const lowBall = clip.cross === 'low' || clip.cross === 'cut-back';
  if (headed || lowBall) {
    const crosser = clip.holder;
    const headAt = { ...clip.shootingSpot };
    const crossFrom = { d: clip.ball.d, x: clip.ball.x };
    const header = clip.movers[clip.shooter]!;
    // Still out of reach, the cross is floated, hanging longer for the
    // header to get to; and failing that, put shorter, towards them, but
    // never out of the box.
    const runPace = paceOf(clip, clip.shooter, 'run');
    const runFrames = (at: Point) => Math.ceil(distance(header, at) / runPace);
    const floated = (at: Point) => {
      // Driven low, it goes at its own pace, but slower, though never
      // below 12 m/s, for a shooter further off.
      if (lowBall) {
        const paced = Math.ceil(
          Math.max(
            distance(crossFrom, at) / perFrame(lowCrossPace),
            clipFps / 2
          )
        );
        const slowest = Math.floor(distance(crossFrom, at) / perFrame(12));
        return clamp(runFrames(at), paced, Math.max(paced, slowest));
      }
      const flight = crossFlight(crossFrom, at);
      const slowest = Math.floor(
        distance(crossFrom, at) / perFrame(floatedCross)
      );
      return clamp(runFrames(at), flight, Math.max(flight, slowest));
    };
    const gap = distance(header, headAt);
    const most = runPace * floated(headAt);
    if (gap > most) {
      // Back towards a header further out goes only as far as the box.
      const boxed =
        header.d < headAt.d
          ? Math.max(0, (headAt.d - furthestHeader) / (headAt.d - header.d))
          : 1;
      const back = Math.min((gap - most) / gap, boxed);
      headAt.d = lerp(headAt.d, header.d, back);
      headAt.x = lerp(headAt.x, header.x, back);
    }
    crossFrames = floated(headAt);
    // Still beyond a sprint, it is met nearer the header, though outside
    // the box (#226).
    for (let k = 0; k < 3; k++) {
      const plan = { by: crossFrames, shape: 'bent', to: headAt } as const;
      if (stretchTo(clip, clip.shooter, plan) <= 1) {
        break;
      }
      Object.assign(headAt, reachableToward(clip, clip.shooter, plan));
      crossFrames = floated(headAt);
    }
    // Coming for it, the keeper sets off as it is struck and catches it
    // a few metres short of the header.
    // Punching it (#224), they meet it the same way, but it flies off
    // their fists.
    let claim =
      (clip.outcome === 'claim' || clip.outcome === 'punch') && clip.keeper
        ? clip.keeper
        : undefined;
    // A cross swings in or away.
    const swing = curl(clip, 0.8, 2);
    const crossAt = (u: number) => bent(crossFrom, headAt, u, swing);
    // At least a couple of metres short of the header, so the keeper
    // never meets it on top of them.
    const shortOf = Math.max(
      0.5,
      1 - claimGap / (distance(crossFrom, headAt) || 1)
    );
    // And no further from where they start than they can run by then:
    // later, towards the header, if they need longer (#226).
    const drawnClaim = Math.min(clip.finishRng.between(0.8, 0.88), shortOf);
    let claimAt = drawnClaim;
    if (claim) {
      const coming = claim;
      const keeper = clip.keeperSlot;
      const reaches = (u: number) =>
        distance(coming, crossAt(u)) === 0 ||
        stretchTo(clip, keeper, { by: u * crossFrames, to: crossAt(u) }) <= 1;
      while (!reaches(claimAt) && claimAt < shortOf) {
        claimAt = Math.min(shortOf, claimAt + 0.01);
      }
      // Out of their reach altogether, they stay on their line and save
      // the header there instead, unless the debug page forced it.
      if (!reaches(claimAt) && clip.input.outcome === undefined) {
        claim = undefined;
        if (clip.outcome === 'punch') {
          clip.cross = undefined;
        }
        clip.outcome = clip.outcome === 'punch' ? 'parry' : 'hold';
      }
    }
    claimFrame = claim ? Math.round(crossFrames * claimAt) : 0;
    const claimFrom = claim ? { d: claim.d, x: claim.x } : undefined;
    /** Punched away: off the fists, up and out of the box, and down. */
    punched = (t: number) => {
      const u = Math.min(1, t / punchFlight);
      const hit = crossAt(claimFrame / crossFrames);
      const to = {
        d: hit.d - punchRange,
        x: clamp(hit.x + (hit.x < 34 ? -1 : 1) * 6, 4, pitchWidth - 4)
      };
      return {
        d: lerp(hit.d, to.d, u),
        height: 0.5 * (1 - u) + Math.sin(Math.PI * u) * 0.5,
        x: lerp(hit.x, to.x, u)
      };
    };
    const caught = crossAt(claimFrame / crossFrames);
    clip.passes.push({
      ...(claim ? { cutOut: true as const } : {}),
      // Punched, it goes no further than the keeper's fists.
      end: clip.frame + (clip.outcome === 'punch' ? claimFrame : crossFrames),
      from: label(clip, crosser),
      kind: clip.restart === 'corner' ? 'corner' : 'cross',
      passer: crosser,
      receiver: clip.shooter,
      start: clip.frame,
      to: label(clip, clip.shooter)
    });
    kick(clip, crosser, headAt);
    clip.cameraFocus = () => ({
      d: (clip.ball.d + pitchLength) / 2,
      x: clip.ball.x
    });
    // Beaten to it by the keeper, the header pulls up a stride short of
    // where the keeper takes it.
    const runTo = claim
      ? (() => {
          const gap = distance(header, caught) || 1;
          const stopAt = Math.min(gap, beatenBy);
          return {
            d: caught.d + ((header.d - caught.d) / gap) * stopAt,
            x: caught.x + ((header.x - caught.x) / gap) * stopAt
          };
        })()
      : headAt;
    const headerPlan = {
      by: crossFrames,
      meets: [clip.keeperSlot],
      shape: 'bent',
      to: runTo
    } as const;
    const headerRun = planRun(clip, clip.shooter, {
      ...headerPlan,
      to: reachableToward(clip, clip.shooter, headerPlan)
    });
    const claimPlan =
      claim && claimFrame
        ? planRun(clip, clip.keeperSlot, {
            by: claimFrame,
            meets: [clip.shooter],
            to: caught
          })
        : undefined;
    // Forced by the debug page, a claim out of reach is flown to.
    const claimRun = claimPlan?.unreachable ? undefined : claimPlan;
    for (let f = 1; f <= crossFrames; f++) {
      const u = f / crossFrames;
      Object.assign(clip.ball, crossAt(u));
      clip.ball.height = lowBall
        ? Math.sin(Math.PI * u) * 0.05
        : Math.sin(Math.PI * u) * 0.6 + headHeight * u;
      if (claim && claimFrom) {
        if (f <= claimFrame) {
          if (!claimRun) {
            place(clip, clip.keeperSlot, {
              d: lerp(claimFrom.d, caught.d, f / claimFrame),
              x: lerp(claimFrom.x, caught.x, f / claimFrame)
            });
          }
        } else if (clip.outcome === 'punch') {
          Object.assign(clip.ball, punched(f - claimFrame));
        } else {
          // In the keeper's hands, over their head.
          Object.assign(clip.ball, { d: claim.d, height: 0.5, x: claim.x });
        }
        claim.pose =
          f > claimFrame - 8 &&
          (clip.outcome !== 'punch' || f < claimFrame + punchFrames)
            ? 'hold'
            : 'run';
      }
      moveRuns(clip, [
        headerRun.unreachable ? undefined : headerRun,
        f <= claimFrame ? claimRun : undefined
      ]);
      const left = crossFrames - f;
      header.pose = headed && left < jumpFrames ? 'header' : 'run';
      header.poseFrame = left < jumpFrames / 2 ? 1 : 0;
      steer(clip, new Set([clip.shooter, ...(claim ? [clip.keeperSlot] : [])]));
      finishFrame(clip);
    }
    clip.shotFrom = { d: clip.ball.d, x: clip.ball.x };
  } else if (clip.cross === 'half-clear') {
    // The cross comes into the box, a defender heads it out, and it drops
    // to the shooter at the edge of it, who strikes it first time.
    const crossFrom = { d: clip.ball.d, x: clip.ball.x };
    const into = {
      d: pitchLength - clip.crossRng.between(7, 11),
      x: 34 + clip.crossRng.between(-5, 5)
    };
    let clearing = -1;
    let nearest = Infinity;
    clip.defenders.forEach((p, j) => {
      const i = clip.attackers.length + j;
      const gap = distance(clip.movers[i]!, into);
      if (p.line !== 'keeper' && gap < nearest) {
        nearest = gap;
        clearing = i;
      }
    });
    // Out of their reach at a sprint, it drops nearer them, in the box
    // (#226).
    const rises = () => ({ d: into.d + 0.4, x: into.x });
    for (let k = 0; k < 3 && clearing >= 0; k++) {
      const plan = { by: crossFlight(crossFrom, into), to: rises() };
      if (stretchTo(clip, clearing, plan) <= 1) {
        break;
      }
      const near = reachableToward(clip, clearing, plan);
      into.d = clamp(
        near.d - 0.4,
        pitchLength - boxDepth + 1,
        Math.max(pitchLength - 3, pitchLength - boxDepth + 1)
      );
      into.x = near.x;
    }
    const inFrames = crossFlight(crossFrom, into);
    const outFramesTo = (spot: Point) =>
      Math.ceil(
        Math.max(distance(into, spot) / perFrame(halfClearPace), clipFps / 2)
      );
    // The shooter meets it where they can get to by then: out of their
    // reach, it drops shorter, towards them.
    let outFrames = outFramesTo(clip.shootingSpot);
    for (let k = 0; k < 3; k++) {
      const plan = {
        by: inFrames + outFrames,
        shape: 'bent',
        to: clip.shootingSpot
      } as const;
      if (stretchTo(clip, clip.shooter, plan) <= 1) {
        break;
      }
      Object.assign(
        clip.shootingSpot,
        reachableToward(clip, clip.shooter, plan)
      );
      outFrames = outFramesTo(clip.shootingSpot);
    }
    crossFrames = inFrames + outFrames;
    clip.passes.push({
      cutOut: true,
      end: clip.frame + inFrames,
      from: label(clip, clip.holder),
      kind: 'cross',
      passer: clip.holder,
      receiver: clip.shooter,
      start: clip.frame,
      to: label(clip, clip.shooter)
    });
    kick(clip, clip.holder, into);
    clip.cameraFocus = () => ({
      d: (clip.ball.d + pitchLength) / 2,
      x: clip.ball.x
    });
    const swing = curl(clip, 0.8, 2);
    const from = clearing >= 0 ? { ...clip.movers[clearing]! } : undefined;
    const clearPlan =
      clearing >= 0
        ? planRun(clip, clearing, { by: inFrames, to: rises() })
        : undefined;
    // Still out of reach on their feet, the defender throws themselves at
    // it.
    const clearRun: Run | undefined = clearPlan?.unreachable
      ? undefined
      : clearPlan;
    const shooterPlan = planRun(clip, clip.shooter, {
      by: crossFrames,
      shape: 'bent',
      to: clip.shootingSpot
    });
    const shooterRun = shooterPlan.unreachable ? undefined : shooterPlan;
    for (let f = 1; f <= crossFrames; f++) {
      const defender = clearing >= 0 ? clip.movers[clearing]! : undefined;
      if (f <= inFrames) {
        const u = f / inFrames;
        Object.assign(clip.ball, bent(crossFrom, into, u, swing));
        clip.ball.height = Math.sin(Math.PI * u) * 0.6 + headHeight * u;
        if (defender && from) {
          const left = inFrames - f;
          if (clearRun) {
            defender.pose = left < jumpFrames ? 'header' : 'run';
            defender.poseFrame = left < 2 ? 2 : left < jumpFrames / 2 ? 1 : 0;
          } else {
            place(clip, clearing, {
              d: lerp(from.d, rises().d, u),
              x: lerp(from.x, rises().x, u)
            });
            defender.pose = 'tackle';
            defender.poseFrame = 0;
          }
        }
      } else {
        // Looped out, it drops to about knee height for the volley.
        const u = (f - inFrames) / outFrames;
        clip.ball.d = lerp(into.d, clip.shootingSpot.d, u);
        clip.ball.x = lerp(into.x, clip.shootingSpot.x, u);
        clip.ball.height =
          headHeight * (1 - u) + 0.15 * u + Math.sin(Math.PI * u) * 0.5;
        if (defender) {
          defender.pose = f - inFrames < landingFrames ? 'header' : 'run';
          defender.poseFrame = 0;
        }
      }
      moveRuns(clip, [shooterRun, f <= inFrames ? clearRun : undefined]);
      clip.movers[clip.shooter]!.pose = 'run';
      steer(
        clip,
        new Set([clip.shooter, ...(clearing >= 0 ? [clearing] : [])])
      );
      finishFrame(clip);
    }
    clip.shotFrom = { d: clip.ball.d, x: clip.ball.x };
  }
  return { claimFrame, crossFrames, punched };
};

export type CrossIn = ReturnType<typeof playCrossIn>;
