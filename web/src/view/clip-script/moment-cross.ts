import { bent, clamp, distance, lerp, perFrame, type Point } from './geometry';
import { clipFps, headHeight, pitchLength, pitchWidth } from './model';
import {
  bentRun,
  crossFlight,
  kick,
  label,
  nextFrame,
  reach,
  steer,
  type Clip
} from './pitch';
import { curl } from './setup';
import {
  beatenBy,
  boxDepth,
  claimGap,
  clearerPace,
  fastestRun,
  floatedCross,
  furthestHeader,
  halfClearPace,
  jumpFrames,
  landingFrames,
  lowCrossPace,
  punchFlight,
  punchFrames,
  punchRange,
  receiverSpeed
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
    const runFrames = (at: Point) =>
      Math.ceil(distance(header, at) / perFrame(receiverSpeed));
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
    const most = reach(floated(headAt));
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
      const run = distance(header, headAt);
      const most = perFrame(clearerPace) * crossFrames;
      if (run <= most) {
        break;
      }
      headAt.d = header.d + ((headAt.d - header.d) / run) * most;
      headAt.x = header.x + ((headAt.x - header.x) / run) * most;
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
      const reaches = (u: number) =>
        distance(coming, crossAt(u)) <= perFrame(fastestRun) * u * crossFrames;
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
    const runAt = bentRun(clip, clip.shooter, runTo, crossFrames);
    for (let f = 1; f <= crossFrames; f++) {
      const u = f / crossFrames;
      Object.assign(clip.ball, crossAt(u));
      clip.ball.height = lowBall
        ? Math.sin(Math.PI * u) * 0.05
        : Math.sin(Math.PI * u) * 0.6 + headHeight * u;
      if (claim && claimFrom) {
        if (f <= claimFrame) {
          Object.assign(claim, {
            d: lerp(claimFrom.d, caught.d, f / claimFrame),
            x: lerp(claimFrom.x, caught.x, f / claimFrame)
          });
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
      Object.assign(header, runAt(u));
      const left = crossFrames - f;
      header.pose = headed && left < jumpFrames ? 'header' : 'run';
      header.poseFrame = left < jumpFrames / 2 ? 1 : 0;
      steer(clip, new Set([clip.shooter, ...(claim ? [clip.keeperSlot] : [])]));
      nextFrame(clip);
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
    for (let k = 0; k < 3 && clearing >= 0; k++) {
      const them = clip.movers[clearing]!;
      const run = distance(them, { d: into.d + 0.4, x: into.x });
      const most = perFrame(clearerPace) * crossFlight(crossFrom, into);
      if (run <= most) {
        break;
      }
      const u = 1 - most / run;
      into.d = Math.min(lerp(into.d, them.d, u), pitchLength - 3);
      into.d = Math.max(into.d, pitchLength - boxDepth + 1);
      into.x = lerp(into.x, them.x, u);
    }
    const inFrames = crossFlight(crossFrom, into);
    const outFrames = Math.ceil(
      Math.max(
        distance(into, clip.shootingSpot) / perFrame(halfClearPace),
        clipFps / 2
      )
    );
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
    const runAt = bentRun(clip, clip.shooter, clip.shootingSpot, crossFrames);
    for (let f = 1; f <= crossFrames; f++) {
      const defender = clearing >= 0 ? clip.movers[clearing]! : undefined;
      if (f <= inFrames) {
        const u = f / inFrames;
        Object.assign(clip.ball, bent(crossFrom, into, u, swing));
        clip.ball.height = Math.sin(Math.PI * u) * 0.6 + headHeight * u;
        if (defender && from) {
          defender.d = lerp(from.d, into.d + 0.4, u);
          defender.x = lerp(from.x, into.x, u);
          const left = inFrames - f;
          defender.pose = left < jumpFrames ? 'header' : 'run';
          defender.poseFrame = left < 2 ? 2 : left < jumpFrames / 2 ? 1 : 0;
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
      Object.assign(clip.movers[clip.shooter]!, runAt(f / crossFrames));
      clip.movers[clip.shooter]!.pose = 'run';
      steer(
        clip,
        new Set([clip.shooter, ...(clearing >= 0 ? [clearing] : [])])
      );
      nextFrame(clip);
    }
    clip.shotFrom = { d: clip.ball.d, x: clip.ball.x };
  }
  return { claimFrame, crossFrames, punched };
};

export type CrossIn = ReturnType<typeof playCrossIn>;
