import { playBuildUp, playRestart, playZoom } from './clip-script/build-up';
import { writeScript } from './clip-script/frames';
import { lateralSpots } from './clip-script/geometry';
import {
  cameraWide,
  pitchLength,
  pitchWidth,
  type ClipFrame,
  type ClipInput,
  type ClipScript,
  type ClipSide,
  type FramePlayer,
  type Line
} from './clip-script/model';
import { playMoment } from './clip-script/moment';
import { setThePitch } from './clip-script/pitch';
import { playReaction } from './clip-script/reaction';
import { decideClip } from './clip-script/setup';

// Modern mode's sprite highlights (#144): each moment plays as a clip, the
// build-up, the moment and the reaction, at real-world pace. Everything in a
// clip but the moment is made up for show from a seed of the clip's own, so
// the same moment always plays the same clip and nothing in it touches the
// game. A script is worked out whole, frame by frame, when it is made.
//
// The script is played in stages, each in a module of its own under
// `clip-script/`: the decisions made from the seed (`setup.ts`), the pitch
// the stages share (`pitch.ts`), the build-up and the zoom (`build-up.ts`,
// with the holder's carries and passes in `passing.ts`), the moment
// (`moment.ts` and the `moment-*.ts` beside it), the reaction
// (`reaction.ts`), and the frames worked out from what was written as it
// played (`frames.ts`).

export {
  boardMetres,
  boardTop,
  cameraAspect,
  cameraWide,
  cameraZoomed,
  cardFrames,
  clearanceOutcomes,
  clipFps,
  crosses,
  finishes,
  goalFrames,
  hashSeed,
  headerFrames,
  headHeight,
  missOutcomes,
  outcomeKind,
  pitchLength,
  pitchWidth,
  restarts,
  saveOutcomes,
  shortestCameraAspect,
  tallestCameraAspect,
  tiredPerSide,
  wipeFrames
} from './clip-script/model';
export type {
  ClearanceOutcome,
  ClipCard,
  ClipFrame,
  ClipGoal,
  ClipInput,
  ClipOutcome,
  ClipPass,
  ClipPhase,
  ClipPlayer,
  ClipScript,
  ClipSide,
  Cross,
  Facing,
  Finish,
  FramePlayer,
  Line,
  MissOutcome,
  Pose,
  Restart,
  SaveOutcome,
  Status
} from './clip-script/model';
export { seededOutcome } from './clip-script/setup';

/**
 * Plays out a clip. Positions are worked out in the attacking side's own
 * terms, `d` metres up from its own goal line and `x` across from its left,
 * then turned to the screen.
 */
export const createClipScript = (input: ClipInput): ClipScript => {
  const clip = setThePitch(decideClip(input));
  playRestart(clip);
  playBuildUp(clip);
  playZoom(clip);
  playMoment(clip);
  playReaction(clip);
  return writeScript(clip);
};

/**
 * Both sides standing in shape with the ball on the centre spot, as under
 * the "Kick-off" and "Full time" cards. `home` shoots up the screen.
 */
export const kickOffFrame = (
  home: ClipSide,
  away: ClipSide,
  caption: string
): ClipFrame => {
  const depths: Record<Line, number> = {
    attack: 48,
    defence: 20,
    keeper: 4,
    midfield: 35
  };
  const place = (side: ClipSide, up: boolean, team: 'attack' | 'defence') => {
    const spots = lateralSpots(side.players);
    return side.players.map((p, i): FramePlayer => {
      const d = depths[p.line];
      const x = pitchWidth * spots[i]!;
      return {
        facing: up ? 'up' : 'down',
        keeper: p.line === 'keeper',
        pose: 'stand',
        side: team,
        travelled: 0,
        x: up ? x : pitchWidth - x,
        y: up ? pitchLength - d : d
      };
    });
  };
  return {
    ball: { height: 0, x: pitchWidth / 2, y: pitchLength / 2 },
    camera: { width: cameraWide, x: pitchWidth / 2, y: pitchLength / 2 },
    card: { shown: 1, text: caption },
    minimap: true,
    phase: 'build-up',
    players: [...place(home, true, 'attack'), ...place(away, false, 'defence')]
  };
};
