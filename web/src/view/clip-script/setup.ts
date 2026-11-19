import type { Moment } from '../../sim/moments';
import { clamp, lateralSpots } from './geometry';
import {
  clipFps,
  hashSeed,
  outcomeKind,
  pitchLength,
  pitchWidth,
  saveOutcomes,
  tiredPerSide,
  type ClearanceOutcome,
  type ClipInput,
  type ClipOutcome,
  type ClipPlayer,
  type Cross,
  type Finish,
  type MissOutcome,
  type Restart,
  type SaveOutcome
} from './model';
import {
  challengeShare,
  claimShare,
  crossShare,
  injuredFrom,
  parryLean,
  penaltySpot,
  reboundShare,
  sixYards
} from './tuning';

/**
 * The clearances the seed picks from evenly. A tackle is picked apart from
 * them, from a block of a shooter on the ball, so other clips play as before.
 */
const drawnClearances: readonly ClearanceOutcome[] = ['interception', 'block'];

/** mulberry32: a small stream of its own, apart from the game's RND. */
export const createClipRng = (seed: number) => {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d_2b_79_f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  return {
    between: (low: number, high: number) => low + (high - low) * next(),
    /**
     * As `between`, leaning towards `high` for `lean` above 0 and `low`
     * below it, from -1 to 1, as a player's quality does (#234). With no
     * lean it draws as `between`.
     */
    int: (low: number, high: number) =>
      low + Math.floor(next() * (high - low + 1)),
    leaning: (low: number, high: number, lean: number) =>
      low + (high - low) * next() ** (2 ** -lean),
    next,
    pick: <T>(list: readonly T[]) => list[Math.floor(next() * list.length)]!
  };
};
export type ClipRng = ReturnType<typeof createClipRng>;

/**
 * A near miss goes wide most often, as in the original, where only a few
 * hit the post (#150): wide 60%, split by side, over the bar 25%, post 15%.
 */
export const drawMiss = (rng: ClipRng): MissOutcome => {
  const roll = rng.next();
  return roll < 0.3
    ? 'wide-left'
    : roll < 0.6
      ? 'wide-right'
      : roll < 0.85
        ? 'over'
        : 'post';
};

/**
 * How good a player is, from -1 for the least skilled to 1 for the most,
 * an average one or one without a skill 0 (#234).
 */
export const qualityOf = (player: ClipPlayer | undefined) =>
  (clamp(player?.skill ?? 3, 1, 5) - 3) / 2;

/**
 * A save: a dive, a hold or a parry, evenly for an average keeper. A
 * better keeper parries fewer, holding them instead (#235).
 */
const drawSave = (rng: ClipRng, keeper: number): SaveOutcome => {
  const roll = rng.next();
  const parries = (1 - parryLean * keeper) / 3;
  return roll < 1 / 3 ? 'dive' : roll < 1 - parries ? 'hold' : 'parry';
};

/**
 * The outcome the seed picks for a kind. An injury (#110) plays as the
 * injured player being tackled, or pulling up, and staying down. `keeper`
 * is the defending keeper's quality.
 */
export const drawOutcome = (
  rng: ClipRng,
  kind: Moment['kind'],
  keeper = 0
): ClipOutcome =>
  kind === 'injury'
    ? 'tackle'
    : kind === 'goal'
      ? 'goal'
      : kind === 'save'
        ? drawSave(rng, keeper)
        : kind === 'clearance'
          ? rng.pick(drawnClearances)
          : drawMiss(rng);

/** The outcome a clip's seed picks for a kind: the clip's first draw. */
export const seededOutcome = (seed: number, kind: Moment['kind']) =>
  drawOutcome(createClipRng(seed), kind);

/**
 * Who shows tired in a clip: each player with a chance of
 * `(1 - energy / 20) * minute / 90`, so more often late on and when
 * spent, and at most three a side. It draws from a stream of its own off
 * the clip's seed, so the rest of the clip plays as it would without it.
 */
