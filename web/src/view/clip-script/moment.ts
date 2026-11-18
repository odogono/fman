import { outcomeKind } from './model';
import { playClearance, playHeadedClear } from './moment-clearance';
import { playCrossIn } from './moment-cross';
import { playShot } from './moment-shot';
import { playTackle } from './moment-tackle';
import { type Clip } from './pitch';
import { crossWidth } from './tuning';

/** The moment: the shot, or whatever stops it, and how it ends. */
export const playMoment = (clip: Clip) => {
  // A cross to be headed clear comes from wide; with the ball still in the
  // middle, the pass is cut out as any other is.
  if (
    clip.cross === 'headed-clear' &&
    Math.abs(clip.ball.x - 34) < crossWidth
  ) {
    clip.cross = undefined;
  }

  clip.momentStart = clip.frame;
  clip.offside = false;
  clip.side = clip.rng.next() < 0.5 ? -1 : 1;
  clip.shotFrom = { d: clip.ball.d, x: clip.ball.x };
  clip.keeper =
    clip.keeperSlot >= 0 ? clip.movers[clip.keeperSlot]! : undefined;
  if (clip.outcome === 'tackle') {
    playTackle(clip);
  } else if (clip.cross === 'headed-clear') {
    playHeadedClear(clip);
  } else if (outcomeKind(clip.outcome) === 'clearance') {
    playClearance(clip);
  } else {
    // For a header the cross comes first: from the crosser, or the corner
    // flag, to the shooter, who runs on, crouches and leaps to meet it. A
    // low ball in (#224) comes first too, driven along the ground for the
    // shooter to strike first time.
    playShot(clip, playCrossIn(clip));
  }
};
