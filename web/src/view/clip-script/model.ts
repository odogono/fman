import type { Moment } from '../../sim/moments';

/** Frames a second, as the sim counts them. */
export const clipFps = 50;
/** The pitch, in metres: across the screen, then up and down it. */
export const pitchWidth = 68;
export const pitchLength = 105;
/** The patch of pitch the camera shows across, in metres, and zoomed in. */
export const cameraWide = 40;
export const cameraZoomed = 30;
/** The camera's patch is this much taller than it is wide. */
export const cameraAspect = 5 / 4;
/**
 * The tallest the camera's patch may grow, height over width, where the
 * screen leaves a taller box: the width stays the same, so a tall phone
 * sees more of the pitch's length, never a closer picture.
 */
export const tallestCameraAspect = 2;
/**
 * The shortest the patch may get, where a phone on its side leaves a box
 * wider than the camera's shape: square, 40 m by 40 m.
 */
export const shortestCameraAspect = 1;
/**
 * The match-time card shows over a clip's first 1.5 s, or until a restart
 * is taken, sliding in and out over this many frames.
 */
export const cardFrames = 75;
export const cardSlide = 10;
/** How long a wipe between pictures takes, in frames: 0.8 s. */
export const wipeFrames = 40;
/** How long the goal announcement shows from the moment: 2.5 s. */
export const goalFrames = 125;

/**
 * The goal announcement, from the moment a goal goes in: `at` frames in, of
 * `length`, the scorer's name and the minute, and the new score, home
 * first.
 */
export type ClipGoal = Readonly<{
  at: number;
  length: number;
  minute: string;
  name: string;
  score: readonly number[];
}>;

/**
 * A save: a dive, a catch or a parry, or the keeper coming off their line
 * to catch a cross before it can be headed, or to punch it away (#224).
 */
export type SaveOutcome = 'claim' | 'dive' | 'hold' | 'parry' | 'punch';
export type ClearanceOutcome = 'block' | 'interception' | 'tackle';
export type MissOutcome = 'over' | 'post' | 'wide-left' | 'wide-right';
/**
 * How a moment plays out: a goal, a kind of save, a kind of clearance
 * (#150) or a kind of near miss.
 */
export type ClipOutcome = 'goal' | ClearanceOutcome | MissOutcome | SaveOutcome;
/**
 * The saves the seed picks from evenly. A claim is picked apart from them,
 * only for a cross, so every other save plays as it did before claims.
 */
export const saveOutcomes: readonly SaveOutcome[] = ['dive', 'hold', 'parry'];
export const clearanceOutcomes: readonly ClearanceOutcome[] = [
  'interception',
  'block',
  'tackle'
];
export const missOutcomes: readonly MissOutcome[] = [
  'post',
  'wide-left',
  'wide-right',
  'over'
];

/**
 * How the build-up starts: in open play, or from a free kick, a throw-in,
 * a goal kick or a corner. A penalty (#211) has no build-up: the seed never
 * picks it, and only a penalty moment plays it.
 */
export type Restart =
  'corner' | 'free-kick' | 'goal-kick' | 'open-play' | 'penalty' | 'throw-in';
export const restarts: readonly Restart[] = [
  'open-play',
  'free-kick',
  'throw-in',
  'goal-kick',
  'corner'
];
export const restartNames: Record<Restart, string> = {
  corner: 'Corner',
  'free-kick': 'Free kick',
  'goal-kick': 'Goal kick',
  'open-play': '',
  penalty: 'Penalty',
  'throw-in': 'Throw-in'
};

/**
 * How the chance is finished: a shot from the edge of the box, a header
 * from a cross or a corner, a shot from long range, or a run through on
 * the keeper.
 */
export type Finish = 'header' | 'long-range' | 'one-on-one' | 'shot';
export const finishes: readonly Finish[] = [
  'shot',
  'header',
  'long-range',
  'one-on-one'
];

/**
 * A ball in from wide that isn't headed at goal (#224): a low cross driven
 * in, or a cut-back from the byline, met first time; a cross headed clear
 * by a defender; one half-cleared to the edge of the box and struck from
 * there; or one the keeper comes and punches away.
 */
export type Cross =
  'cut-back' | 'half-clear' | 'headed-clear' | 'low' | 'punch';
