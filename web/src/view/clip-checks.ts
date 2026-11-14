import {
  clipFps,
  outcomeKind,
  pitchLength,
  pitchWidth,
  type ClipFrame,
  type ClipPass,
  type ClipScript,
  type Facing
} from './clips';

// Checks a clip for play that looks wrong: passes that face away, crawl or
// run through a defender, players standing inside each other, a scattered
// back line, a defender scoring from open play. The clip debugger shows
// what they find over the pitch, and the tests hold the engine to them.

export type ClipIssueKind =
  | 'ball-behind-carrier'
  | 'ball-jumps'
  | 'crowded'
  | 'facing-away'
  | 'facing-flicker'
  | 'long-back-pass'
  | 'long-ground-pass'
  | 'long-shot'
  | 'pass-through-defender'
  | 'receiver-misses'
  | 'scattered-back-line'
  | 'sharp-turn'
  | 'slow-build-up'
  | 'slow-pass'
  | 'unlikely-scorer';

export const clipIssueKinds: readonly ClipIssueKind[] = [
  'ball-behind-carrier',
  'ball-jumps',
  'crowded',
  'facing-away',
  'facing-flicker',
  'long-back-pass',
  'long-ground-pass',
  'long-shot',
  'pass-through-defender',
  'receiver-misses',
  'scattered-back-line',
  'sharp-turn',
  'slow-build-up',
  'slow-pass',
  'unlikely-scorer'
];

export type ClipIssue = Readonly<{
  /** The last frame it shows in. */
  end: number;
  kind: ClipIssueKind;
  message: string;
  /** The players involved: indexes into a frame's `players`. */
  players: readonly number[];
  start: number;
}>;

/** The limits the checks hold a clip to. */
export const clipLimits = {
  /**
   * Off a pass's flight, the ball's speed changes by no more than this in a
   * frame, in metres a second: more, and it jumps at a player's feet.
   */
  ballJump: 6,
  /** A ball carried at a run is within this angle of the way they go. */
  carrierAngle: Math.PI / 4,
  /** A carrier is running at this pace or more, in metres a second. */
  carrierSpeed: 4,
  /** Two players closer than this, in metres, stand inside each other. */
  crowded: 0.7,
  /** For at least this many frames. */
  crowdedFrames: 5,
  /** A defender comes no closer than this to a pass along the ground. */
  defenderClearance: 0.9,
  /** A passer faces within this angle of the pass. */
  facingAngle: Math.PI / 3,
  /** A player who turns this many times within the frames after flickers. */
  flickerFrames: clipFps / 2,
  flickerTurns: 3,
  /** The longest pass back, in metres, and how far back makes it one. */
  longestBackPass: 15,
  longestGroundPass: 30,
  /** A pass at least this long, in metres, keeps at least this pace. */
  paceFrom: 9,
  passPace: 10,
  /** The receiver is this close to the ball as a pass arrives. */
  receiverReach: 1.5,
  /** A shot is struck within this far of goal, in metres. */
  longestShot: 32,
  /** The moment starts within this many frames of the clip's start. */
  momentBy: 15 * clipFps,
  /** A back line spread deeper than this, in metres, is scattered. */
  scattered: 6,
  /** For at least this many frames. */
  scatteredFrames: clipFps,
  /** A receiver on the move turns no more than this as the ball is played. */
  throwInPace: 8,
  turnAngle: Math.PI / 4
} as const;

type At = Readonly<{ x: number; y: number }>;
const gap = (a: At, b: At) => Math.hypot(a.x - b.x, a.y - b.y);
const facingVector: Readonly<Record<Facing, readonly [number, number]>> = {
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1]
};
const cosine = (ax: number, ay: number, bx: number, by: number) =>
  (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by) || 1);
