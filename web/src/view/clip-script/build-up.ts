import { clamp, distance, ease, lerp, perFrame, type Point } from './geometry';
import {
  cameraWide,
  cameraZoomed,
  cardFrames,
  clipFps,
  outcomeKind,
  pitchLength,
  pitchWidth
} from './model';
import {
  dribble,
  goWide,
  nextReceiver,
  onside,
  pass,
  passesLeft,
  waitOnIt,
  waitingSpot
} from './passing';
import {
  aimAt,
  crossFlight,
  reach,
  record,
  standBack,
  steer,
  type Clip
} from './pitch';
import { fromWide } from './setup';
import {
  backLineAhead,
  carrierBrake,
  carryReach,
  finalPassRange,
  finalRunOn,
  firstTouchPace,
  intoRangePace,
  keeperRushes,
  longRange,
  longestCarry,
  longestLongRange,
  longestShot,
  penaltyRunUp,
  quickTouch,
  shooterReadyBy,
  stretchedShot,
  tackleShare,
  throwBack
} from './tuning';

/** The restart that starts the build-up, if any, played to a team-mate. */
export const playRestart = (clip: Clip) => {
  // A restart: the thrower holds the ball over their head, or the taker
  // waits with the defenders back, while both sides set; then the ball is
  // played to a team-mate.
  if (clip.restart === 'penalty') {
    // Everyone waits, still, while the penalty is set.
    const waits = clip.penaltyRng.int(80, 100);
    clip.cardEnd = Math.max(cardFrames, waits);
    const everyone = new Set(clip.movers.keys());
    for (let f = 0; f < waits; f++) {
      steer(clip, clip.frame, everyone);
      record(clip);
      clip.frame++;
    }
  } else if (clip.restart !== 'open-play') {
    const waits =
      clip.restart === 'throw-in'
        ? clip.rng.int(50, 80)
        : clip.restart === 'corner'
          ? // A corner to be headed takes longer, as the box fills.
            clip.finish === 'header'
            ? clip.rng.int(150, 200)
            : clip.rng.int(90, 130)
          : clip.rng.int(75, 110);
    // For a corner, the shooter and up to four more attack the box.
    const box = new Map<number, Point>();
    if (clip.restart === 'corner') {
      box.set(clip.shooter, clip.shootingSpot);
      for (const i of clip.others
        .filter(
          i => i !== clip.starter && clip.attackers[i]!.line !== 'defence'
        )
        .slice(0, 4)) {
        box.set(i, {
          d: pitchLength - clip.rng.between(5, 13),
          x: 34 + clip.rng.between(-10, 10)
        });
      }
      for (const [i, spot] of box) {
        clip.movers[i]!.d = spot.d - clip.rng.between(3, 6);
        clip.movers[i]!.x = spot.x + clip.rng.between(-3, 3);
      }
    }
    clip.cardEnd = Math.max(cardFrames, waits);
    clip.keepAway =
      clip.restart === 'free-kick'
        ? { d: clip.ball.d, x: clip.ball.x }
        : undefined;
    if (clip.keepAway) {
      // The clip opens with the defenders already back.
      for (let i = clip.attackers.length; i < clip.count; i++) {
        if (i !== clip.keeperSlot) {
          standBack(clip.movers[i]!, clip.keepAway);
        }
      }
    }
    const taker = clip.movers[clip.holder]!;
    for (let f = 0; f < waits; f++) {
      taker.pose = clip.restart === 'throw-in' ? 'hold' : 'run';
      clip.ball.height = clip.restart === 'throw-in' ? 0.3 : 0;
      steer(clip, clip.frame, new Set([clip.holder]), box);
      record(clip);
      clip.frame++;
    }
    clip.keepAway = undefined;
    const within = clip.others.filter(i => {
      const gap = distance(clip.movers[i]!, clip.ball);
      return i !== clip.holder && gap > 6 && gap < 20;
    });
    // A throw-in goes up the line or across, not back towards the
    // thrower's own goal, which leaves the build-up too far to go (#241).
    const upfield = within.filter(
      i => clip.movers[i]!.d >= clip.ball.d - throwBack
    );
    const near = upfield.length ? upfield : within;
    // A goal kick goes long, to someone onside in the middle of the pitch.
    const long = clip.others.filter(
      i => onside(clip, i) && clip.movers[i]!.d > 30 && clip.movers[i]!.d < 75
    );
    // A corner to be headed, or cut out, is crossed in the moment.
    if (
      clip.restart !== 'corner' ||
      (clip.outcome !== 'interception' && clip.finish !== 'header')
    ) {
      pass(
        clip,
        clip.restart === 'corner'
          ? clip.shooter
          : clip.restart === 'throw-in' && near.length
            ? clip.rng.pick(near)
            : clip.restart === 'goal-kick' && long.length
              ? clip.rng.pick(long)
              : nextReceiver(clip),
        clip.restart
      );
    }
  }
};

