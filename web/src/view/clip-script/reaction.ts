import {
  clamp,
  distance,
  ease,
  lerp,
  loftedHeight,
  perFrame,
  type Mover,
  type Point
} from './geometry';
import {
  cameraWide,
  cameraZoomed,
  outcomeKind,
  pitchLength,
  pitchWidth
} from './model';
import { aimAt, finishFrame, kick, steer, target, type Clip } from './pitch';
import {
  celebrateFor,
  celebrationPace,
  clearRunOn,
  despairFrames,
  fetchFrom,
  getUpFrames,
  huddleGap,
  huddleReach,
  jogPace,
  jumpAir,
  jumpCrouch,
  jumpCycle,
  keeperStride,
  leapFrames,
  longestWheel,
  slideMetres,
  turnBackFrom,
  walkPace
} from './tuning';

/** A jump for joy, `t` frames in: crouch, in the air, land, again. */
const jumping = (t: number): Pick<Mover, 'pose' | 'poseFrame'> => {
  const at = ((t % jumpCycle) + jumpCycle) % jumpCycle;
  return at < jumpCrouch
    ? { pose: 'jump', poseFrame: 0 }
    : at < jumpCrouch + jumpAir
      ? { pose: 'jump', poseFrame: 1 }
      : { pose: 'celebrate' };
};

/**
 * The reaction: the scorer celebrates, the keeper plays the ball out, or
 * the shooter holds their head.
 */