const degrees = (cos: number) =>
  Math.round((Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI);

/**
 * Runs of frames where `flag` holds, at least `least` frames long, each
 * with the frame it starts on.
 */
const runs = (
  from: number,
  to: number,
  flag: (at: number) => boolean,
  least: number
) => {
  const found: { end: number; start: number }[] = [];
  let start = -1;
  for (let at = from; at <= to + 1; at++) {
    const on = at <= to && flag(at);
    if (on && start < 0) {
      start = at;
    } else if (!on && start >= 0) {
      if (at - start >= least) {
        found.push({ end: at - 1, start });
      }
      start = -1;
    }
  }
  return found;
};

const checkPass = (
  script: ClipScript,
  frames: readonly ClipFrame[],
  pass: ClipPass,
  final: boolean
): ClipIssue[] => {
  const issues: ClipIssue[] = [];
  const add = (
    kind: ClipIssueKind,
    message: string,
    players: readonly number[] = [pass.passer, pass.receiver],
    start = pass.start,
    end = pass.end
  ) => issues.push({ end, kind, message, players, start });
  const last = frames.length - 1;
  const from = frames[pass.start]!;
  const to = frames[Math.min(pass.end, last)]!;
  const metres = gap(from.ball, to.ball);
  const seconds = (pass.end - pass.start) / clipFps;
  const name = `${pass.from || `#${pass.passer}`} → ${pass.to || `#${pass.receiver}`}`;

  // The passer faces where they play it.
  const passer = from.players[pass.passer]!;
  const aimed = gap(passer, to.ball);
  if (aimed >= 2) {
    const [fx, fy] = facingVector[passer.facing];
    const cos = cosine(fx, fy, to.ball.x - passer.x, to.ball.y - passer.y);
    if (cos < Math.cos(clipLimits.facingAngle)) {
      add(
        'facing-away',
        `${name}: passer faces ${degrees(cos)}° off the pass`,
        [pass.passer],
        pass.start,
        pass.start + 10
      );
    }
  }

  const middle = frames[Math.round((pass.start + pass.end) / 2)]!;
  const lofted = middle.ball.height > 0;
  if (!lofted && metres > clipLimits.longestGroundPass) {
    add('long-ground-pass', `${name}: ${metres.toFixed(0)} m along the ground`);
  }

  const pace = metres / seconds;
  const least =
    pass.kind === 'throw-in' ? clipLimits.throwInPace : clipLimits.passPace;
  if (!pass.cutOut && metres >= clipLimits.paceFrom && pace < least) {
    add(
      'slow-pass',
      `${name}: ${pace.toFixed(1)} m/s over ${metres.toFixed(0)} m`
    );
  }

  // A pass a keeper came and caught never reaches its receiver.
  const receiver = to.players[pass.receiver]!;
  const missed = gap(receiver, to.ball);
  if (!pass.cutOut && missed > clipLimits.receiverReach) {
    add(
      'receiver-misses',
      `${name}: receiver ${missed.toFixed(1)} m from the ball`,
      [pass.receiver],
      pass.end,
      pass.end
    );
  }

  // Defenders never cut out a pass, so none stands in its way.
  if (!lofted) {
    for (let at = pass.start + 5; at < pass.end - 5; at++) {
      const frame = frames[at]!;
      if (frame.ball.height > 0) {
        break;
      }
      const near = frame.players.findIndex(
        p =>
          p.side === 'defence' &&
          gap(p, frame.ball) < clipLimits.defenderClearance
      );
      if (near >= 0) {
        add('pass-through-defender', `${name}: runs through a defender`, [
          pass.passer,
          pass.receiver,
          near
        ]);
        break;
      }
    }
  }

  // Shooting up the screen, a pass back goes down it.
  const back =
    (to.ball.y - from.ball.y) * (script.input.attackingUp ? 1 : -1) > 5;
  if (
    pass.kind === 'pass' &&
    !final &&
    back &&
    metres > clipLimits.longestBackPass
  ) {
    add('long-back-pass', `${name}: ${metres.toFixed(0)} m back`);
  }

  // The receiver runs on, without turning sharply as it is played.
  if (pass.start >= 2) {
    const [a, b, c] = [-2, -1, 0].map(
      k => frames[pass.start + k]!.players[pass.receiver]!
    );
    const before = [b!.x - a!.x, b!.y - a!.y] as const;
    const after = [c!.x - b!.x, c!.y - b!.y] as const;
    const running = [before, after].every(
      ([x, y]) => Math.hypot(x, y) * clipFps >= 2
    );
    const cos = cosine(...before, ...after);
    if (running && cos < Math.cos(clipLimits.turnAngle)) {
      add(
        'sharp-turn',
        `${name}: receiver turns ${degrees(cos)}° as it is played`,
        [pass.receiver],
        pass.start - 2,
        pass.start + 2
      );
    }
  }
  return issues;
};

/** Every problem a clip shows, in the order they start. */
export const checkClip = (script: ClipScript): ClipIssue[] => {
  const frames = Array.from({ length: script.length }, (_, at) =>
    script.frame(at)
  );
  const { input, passes, phases } = script;
  const attackers = input.attack.players.length;
  const issues: ClipIssue[] = passes.flatMap((pass, k) =>
    checkPass(script, frames, pass, k === passes.length - 1)
  );

  // The carrier keeps the ball ahead, the way they run.
  const inPass = (at: number) =>
    passes.some(p => at >= p.start - 2 && at <= p.end + 2);
  const carrier = (at: number) => passes.findLast(p => p.end <= at)?.receiver;
  const behind = (at: number) => {
    const holder = carrier(at);
    if (at < 1 || inPass(at) || holder === undefined) {
      return false;
    }
    const was = frames[at - 1]!.players[holder]!;
    const now = frames[at]!.players[holder]!;
    const vx = now.x - was.x;
    const vy = now.y - was.y;
    if (Math.hypot(vx, vy) * clipFps < clipLimits.carrierSpeed) {
      return false;
    }
    const { ball } = frames[at]!;
    return (
      cosine(ball.x - now.x, ball.y - now.y, vx, vy) <
      Math.cos(clipLimits.carrierAngle)
    );
  };
  for (const run of runs(1, phases.zoom - 1, behind, 1)) {
    issues.push({
      ...run,
      kind: 'ball-behind-carrier',
      message: 'the ball trails the way its carrier runs',
      players: [carrier(run.start)!]
    });
  }

  // At a player's feet the ball changes speed smoothly: it never stops dead
  // as a pass arrives, springs back to the receiver or jumps round them.
  const inFlight = (at: number) =>
    passes.some(p => at >= p.start - 1 && at <= p.end);
  const ballStep = (at: number) => ({
    x: frames[at]!.ball.x - frames[at - 1]!.ball.x,
    y: frames[at]!.ball.y - frames[at - 1]!.ball.y
  });
  const jumps = (at: number) => {
    if (at < 2 || inFlight(at) || carrier(at) === undefined) {
      return false;
    }
    const now = ballStep(at);
    const was = ballStep(at - 1);
    return (
      Math.hypot(now.x - was.x, now.y - was.y) * clipFps > clipLimits.ballJump
    );
  };
  for (const run of runs(2, phases.moment - 1, jumps, 1)) {
    issues.push({
      ...run,
      kind: 'ball-jumps',
      message: 'the ball jumps at its carrier’s feet',
      players: [carrier(run.start)!]
    });
  }

  // No two players stand inside each other, until the reaction's huddles.
  const count = frames[0]!.players.length;
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const close = (at: number) =>
        gap(frames[at]!.players[i]!, frames[at]!.players[j]!) <
        clipLimits.crowded;
      for (const run of runs(
        0,
        phases.reaction - 1,
        close,
        clipLimits.crowdedFrames
      )) {
        // Each by side and place in it, as the debugger's player ids show.
        const [a, b] = [i, j].map(k =>
          k < attackers ? `attack #${k}` : `defence #${k - attackers}`
        );
        issues.push({
          ...run,
          kind: 'crowded',
          message: `${a} and ${b} stand inside each other`,
          players: [i, j]
        });
      }
    }
  }

  // The back line holds together, but for one defender stepping out of it,
  // such as to close the ball down: its depth without whichever one makes
  // it deepest.
  const backLine = input.defence.players.flatMap((p, j) =>
    p.line === 'defence' ? [attackers + j] : []
  );
  const spread = (at: number) => {
    const depths = backLine
      .map(i => frames[at]!.players[i]!.y)
      .toSorted((a, b) => a - b);
    if (depths.length < 3) {
      return 0;
    }
    return Math.min(depths.at(-1)! - depths[1]!, depths.at(-2)! - depths[0]!);
  };
  if (backLine.length >= 3) {
    for (const run of runs(
      0,
      phases.zoom - 1,
      at => spread(at) > clipLimits.scattered,
      clipLimits.scatteredFrames
    )) {
      issues.push({
        ...run,
        kind: 'scattered-back-line',
        message: `the back line is up to ${Math.max(
          ...Array.from({ length: run.end - run.start + 1 }, (_, k) =>
            spread(run.start + k)
          )
        ).toFixed(0)} m deep`,
        players: backLine
      });
    }
  }

  // No one turns back and forth: three turns within half a second flicker.
  // A turn to kick the ball is meant, so it doesn't count.
  for (let i = 0; i < count; i++) {
    const turns: number[] = [];
    for (let at = 1; at < frames.length; at++) {
      const player = frames[at]!.players[i]!;
      if (
        player.pose !== 'kick' &&
        player.facing !== frames[at - 1]!.players[i]!.facing
      ) {
        turns.push(at);
      }
    }
    const last = clipLimits.flickerTurns - 1;
    for (let k = last; k < turns.length; k++) {
      if (turns[k]! - turns[k - last]! <= clipLimits.flickerFrames) {
        const side = i < attackers ? 'attack' : 'defence';
        issues.push({
          end: turns[k]!,
          kind: 'facing-flicker',
          message: `${side} #${i < attackers ? i : i - attackers} turns ${clipLimits.flickerTurns} times in half a second`,
          players: [i],
          start: turns[k - last]!
        });
        break;
      }
    }
  }

  // The build-up gets to the point: the moment starts within 15 s.
  if (phases.moment > clipLimits.momentBy) {
    issues.push({
      end: phases.moment,
      kind: 'slow-build-up',
      message: `the moment starts ${(phases.moment / clipFps).toFixed(1)} s in`,
      players: [],
      start: clipLimits.momentBy
    });
  }

  // A shot is struck in range; a header's moment starts with the cross.
  const struck = frames[phases.moment]!.ball;
  const out = Math.hypot(
    struck.x - pitchWidth / 2,
    struck.y - (input.attackingUp ? 0 : pitchLength)
  );
  if (
    script.finish !== 'header' &&
    outcomeKind(script.outcome) !== 'clearance' &&
    out > clipLimits.longestShot
  ) {
    issues.push({
      end: phases.moment,
      kind: 'long-shot',
      message: `the shot is struck ${Math.round(out)} m out`,
      players: [input.shooter],
      start: phases.moment
    });
  }

  // Defenders and keepers score mostly from set pieces.
  const shooter = input.attack.players[input.shooter];
  if (
    shooter &&
    (shooter.line === 'defence' || shooter.line === 'keeper') &&
    script.restart !== 'corner' &&
    script.restart !== 'free-kick'
  ) {
    issues.push({
      end: phases.moment,
      kind: 'unlikely-scorer',
      message: `a ${shooter.line === 'keeper' ? 'keeper' : 'defender'} shoots after ${script.restart === 'open-play' ? 'open play' : `a ${script.restart}`}`,
      players: [input.shooter],
      start: 0
    });
  }
  return issues.toSorted((a, b) => a.start - b.start || a.end - b.end);
};