/**
 * The build-up, from the restart to the zoom: the passes and carries that
 * find the shooter, or the player who puts the final ball in, and their
 * run on with it.
 */
export const playBuildUp = (clip: Clip) => {
  // The build-up: each player takes the ball under control, may carry it
  // on, then passes; the last pass reaches the shooter in shooting range.
  // A corner's cross has already found the shooter.
  while (clip.restart !== 'corner' && clip.restart !== 'penalty') {
    // The first touch takes the ball on the way it came, the receiver
    // slowing to it from the pace they came at.
    // Found late, the shooter's touch is a quick one.
    const drawnTouch = clip.rng.int(25, 50);
    const touchFrames =
      clip.holder === clip.shooter && clip.frame > clip.maxBuildUp
        ? Math.min(drawnTouch, quickTouch)
        : drawnTouch;
    const last = clip.steps[clip.holder] ?? { d: 0, x: 0 };
    const touchPace = clamp(
      Math.hypot(last.d, last.x) * clipFps,
      ...firstTouchPace
    );
    // Far enough on that they ease down to it, however fast they came.
    const touchRun = Math.max(
      (touchPace * touchFrames) / clipFps + 1,
      clip.carryPace ** 2 / (2 * carrierBrake) + 1
    );
    dribble(
      clip,
      touchFrames,
      {
        d: clip.ball.d + clip.carrying.d * touchRun,
        x: clip.ball.x + clip.carrying.x * touchRun
      },
      touchPace
    );
    const towards =
      clip.holder === clip.shooter ? { d: 101, x: 34 } : clip.shootingSpot;
    // Before the final pass the ball is carried only as far as it must be,
    // into range or out wide, so the holder doesn't dwell on it.
    const final =
      clip.holder !== clip.shooter &&
      (passesLeft(clip) <= 1 || clip.frame > clip.maxBuildUp);
    const carries =
      clip.rng.next() < 0.6 && clip.frame < clip.lastCarry && !final;
    if (
      carries ||
      (clip.holder === clip.shooter && clip.frame < clip.minBuildUp)
    ) {
      const seconds =
        clip.holder === clip.shooter
          ? Math.max(1, Math.min(4, (clip.minBuildUp - clip.frame) / clipFps))
          : clip.rng.between(1, 2.5);
      const speed = clip.rng.between(5, 7);
      // A shooter from range carries it no nearer than they mean to shoot.
      const range =
        clip.holder === clip.shooter && clip.finish === 'long-range'
          ? Math.max(
              0,
              distance(clip.movers[clip.holder]!, towards) - longRange
            )
          : Infinity;
      // Found early, the shooter takes their time on it rather than run a
      // long way with it.
      const reach = Math.min(
        seconds * speed,
        Math.max(0, distance(clip.movers[clip.holder]!, towards) - 4),
        range,
        clip.holder === clip.shooter ? longestCarry / 2 : Infinity
      );
      const gap = distance(clip.movers[clip.holder]!, towards) || 1;
      const to = {
        d: Math.min(
          clip.movers[clip.holder]!.d +
            ((towards.d - clip.movers[clip.holder]!.d) / gap) * reach,
          // An injured player carries it no further than the edge of the
          // box, or for a foul, the six-yard box.
          clip.holder === clip.shooter ? clip.injuredLimit : Infinity
        ),
        x: clamp(
          clip.movers[clip.holder]!.x +
            ((towards.x - clip.movers[clip.holder]!.x) / gap) * reach +
            clip.rng.between(-3, 3),
          3,
          pitchWidth - 3
        )
      };
      dribble(clip, Math.round(seconds * clipFps), to, speed);
    }
    if (clip.holder === clip.shooter) {
      // Found out of range, the shooter carries it on until they are in it.
      // With too little time left for that, they try their luck from range,
      // carrying it only to 30 m.
      const goal = { d: pitchLength, x: 34 };
      const out = distance(clip.movers[clip.shooter]!, goal);
      const reach =
        perFrame(intoRangePace) *
        Math.max(0, shooterReadyBy - clip.frame - clipFps / 2);
      // A blocked shot stays a shot, carried only as far as there is time.
      const blocked = outcomeKind(clip.outcome) === 'clearance';
      // Found further out than a short carry into range, they shoot from
      // range instead, carried no nearer than 28 m, rather than run a long
      // way with it.
      const carried = clip.foundAt
        ? distance(clip.foundAt, clip.movers[clip.shooter]!)
        : 0;
      const carryLeft = Math.max(0, longestCarry - carried);
      // A shot found a little further out than that is struck from up to
      // 25 m.
      const tooFar = out - carryLeft > stretchedShot;
      if (
        clip.finish === 'shot' &&
        !blocked &&
        (out - reach > longestShot - 2 || tooFar)
      ) {
        clip.finish = 'long-range';
      }
      const furthest =
        clip.finish === 'long-range'
          ? longestLongRange
          : Math.max(longestShot, Math.min(out - carryLeft, stretchedShot) + 2);
      if (
        (clip.finish === 'shot' || clip.finish === 'long-range') &&
        out > furthest
      ) {
        const metres = out - (furthest - 2);
        const way =
          distance(clip.movers[clip.shooter]!, clip.shootingSpot) || 1;
        // Carried no further than what is left of the short carry: a shot
        // from range further only as it must be to get within 30 m, whatever
        // the time; one to be blocked only as there is time, and it is
        // blocked from there.
        const along = Math.min(
          metres,
          way,
          blocked
            ? Math.min(reach, carryLeft)
            : Math.max(carryLeft, out - longestLongRange)
        );
        const to = {
          d:
            clip.movers[clip.shooter]!.d +
            ((clip.shootingSpot.d - clip.movers[clip.shooter]!.d) / way) *
              along,
          x:
            clip.movers[clip.shooter]!.x +
            ((clip.shootingSpot.x - clip.movers[clip.shooter]!.x) / way) * along
        };
        dribble(
          clip,
          Math.ceil((along / intoRangePace) * clipFps) + clipFps / 2,
          to,
          intoRangePace
        );
      }
      break;
    }
    if (clip.frame > clip.maxBuildUp) {
      clip.passesMade = Math.max(clip.passesMade, clip.passCount - 1);
    }
    // Over time, the holder plays it at once, in the air if it is long.
    const overTime = clip.frame > clip.maxBuildUp;
    // Still too far out for the shooter to be found in range, the holder
    // plays one more pass forward first, while there is time for it.
    // How far up the ball must be for the back line, holding its distance
    // from it, to have dropped to where the shooter waiting onside can run
    // onto the final pass at the shooting spot.
    const finalPassFrom = clip.shootingSpot.d - backLineAhead - finalRunOn;
    const tooFar = finalPassFrom - clip.ball.d > 2 * carryReach;
    if (
      passesLeft(clip) === 1 &&
      !fromWide(clip) &&
      clip.finish !== 'one-on-one' &&
      tooFar &&
      !clip.extraPass &&
      clip.frame + 2 * clipFps < clip.maxBuildUp
    ) {
      clip.extraPass = true;
      clip.passCount++;
    }
    if (passesLeft(clip) <= 1 && !fromWide(clip) && !overTime) {
      // Far from goal, the holder carries the ball on before the final pass:
      // into passing range of the shooter, and near enough that the back
      // line, holding its distance from the ball, has dropped to where the
      // shooter, waiting onside, can run onto the pass in range.
      const mover = clip.movers[clip.holder]!;
      const gap = distance(mover, clip.shootingSpot);
      const toLine = finalPassFrom - mover.d;
      if (gap > finalPassRange || toLine > 0) {
        const speed = clip.rng.between(5.5, 7);
        const metres = Math.min(
          Math.max(gap - finalPassRange + 2, toLine + 2),
          2 * speed
        );
        const to = {
          d: mover.d + ((clip.shootingSpot.d - mover.d) / gap) * metres,
          x: mover.x + ((clip.shootingSpot.x - mover.x) / gap) * metres
        };
        dribble(clip, Math.round((metres / speed) * clipFps), to, speed);
      }
    }
    if (fromWide(clip) && passesLeft(clip) <= 1) {
      goWide(clip);
      break;
    }
    const receiver = nextReceiver(clip);
    if (fromWide(clip) && receiver === clip.shooter) {
      // The shooter waits in the box for the cross.
      goWide(clip);
      break;
    }
    if (receiver === clip.shooter && clip.outcome === 'interception') {
      // The final pass is the one cut out.
      break;
    }
    pass(clip, receiver);
  }
  if (clip.holder === clip.shooter && clip.outcome === 'interception') {
    clip.outcome = 'block';
  }
  // A shooter on the ball can be tackled before they shoot: half the blocks
  // of a shot, picked from a stream of their own. Only the shooter is
  // tackled, so a cross can't be.
  const onTheBall =
    clip.holder === clip.shooter &&
    (clip.finish === 'shot' || clip.finish === 'long-range');
  if (
    clip.outcome === 'block' &&
    onTheBall &&
    clip.input.outcome === undefined &&
    clip.tackleRng.next() < tackleShare
  ) {
    clip.outcome = 'tackle';
  }
  if (clip.outcome === 'tackle' && clip.holder !== clip.shooter) {
    clip.outcome = 'block';
  }
  // Whether the block is made sliding in waits on who makes it (#238).
  clip.slidingBlockRoll =
    clip.outcome === 'block' ? clip.tackleRng.next() : undefined;
  // Left with the ball themselves, the shooter can't head a cross, nor
  // have one put in for them.
  if (fromWide(clip) && clip.holder === clip.shooter) {
    clip.finish = clip.finish === 'header' ? 'shot' : clip.finish;
    clip.cross = undefined;
    if (clip.outcome === 'claim' || clip.outcome === 'punch') {
      clip.outcome = 'hold';
    }
  }

  // Waiting to cross, the crosser holds the ball while the header runs in,
  // so they can meet it at a pace a player can run.
  // A cut-back is played from the byline at once, slowed for a shooter
  // further off rather than held.
  if (
    fromWide(clip) &&
    clip.restart !== 'corner' &&
    clip.cross !== 'cut-back'
  ) {
    waitOnIt(
      clip,
      () =>
        distance(clip.movers[clip.shooter]!, clip.shootingSpot) >
        reach(crossFlight(clip.ball, clip.shootingSpot) + clipFps / 2),
      new Map([[clip.shooter, waitingSpot(clip)]])
    );
  }

  // Through on goal from further out, the shooter runs on with the ball.
  if (clip.finish === 'one-on-one' && clip.holder === clip.shooter) {
    // At most a few seconds' run: from further out, the shot comes sooner.
    const runOn = Math.min(
      pitchLength - 16 - clip.movers[clip.shooter]!.d,
      7 * 4
    );
    if (runOn > 0) {
      // Time to get up to speed, too.
      dribble(
        clip,
        Math.round((runOn / 7) * clipFps) + clipFps / 2,
        { d: pitchLength - 16, x: lerp(clip.ball.x, 34, 0.5) },
        7
      );
    }
  }
};