export const playReaction = (clip: Clip) => {
  const { keeper } = clip;
  clip.reactionStart = clip.frame;
  const reactionFrames = clip.rng.int(150, 200);
  const scorer = clip.movers[clip.shooter]!;
  const corner = {
    d: pitchLength - 2,
    x: scorer.x < 34 ? 2 : pitchWidth - 2
  };
  const outlet = {
    d: clip.rng.between(55, 70),
    x: clip.rng.between(12, 56)
  };
  const ballAtRest = { d: clip.ball.d, x: clip.ball.x };
  // A clearance goes long upfield or into touch, as the seed picks. With a
  // player down injured, it goes into touch, so play stops for them.
  const upfield = clip.rng.next() < 0.5 && !clip.injured;
  const cleared = upfield
    ? {
        d: clamp(clip.ball.d - clip.rng.between(30, 45), 5, 100),
        x: clip.rng.between(8, 60)
      }
    : {
        d: clamp(clip.ball.d - clip.rng.between(5, 20), 5, 100),
        // Landing just out of play, it runs on into the boards.
        x: clip.ball.x < 34 ? -0.5 : pitchWidth + 0.5
      };
  const clearFrames = Math.max(
    20,
    Math.ceil(distance(ballAtRest, cleared) / perFrame(20))
  );
  const reactionHeld = new Set([clip.shooter, clip.keeperSlot]);
  if (clip.clearer >= 0) {
    reactionHeld.add(clip.clearer);
  }
  // After a catch, the keeper throws it or rolls it out to a team-mate
  // between 12 and 25 m away, or kicks it long, as the seed picks.
  const caughtIt =
    keeper !== undefined &&
    outcomeKind(clip.outcome) === 'save' &&
    clip.outcome !== 'parry' &&
    clip.outcome !== 'punch';
  const mates = caughtIt
    ? clip.defenders.flatMap((p, j) => {
        const i = clip.attackers.length + j;
        const gap = distance(clip.movers[i]!, keeper);
        return p.line !== 'keeper' && gap > 12 && gap < 25 ? [i] : [];
      })
    : [];
  const wayOut = clip.rng.next();
  const playOut: 'kick' | 'roll' | 'throw' = !mates.length
    ? 'kick'
    : wayOut < 0.45
      ? 'throw'
      : wayOut < 0.8
        ? 'roll'
        : 'kick';
  const mate = mates.length ? clip.rng.pick(mates) : -1;
  /** The reaction's frame the keeper lets it go on. */
  const release = 50;
  // How everyone else takes it. After a goal, the defenders nearest their
  // goal despair, they all trudge back, and the keeper fetches the ball
  // from the net. After a save, a miss or a clearance, the attackers turn
  // back, the shooter holding their head first after a save or a miss.
  const conceded = clip.outcome === 'goal';
  const goalMouth = { d: pitchLength, x: 34 };
  const halfway = { d: pitchLength / 2 - 7, x: 34 };
  const despairing = conceded
    ? clip.defenders
        .flatMap((p, j) =>
          p.line === 'keeper' ? [] : [clip.attackers.length + j]
        )
        .toSorted(
          (a, b) =>
            distance(clip.movers[a]!, goalMouth) -
            distance(clip.movers[b]!, goalMouth)
        )
        .slice(0, 2)
    : [];
  const rues =
    outcomeKind(clip.outcome) === 'save' ||
    outcomeKind(clip.outcome) === 'near-miss';
  // The scorer wheels away towards the corner flag, to the fans behind the
  // goal, or back to their team-mates, as the seed picks, going only as far
  // as leaves them time to celebrate there. The nearest team-mates chase
  // them down and pile in.
  const awayFrom = scorer.x < 34 ? -1 : 1;
  const wheelsTo = clip.rng.pick(['corner', 'fans', 'mates'] as const);
  const wheelRange = Math.min(
    longestWheel,
    perFrame(celebrationPace) * (reactionFrames - leapFrames - celebrateFor)
  );
  const wheelTowards: Point =
    wheelsTo === 'corner'
      ? corner
      : wheelsTo === 'fans'
        ? { d: pitchLength - 1, x: 34 + awayFrom * clip.rng.between(9, 14) }
        : { d: scorer.d - clip.rng.between(8, 12), x: lerp(scorer.x, 34, 0.3) };
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
    ? clip.others
        .toSorted(
          (a, b) =>
            distance(clip.movers[a]!, scorer) -
            distance(clip.movers[b]!, scorer)
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
          x: clip.movers[mate]!.x < 34 ? 18 : pitchWidth - 18
        }
      : undefined;
  const pushUp = { d: pitchLength - 35, x: 34 };
  const flag = {
    d: pitchLength - 0.5,
    x: clip.ball.x < 34 ? 0.5 : pitchWidth - 0.5
  };
  const cornerTaker =
    clip.outcome === 'parry'
      ? (clip.others.toSorted(
          (a, b) =>
            distance(clip.movers[a]!, flag) - distance(clip.movers[b]!, flag)
        )[0] ?? -1)
      : -1;
  const huddled = new Set<number>();
  // With a player down injured, the two team-mates nearest walk over to
  // see to them once the ball is out.
  const carers = clip.injured
    ? clip.others
        .toSorted(
          (a, b) =>
            distance(clip.movers[a]!, scorer) -
            distance(clip.movers[b]!, scorer)
        )
        .slice(0, 2)
    : [];
  // How the scorer celebrates once there: arms up, jumping, or, from a
  // run to the fans or the corner, a knee slide.
  const arrivesWith = clip.rng.pick(
    wheelsTo === 'mates'
      ? (['arms', 'jump'] as const)
      : (['arms', 'jump', 'slide'] as const)
  );
  /** The reaction's frame the scorer got there. */
  let there: number | undefined;
  let fetched = false;
  let mateSpot: Point | undefined;
  let keeperSpot: Point | undefined;
  let outFrames = 0;
  for (let f = 0; f < reactionFrames; f++) {
    clip.cameraWidth =
      f < 50
        ? cameraZoomed
        : lerp(cameraZoomed, cameraWide, ease(Math.min(1, (f - 50) / 50)));
    const overrides = new Map<number, Point>();
    const paces = new Map<number, number>();
    if (clip.outcome === 'goal') {
      // Arms up where they scored, then away, then arms up again there.
      const gap = distance(scorer, celebrateAt);
      const step = perFrame(celebrationPace);
      const off = f >= leapFrames && gap > step;
      // A knee slide carries them the last few metres, slowing.
      const sliding =
        arrivesWith === 'slide' && f >= leapFrames && gap < slideMetres;
      if (off) {
        const pace = sliding ? step * Math.max(0.2, gap / slideMetres) : step;
        scorer.d += ((celebrateAt.d - scorer.d) / gap) * pace;
        scorer.x += ((celebrateAt.x - scorer.x) / gap) * pace;
      } else if (f >= leapFrames) {
        Object.assign(scorer, celebrateAt);
        if (arrivesWith !== 'slide') {
          aimAt(clip, clip.shooter, salute, true);
        }
        there ??= f;
      }
      // Arms up as they go, then arms up, a jump for joy or on their knees.
      Object.assign(
        scorer,
        f < leapFrames
          ? { pose: 'celebrate' }
          : sliding || (there !== undefined && arrivesWith === 'slide')
            ? { pose: 'slide' }
            : off
              ? { pose: 'cheer' }
              : arrivesWith === 'jump'
                ? jumping(f - there!)
                : { pose: 'celebrate' }
      );
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
      for (const i of clip.others) {
        if (!joiners.includes(i)) {
          const from = clip.movers[i]!;
          const gap = distance(from, scorer) || 1;
          overrides.set(i, {
            d: scorer.d + ((from.d - scorer.d) / gap) * 4,
            x: scorer.x + ((from.x - scorer.x) / gap) * 4
          });
          paces.set(i, jogPace);
        }
      }
      clip.cameraFocus = () => ({ d: scorer.d, x: scorer.x });
      clip.keepInShot = () => scorer;
    } else if (outcomeKind(clip.outcome) === 'clearance') {
      // Tackled, the shooter lies there a moment first.
      scorer.pose = clip.frame < clip.shooterUpAt ? 'fall' : 'run';
      scorer.poseFrame = 1;
      // For a foul, play stops: the ball stays where it ran, and the
      // defender who took it is free. Headed clear (#224), it is cleared
      // already, and comes to rest where it lands.
      const clears = !clip.foul && clip.cross !== 'headed-clear';
      if (!clears && f === 25) {
        reactionHeld.delete(clip.clearer);
      }
      if (f === 25 && clears) {
        kick(clip, clip.clearer, cleared);
      }
      if (clears && f >= 25 && f < 25 + clearFrames) {
        const u = (f - 25) / clearFrames;
        clip.ball.d = lerp(ballAtRest.d, cleared.d, u);
        clip.ball.x = lerp(ballAtRest.x, cleared.x, u);
        clip.ball.height = loftedHeight(u, 0.6);
      } else if (clears && f >= 25 + clearFrames) {
        // Landed, it runs on a few metres and stops.
        const run = Math.min(1, (f - 25 - clearFrames) / 30);
        const on = (1 - (1 - run) * (1 - run)) * clearRunOn;
        const gap = distance(ballAtRest, cleared) || 1;
        clip.ball.d = cleared.d + ((cleared.d - ballAtRest.d) / gap) * on;
        clip.ball.x = cleared.x + ((cleared.x - ballAtRest.x) / gap) * on;
        clip.ball.height = 0;
        // Cleared, the defender is free to rejoin the shape.
        reactionHeld.delete(clip.clearer);
      }
      if (clip.injured && f >= 30) {
        carers.forEach((i, k) => {
          const side = k === 0 ? -1 : 1;
          overrides.set(i, { d: scorer.d - 1, x: scorer.x + side * 2.2 });
          paces.set(i, walkPace);
        });
      }
      // The camera stays with a player down injured.
      clip.cameraFocus = clip.injured
        ? () => ({ d: scorer.d, x: scorer.x })
        : () => ({ d: clip.ball.d, x: clip.ball.x });
    } else {
      scorer.pose = outcomeKind(clip.outcome) === 'near-miss' ? 'head' : 'run';
      if (keeper && outcomeKind(clip.outcome) === 'save') {
        if (clip.outcome === 'parry') {
          // Up off the ground, and back to the line for the corner.
          keeper.pose = f < getUpFrames ? 'dive' : 'run';
          if (f === getUpFrames) {
            reactionHeld.delete(clip.keeperSlot);
          }
          if (f >= getUpFrames) {
            overrides.set(clip.keeperSlot, { d: pitchLength - 1, x: 34 });
            paces.set(clip.keeperSlot, walkPace);
          }
          if (cornerTaker >= 0 && f >= turnBackFrom) {
            overrides.set(cornerTaker, flag);
          }
        } else if (clip.outcome === 'punch') {
          // Punched away, they walk back to their line.
          keeper.pose = 'run';
          if (f === 0) {
            reactionHeld.delete(clip.keeperSlot);
          }
          overrides.set(clip.keeperSlot, { d: pitchLength - 1, x: 34 });
          paces.set(clip.keeperSlot, walkPace);
        } else if (f < release) {
          // Held: down after a dive, then up in the hands, or ready to bowl,
          // coming out a few steps as the team spreads to take it.
          const down = clip.outcome === 'dive' && f < getUpFrames;
          keeper.pose = down
            ? 'dive'
            : playOut === 'roll' && f >= release - 8
              ? 'kick'
              : 'hold';
          if (!down) {
            keeper.d -= perFrame(keeperStride);
          }
          clip.ball.d = keeper.d;
          clip.ball.x = keeper.x;
          if (wideFor) {
            overrides.set(mate, wideFor);
            paces.set(mate, 5);
          }
        } else if (playOut === 'kick') {
          // Kicked long, to land and bounce in midfield.
          if (f === release) {
            kick(clip, clip.keeperSlot, outlet);
            keeperSpot = { d: keeper.d, x: keeper.x };
          }
          keeper.pose = 'run';
          if (f < release + 30) {
            const u = ease((f - release) / 30);
            clip.ball.d = lerp(keeperSpot!.d, outlet.d, u);
            clip.ball.x = lerp(keeperSpot!.x, outlet.x, u);
            clip.ball.height = loftedHeight(u, 0.5);
          } else {
            clip.ball.height = 0;
          }
        } else {
          // Thrown or rolled to a team-mate, who stands to take it.
          if (f === release) {
            mateSpot = { d: clip.movers[mate]!.d, x: clip.movers[mate]!.x };
            keeperSpot = { d: keeper.d, x: keeper.x };
            outFrames = Math.ceil(
              distance(keeperSpot, mateSpot) /
                perFrame(playOut === 'throw' ? 14 : 13)
            );
            aimAt(clip, clip.keeperSlot, mateSpot);
          }
          overrides.set(mate, mateSpot!);
          const u = Math.min(1, (f - release) / outFrames);
          if (u < 1) {
            clip.ball.d = lerp(keeperSpot!.d, mateSpot!.d, u);
            clip.ball.x = lerp(keeperSpot!.x, mateSpot!.x, u);
            // A throw comes down from over the head; a roll stays on the grass.
            clip.ball.height =
              playOut === 'throw'
                ? 0.35 * (1 - u) + Math.sin(Math.PI * u) * 0.1
                : 0;
          } else {
            const at = clip.movers[mate]!;
            const gap = distance(keeperSpot!, at) || 1;
            clip.ball.d = at.d + ((at.d - keeperSpot!.d) / gap) * 0.5;
            clip.ball.x = at.x + ((at.x - keeperSpot!.x) / gap) * 0.5;
            clip.ball.height = 0;
          }
          keeper.pose =
            f < release + 8 ? (playOut === 'throw' ? 'hold' : 'kick') : 'run';
        }
      }
      clip.cameraFocus =
        outcomeKind(clip.outcome) === 'save'
          ? () => ({ d: (clip.ball.d + pitchLength) / 2, x: clip.ball.x })
          : () => ({ d: scorer.d + 4, x: scorer.x });
    }
    if (conceded) {
      for (const i of despairing) {
        if (f < despairFrames) {
          clip.movers[i]!.pose = 'head';
          reactionHeld.add(i);
        } else if (f === despairFrames) {
          clip.movers[i]!.pose = 'run';
          reactionHeld.delete(i);
        }
      }
      clip.defenders.forEach((p, j) => {
        const i = clip.attackers.length + j;
        if (p.line !== 'keeper' && !reactionHeld.has(i)) {
          overrides.set(i, target(clip, i, halfway, clip.frame));
          paces.set(i, walkPace);
        }
      });
      if (keeper && f >= fetchFrom) {
        // Into the net for the ball, then out with it in their hands.
        const to = fetched
          ? { d: pitchLength - 4, x: 34 }
          : { d: clip.ball.d, x: clip.ball.x };
        const gap = distance(keeper, to);
        // Off their line, as after a one-on-one, they jog back for it.
        const step = perFrame(!fetched && gap > 3 ? jogPace : walkPace + 1);
        if (gap > step) {
          keeper.d += ((to.d - keeper.d) / gap) * step;
          keeper.x += ((to.x - keeper.x) / gap) * step;
        }
        fetched ||= distance(keeper, clip.ball) < 0.6;
        keeper.pose = fetched ? 'hold' : 'run';
        if (fetched) {
          Object.assign(clip.ball, {
            d: keeper.d,
            height: 0.5,
            x: keeper.x
          });
        }
      }
    } else {
      if (rues) {
        scorer.pose = f < despairFrames ? 'head' : 'run';
      }
      // A shooter down after a tackle stays where they fell until they are
      // up; down injured, that is the whole reaction.
      if (f >= (rues ? despairFrames : 0) && clip.frame >= clip.shooterUpAt) {
        reactionHeld.delete(clip.shooter);
      }
      // Waiting on a corner, the attackers stay up.
      clip.outfield.forEach(i => {
        if (
          clip.outcome !== 'parry' &&
          !reactionHeld.has(i) &&
          !overrides.has(i) &&
          f >= turnBackFrom
        ) {
          overrides.set(i, target(clip, i, halfway, clip.frame));
          paces.set(i, jogPace);
        }
      });
      if (caughtIt && f >= turnBackFrom) {
        clip.defenders.forEach((p, j) => {
          const i = clip.attackers.length + j;
          if (p.line !== 'keeper' && !overrides.has(i)) {
            overrides.set(i, target(clip, i, pushUp, clip.frame));
            paces.set(i, jogPace);
          }
        });
      }
    }
    steer(clip, reactionHeld, overrides, undefined, paces);
    for (const i of joiners) {
      // Once both are there, they throw their arms up and stay.
      if (
        f >= leapFrames &&
        distance(scorer, celebrateAt) < 0.01 &&
        distance(clip.movers[i]!, scorer) < huddleReach
      ) {
        huddled.add(i);
        reactionHeld.add(i);
      }
      // Chasing or arrived, they look at the scorer, and jump about with
      // them, each in their own time.
      Object.assign(
        clip.movers[i]!,
        huddled.has(i) ? jumping(f + joiners.indexOf(i) * 9) : { pose: 'run' }
      );
      aimAt(clip, i, scorer, true);
    }
    finishFrame(clip);
  }
};
