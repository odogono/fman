import { clamp, ease, lerp } from './geometry';
import {
  cameraWide,
  cardSlide,
  facings,
  goalFrames,
  poses,
  restartNames,
  wipeFrames,
  type ClipFrame,
  type ClipGoal,
  type ClipPhase,
  type ClipScript,
  type FramePlayer
} from './model';
import { type Clip } from './pitch';
import { tiredPlayers } from './setup';
import { gettingUp } from './tuning';

/** The clip's script, its frames worked out from the logs. */
export const writeScript = (clip: Clip): ClipScript => {
  const length = clip.frame;
  // A player down on the ground gets up over the last frames they spend
  // there: on hands and knees, then on one knee; from sitting, on one knee.
  const getUpIndex = poses.indexOf('getup');
  const lying = (at: number, i: number) => {
    const pose = poses[clip.poseLog[at]![i]!]!;
    return (
      pose === 'dive' ||
      ((pose === 'fall' || pose === 'tackle') &&
        clip.poseFrameLog[at]![i] === 1)
    );
  };
  for (let i = 0; i < clip.count; i++) {
    let start = -1;
    for (let at = 0; at < length; at++) {
      if (lying(at, i)) {
        start = start < 0 ? at : start;
        continue;
      }
      if (start >= 0) {
        const sat = poses[clip.poseLog[at - 1]![i]!] === 'tackle';
        const span = Math.min(
          sat ? gettingUp / 2 : gettingUp,
          Math.floor((at - start) / 2)
        );
        for (let k = at - span; k < at; k++) {
          clip.poseLog[k]![i] = getUpIndex;
          clip.poseFrameLog[k]![i] = sat || k >= at - span / 2 ? 1 : 0;
        }
        start = -1;
      }
    }
  }
  const sides = Array.from({ length: clip.count }, (_, i) =>
    i < clip.attackers.length ? ('attack' as const) : ('defence' as const)
  );
  const keepers = new Set([
    clip.attackKeeper,
    clip.defenceKeeper < 0 ? -1 : clip.attackers.length + clip.defenceKeeper
  ]);
  const phaseAt = (at: number): ClipPhase =>
    at < clip.zoomStart
      ? 'build-up'
      : at < clip.momentStart
        ? 'zoom'
        : at < clip.reactionStart
          ? 'moment'
          : 'reaction';
  const shooterLabel = clip.attackers[clip.shooter]?.label ?? '';
  const tired = tiredPlayers(clip.input);
  // The goal announcement is gone before the wipe out of the clip starts.
  const goalEnd =
    clip.outcome === 'goal'
      ? Math.min(clip.momentFrame + goalFrames, length - wipeFrames / 2)
      : 0;
  const goalAt = (at: number): ClipGoal | undefined =>
    at >= clip.momentFrame && at < goalEnd
      ? {
          at: at - clip.momentFrame,
          length: goalEnd - clip.momentFrame,
          minute: `${clip.input.minute}′`,
          name: shooterLabel,
          score: clip.input.score ?? (clip.input.attack.home ? [1, 0] : [0, 1])
        }
      : undefined;

  const frameAt = (at: number): ClipFrame => {
    const clamped = clamp(at, 0, length - 1);
    const low = Math.floor(clamped);
    const high = Math.min(length - 1, low + 1);
    const u = clamped - low;
    const [cx0, cy0, cw0] = clip.cameraTrack[low]!;
    const [cx1, cy1, cw1] = clip.cameraTrack[high]!;
    const width = lerp(cw0, cw1, u);
    const zoomed = width < cameraWide - 0.01;
    const players = sides.map((side, i): FramePlayer => ({
      facing: facings[clip.facingLog[low]![i]!]!,
      keeper: keepers.has(i),
      pose: poses[clip.poseLog[low]![i]!]!,
      ...(clip.poseFrameLog[low]![i]! >= 0
        ? { poseFrame: clip.poseFrameLog[low]![i]! }
        : {}),
      side,
      ...(zoomed && tired.has(i) ? { status: 'tired' as const } : {}),
      travelled: lerp(clip.travelLog[low]![i]!, clip.travelLog[high]![i]!, u),
      x: lerp(clip.xs[low]![i]!, clip.xs[high]![i]!, u),
      y: lerp(clip.ys[low]![i]!, clip.ys[high]![i]!, u)
    }));
    const [bx0, by0, bh0] = clip.balls[low]!;
    const [bx1, by1, bh1] = clip.balls[high]!;
    const named = players[clip.shooter];
    const goal = goalAt(clamped);
    return {
      ball: {
        height: lerp(bh0, bh1, u),
        x: lerp(bx0, bx1, u),
        y: lerp(by0, by1, u)
      },
      camera: { width, x: lerp(cx0, cx1, u), y: lerp(cy0, cy1, u) },
      ...(clip.outcome === 'goal' && low >= clip.reactionStart
        ? { cheer: true }
        : {}),
      ...(clamped < clip.cardEnd
        ? {
            card: {
              minute: `${clip.input.minute}′`,
              shown: ease(
                Math.min(
                  1,
                  clamped / cardSlide,
                  (clip.cardEnd - clamped) / cardSlide
                )
              ),
              ...(restartNames[clip.restart]
                ? { text: restartNames[clip.restart] }
                : {})
            }
          }
        : {}),
      ...(goal ? { goal } : {}),
      // The announcement names the scorer while it shows.
      ...(named && zoomed && !goal
        ? { label: { text: shooterLabel, x: named.x, y: named.y } }
        : {}),
      minimap: !zoomed,
      phase: phaseAt(low),
      players
    };
  };

  return {
    ...(clip.cross ? { cross: clip.cross } : {}),
    finish: clip.finish,
    frame: frameAt,
    input: clip.input,
    length,
    momentFrame: clip.momentFrame,
    outcome: clip.outcome,
    passes: clip.passes,
    phases: {
      moment: clip.momentStart,
      reaction: clip.reactionStart,
      zoom: clip.zoomStart
    },
    rebound: clip.rebound,
    restart: clip.restart
  };
};