/** The zoom, as the camera closes in on the shooter. */
export const playZoom = (clip: Clip) => {
  // The zoom: the shooter takes a touch towards goal as the camera closes in.
  // Offside no longer matters once the shooter has the ball in range.
  clip.zoomStart = clip.frame;
  clip.buildingUp = false;
  // Running late, the camera closes in quicker.
  const zoomFrames = clip.frame > shooterReadyBy ? clipFps / 2 : clipFps;
  // Before an interception the passer has the ball; a corner taker waits.
  // Through on goal, the shooter carries it on and the keeper comes out;
  // waiting for a cross, the shooter makes for the spot to meet it.
  const through = clip.finish === 'one-on-one' && clip.holder === clip.shooter;
  const touch = through
    ? {
        d: Math.min(clip.movers[clip.shooter]!.d + 6, pitchLength - 10),
        x: lerp(clip.ball.x, 34, 0.3)
      }
    : clip.holder === clip.shooter
      ? {
          d: Math.min(
            clip.movers[clip.shooter]!.d + 1.5,
            // Injured, they take it no nearer the box.
            clip.injured
              ? Math.max(clip.movers[clip.shooter]!.d, clip.injuredLimit)
              : 100
          ),
          x: clip.ball.x
        }
      : clip.restart === 'corner'
        ? { d: clip.movers[clip.holder]!.d, x: clip.movers[clip.holder]!.x }
        : { d: Math.min(clip.movers[clip.holder]!.d + 1, 100), x: clip.ball.x };
  const waiting = clip.restart === 'corner' && clip.holder !== clip.shooter;
  const zoomChase = new Map<number, Point>();
  if (fromWide(clip)) {
    zoomChase.set(clip.shooter, waitingSpot(clip));
  }
  for (let f = 0; f < zoomFrames; f++) {
    clip.cameraWidth = lerp(cameraWide, cameraZoomed, ease(f / zoomFrames));
    if (through && clip.keeperSlot >= 0) {
      zoomChase.set(clip.keeperSlot, {
        d: pitchLength - keeperRushes,
        x: lerp(34, clip.ball.x, 0.5)
      });
    }
    if (clip.restart === 'penalty') {
      // The taker waits, then steps up to the ball over the last frames,
      // everyone else still until it is struck.
      const taker = clip.movers[clip.shooter]!;
      const to = { d: clip.ball.d - 0.7, x: clip.ball.x - 0.3 };
      const gap = distance(taker, to);
      const left = zoomFrames - f;
      const runUp = Math.ceil(gap / perFrame(penaltyRunUp));
      if (left <= runUp && gap > 0) {
        const step = Math.min(gap, perFrame(penaltyRunUp));
        taker.d += ((to.d - taker.d) / gap) * step;
        taker.x += ((to.x - taker.x) / gap) * step;
      }
      aimAt(clip, clip.shooter, clip.ball, true);
      steer(clip, clip.frame, new Set(clip.movers.keys()));
      record(clip);
      clip.frame++;
    } else if (waiting) {
      // The ball stays on the corner spot until it is crossed.
      steer(clip, clip.frame, new Set([clip.holder]), zoomChase);
      record(clip);
      clip.frame++;
    } else {
      dribble(clip, 1, touch, through ? 5.5 : 1.5, zoomChase);
    }
  }
  clip.cameraWidth = cameraZoomed;
  // A corner crossed in the moment keeps its card until it is taken.
  if (waiting) {
    clip.cardEnd = Math.max(clip.cardEnd, clip.frame);
  }
};
