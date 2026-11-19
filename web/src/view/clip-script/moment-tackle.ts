import { clamp, distance, lerp, perFrame, type Point } from './geometry';
import { clipFps, pitchLength, pitchWidth } from './model';
import { aimAt, record, steer, type Clip } from './pitch';
import { byQuality } from './setup';
import {
  afterArrival,
  boxDepth,
  intoRangePace,
  lieFrames,
  pullUpGap,
  runOutFrames,
  runOutPace,
  sitFrames,
  slideFrames,
  slidePace,
  slideReach,
  stumbleFrames,
  stumblePace,
  tacklePace
} from './tuning';

/**
 * A tackle on the shooter as they shape to shoot, or an injury: tackled,
 * or pulling up.
 */
export const playTackle = (clip: Clip) => {
  /** Who made the tackle. */
  let tackler = -1;
  // The defender nearest the shooter sprints in and slides, feet first,
  // into the ball as the shooter shapes to shoot. It runs loose, and the
  // shooter goes over and lies there a moment.
  const runner = clip.movers[clip.shooter]!;
  let nearest = Infinity;
  clip.defenders.forEach((p, j) => {
    const i = clip.attackers.length + j;
    const gap = distance(clip.movers[i]!, runner);
    if (p.line !== 'keeper' && gap < nearest) {
      nearest = gap;
      tackler = i;
    }
  });
  if (tackler < 0) {
    tackler = clip.keeperSlot;
  }
  // An injury's tackle is made by the defender the moment names.
  const named =
    clip.input.tackler === undefined
      ? undefined
      : clip.defenders[clip.input.tackler];
  if (named && named.line !== 'keeper') {
    tackler = clip.attackers.length + clip.input.tackler!;
    nearest = distance(clip.movers[tackler]!, runner);
  }
  const defender = clip.movers[tackler]!;
  /** Past the ball, a weak tackler's slide runs out further (#238). */
  const quality = clip.qualities[tackler] ?? 0;
  const runOut = Math.round(byQuality(quality, runOutFrames));
  const runOutShare = byQuality(quality, runOutPace);
  /** Pulling up, the player goes down this many frames into the run. */
  const pullAt = clip.pulledUp ? Math.round(clip.tackleRng.between(20, 32)) : 0;
  const goal = { d: pitchLength, x: 34 };
  const toGoal = distance(runner, goal) || 1;
  const heading = {
    d: (goal.d - runner.d) / toGoal,
    x: (goal.x - runner.x) / toGoal
  };
  // With the tackler still far off, the shooter steadies themselves.
  const runPace = perFrame(nearest > 10 ? 2.5 : 4.5);
  // To be fouled in the box, they carry it in at pace first, and the
  // slide waits for them there.
  const latest = clipFps * (clip.foul ? 12 : 3);
  let slide: Point | undefined;
  let sliding = 0;
  let contact = 0;
  let loose: Point = { d: clip.ball.d, x: clip.ball.x };
  let looseFrom: Point = { d: clip.ball.d, x: clip.ball.x };
  /** The defender who runs onto the loose ball, if one is near. */
  let sweeper = -1;
  const held = new Set([clip.shooter, tackler]);
  clip.cameraFocus = () => ({ d: clip.ball.d + 4, x: clip.ball.x });
  for (let f = 1; !contact || f <= contact + afterArrival; f++) {
    if (!contact) {
      // The shooter carries on, the ball just ahead, and plants their
      // feet to shoot as the slide comes in.
      // A foul waits for the shooter to be in the box.
      const inBox = !clip.foul || runner.d > pitchLength - boxDepth + 1;
      // Injured, they never get into the box, or for a foul, the six-yard
      // box.
      const room = clip.injured
        ? Math.max(0, clip.injuredLimit - runner.d) / heading.d
        : Infinity;
      const pace = Math.min(
        room,
        (inBox ? runPace : perFrame(intoRangePace)) *
          Math.max(0, 1 - sliding / 6)
      );
      runner.d += heading.d * pace;
      runner.x += heading.x * pace;
      clip.ball.d = runner.d + heading.d * 0.7;
      clip.ball.x = runner.x + heading.x * 0.7;
      clip.ball.height = 0;
      runner.pose = 'run';
      if (!slide) {
        // Until then, the tackler runs with them, a little ahead and to
        // the side they came from.
        const across = { d: -heading.x, x: heading.d };
        const fromSide =
          Math.sign(
            (defender.d - runner.d) * across.d +
              (defender.x - runner.x) * across.x
          ) || 1;
        const lead = inBox
          ? {
              d: clip.ball.d + heading.d * 1.5,
              x: clip.ball.x + heading.x * 1.5
            }
          : {
              d: runner.d + heading.d * 2.2 + across.d * fromSide * 1.6,
              x: runner.x + heading.x * 2.2 + across.x * fromSide * 1.6
            };
        const gap = distance(defender, lead) || 1;
        const step = Math.min(gap, perFrame(tacklePace));
        defender.d += ((lead.d - defender.d) / gap) * step;
        defender.x += ((lead.x - defender.x) / gap) * step;
        defender.pose = 'run';
        if (
          !clip.pulledUp &&
          ((inBox && distance(defender, clip.ball) < slideReach) ||
            f >= latest - slideFrames)
        ) {
          slide = { d: 0, x: 0 };
        }
      }
      if (
        clip.pulledUp &&
        (f >= pullAt || distance(defender, runner) < pullUpGap)
      ) {
        // Pulling up, the player stops short and the ball runs on, before
        // the defender closing them down gets there.
        contact = f;
        looseFrom = { d: clip.ball.d, x: clip.ball.x };
        const along = clip.tackleRng.between(3, 5);
        loose = {
          d: clamp(clip.ball.d + heading.d * along, 2, pitchLength - 2),
          x: clamp(clip.ball.x + heading.x * along, 2, pitchWidth - 2)
        };
        let near = 15;
        clip.defenders.forEach((p, j) => {
          const i = clip.attackers.length + j;
          const gap = distance(clip.movers[i]!, loose);
          if (p.line !== 'keeper' && gap < near) {
            near = gap;
            sweeper = i;
          }
        });
        if (sweeper >= 0) {
          held.add(sweeper);
        }
        clip.clearer = sweeper >= 0 ? sweeper : tackler;
      }
      if (slide) {
        // Feet first, homing on the ball, slowing as they go.
        const feet = distance(defender, clip.ball) || 1;
        slide = {
          d: (clip.ball.d - defender.d) / feet,
          x: (clip.ball.x - defender.x) / feet
        };
        const step = Math.min(
          perFrame(Math.max(2, slidePace * (1 - sliding / slideFrames))),
          Math.max(0, feet - 0.8)
        );
        defender.d += slide.d * step;
        defender.x += slide.x * step;
        defender.pose = 'tackle';
        defender.poseFrame = 0;
        aimAt(clip, tackler, {
          d: defender.d + slide.d * 5,
          x: defender.x + slide.x * 5
        });
        sliding++;
        if ((feet < 1.2 && sliding >= 6) || sliding >= 2 * slideFrames) {
          contact = f;
          // Poked away, on across the shooter's path.
          const across = clip.tackleRng.next() < 0.5 ? -1 : 1;
          const along = clip.tackleRng.between(3, 6);
          const way = {
            d: slide.d * 0.8 - slide.x * across * 0.6,
            x: slide.x * 0.8 + slide.d * across * 0.6
          };
          const size = Math.hypot(way.d, way.x) || 1;
          looseFrom = { d: clip.ball.d, x: clip.ball.x };
          loose = {
            d: clamp(clip.ball.d + (way.d / size) * along, 2, pitchLength - 2),
            x: clamp(clip.ball.x + (way.x / size) * along, 2, pitchWidth - 2)
          };
          let near = 9;
          clip.defenders.forEach((p, j) => {
            const i = clip.attackers.length + j;
            const gap = distance(clip.movers[i]!, loose);
            if (i !== tackler && p.line !== 'keeper' && gap < near) {
              near = gap;
              sweeper = i;
            }
          });
          if (sweeper >= 0) {
            held.add(sweeper);
          }
          clip.clearer = sweeper >= 0 ? sweeper : tackler;
        }
      }
    } else {
      const after = f - contact;
      const settle = Math.min(1, after / 25);
      const u = 1 - (1 - settle) * (1 - settle);
      clip.ball.d = lerp(looseFrom.d, loose.d, u);
      clip.ball.x = lerp(looseFrom.x, loose.x, u);
      clip.ball.height = 0;
      // Taken out, the shooter pitches forward over the tackle and goes
      // down.
      if (after <= stumbleFrames) {
        const on =
          perFrame(clip.pulledUp ? stumblePace / 3 : stumblePace) *
          (1 - after / stumbleFrames);
        runner.d += heading.d * on;
        runner.x += heading.x * on;
        aimAt(clip, clip.shooter, {
          d: runner.d + heading.d * 5,
          x: runner.x + heading.x * 5
        });
      }
      runner.pose = 'fall';
      runner.poseFrame = after <= stumbleFrames ? 0 : 1;
      // The slide runs out, and the tackler sits up.
      if (after < runOut && slide) {
        const step = perFrame(slidePace) * runOutShare * (1 - after / runOut);
        defender.d += slide.d * step;
        defender.x += slide.x * step;
      }
      // Pulling up, nobody slid in, and the nearest defender takes it.
      const sitting = !clip.pulledUp && after < runOut + sitFrames;
      if (!clip.pulledUp) {
        defender.pose = sitting ? 'tackle' : 'run';
        defender.poseFrame = after < runOut ? 0 : 1;
      }
      if (!sitting && sweeper >= 0) {
        held.delete(tackler);
      }
      const sweeping =
        sitting && sweeper < 0 ? undefined : clip.movers[clip.clearer];
      if (sweeping) {
        // A team-mate gets to the loose ball, facing upfield. Once there
        // they stay on it, held, rather than be steered off it to close it
        // down and step back onto it every few frames.
        const to = { d: clip.ball.d + 0.6, x: clip.ball.x };
        const gap = distance(sweeping, to);
        const step = perFrame(7) * clip.runPaces[clip.clearer]!;
        if (gap > step) {
          sweeping.d += ((to.d - sweeping.d) / gap) * step;
          sweeping.x += ((to.x - sweeping.x) / gap) * step;
        } else {
          held.add(clip.clearer);
          sweeping.d = to.d;
          sweeping.x = to.x;
        }
        sweeping.pose = 'run';
      }
    }
    steer(clip, clip.frame, held);
    record(clip);
    clip.frame++;
  }
  clip.momentFrame = clip.momentStart + contact - 1;
  // Injured, the player stays down.
  clip.shooterUpAt = clip.injured
    ? Infinity
    : clip.momentFrame + stumbleFrames + lieFrames;
};
