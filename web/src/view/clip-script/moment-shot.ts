import {
  bent,
  clamp,
  distance,
  ease,
  lerp,
  perFrame,
  type Point
} from './geometry';
import { headHeight, pitchLength } from './model';
import { type CrossIn } from './moment-cross';
import { aimAt, kick, record, steer, type Clip } from './pitch';
import { curl } from './setup';
import {
  afterArrival,
  fastestRun,
  followPace,
  goalHalf,
  kickFrames,
  landingFrames,
  lateBy,
  punchFrames,
  reboundRange,
  reboundSettle,
  scrambleFrames,
  spillPace
} from './tuning';

/** A header lands: the contact for a few frames, then the crouch. */
const land = (clip: Clip, f: number, met: boolean) => {
  const header = clip.movers[clip.shooter]!;
  const contact = met ? landingFrames : 0;
  header.pose = f <= contact + landingFrames ? 'header' : 'run';
  header.poseFrame = f <= contact ? 2 : 0;
};

/**
 * The finish after any ball in from wide: a keeper's catch or punch of
 * the cross, or a rebound and then the shot or header, and how it ends.
 */
export const playShot = (
  clip: Clip,
  { claimFrame, crossFrames, punched }: CrossIn
) => {
  let headed = clip.finish === 'header';
  /** The frames the first effort and the rebound take. */
  let reboundFrames = 0;
  if ((clip.outcome === 'claim' || clip.outcome === 'punch') && clip.keeper) {
    // Caught: the clip reaches its moment in the keeper's hands, and they
    // hold it while the header lands. Punched, it flies on out of the box.
    clip.momentFrame = clip.momentStart + claimFrame - 1;
    clip.cameraFocus = () => ({
      d: (clip.ball.d + pitchLength) / 2,
      x: clip.ball.x
    });
    for (let f = 1; f <= afterArrival; f++) {
      land(clip, f, false);
      const since = crossFrames - claimFrame + f;
      clip.keeper.pose =
        clip.outcome === 'punch' && since >= punchFrames ? 'run' : 'hold';
      Object.assign(
        clip.ball,
        clip.outcome === 'punch'
          ? punched(since)
          : { d: clip.keeper.d, height: 0.5, x: clip.keeper.x }
      );
      steer(clip, clip.frame, new Set([clip.keeperSlot]));
      record(clip);
      clip.frame++;
    }
  } else {
    // Only a chance from close in comes back to the shooter.
    clip.rebound &&=
      clip.keeper !== undefined &&
      distance(clip.shotFrom, { d: pitchLength, x: 34 }) < reboundRange;
    if (clip.rebound && clip.keeper) {
      // The keeper gets down to the first effort but only pushes it back
      // out into the box. The shooter follows in, beating the nearest
      // defender to it, as the keeper scrambles up.
      const striker = clip.movers[clip.shooter]!;
      const firstAim = {
        d: pitchLength - 0.8,
        x: 34 + clip.side * clip.reboundRng.between(1.5, goalHalf - 0.4)
      };
      const firstFlight = Math.max(
        10,
        Math.ceil(
          distance(clip.shotFrom, firstAim) / perFrame(headed ? 14 : 25)
        )
      );
      const spill = {
        d: pitchLength - clip.reboundRng.between(5, 8),
        x: clamp(
          lerp(firstAim.x, striker.x, clip.reboundRng.between(0.3, 0.7)) +
            clip.reboundRng.between(-2.5, 2.5),
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
      const keeperFrom = { d: clip.keeper.d, x: clip.keeper.x };
      // Needing more than a run to get to the first effort, the keeper
      // dives from the start (#226).
      const flyingFirst =
        (1.5 * distance(keeperFrom, firstAim)) / Math.max(1, firstFlight - 2) >
        perFrame(fastestRun);
      const recover = {
        d: pitchLength - 0.8,
        x: lerp(firstAim.x, 34, 0.6)
      };
      let chaser = -1;
      let nearest = Infinity;
      clip.defenders.forEach((p, j) => {
        const i = clip.attackers.length + j;
        const gap = distance(clip.movers[i]!, spill);
        if (p.line !== 'keeper' && gap < nearest) {
          nearest = gap;
          chaser = i;
        }
      });
      const firstBend = headed ? 0 : curl(clip, 0.2, 1);
      if (headed) {
        aimAt(clip, clip.shooter, firstAim);
      } else {
        kick(clip, clip.shooter, firstAim);
      }
      const wasHeaded = headed;
      for (let f = 1; f <= reboundFrames; f++) {
        if (wasHeaded) {
          land(clip, f, true);
        }
        if (f <= firstFlight) {
          const u = f / firstFlight;
          Object.assign(clip.ball, bent(clip.shotFrom, firstAim, u, firstBend));
          clip.ball.height = wasHeaded
            ? headHeight * (1 - u) + Math.sin(Math.PI * u) * 0.12
            : Math.sin(Math.PI * u) * 0.35;
          const k = ease(Math.min(1, f / Math.max(1, firstFlight - 2)));
          clip.keeper.d = lerp(keeperFrom.d, firstAim.d, k);
          clip.keeper.x = lerp(keeperFrom.x, firstAim.x, k);
          clip.keeper.pose =
            flyingFirst || f > firstFlight * 0.4 ? 'dive' : 'run';
        } else {
          // Off the keeper it pops up and runs out, and stops.
          const u = Math.min(1, (f - firstFlight) / spillFrames);
          const out = 1 - (1 - u) * (1 - u);
          clip.ball.d = lerp(firstAim.d, spill.d, out);
          clip.ball.x = lerp(firstAim.x, spill.x, out);
          clip.ball.height = Math.sin(Math.PI * u) * 0.5;
          if (f - firstFlight > scrambleFrames) {
            clip.keeper.pose = 'run';
            const gap = distance(clip.keeper, recover);
            const step = perFrame(5);
            if (gap > step) {
              clip.keeper.d += ((recover.d - clip.keeper.d) / gap) * step;
              clip.keeper.x += ((recover.x - clip.keeper.x) / gap) * step;
            }
          }
        }
        if (f > setOff) {
          if (!wasHeaded) {
            striker.pose = 'run';
          }
          // Eyes on goal, they come back for it rather than turn about.
          aimAt(clip, clip.shooter, firstAim, true);
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
          const at = clip.movers[chaser]!;
          const gap = distance(at, spill) || 1;
          overrides.set(chaser, {
            d: spill.d + ((at.d - spill.d) / gap) * lateBy,
            x: spill.x + ((at.x - spill.x) / gap) * lateBy
          });
        }
        steer(
          clip,
          clip.frame,
          new Set([clip.shooter, clip.keeperSlot]),
          overrides
        );
        record(clip);
        clip.frame++;
      }
      clip.shotFrom = { d: clip.ball.d, x: clip.ball.x };
      headed = false;
    }
    // Through on goal, the keeper has come out to meet the shooter.
    const outFor =
      clip.finish === 'one-on-one' && clip.keeper ? clip.keeper : undefined;
    let aim: Point;
    let rest: Point;
    let stopsAtKeeper = false;
    // A rebound scored goes in the side the keeper has left.
    const shotSide =
      clip.rebound && clip.keeper ? (clip.keeper.x <= 34 ? 1 : -1) : clip.side;
    switch (clip.outcome) {
      case 'goal': {
        const x = 34 + shotSide * clip.rng.between(0.6, goalHalf - 0.4);
        aim = { d: pitchLength, x };
        rest = { d: pitchLength + 1.8, x: x + clip.side * 0.4 };
        break;
      }
      case 'hold':
      case 'dive':
      case 'parry': {
        const x =
          34 +
          clip.side *
            (clip.outcome === 'hold'
              ? clip.rng.between(0, 1.2)
              : clip.rng.between(2, goalHalf - 0.3));
        aim = outFor
          ? {
              d: outFor.d - 0.5,
              x: outFor.x + clip.side * (clip.outcome === 'hold' ? 0.3 : 1.4)
            }
          : { d: pitchLength - 0.8, x };
        stopsAtKeeper = true;
        rest =
          clip.outcome === 'parry'
            ? {
                d: pitchLength + 2,
                x: 34 + clip.side * clip.rng.between(8, 12)
              }
            : aim;
        break;
      }
      case 'post': {
        const x = 34 + clip.side * goalHalf;
        aim = { d: pitchLength, x };
        rest = {
          d: pitchLength - clip.rng.between(7, 10),
          x: x - clip.side * 3
        };
        break;
      }
      case 'wide-left':
      case 'wide-right': {
        const out = clip.outcome === 'wide-left' ? -1 : 1;
        const x = 34 + out * (goalHalf + clip.rng.between(0.8, 3.5));
        aim = { d: pitchLength, x };
        rest = { d: pitchLength + 5, x: x + out * 1.5 };
        break;
      }
      case 'block':
      case 'interception':
      case 'tackle':
        throw new Error('A clearance plays above');
      case 'claim':
      case 'punch':
        throw new Error('A claim or a punch plays above');
      case 'over': {
        const x = 34 + clip.side * clip.rng.between(0, goalHalf - 0.5);
        aim = { d: pitchLength, x };
        rest = { d: pitchLength + 5, x };
        break;
      }
    }
    // A header is slower than a shot, a shot from range faster.
    const pace = headed ? 14 : clip.finish === 'long-range' ? 28 : 25;
    const flight = Math.max(
      10,
      Math.ceil(distance(clip.shotFrom, aim) / perFrame(pace))
    );
    // The frame the ball arrives, the cross's frames included.
    clip.momentFrame =
      clip.momentStart + crossFrames + reboundFrames + flight - 1;
    const keeperFrom = clip.keeper
      ? { d: clip.keeper.d, x: clip.keeper.x }
      : undefined;
    const keeperTo =
      clip.keeper && keeperFrom
        ? stopsAtKeeper
          ? { d: aim.d, x: aim.x }
          : clip.outcome === 'goal'
            ? outFor
              ? // Rounded or beaten, the keeper is left where they came to.
                { d: keeperFrom.d, x: lerp(keeperFrom.x, aim.x, 0.35) }
              : {
                  d: pitchLength - 0.5,
                  x: lerp(keeperFrom.x, aim.x, 0.55)
                }
            : keeperFrom
        : undefined;
    // Needing more than a run to get across, the keeper dives from the
    // start, and a catch is made diving (#226). Easing in and out, they go
    // half as fast again as on average at their quickest.
    const flying =
      keeperFrom !== undefined &&
      keeperTo !== undefined &&
      (1.5 * distance(keeperFrom, keeperTo)) / Math.max(1, flight - 2) >
        perFrame(fastestRun);
    if (flying && clip.outcome === 'hold' && clip.input.outcome === undefined) {
      clip.outcome = 'dive';
    }
    const dives =
      flying ||
      clip.outcome === 'dive' ||
      clip.outcome === 'parry' ||
      (clip.outcome === 'goal' &&
        Math.abs(aim.x - (keeperFrom?.x ?? 34)) > 1.5);
    clip.cameraFocus = () => ({
      d: (clip.ball.d + pitchLength) / 2,
      x: clip.ball.x
    });
    if (headed) {
      aimAt(clip, clip.shooter, aim);
    } else {
      kick(clip, clip.shooter, aim);
    }
    const scorer = clip.movers[clip.shooter]!;
    // A shot bends a little; a header doesn't.
    const shotBend = headed ? 0 : curl(clip, 0.2, 1);
    for (let f = 1; f <= flight + afterArrival; f++) {
      if (headed) {
        // The forehead meets it, then the header lands and runs on.
        land(clip, f, true);
      }
      if (f <= flight) {
        const u = f / flight;
        Object.assign(clip.ball, bent(clip.shotFrom, aim, u, shotBend));
        // A header starts at head height and goes down, or over the bar.
        const from = headed ? headHeight : 0.4;
        clip.ball.height =
          clip.outcome === 'over'
            ? from + (1 - from) * u
            : headed
              ? headHeight * (1 - u) + Math.sin(Math.PI * u) * 0.12
              : Math.sin(Math.PI * u) * 0.35;
      } else {
        const after = f - flight;
        const settle = Math.min(1, after / 40);
        const u = 1 - (1 - settle) * (1 - settle);
        clip.ball.d = lerp(aim.d, rest.d, u);
        clip.ball.x = lerp(aim.x, rest.x, u);
        clip.ball.height =
          clip.outcome === 'over'
            ? Math.max(0, 1 - settle)
            : stopsAtKeeper
              ? 0.2
              : 0;
      }
      if (clip.keeper && keeperFrom && keeperTo) {
        const u = Math.min(1, f / Math.max(1, flight - 2));
        clip.keeper.d = lerp(keeperFrom.d, keeperTo.d, ease(u));
        clip.keeper.x = lerp(keeperFrom.x, keeperTo.x, ease(u));
        clip.keeper.pose =
          dives && (flying || f > flight * 0.4) ? 'dive' : 'run';
        if (stopsAtKeeper && f > flight && clip.outcome !== 'parry') {
          // Caught diving, the keeper stays down with it until the
          // reaction gets them up.
          clip.keeper.pose = clip.outcome === 'dive' ? 'dive' : 'hold';
          clip.ball.d = clip.keeper.d;
          clip.ball.x = clip.keeper.x;
        }
      }
      steer(
        clip,
        clip.frame,
        new Set([clip.shooter, clip.keeperSlot]),
        new Map()
      );
      record(clip);
      clip.frame++;
    }
  }
};