export const crosses: readonly Cross[] = [
  'low',
  'cut-back',
  'headed-clear',
  'half-clear',
  'punch'
];

/** Where a player lines up. */
export type Line = 'attack' | 'defence' | 'keeper' | 'midfield';
export type ClipPlayer = Readonly<{
  /** Readiness to play, 1 to 20; a player without one is never tired. */
  energy?: number;
  label: string;
  line: Line;
  /**
   * Football ability, 1 to 5 (#234); a player without one plays as an
   * average one, 3.
   */
  skill?: number;
}>;

/** One side in a clip: its kit, its goalkeeper's colour and its 11 or fewer. */
export type ClipSide = Readonly<{
  keeper: string;
  kit: string;
  players: readonly ClipPlayer[];
}>;

export type ClipInput = Readonly<{
  /** The side that made the chance, and the side defending it. */
  attack: ClipSide;
  /** The attacking side shoots up the screen. */
  attackingUp: boolean;
  /**
   * Forces a ball in from wide that isn't headed at goal (#224), or none
   * with `null`, for the debug page; the seed picks otherwise.
   */
  cross?: Cross | null;
  defence: ClipSide;
  /** Forces how the chance is finished, for the debug page. */
  finish?: Finish;
  /**
   * For an injury caused by a tackle (#211): the tackle was a foul in the
   * penalty area, so the player goes down in the box and play stops.
   */
  foul?: boolean;
  kind: Moment['kind'];
  minute: number;
  /** Forces the outcome, for the debug page; the seed picks it otherwise. */
  outcome?: ClipOutcome;
  /**
   * A goal, save or near miss from the penalty spot (#211): no build-up,
   * the ball on the spot, everyone else outside the box and the D.
   */
  penalty?: boolean;
  /** Forces a rebound, or none, for the debug page. */
  rebound?: boolean;
  /** Forces how the build-up starts, for the debug page. */
  restart?: Restart;
  /**
   * The score after this moment, home first, for the goal announcement;
   * it plays no part in the clip.
   */
  score: readonly number[];
  seed: number;
  /** The named player: an index into `attack.players`. */
  shooter: number;
  /**
   * For an injury (#110): whether a tackle caused it, and who made it, an
   * index into `defence.players`. Left out, a tackle did, from the nearest
   * defender.
   */
  tackled?: boolean;
  tackler?: number;
}>;

/** What a player is doing, for the drawing. */
export type Pose =
  | 'celebrate'
  | 'cheer'
  | 'dive'
  | 'fall'
  | 'getup'
  | 'head'
  | 'header'
  | 'hold'
  | 'jump'
  | 'kick'
  /** The cup celebration's captain lifting the cup: facing down only. */
  | 'lift'
  | 'run'
  | 'slide'
  /** A loser of a cup final, slumped: facing down only. */
  | 'slump'
  | 'stand'
  | 'tackle';
export const poses: readonly Pose[] = [
  'run',
  'header',
  'dive',
  'celebrate',
  'head',
  'hold',
  'kick',
  'stand',
  'cheer',
  'jump',
  'slide',
  'tackle',
  'fall',
  'getup',
  'lift',
  'slump'
];
/** Poses drawn side on only, facing left or right. */
export const sideOn: ReadonlySet<Pose> = new Set([
  'dive',
  'fall',
  'getup',
  'tackle'
]);
/** Poses whose frame the clip sets, rather than the ground covered. */
export const framedPoses: ReadonlySet<Pose> = new Set([
  'fall',
  'getup',
  'header',
  'jump',
  'lift',
  'slump',
  'tackle'
]);
/** Which way a player faces on the screen. */
export type Facing = 'down' | 'left' | 'right' | 'up';
export const facings: readonly Facing[] = ['up', 'down', 'left', 'right'];
/**
 * A state shown by a status icon over a player's head, in the zoomed view
 * only (#146). Only tiredness so far.
 */
export type Status = 'tired';
/** The most players a side shows tired in one clip. */
export const tiredPerSide = 3;
/**
 * The ball's height at a leaping header's forehead, as a frame's `height`
 * measures it: about 2 m up, just under the bar.
 */
export const headHeight = 0.8;
/** The advertising boards stand this far beyond the lines (#157). */
export const boardMetres = 3;
/**
 * The boards stand about 0.9 m tall: a ball this high, as a frame's `height`
 * measures it, clears them and goes into the crowd.
 */