export const tiredPlayers = (input: ClipInput) => {
  const rng = createClipRng(hashSeed(`${input.seed}|tired`));
  const late = clamp(input.minute / 90, 0, 1);
  const tired = new Set<number>();
  let offset = 0;
  for (const side of [input.attack, input.defence]) {
    const rolled = side.players.flatMap((p, i) => {
      const roll = rng.next();
      if (p.energy === undefined) {
        return [];
      }
      const chance = (1 - clamp(p.energy, 0, 20) / 20) * late;
      return roll < chance ? [{ i: offset + i, margin: roll / chance }] : [];
    });
    for (const { i } of rolled
      .toSorted((a, b) => a.margin - b.margin)
      .slice(0, tiredPerSide)) {
      tired.add(i);
    }
    offset += side.players.length;
  }
  return tired;
};

/** How much a ball in the air bends, from a stream of its own. */
export const curl = (clip: Setup, low: number, high: number) =>
  clip.curlRng.between(low, high) * (clip.curlRng.next() < 0.5 ? -1 : 1);
/** The ball comes in from wide: a cross to be headed, or one of these. */
export const fromWide = (
  clip: Readonly<{ cross: Cross | undefined; finish: Finish }>
) =>
  clip.finish === 'header' ||
  (clip.cross !== undefined && clip.cross !== 'punch');

