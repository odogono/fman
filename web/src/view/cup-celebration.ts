import { artPixelMetres } from './clip-sprites';
import {
  hashSeed,
  kickOffFrame,
  pitchWidth,
  type ClipFrame,
  type ClipSide,
  type Facing,
  type FramePlayer
} from './clips';

// The cup celebration: the scene Modern mode plays when the managed club
// wins the F.A. Cup final. Like a clip it is made up for show. It follows
// the original's timed celebration, so the beeps keep time: while the
// original draws its trophy the winners run in and gather round the cup,
// and the losers sink to the turf; while it prints its title the captain
// lifts the cup and the crowd stands; each row of its stars throws a burst
// of confetti. Then it holds on the lift.

/** How far the original's celebration has got, each part 0 to 1. */
export type CelebrationProgress = Readonly<{
  /** The rows of stars printed, 0 to 1 of nine. */
  stars: number;
  text: number;
  trophy: number;
}>;

/** The winners and the losers of the final, as the highlights dress them. */
export type CelebrationSides = Readonly<{
  losers: ClipSide;
  winners: ClipSide;
}>;

/** Where the winners gather: near the top goal, under the top stand. */
const huddle = { x: pitchWidth / 2, y: 16 } as const;
/** How far round the captain the others stand, across and up the pitch. */
const ring = { x: 4.6, y: 3.2 } as const;
/** The losers stay at least this far from the huddle. */
const clearOfHuddle = 9;
const cameraWidth = 30;
/** The frames a jump for joy holds each of its two frames. */
const jumpFrames = 9;
const bursts = 9;
const specksPerBurst = 22;

/**
 * Where the cup's foot stands for each of the lift's frames, in metres
 * above the ground: the hands' height in the art, over the head, then
 * arms straight up.
 */
const liftRaise: readonly number[] = [
  0.9,
  23 * artPixelMetres,
  26 * artPixelMetres
];

const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** The way to face, moving from one spot towards another. */
const facingTowards = (dx: number, dy: number): Facing =>
  Math.abs(dx) > Math.abs(dy)
    ? dx < 0
      ? 'left'
      : 'right'
    : dy < 0
      ? 'up'
      : 'down';

/** The captain: the winners' first player who isn't the keeper. */
const captainOf = (side: ClipSide) =>
  Math.max(
    0,
    side.players.findIndex(p => p.line !== 'keeper')
  );

/** Each of the others' place round the captain, the keeper's included. */
const ringSpot = (place: number, count: number) => {
  // A crescent round the front and sides, so nobody hides behind the cup.
  const angle = Math.PI * (-0.2 + (1.4 * (place + 0.5)) / count);
  return {
    x: huddle.x + Math.cos(angle) * ring.x,
    y: huddle.y + Math.sin(angle) * ring.y
  };
};

/** One burst's confetti, falling from the top of the shot as `clock` runs. */
const burst = (
  burst: number,
  clock: number,
  colours: readonly string[]
): NonNullable<ClipFrame['confetti']> =>
  Array.from({ length: specksPerBurst }, (_, i) => {
    const hash = hashSeed(`confetti|${burst}|${i}`);
    const span = 30;
    const fall = (((hash >>> 8) % 1000) / 1000) * span + clock * 0.06;
    const sway = Math.sin(clock / 20 + (hash % 7)) * 0.6;
    return {
      colour: colours[hash % colours.length]!,
      x: huddle.x - 14 + ((hash >>> 4) % 280) / 10 + sway,
      y: huddle.y - 14 + (fall % span)
    };
  });

/**
 * The scene at `progress`, `clock` frames into the screen. `still` draws
 * the lift from the start, without the run-in, the jumping or confetti,
 * for reduced motion.
 */
export const celebrationFrame = (
  sides: CelebrationSides,
  progress: CelebrationProgress,
  clock: number,
  still = false
): ClipFrame => {
  const gather = still ? 1 : ease(clamp01(progress.trophy));
  const lift = still ? 1 : clamp01(progress.text);
  const stars = still ? 0 : clamp01(progress.stars) * bursts;
  const start = kickOffFrame(sides.winners, sides.losers, '').players;
  const winners = start.filter(p => p.side === 'attack');
  const losers = start.filter(p => p.side === 'defence');
  const captain = captainOf(sides.winners);
  const liftFrame = lift < 0.35 ? -1 : lift < 0.65 ? 1 : 2;
  const others = winners.length - 1;
  const players: FramePlayer[] = winners.map((from, i): FramePlayer => {
    const to =
      i === captain
        ? huddle
        : ringSpot(i < captain ? i : i - 1, Math.max(1, others));
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const x = from.x + dx * gather;
    const y = from.y + dy * gather;
    const arrived = gather >= 1;
    if (i === captain && arrived && liftFrame >= 0) {
      return {
        ...from,
        facing: 'down',
        pose: 'lift',
        poseFrame: liftFrame,
        x,
        y
      };
    }
    if (!arrived) {
      return {
        ...from,
        facing: facingTowards(dx, dy),
        pose: 'cheer',
        travelled: Math.hypot(dx, dy) * gather,
        x,
        y
      };
    }
    if (still || lift === 0) {
      return { ...from, facing: 'down', pose: 'celebrate', x, y };
    }
    // A jump for joy, each player in their own time.
    const beat = Math.floor((clock + i * 4) / jumpFrames) % 2;
    return { ...from, facing: 'down', pose: 'jump', poseFrame: beat, x, y };
  });
  const sinking = still || gather > 0.5;
  for (const [i, from] of losers.entries()) {
    const dx = from.x - huddle.x;
    const dy = from.y - huddle.y;
    const away = Math.hypot(dx, dy) || 1;
    const push = Math.max(0, clearOfHuddle - away);
    players.push({
      ...from,
      facing: 'down',
      pose: sinking ? 'slump' : 'stand',
      poseFrame: i % 2,
      x: from.x + (dx / away) * push,
      y: from.y + (dy / away) * push
    });
  }
  const lifted = gather >= 1 && liftFrame >= 0;
  const trophy = lifted
    ? { raise: liftRaise[liftFrame]!, x: huddle.x, y: huddle.y }
    : // On the grass in front of the captain's spot until it is lifted.
      { raise: 0, x: huddle.x, y: huddle.y + 1.2 };
  const colours = [sides.winners.kit, '#ffffff', '#ffd700'];
  const confetti = Array.from({ length: Math.ceil(stars) }, (_, k) =>
    burst(k, clock, colours)
  ).flat();
  return {
    // The camera follows the ball, which the cup's presence hides.
    ball: { height: 0, x: huddle.x, y: huddle.y },
    // High enough to show the top stand over the huddle; the painter keeps
    // the camera from going further.
    camera: { width: cameraWidth, x: huddle.x, y: huddle.y - 10 },
    cheer: still || lift > 0,
    ...(confetti.length ? { confetti } : {}),
    minimap: false,
    phase: 'reaction',
    players,
    trophy
  };
};