export const boardTop = 0.36;

export type ClipPhase = 'build-up' | 'moment' | 'reaction' | 'zoom';

export type FramePlayer = Readonly<{
  facing: Facing;
  keeper: boolean;
  pose: Pose;
  /**
   * Which of a header's frames shows: crouching to jump, in the air, then
   * meeting the ball.
   */
  poseFrame?: number;
  side: 'attack' | 'defence';
  status?: Status;
  /** The ground they have covered in the clip so far, in metres. */
  travelled: number;
  x: number;
  y: number;
}>;
/** A header's frames: crouching, in the air, meeting the ball. */
export const headerFrames = 3;

/** The match-time card in a frame's top left. */
export type ClipCard = Readonly<{
  /** As "34′"; none on the still pitch at kick-off and full time. */
  minute?: string;
  /** How far it has slid in, from 0 out of sight to 1. */
  shown: number;
  /** The restart, such as "Free kick", or "Kick-off" or "Full time". */
  text?: string;
}>;

/** One frame of a clip, in metres on a pitch whose top edge is y = 0. */
export type ClipFrame = Readonly<{
  /** `height` is 0 on the ground, up to 1 well over the bar. */
  ball: Readonly<{ height: number; x: number; y: number }>;
  /** The middle of the patch on show, and its width. */
  camera: Readonly<{ width: number; x: number; y: number }>;
  /** The match-time card: the minute, and the restart or "Kick-off". */
  card?: ClipCard;
  /** The crowd is on its feet, after a goal (#157). */
  cheer?: boolean;
  /**
   * Coloured specks of confetti over the pitch, in metres, for the cup
   * celebration.
   */
  confetti?: readonly Readonly<{ colour: string; x: number; y: number }>[];
  /** The goal announcement, while it shows. */
  goal?: ClipGoal;
  /** The named player's label, in the zoomed view only. */
  label?: Readonly<{ text: string; x: number; y: number }>;
  /** The overview of the whole pitch shows, except while zoomed in. */
  minimap: boolean;
  phase: ClipPhase;
  players: readonly FramePlayer[];
  /**
   * The cup, for the cup celebration: where it stands on the pitch, and how
   * far above the ground its foot is, in metres.
   */
  trophy?: Readonly<{ raise: number; x: number; y: number }>;
}>;

export type ClipPass = Readonly<{
  /** The ball never reached the receiver: a keeper came and caught it. */
  cutOut?: true;
  end: number;
  from: string;
  /**
   * A pass in open play, the restart that starts the build-up, or a cross
   * from wide for a header.
   */
  kind: 'cross' | 'pass' | Exclude<Restart, 'open-play'>;
  /** The passer and receiver: indexes into `attack.players`. */
  passer: number;
  receiver: number;
  start: number;
  to: string;
}>;

export type ClipScript = Readonly<{
  /** The ball in from wide that wasn't headed at goal, if there was one. */
  cross?: Cross;
  finish: Finish;
  frame: (at: number) => ClipFrame;
  input: ClipInput;
  /** The clip's length in frames, as the sim holds it. */
  length: number;
  /** The frame the clip reaches its moment, when the score and ticker change. */
  momentFrame: number;
  outcome: ClipOutcome;
  passes: readonly ClipPass[];
  /** The frames each phase after the build-up starts. */
  phases: Readonly<{ moment: number; reaction: number; zoom: number }>;
  /** The first effort was parried back into the box, and the shooter struck again. */
  rebound: boolean;
  restart: Restart;
}>;

/** FNV-1a over a string: the clip's seed. */
export const hashSeed = (text: string) => {
  let hash = 0x81_1c_9d_c5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01_00_01_93);
  }
  return hash >>> 0;
};

/** The kind of moment an outcome plays. */
export const outcomeKind = (outcome: ClipOutcome): Moment['kind'] =>
  outcome === 'goal'
    ? 'goal'
    : outcome === 'claim' ||
        outcome === 'punch' ||
        (saveOutcomes as readonly string[]).includes(outcome)
      ? 'save'
      : (clearanceOutcomes as readonly string[]).includes(outcome)
        ? 'clearance'
        : 'near-miss';