/** The decisions made before a clip plays, all from its seed. */
export const decideClip = (input: ClipInput) => {
  const rng = createClipRng(input.seed);
  const attackers = input.attack.players;
  const defenders = input.defence.players;
  const keeperQuality = qualityOf(defenders.find(p => p.line === 'keeper'));
  const drawnOutcome =
    input.outcome ?? drawOutcome(rng, input.kind, keeperQuality);
  const count = attackers.length + defenders.length;
  const attackSpots = lateralSpots(attackers);
  const defenceSpots = lateralSpots(defenders);
  // Each player has a little way of their own: a set offset and a sway.
  const quirks = Array.from({ length: count }, () => ({
    d: rng.between(-3, 3),
    period: rng.between(3, 5) * clipFps,
    phase: rng.between(0, Math.PI * 2),
    x: rng.between(-2.5, 2.5)
  }));
  const shooter = clamp(input.shooter, 0, Math.max(0, attackers.length - 1));
  const attackKeeper = attackers.findIndex(p => p.line === 'keeper');
  const defenceKeeper = defenders.findIndex(p => p.line === 'keeper');
  const keeperSlot = defenceKeeper < 0 ? -1 : attackers.length + defenceKeeper;

  // The ball starts in the attacking side's own half, with a player who
  // isn't the shooter if anyone else can start it.
  const ballStart = { d: rng.between(20, 45), x: rng.between(10, 58) };
  const outfield = attackers.flatMap((p, i) =>
    p.line === 'keeper' && i !== shooter ? [] : [i]
  );
  const others = outfield.filter(i => i !== shooter);
  // An interception needs someone to make the final pass; alone, the
  // shooter is blocked instead.
  let outcome: ClipOutcome =
    drawnOutcome === 'interception' && !others.length ? 'block' : drawnOutcome;
  /** An injury (#110): tackled, or pulling up, the player stays down. */
  const injured = input.kind === 'injury';
  const pulledUp = injured && input.tackled === false;
  /** A foul in the box (#211): the player goes down in it, and play stops. */
  const foul = injured && !pulledUp && input.foul === true;
  /** Any other injury is kept out of the box, so it never looks a penalty. */
  const keptOut = injured && !foul;
  /**
   * The nearest an injured player gets to goal, in metres up the pitch:
   * short of the box, or for a foul, short of the six-yard box.
   */
  const injuredLimit = keptOut
    ? pitchLength - injuredFrom
    : foul
      ? pitchLength - sixYards
      : Infinity;
  /** A chance from the penalty spot (#211), with no build-up. */
  const penalty =
    input.penalty === true && !injured && outcomeKind(outcome) !== 'clearance';
  /** The penalty's set-up and the foul's spot, from a stream of their own. */
  const penaltyRng = createClipRng(hashSeed(`${input.seed}|penalty`));
  const deep = others.filter(i => attackers[i]!.line !== 'attack');
  let starter = others.length ? rng.pick(deep.length ? deep : others) : shooter;
  // Of the build-ups, 40% start in open play, 20% each from a free kick and
  // a throw-in, and 10% each from a goal kick and a corner. A side with no
  // keeper but the shooter takes no goal kick.
  const restartRoll = rng.next();
  const goalKicker =
    attackKeeper >= 0 && attackKeeper !== shooter ? attackKeeper : -1;
  // A defender or keeper who shoots has come up for a set piece: a corner
  // 60% of the time, a free kick 40%.
  const setPiece =
    attackers[shooter]?.line === 'defence' ||
    attackers[shooter]?.line === 'keeper';
  const drawn: Restart =
    input.restart ??
    (setPiece ? (restartRoll < 0.6 ? 'corner' : 'free-kick') : undefined) ??
    (restartRoll < 0.4
      ? 'open-play'
      : restartRoll < 0.6
        ? 'free-kick'
        : restartRoll < 0.8
          ? 'throw-in'
          : restartRoll < 0.9
            ? 'goal-kick'
            : 'corner');
  const restart: Restart = penalty
    ? 'penalty'
    : !others.length || (drawn === 'goal-kick' && goalKicker < 0)
      ? 'open-play'
      : drawn;

  // How the chance is finished, from a stream of its own so a shot plays
  // as it would without the others. Every corner, and a defender's or
  // keeper's free kick, is headed in; a clearance and a lone player always
  // shoot.
  const finishRng = createClipRng(hashSeed(`${input.seed}|finish`));
  /** How much each ball in the air bends, from a stream of its own. */
  const curlRng = createClipRng(hashSeed(`${input.seed}|curl`));
  const finishRoll = finishRng.next();
  const odds: readonly (readonly [Finish, number])[] =
    attackers[shooter]?.line === 'attack'
      ? [
          ['header', 0.25],
          ['one-on-one', 0.2],
          ['long-range', 0.05]
        ]
      : [
          ['header', 0.15],
          ['one-on-one', 0.1],
          ['long-range', 0.3]
        ];
  let roll = finishRoll;
  const drawnFinish: Finish =
    restart === 'corner' || setPiece
      ? 'header'
      : (odds.find(([, chance]) => (roll -= chance) < 0)?.[0] ?? 'shot');
  let finish: Finish =
    outcomeKind(outcome) === 'clearance' || penalty
      ? 'shot'
      : restart === 'corner'
        ? 'header'
        : (input.finish ?? drawnFinish);
  // Catching a cross needs a cross.
  if (outcome === 'claim') {
    finish = 'header';
  }
  if (finish === 'header' && !others.length) {
    finish = 'shot';
  }
  if (outcome === 'claim' && (finish !== 'header' || keeperSlot < 0)) {
    outcome = 'hold';
  }
  // A ball in from wide that isn't headed at goal (#224), from a stream of
  // its own. It needs someone to put it in, and open play to come from.
  const crossRng = createClipRng(hashSeed(`${input.seed}|cross`));
  const canCross =
    others.length > 0 &&
    !penalty &&
    !injured &&
    restart !== 'corner' &&
    attackers[shooter]?.line !== 'keeper';
  // Unforced, about a third of shots, of shots from range and of clearances
  // that cut out the final ball come from one; a low ball in is a cut-back
  // half the time.
  const crossRoll = crossRng.next();
  const cutBackRoll = crossRng.next();
  const seeded: Cross | undefined =
    crossRoll >= crossShare
      ? undefined
      : finish === 'shot' && outcomeKind(outcome) !== 'clearance'
        ? cutBackRoll < 0.5
          ? 'cut-back'
          : 'low'
        : finish === 'long-range' && outcomeKind(outcome) !== 'clearance'
          ? 'half-clear'
          : undefined;
  // Two in three cut-out final balls, so a third of all clearances.
  const headedClear = outcome === 'interception' && crossRoll < 2 * crossShare;
  let cross: Cross | undefined =
    input.cross === null
      ? undefined
      : input.cross
        ? canCross || input.cross === 'punch'
          ? input.cross
          : undefined
        : canCross
          ? (seeded ?? (headedClear ? 'headed-clear' : undefined))
          : undefined;
  // A low ball in, or a cut-back, is met first time for a shot.
  if (
    (cross === 'low' || cross === 'cut-back') &&
    outcomeKind(outcome) !== 'clearance'
  ) {
    finish = 'shot';
  } else if (cross === 'low' || cross === 'cut-back') {
    cross = undefined;
  }
  // A cross half-cleared is struck from range.
  if (cross === 'half-clear' && outcomeKind(outcome) !== 'clearance') {
    finish = 'long-range';
  } else if (cross === 'half-clear') {
    cross = undefined;
  }
  // A cross punched away is a save from a cross meant to be headed.
  if (
    cross === 'punch' &&
    outcomeKind(outcome) === 'save' &&
    keeperSlot >= 0 &&
    !penalty
  ) {
    finish = 'header';
    outcome = 'punch';
  } else if (cross === 'punch') {
    cross = undefined;
  }
  // A cross headed clear is a final ball cut out.
  if (cross === 'headed-clear' && outcomeKind(outcome) === 'clearance') {
    outcome = 'interception';
  } else if (cross === 'headed-clear') {
    cross = undefined;
  }
  const touchline = rng.next() < 0.5 ? 0 : pitchWidth;
  if (restart === 'throw-in') {
    ballStart.d = rng.between(20, 80);
    ballStart.x = touchline;
  } else if (restart === 'free-kick') {
    ballStart.d = rng.between(30, 70);
    ballStart.x = rng.between(12, 56);
  } else if (restart === 'goal-kick') {
    starter = goalKicker;
    ballStart.d = 5.5;
    ballStart.x = 34 + (touchline === 0 ? -9.16 : 9.16);
  } else if (restart === 'corner') {
    ballStart.d = pitchLength - 0.3;
    ballStart.x = touchline === 0 ? 0.3 : pitchWidth - 0.3;
  } else if (restart === 'penalty') {
    starter = shooter;
    ballStart.d = pitchLength - penaltySpot;
    ballStart.x = 34;
  }
  const shootingSpot = {
    d: pitchLength - rng.between(11, 22),
    x: 34 + rng.between(-14, 14)
  };
  if (restart === 'corner') {
    // From a corner the shooter meets the cross in the box.
    shootingSpot.d = pitchLength - rng.between(6, 12);
    shootingSpot.x = 34 + rng.between(-6, 6);
  } else if (cross === 'half-clear') {
    // Half-cleared, it drops to the shooter at the edge of the box.
    shootingSpot.d = pitchLength - crossRng.between(19, 25);
    shootingSpot.x = 34 + crossRng.between(-8, 8);
  } else if (cross === 'headed-clear') {
    // The cross is aimed six to eleven metres out, as for a header.
    shootingSpot.d = pitchLength - crossRng.between(6, 11);
    shootingSpot.x = 34 + crossRng.between(-6, 6);
  } else if (cross === 'cut-back') {
    // A cut-back is met first time, ten to sixteen metres out.
    shootingSpot.d = pitchLength - crossRng.between(10, 16);
    shootingSpot.x = 34 + crossRng.between(-6, 6);
  } else if (cross === 'low') {
    // A low cross is met first time, seven to thirteen metres out.
    shootingSpot.d = pitchLength - crossRng.between(7, 13);
    shootingSpot.x = 34 + crossRng.between(-8, 8);
  } else if (finish === 'header') {
    // A cross is met six to eleven metres out.
    shootingSpot.d = pitchLength - finishRng.between(6, 11);
    shootingSpot.x = 34 + finishRng.between(-6, 6);
  } else if (finish === 'long-range') {
    shootingSpot.d = pitchLength - finishRng.between(22, 30);
    shootingSpot.x = 34 + finishRng.between(-12, 12);
  } else if (finish === 'one-on-one') {
    // Through on goal, centrally, with the keeper to beat.
    shootingSpot.d = pitchLength - finishRng.between(14, 18);
    shootingSpot.x = 34 + finishRng.between(-5, 5);
  }
  // An injured player is found outside the box, with room to take the
  // pass in their stride; one fouled, in it.
  if (keptOut) {
    shootingSpot.d = Math.min(shootingSpot.d, injuredLimit - 3);
  } else if (foul) {
    shootingSpot.d = pitchLength - penaltyRng.between(11, 14);
    shootingSpot.x = 34 + penaltyRng.between(-10, 10);
  }
  // Of the saves from a cross, some are the keeper coming to catch it.
  if (
    finish === 'header' &&
    keeperSlot >= 0 &&
    input.outcome === undefined &&
    (saveOutcomes as readonly string[]).includes(outcome) &&
    finishRng.next() < claimShare
  ) {
    outcome = 'claim';
  }
  // Of the other saves from a cross, a third are the keeper coming to punch
  // it away (#224), corners among them.
  if (
    input.cross === undefined &&
    input.outcome === undefined &&
    cross === undefined &&
    finish === 'header' &&
    keeperSlot >= 0 &&
    (saveOutcomes as readonly string[]).includes(outcome) &&
    crossRoll < crossShare
  ) {
    cross = 'punch';
    outcome = 'punch';
  }
  // Of the shots and headers that reach the keeper's goal, some are first
  // parried back out for the shooter to strike again, from a stream of
  // their own so every other clip plays as before.
  const reboundRng = createClipRng(hashSeed(`${input.seed}|rebound`));
  const rebound =
    !penalty &&
    (finish === 'shot' || finish === 'header') &&
    keeperSlot >= 0 &&
    outcome !== 'claim' &&
    outcome !== 'punch' &&
    outcomeKind(outcome) !== 'clearance' &&
    (input.rebound ?? reboundRng.next() < reboundShare);
  const passCount = others.length ? rng.int(2, 4) : 0;
  const minBuildUp = 6 * clipFps;
  /**
   * Past this, no one carries the ball on; past the next, the shooter is
   * found. A cross or a ball through takes time of its own after, so its
   * build-up is cut shorter.
   */
  const setUp =
    finish === 'one-on-one' || cross === 'cut-back'
      ? 3
      : fromWide({ cross, finish })
        ? 2
        : 0;
  const lastCarry = (7 - setUp) * clipFps;
  const maxBuildUp = (8 - setUp) * clipFps;
  // Some build-ups see a defender slide in on the ball, and the carrier
  // skip past: picked from a stream of its own, so other clips play as
  // before.
  const challengeRng = createClipRng(hashSeed(`${input.seed}|challenge`));
  const wantsChallenge = challengeRng.next() < challengeShare;
  // A shooter on the ball can be tackled before they shoot, from a stream
  // of its own.
  const tackleRng = createClipRng(hashSeed(`${input.seed}|tackle`));
  return {
    attackers,
    attackKeeper,
    attackSpots,
    ballStart,
    count,
    cross,
    crossRng,
    curlRng,
    defenceKeeper,
    defenceSpots,
    defenders,
    finish,
    finishRng,
    foul,
    injured,
    injuredLimit,
    input,
    keeperQuality,
    keeperSlot,
    keptOut,
    lastCarry,
    maxBuildUp,
    minBuildUp,
    others,
    outcome,
    outfield,
    passCount,
    penaltyRng,
    pulledUp,
    quirks,
    rebound,
    reboundRng,
    restart,
    rng,
    shooter,
    shooterQuality: qualityOf(attackers[shooter]),
    shootingSpot,
    starter,
    tackleRng,
    touchline,
    wantsChallenge
  };
};

export type Setup = ReturnType<typeof decideClip>;
