import { expect, setDefaultTimeout, test } from 'bun:test';

import { longestClip } from '../sim/ticker';
import { checkClip, type ClipIssueKind } from './clip-checks';
import { decideClip } from './clip-script/setup';
import { huddleReach, leapFrames } from './clip-script/tuning';
import {
  boardMetres,
  boardTop,
  cameraWide,
  cardFrames,
  clearanceOutcomes,
  clipFps,
  createClipScript,
  crosses,
  finishes,
  goalFrames,
  kickOffFrame,
  missOutcomes,
  outcomeKind,
  pitchLength,
  pitchWidth,
  restarts,
  saveOutcomes,
  seededOutcome,
  tiredPerSide,
  type ClipFrame,
  type ClipInput,
  type ClipScript,
  type ClipSide,
  type Line
} from './clips';

// Most of these tests build and play out a hundred clips or more, which is
// slow on a busy CI runner; bun's 5 s default is for ordinary tests.
setDefaultTimeout(20_000);

const lines: readonly Line[] = [
  'keeper',
  'defence',
  'defence',
  'defence',
  'defence',
  'midfield',
  'midfield',
  'midfield',
  'midfield',
  'attack',
  'attack'
];
const side = (kit: string, shape = lines): ClipSide => ({
  keeper: '#ff8c1a',
  kit,
  players: shape.map((line, i) => ({ label: `${kit} ${i}`, line }))
});
/** The card's minute and restart, as they read. */
const cardText = (frame: ClipFrame) =>
  [frame.card?.minute, frame.card?.text].filter(Boolean).join(' ');

const input = (overrides: Partial<ClipInput> = {}): ClipInput => ({
  attack: side('#d70000'),
  attackingUp: true,
  defence: side('#0000d7'),
  kind: 'goal',
  minute: 34,
  score: [1, 0],
  seed: 1234,
  shooter: 9,
  ...overrides
});

test('the same moment always plays the same clip', () => {
  const a = createClipScript(input());
  const b = createClipScript(input());
  expect(b.length).toBe(a.length);
  expect(b.momentFrame).toBe(a.momentFrame);
  expect(b.passes).toEqual(a.passes);
  for (const at of [0, 100.5, a.momentFrame, a.length - 1]) {
    expect(b.frame(at)).toEqual(a.frame(at));
  }
  // Another seed plays another clip.
  expect(createClipScript(input({ seed: 99 })).frame(200)).not.toEqual(
    a.frame(200)
  );
});

test('clips run at real-world pace, within what the sim holds', () => {
  for (let seed = 0; seed < 100; seed++) {
    for (const kind of ['goal', 'save', 'near-miss'] as const) {
      const script = createClipScript(input({ kind, seed }));
      // A corner's cross goes straight to the shooter.
      const corner = script.restart === 'corner';
      expect(script.length).toBeGreaterThanOrEqual((corner ? 8 : 10) * clipFps);
      expect(script.length).toBeLessThanOrEqual(35 * clipFps);
      expect(script.length).toBeLessThanOrEqual(longestClip);
      expect(Number.isInteger(script.length)).toBe(true);
      // The build-up, the zoom, the moment, then the reaction, in order.
      const { moment, reaction, zoom } = script.phases;
      // At least a few seconds' build-up, and the moment within 15 s. A
      // cross can come quickly, as on the break; a shot is worked for.
      expect(zoom).toBeGreaterThanOrEqual(
        (corner ? 3 : script.finish === 'header' || script.cross ? 3.5 : 6) *
          clipFps
      );
      expect(moment).toBeLessThanOrEqual(15 * clipFps);
      expect(zoom).toBeLessThan(moment);
      expect(script.momentFrame).toBeGreaterThan(moment);
      expect(script.momentFrame).toBeLessThan(reaction);
      expect(reaction).toBeLessThan(script.length);
      expect(script.passes.length).toBeGreaterThanOrEqual(corner ? 1 : 2);
      // A header adds the ball out wide, then the cross.
      expect(script.passes.length).toBeLessThanOrEqual(
        script.finish === 'header' ? 6 : 5
      );
      expect(script.passes.at(-1)!.to).toBe(`#d70000 ${9}`);
    }
  }
});

test('the seed picks each outcome of a save, a clearance and a near miss', () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < 100; seed++) {
    for (const kind of ['save', 'clearance', 'near-miss'] as const) {
      const { outcome } = createClipScript(input({ kind, seed }));
      expect(outcomeKind(outcome)).toBe(kind);
      seen.add(outcome);
    }
  }
  expect([...seen].sort()).toEqual(
    [
      ...saveOutcomes,
      'claim',
      'punch',
      ...clearanceOutcomes,
      ...missOutcomes
    ].sort()
  );
  expect(
    createClipScript(input({ kind: 'save', outcome: 'parry' })).outcome
  ).toBe('parry');
});

test('the clip reaches its moment as the ball reaches the goal line', () => {
  for (const attackingUp of [true, false]) {
    for (const outcome of ['goal', 'post', 'wide-left', 'over'] as const) {
      const script = createClipScript(
        input({ attackingUp, kind: outcomeKind(outcome), outcome })
      );
      const line = attackingUp ? 0 : pitchLength;
      const ball = script.frame(script.momentFrame).ball;
      expect(Math.abs(ball.y - line)).toBeLessThan(0.01);
      const before = script.frame(script.momentFrame - 1).ball;
      expect(Math.abs(before.y - line)).toBeGreaterThan(0.1);
    }
  }
});

test('a goal ends in the net; a miss beside or over it', () => {
  const goal = createClipScript(input({ outcome: 'goal' }));
  const net = goal.frame(goal.phases.reaction).ball;
  expect(net.y).toBeLessThan(0);
  expect(Math.abs(net.x - 34)).toBeLessThan(3.66 + 0.5);
  const wide = createClipScript(
    input({ kind: 'near-miss', outcome: 'wide-right' })
  );
  expect(Math.abs(wide.frame(wide.momentFrame).ball.x - 34)).toBeGreaterThan(
    3.66
  );
});

/** Short of the advertising boards. */
const inside = (at: { x: number; y: number }) =>
  at.x > -boardMetres &&
  at.x < pitchWidth + boardMetres &&
  at.y > -boardMetres &&
  at.y < pitchLength + boardMetres;

/** How far beyond the pitch's lines, in metres. */
const beyond = (at: { x: number; y: number }) =>
  Math.max(-at.x, at.x - pitchWidth, -at.y, at.y - pitchLength);

test('a ball wide or into touch comes back off the boards, and no one goes through them', () => {
  let bounced = 0;
  let over = 0;
  for (let seed = 0; seed < 40; seed++) {
    for (const outcome of ['wide-left', 'over', 'block'] as const) {
      const script = createClipScript(
        input({
          attackingUp: seed % 2 === 0,
          kind: outcome === 'block' ? 'clearance' : 'near-miss',
          outcome,
          seed
        })
      );
      const frames = Array.from({ length: script.length }, (_, at) =>
        script.frame(at)
      );
      for (const frame of frames) {
        expect(frame.players.every(inside)).toBe(true);
      }
      // Over the bar, it clears the boards; along the ground, it meets them.
      const crowd = frames.findIndex(f => !inside(f.ball));
      if (outcome === 'over') {
        expect(frames[crowd - 1]?.ball.height ?? 0).toBeGreaterThan(boardTop);
        over++;
        continue;
      }
      expect(crowd).toBe(-1);
      // Beyond a line, it runs out towards the boards, then back off them.
      const out = frames.map(f => beyond(f.ball));
      const furthest = Math.max(...out);
      if (furthest > boardMetres - 1 && out.at(-1)! < furthest - 0.3) {
        bounced++;
      }
    }
  }
  // Every miss wide reaches the boards, and a clearance does when it goes
  // into touch; every one over the bar goes into the crowd.
  expect(bounced).toBeGreaterThan(50);
  expect(over).toBe(40);
});

test('the sides change ends at half-time', () => {
  const first = createClipScript(input({ attackingUp: true }));
  const second = createClipScript(input({ attackingUp: false }));
  expect(first.frame(first.momentFrame).ball.y).toBeLessThan(1);
  expect(second.frame(second.momentFrame).ball.y).toBeGreaterThan(104);
});

test('the match-time card slides in and out over the first 1.5 s; the label only zoomed in', () => {
  const script = createClipScript(input({ restart: 'open-play' }));
  // From open play, the minute alone.
  expect(script.frame(0).card).toEqual({ minute: '34′', shown: 0 });
  expect(script.frame(5).card!.shown).toBeGreaterThan(0);
  expect(script.frame(5).card!.shown).toBeLessThan(1);
  expect(script.frame(cardFrames / 2).card!.shown).toBe(1);
  expect(script.frame(cardFrames - 5).card!.shown).toBeLessThan(1);
  expect(script.frame(cardFrames).card).toBeUndefined();
  const wide = script.frame(script.phases.zoom - 1);
  expect(wide.focus.across).toBe(cameraWide);
  expect(wide.label).toBeUndefined();
  expect(wide.minimap).toBe(true);
  // Just before the moment: a goal's announcement hides the label after.
  const zoomed = script.frame(script.momentFrame - 1);
  expect(zoomed.focus.across).toBeLessThan(cameraWide);
  expect(zoomed.label?.text).toBe('#d70000 9');
  expect(zoomed.minimap).toBe(false);
  expect(script.frame(script.length - 1).minimap).toBe(true);
});

test("a clip's subject is the ball, and after a goal the scorer", () => {
  for (let seed = 0; seed < 50; seed++) {
    const script = createClipScript(
      input({ kind: seed % 2 ? 'goal' : 'save', seed })
    );
    for (let at = 0; at < script.length; at += 10) {
      const { ball, players, subject } = script.frame(at);
      const kept =
        script.outcome === 'goal' && at >= script.phases.reaction
          ? players[9]!
          : ball;
      expect(subject.x).toBeCloseTo(kept.x, 6);
      expect(subject.y).toBeCloseTo(kept.y, 6);
    }
  }
});

test('a side picked short plays short, and a lone player shoots alone', () => {
  const short = createClipScript(
    input({
      attack: side('#d70000', ['defence', 'attack']),
      shooter: 1
    })
  );
  expect(short.frame(0).players.filter(p => p.side === 'attack')).toHaveLength(
    2
  );
  const alone = createClipScript(
    input({ attack: side('#d70000', ['attack']), shooter: 0 })
  );
  expect(alone.passes).toEqual([]);
  expect(alone.length).toBeGreaterThan(6 * clipFps);
  const keeperless = createClipScript(
    input({
      defence: side('#0000d7', ['defence', 'midfield']),
      kind: 'save'
    })
  );
  expect(keeperless.length).toBeGreaterThan(0);
});

/** How far up the pitch a frame's player is, in the attacking side's terms. */
const depth = (y: number) => pitchLength - y;

test('no one receives a pass from an offside position', () => {
  for (let seed = 0; seed < 150; seed++) {
    const script = createClipScript(input({ seed }));
    const labels = script.input.attack.players.map(p => p.label);
    for (const pass of script.passes) {
      if (pass.kind === 'throw-in' || pass.start === 0) {
        continue;
      }
      // As the ball is played: the receiver, the ball and the defenders.
      const frame = script.frame(pass.start - 1);
      const receiver = frame.players[labels.indexOf(pass.to)]!;
      const defenders = frame.players
        .filter(p => p.side === 'defence')
        .map(p => depth(p.y))
        .sort((a, b) => b - a);
      const line = Math.max(
        pitchLength / 2,
        depth(frame.ball.y),
        defenders[1] ?? 0
      );
      expect(depth(receiver.y)).toBeLessThanOrEqual(line + 0.3);
    }
  }
});

test('build-ups start in open play, from a free kick or from a throw-in', () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < 100; seed++) {
    const script = createClipScript(input({ seed }));
    seen.add(script.restart);
    if (script.restart !== 'open-play') {
      expect(script.passes[0]!.kind).toBe(script.restart);
    }
  }
  expect([...seen].sort()).toEqual([...restarts].sort());
});

test('a throw-in is taken from beyond the touchline, with the ball held', () => {
  const script = createClipScript(input({ restart: 'throw-in' }));
  const start = script.frame(0);
  expect(cardText(start)).toBe('34′ Throw-in');
  expect([0, 68]).toContain(start.ball.x);
  expect(start.ball.height).toBeGreaterThan(0);
  const thrower = start.players.find(p => p.pose === 'hold')!;
  expect(thrower.x < 0 || thrower.x > 68).toBe(true);
  expect(script.passes[0]!.kind).toBe('throw-in');
});

test('defenders stand back from a free kick until it is taken', () => {
  for (let seed = 0; seed < 30; seed++) {
    const script = createClipScript(input({ restart: 'free-kick', seed }));
    expect(cardText(script.frame(0))).toBe('34′ Free kick');
    const taken = script.passes[0]!;
    expect(taken.kind).toBe('free-kick');
    const set = script.frame(taken.start - 1);
    for (const p of set.players) {
      if (p.side === 'defence' && !p.keeper) {
        const gap = Math.hypot(p.x - set.ball.x, p.y - set.ball.y);
        expect(gap).toBeGreaterThan(8.5);
      }
    }
  }
});

test('a goal kick is taken by the keeper from the six-yard box, and goes long', () => {
  for (let seed = 0; seed < 20; seed++) {
    const script = createClipScript(input({ restart: 'goal-kick', seed }));
    expect(cardText(script.frame(0))).toBe('34′ Goal kick');
    const kick = script.passes[0]!;
    expect(kick).toMatchObject({ from: '#d70000 0', kind: 'goal-kick' });
    const start = script.frame(0).ball;
    expect(depth(start.y)).toBeCloseTo(5.5);
    const received = script.frame(kick.end).ball;
    expect(depth(received.y)).toBeGreaterThan(30);
  }
  // Without a keeper of its own, a side takes no goal kick.
  const keeperless = createClipScript(
    input({
      attack: side('#d70000', ['defence', 'midfield', 'attack']),
      restart: 'goal-kick',
      shooter: 2
    })
  );
  expect(keeperless.restart).toBe('open-play');
});

test('a corner is crossed from the flag to the shooter in the box', () => {
  for (let seed = 0; seed < 20; seed++) {
    const script = createClipScript(input({ restart: 'corner', seed }));
    expect(cardText(script.frame(0))).toBe('34′ Corner');
    const start = script.frame(0).ball;
    expect(depth(start.y)).toBeGreaterThan(104);
    expect(start.x < 1 || start.x > 67).toBe(true);
    expect(script.passes).toHaveLength(1);
    expect(script.passes[0]).toMatchObject({ kind: 'corner', to: '#d70000 9' });
    // The card holds until the corner is taken, after the zoom for a header.
    const taken = script.passes[0]!.start;
    expect(script.frame(taken - 1).card).toBeDefined();
    expect(script.frame(taken).card).toBeUndefined();
    const met = script.frame(script.passes[0]!.end).ball;
    expect(depth(met.y)).toBeGreaterThan(pitchLength - 16.5);
    expect(Math.abs(met.x - 34)).toBeLessThan(20.16);
  }
});

test('a near miss goes wide most often, rarely off the post', () => {
  const counts: Record<string, number> = {};
  const runs = 20_000;
  for (let seed = 0; seed < runs; seed++) {
    const outcome = seededOutcome(seed, 'near-miss');
    counts[outcome] = (counts[outcome] ?? 0) + 1;
  }
  // A clip plays the outcome its seed picks.
  for (let seed = 0; seed < 20; seed++) {
    expect(createClipScript(input({ kind: 'near-miss', seed })).outcome).toBe(
      seededOutcome(seed, 'near-miss')
    );
  }
  const share = (outcome: string) => (counts[outcome] ?? 0) / runs;
  expect(share('wide-left') + share('wide-right')).toBeCloseTo(0.6, 1);
  expect(share('over')).toBeCloseTo(0.25, 1);
  expect(share('post')).toBeCloseTo(0.15, 1);
});

test('a clearance reaches its moment as a defender meets the ball', () => {
  for (let seed = 0; seed < 100; seed++) {
    for (const outcome of clearanceOutcomes) {
      const script = createClipScript(
        input({ kind: 'clearance', outcome, seed })
      );
      expect(script.outcome).toBe(outcome);
      const { moment, reaction } = script.phases;
      expect(script.momentFrame).toBeGreaterThan(moment);
      expect(script.momentFrame).toBeLessThan(reaction);
      const met = script.frame(script.momentFrame);
      const gap = Math.min(
        ...met.players
          .filter(p => p.side === 'defence')
          .map(p => Math.hypot(p.x - met.ball.x, p.y - met.ball.y))
      );
      expect(gap).toBeLessThan(1.5);
      // The ball never reaches the goal.
      for (let at = script.momentFrame; at < script.length; at += 5) {
        expect(depth(script.frame(at).ball.y)).toBeLessThan(pitchLength - 1);
      }
    }
  }
});

test('an interception cuts out the final pass; a block stops the shot', () => {
  for (let seed = 0; seed < 50; seed++) {
    const cut = createClipScript(
      input({
        kind: 'clearance',
        outcome: 'interception',
        restart: 'open-play',
        seed
      })
    );
    // The shooter never receives: the pass to them is the one cut out, or
    // a cross headed clear (#224) that never reaches them.
    expect(cut.passes.every(p => p.to !== '#d70000 9' || p.cutOut)).toBe(true);
    const blocked = createClipScript(
      input({ kind: 'clearance', outcome: 'block', restart: 'open-play', seed })
    );
    expect(blocked.passes.at(-1)!.to).toBe('#d70000 9');
  }
  // Alone, the shooter has no one to pass, so is blocked instead.
  const alone = createClipScript(
    input({
      attack: side('#d70000', ['attack']),
      kind: 'clearance',
      outcome: 'interception',
      shooter: 0
    })
  );
  expect(alone.outcome).toBe('block');
});

test('the seed tackles a shooter on the ball, instead of blocking the shot', () => {
  let tackles = 0;
  let clearances = 0;
  for (let seed = 0; seed < 300; seed++) {
    const script = createClipScript(input({ kind: 'clearance', seed }));
    clearances++;
    if (script.outcome !== 'tackle') {
      continue;
    }
    tackles++;
    // Only the shooter, with the ball at their feet, is tackled.
    expect(script.finish === 'shot' || script.finish === 'long-range').toBe(
      true
    );
  }
  // Half the blocks of a shot: about a quarter of clearances.
  expect(tackles / clearances).toBeGreaterThan(0.15);
  expect(tackles / clearances).toBeLessThan(0.35);
  // A clearance is always a shot, so a forced tackle from a corner comes
  // after the corner is played short to the shooter.
  const short = createClipScript(
    input({ kind: 'clearance', outcome: 'tackle', restart: 'corner' })
  );
  expect(short.outcome).toBe('tackle');
  expect(short.passes.at(-1)!.to).toBe('#d70000 9');
});

test('a tackle slides in on the ball, and the shooter goes down and gets up', () => {
  for (let seed = 0; seed < 40; seed++) {
    const script = createClipScript(
      input({ kind: 'clearance', outcome: 'tackle', seed })
    );
    expect(script.outcome).toBe('tackle');
    const met = script.frame(script.momentFrame);
    const sliding = met.players.filter(p => p.pose === 'tackle');
    expect(sliding).toHaveLength(1);
    expect(sliding[0]!.side).toBe('defence');
    expect(
      Math.hypot(sliding[0]!.x - met.ball.x, sliding[0]!.y - met.ball.y)
    ).toBeLessThan(1.5);
    // The slide shows for a few frames before it meets the ball.
    expect(
      script
        .frame(script.momentFrame - 5)
        .players.some(p => p.pose === 'tackle')
    ).toBe(true);
    // The shooter stumbles, lies down, gets up on hands and knees, then on
    // one knee, and is up again before the clip ends.
    const seen: string[] = [];
    for (let at = script.momentFrame + 1; at < script.length; at++) {
      const { pose, poseFrame } = script.frame(at).players[9]!;
      const step = `${pose}${poseFrame ?? ''}`;
      if (seen.at(-1) !== step) {
        seen.push(step);
      }
    }
    expect(seen.slice(0, 4)).toEqual(['fall0', 'fall1', 'getup0', 'getup1']);
    expect(['run', 'stand']).toContain(
      script.frame(script.length - 1).players[9]!.pose
    );
  }
});

test('now and then a defender slides in on the carrier, who skips past', () => {
  let challenged = 0;
  const clips = 200;
  for (let seed = 0; seed < clips; seed++) {
    const script = createClipScript(input({ seed }));
    const { zoom } = script.phases;
    const start = Array.from({ length: zoom }, (_, at) => at).find(at =>
      script.frame(at).players.some(p => p.pose === 'tackle')
    );
    if (start === undefined) {
      continue;
    }
    challenged++;
    const slider = script
      .frame(start)
      .players.findIndex(p => p.pose === 'tackle');
    expect(script.frame(start).players[slider]!.side).toBe('defence');
    // The carrier keeps the ball: still at their feet once the slide is by.
    const carrier = script.passes.findLast(p => p.end <= start)?.receiver;
    const after = script.frame(start + 24);
    if (carrier !== undefined && start + 24 < zoom) {
      const runner = after.players[carrier]!;
      expect(
        Math.hypot(runner.x - after.ball.x, runner.y - after.ball.y)
      ).toBeLessThan(2);
    }
    // The slider sits up, then gets up, all before the zoom.
    const poses = Array.from(
      { length: zoom - start },
      (_, k) => script.frame(start + k).players[slider]!
    );
    expect(poses.some(p => p.pose === 'tackle' && p.poseFrame === 1)).toBe(
      true
    );
    expect(poses.some(p => p.pose === 'getup')).toBe(true);
    expect(['run', 'stand']).toContain(poses.at(-1)!.pose);
  }
  // About a quarter of clips.
  expect(challenged / clips).toBeGreaterThan(0.15);
  expect(challenged / clips).toBeLessThan(0.35);
});

test('some blocks are made sliding in', () => {
  let sliding = 0;
  for (let seed = 0; seed < 60; seed++) {
    const script = createClipScript(
      input({ kind: 'clearance', outcome: 'block', seed })
    );
    if (
      script.frame(script.momentFrame).players.some(p => p.pose === 'tackle')
    ) {
      sliding++;
    }
  }
  // Some, not all: half the blocks of a shooter on the ball are tackles,
  // half the rest are made sliding, and a defender who can't get across
  // to the shot at a run throws themselves at it (#226).
  expect(sliding).toBeGreaterThan(15);
  expect(sliding).toBeLessThan(55);
});

/** Lying or sitting on the ground, as a player is before getting up. */
const down = (pose: string, poseFrame?: number) =>
  pose === 'dive' ||
  ((pose === 'fall' || pose === 'tackle') && poseFrame === 1);

test('a player down on the ground gets up, never springing straight up', () => {
  const ground = new Set(['dive', 'fall', 'getup', 'tackle']);
  let getUps = 0;
  for (let seed = 0; seed < 60; seed++) {
    for (const outcome of ['dive', 'parry', 'tackle', 'block'] as const) {
      const script = createClipScript(
        input({ kind: outcomeKind(outcome), outcome, seed })
      );
      for (let at = 1; at < script.length; at++) {
        const before = script.frame(at - 1).players;
        script.frame(at).players.forEach((p, i) => {
          const was = before[i]!;
          if (ground.has(p.pose)) {
            // Drawn side on, facing left or right; up after a dive, the
            // way they lay.
            if (p.pose === 'fall' || p.pose === 'tackle') {
              expect(['left', 'right']).toContain(p.facing);
            }
            return;
          }
          // Up from the ground only by way of getting up.
          expect(down(was.pose, was.poseFrame)).toBe(false);
          if (was.pose === 'getup') {
            getUps++;
            expect(was.poseFrame).toBe(1);
          }
        });
      }
    }
  }
  expect(getUps).toBeGreaterThan(100);
});

test('the defender clears upfield or into touch', () => {
  let upfield = 0;
  let touch = 0;
  for (let seed = 0; seed < 100; seed++) {
    // A cross headed clear (#224) is cleared by the header itself.
    const script = createClipScript(
      input({ cross: null, kind: 'clearance', seed })
    );
    const meet = script.frame(script.momentFrame).ball;
    const end = script.frame(script.length - 1).ball;
    if (end.x < 0 || end.x > 68) {
      touch++;
    } else {
      expect(depth(meet.y) - depth(end.y)).toBeGreaterThan(25);
      upfield++;
    }
  }
  expect(upfield).toBeGreaterThan(20);
  expect(touch).toBeGreaterThan(20);
});

const spent = (kit: string, energy: number): ClipSide => {
  const plain = side(kit);
  return { ...plain, players: plain.players.map(p => ({ ...p, energy })) };
};

test("energy slows players (#236) but never changes the clip's outcome", () => {
  for (let seed = 0; seed < 20; seed++) {
    for (const kind of ['goal', 'save', 'near-miss', 'clearance'] as const) {
      const fresh = createClipScript(input({ kind, minute: 88, seed }));
      const tired = createClipScript(
        input({
          attack: spent('#d70000', 1),
          defence: spent('#0000d7', 1),
          kind,
          minute: 88,
          seed
        })
      );
      expect(tired.outcome).toBe(fresh.outcome);
      expect(tired.passes.at(-1)?.to).toBe(fresh.passes.at(-1)?.to);
    }
  }
});

test('tired players show it only in the zoomed view, at most three a side', () => {
  const script = createClipScript(
    input({
      attack: spent('#d70000', 1),
      defence: spent('#0000d7', 1),
      minute: 90
    })
  );
  const zoomed = script.frame(script.momentFrame);
  for (const side of ['attack', 'defence'] as const) {
    expect(
      zoomed.players.filter(p => p.side === side && p.status === 'tired')
    ).toHaveLength(tiredPerSide);
  }
  expect(script.frame(0).players.some(p => p.status)).toBe(false);
  expect(script.frame(script.length - 1).players.some(p => p.status)).toBe(
    false
  );
});

test('fresh players, players without energy, and the first minute show no tiredness', () => {
  for (let seed = 0; seed < 50; seed++) {
    const cases = [
      input({ seed }),
      input({ attack: spent('#d70000', 20), seed }),
      input({ attack: spent('#d70000', 1), minute: 0, seed })
    ];
    for (const clip of cases) {
      const script = createClipScript(clip);
      expect(script.frame(script.momentFrame).players.some(p => p.status)).toBe(
        false
      );
    }
  }
});

/** How many players show tired over 100 clips. */
const tiredCount = (energy: number, minute: number) => {
  let tired = 0;
  for (let seed = 0; seed < 100; seed++) {
    const script = createClipScript(
      input({ attack: spent('#d70000', energy), minute, seed })
    );
    tired += script
      .frame(script.momentFrame)
      .players.filter(p => p.status).length;
  }
  return tired;
};

test('tiredness comes more often later in the match and with less energy', () => {
  expect(tiredCount(10, 80)).toBeGreaterThan(tiredCount(10, 20));
  expect(tiredCount(4, 60)).toBeGreaterThan(tiredCount(16, 60));
});

test('the passer and shooter kick, and players face the way they move', () => {
  for (let seed = 0; seed < 20; seed++) {
    const script = createClipScript(input({ restart: 'open-play', seed }));
    const first = script.passes[0]!;
    const passer = Number(first.from.split(' ')[1]);
    expect(script.frame(first.start).players[passer]!.pose).toBe('kick');
    // A header is met, not kicked: its own test follows. A ball in from
    // wide (#224) has its moment start with the cross, as a header does.
    if (script.finish === 'header' || script.cross) {
      continue;
    }
    if (script.outcome === 'goal') {
      expect(script.frame(script.phases.moment).players[9]!.pose).toBe('kick');
    }
    // Shooting up the screen, the shooter faces up as the shot is struck,
    // or across to the goal from out wide.
    const striker = script.frame(script.phases.moment).players[9]!;
    expect(['up', striker.x > pitchWidth / 2 ? 'left' : 'right']).toContain(
      striker.facing
    );
  }
});

test('players stand when still, and line up facing the way their side attacks', () => {
  const still = kickOffFrame(side('#d70000'), side('#0000d7'), 'Kick-off');
  expect(still.players.every(p => p.pose === 'stand')).toBe(true);
  expect(
    still.players.filter(p => p.side === 'attack').every(p => p.facing === 'up')
  ).toBe(true);
  expect(
    still.players
      .filter(p => p.side === 'defence')
      .every(p => p.facing === 'down')
  ).toBe(true);
  // A defender waiting at a free kick stands.
  const script = createClipScript(input({ restart: 'free-kick' }));
  expect(script.frame(30).players.some(p => p.pose === 'stand')).toBe(true);
});

test('the crowd stands only in a goal’s reaction', () => {
  for (let seed = 0; seed < 10; seed++) {
    const goal = createClipScript(input({ outcome: 'goal', seed }));
    expect(goal.frame(goal.phases.reaction - 1).cheer).toBeUndefined();
    expect(goal.frame(goal.phases.reaction + 1).cheer).toBe(true);
    const save = createClipScript(input({ kind: 'save', seed }));
    expect(save.frame(save.length - 1).cheer).toBeUndefined();
  }
});

/** A pass's length and pace, and where its passer and receiver are. */
const passesOf = (seeds: number) =>
  Array.from({ length: seeds }, (_, seed) =>
    (['goal', 'save', 'near-miss', 'clearance'] as const).flatMap(kind => {
      const script = createClipScript(input({ kind, seed }));
      const labels = script.input.attack.players.map(p => p.label);
      return script.passes.map(pass => {
        const from = script.frame(pass.start);
        const to = script.frame(pass.end);
        const metres = Math.hypot(
          to.ball.x - from.ball.x,
          to.ball.y - from.ball.y
        );
        return {
          from,
          metres,
          pace: metres / ((pass.end - pass.start) / clipFps),
          pass,
          passer: labels.indexOf(pass.from),
          receiver: labels.indexOf(pass.to),
          script,
          to
        };
      });
    })
  ).flat();

/**
 * The passes of 100 seeds' clips of every kind, worked out once for all the
 * tests that look at passes, since building them is the slow part.
 */
let passesMade: ReturnType<typeof passesOf> | undefined;
const everyPass = () => (passesMade ??= passesOf(100));

const facingVectors = {
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1]
} as const;

test('a passer faces the way they play the ball', () => {
  for (const { from, passer, to } of everyPass()) {
    const player = from.players[passer]!;
    const metres = Math.hypot(to.ball.x - player.x, to.ball.y - player.y);
    if (metres < 2) {
      continue;
    }
    const [fx, fy] = facingVectors[player.facing];
    const along =
      (fx * (to.ball.x - player.x) + fy * (to.ball.y - player.y)) / metres;
    // Within about 60 degrees of the pass, never side-on or turned away.
    expect(along).toBeGreaterThan(0.5);
  }
});

test('a long pass goes in the air; along the ground it is 30 m at most', () => {
  let lofted = 0;
  for (const { metres, pass, script } of everyPass()) {
    const middle = script.frame((pass.start + pass.end) / 2);
    if (middle.ball.height > 0) {
      lofted++;
    } else {
      expect(metres).toBeLessThanOrEqual(30);
    }
  }
  expect(lofted).toBeGreaterThan(0);
});

test('the ball keeps a pass’s pace, and the receiver gets to it', () => {
  for (const { metres, pace, pass, receiver, to } of everyPass()) {
    // A cross the keeper came and caught never reaches the header.
    if (pass.cutOut) {
      continue;
    }
    if (metres >= 9) {
      expect(pace).toBeGreaterThanOrEqual(pass.kind === 'throw-in' ? 8 : 10);
    }
    const player = to.players[receiver]!;
    expect(
      Math.hypot(player.x - to.ball.x, player.y - to.ball.y)
    ).toBeLessThanOrEqual(1.5);
  }
});

test('a pass along the ground never runs through a defender', () => {
  for (const { pass, script } of everyPass()) {
    for (let at = pass.start + 5; at < pass.end - 5; at++) {
      const frame = script.frame(at);
      if (frame.ball.height > 0) {
        break;
      }
      for (const player of frame.players.filter(p => p.side === 'defence')) {
        expect(
          Math.hypot(player.x - frame.ball.x, player.y - frame.ball.y)
        ).toBeGreaterThan(0.9);
      }
    }
  }
});

test('passes go forward; a pass back is short', () => {
  let forward = 0;
  let back = 0;
  for (const { from, metres, pass, script, to } of everyPass()) {
    if (pass.kind !== 'pass' || pass.to === script.passes.at(-1)!.to) {
      continue;
    }
    // Shooting up the screen, a pass back goes down it.
    const gained = from.ball.y - to.ball.y;
    if (gained < -5) {
      back++;
      expect(metres).toBeLessThanOrEqual(15);
    } else {
      forward++;
    }
  }
  expect(forward).toBeGreaterThan(back * 3);
});

test('the ball runs ahead of a carrier, the way they go', () => {
  let carries = 0;
  for (let seed = 0; seed < 60; seed++) {
    const script = createClipScript(input({ restart: 'open-play', seed }));
    const labels = script.input.attack.players.map(p => p.label);
    for (let at = 1; at < script.phases.zoom; at++) {
      if (script.passes.some(p => at >= p.start - 2 && at <= p.end + 2)) {
        continue;
      }
      const before = script.frame(at - 1);
      const frame = script.frame(at);
      // The carrier received the latest pass.
      const latest = script.passes.findLast(p => p.end <= at);
      if (!latest) {
        continue;
      }
      const k = labels.indexOf(latest.to);
      const vx = frame.players[k]!.x - before.players[k]!.x;
      const vy = frame.players[k]!.y - before.players[k]!.y;
      // Carrying at a run, at least 4 m/s.
      if (Math.hypot(vx, vy) * clipFps < 4) {
        continue;
      }
      carries++;
      const ox = frame.ball.x - frame.players[k]!.x;
      const oy = frame.ball.y - frame.players[k]!.y;
      // Within 45 degrees of the way they go.
      expect(
        (ox * vx + oy * vy) / (Math.hypot(ox, oy) * Math.hypot(vx, vy))
      ).toBeGreaterThan(Math.cos(Math.PI / 4));
    }
  }
  expect(carries).toBeGreaterThan(100);
});

test('a receiver runs onto a pass without turning sharply as it is played', () => {
  for (const { pass, receiver, script } of everyPass()) {
    if (pass.start < 2) {
      continue;
    }
    const [a, b, c] = [-2, -1, 0].map(
      k => script.frame(pass.start + k).players[receiver]!
    );
    const before = [b!.x - a!.x, b!.y - a!.y];
    const after = [c!.x - b!.x, c!.y - b!.y];
    const speeds = [before, after].map(([x, y]) => Math.hypot(x!, y!));
    if (speeds.some(s => s * clipFps < 2)) {
      continue;
    }
    const cos =
      (before[0]! * after[0]! + before[1]! * after[1]!) /
      (speeds[0]! * speeds[1]!);
    expect(cos).toBeGreaterThan(Math.cos(Math.PI / 4));
  }
});

test('clips pass the clip checks, whoever shoots', () => {
  const found = new Map<ClipIssueKind, string>();
  // A forward, a midfielder and a defender shoot, on both ends.
  for (const shooter of [9, 6, 2]) {
    for (let seed = 0; seed < 15; seed++) {
      for (const kind of ['goal', 'save', 'near-miss', 'clearance'] as const) {
        const script = createClipScript(
          input({ attackingUp: seed % 2 === 0, kind, seed, shooter })
        );
        for (const issue of checkClip(script)) {
          found.set(
            issue.kind,
            `seed ${seed}, ${kind}, shooter ${shooter}: ${issue.message} (${issue.start}–${issue.end})`
          );
        }
      }
    }
  }
  expect([...found.values()]).toEqual([]);
  // 180 clips, each built and checked frame by frame: slow on a busy runner.
}, 30_000);

test('defenders get out of a pass along the ground at running pace', () => {
  const fast: string[] = [];
  for (let seed = 0; seed < 20; seed++) {
    const script = createClipScript(
      input({ attackingUp: seed % 2 === 0, cross: null, seed })
    );
    for (const pass of script.passes.filter(p => p.start >= 5)) {
      // From the frame it is played: a defender beside the ball then is
      // the one most in its way.
      for (let at = pass.start; at <= pass.end; at++) {
        const [was, now] = [script.frame(at - 5), script.frame(at)];
        if (now.ball.height > 0.05) {
          continue;
        }
        now.players.forEach((p, i) => {
          const q = was.players[i]!;
          const pace = (Math.hypot(p.x - q.x, p.y - q.y) * clipFps) / 5;
          if (p.side === 'defence' && p.pose === 'run' && pace > 9) {
            fast.push(
              `seed ${seed}, frame ${at}: defence ${i} at ${pace.toFixed(1)} m/s`
            );
          }
        });
      }
    }
  }
  expect(fast).toEqual([]);
});

test('a carrier running into a defender never shoves them along faster than a run (#226)', () => {
  // The ball goes wide for a cross, and the carrier runs into the defender
  // closing them down.
  const script = createClipScript(
    input({ attackingUp: false, cross: null, kind: 'near-miss', seed: 27 })
  );
  for (let at = 330; at <= 360; at++) {
    const [was, now] = [
      script.frame(at - 5).players[19]!,
      script.frame(at).players[19]!
    ];
    expect(
      (Math.hypot(now.x - was.x, now.y - was.y) * clipFps) / 5
    ).toBeLessThan(9);
  }
});

test('no one on their feet moves faster than anyone runs', () => {
  const fast: string[] = [];
  const check = (script: ClipScript, name: string) => {
    for (const issue of checkClip(script)) {
      if (issue.kind === 'too-fast') {
        fast.push(`${name}: ${issue.message} (${issue.start}–${issue.end})`);
      }
    }
  };
  // Runs keep to their own pace (clip-run.test.ts); this checks them end
  // to end, with everyone else.
  for (const shooter of [9, 6, 2]) {
    for (let seed = 0; seed < 20; seed++) {
      for (const kind of [
        'goal',
        'save',
        'near-miss',
        'clearance',
        'injury'
      ] as const) {
        check(
          createClipScript(
            input({ attackingUp: seed % 2 === 0, kind, seed, shooter })
          ),
          `seed ${seed}, ${kind}, shooter ${shooter}`
        );
      }
    }
  }
  for (const cross of crosses) {
    const kind = cross === 'headed-clear' ? 'clearance' : 'save';
    for (let seed = 0; seed < 10; seed++) {
      check(
        createClipScript(input({ cross, kind, seed })),
        `${cross}, seed ${seed}`
      );
    }
  }
  expect(fast).toEqual([]);
}, 120_000);

test('no one stands still on the ball while a team-mate gets into place', () => {
  const still: string[] = [];
  const check = (script: ClipScript, name: string) => {
    for (const issue of checkClip(script)) {
      if (issue.kind === 'holder-still') {
        still.push(`${name}: ${issue.message} (${issue.start}–${issue.end})`);
      }
    }
  };
  // The final pass waiting for the shooter to get in reach or back onside,
  // for a forward and a midfielder, and for an injury's run.
  for (const shooter of [9, 6]) {
    for (let seed = 0; seed < 40; seed++) {
      for (const kind of [
        'goal',
        'save',
        'near-miss',
        'clearance',
        'injury'
      ] as const) {
        check(
          createClipScript(input({ kind, seed, shooter })),
          `seed ${seed}, ${kind}, shooter ${shooter}`
        );
      }
    }
  }
  // The crosser waiting for the header to run into the box.
  for (let seed = 0; seed < 40; seed++) {
    check(
      createClipScript(input({ finish: 'header', seed })),
      `seed ${seed}, header`
    );
  }
  expect(still).toEqual([]);
}, 60_000);

test('the final pass finds the shooter in range, not far out for a long run', () => {
  let shots = 0;
  const long: string[] = [];
  for (const shooter of [9, 6]) {
    for (let seed = 0; seed < 80; seed++) {
      for (const kind of ['goal', 'save', 'near-miss', 'clearance'] as const) {
        const script = createClipScript(
          input({ attackingUp: seed % 2 === 0, kind, seed, shooter })
        );
        const found = script.passes.some(p => p.receiver === shooter);
        if (
          !found ||
          (script.finish !== 'shot' && script.finish !== 'long-range')
        ) {
          continue;
        }
        shots++;
        for (const issue of checkClip(script)) {
          if (issue.kind === 'long-run') {
            long.push(
              `seed ${seed}, ${kind}, shooter ${shooter}: ${issue.message}`
            );
          }
        }
      }
    }
  }
  expect(shots).toBeGreaterThan(300);
  // A few found late and deep may still carry it on.
  expect(long.length / shots).toBeLessThanOrEqual(0.05);
}, 120_000);

test('a shooter found within range of a shot from range carries it only a short way', () => {
  // Found no further out than a shot from range is struck from, plus the
  // 7 m carry, they carry it at most that far, with a short touch first.
  const carries: string[] = [];
  const seeds = [...Array.from({ length: 60 }, (_, seed) => seed), 277];
  for (const shooter of [9, 6]) {
    for (const seed of seeds) {
      for (const kind of ['goal', 'save', 'near-miss', 'clearance'] as const) {
        const script = createClipScript(input({ kind, seed, shooter }));
        const found = script.passes.findLast(p => p.receiver === shooter);
        if (
          !found ||
          (script.finish !== 'shot' && script.finish !== 'long-range')
        ) {
          continue;
        }
        const at = script.frame(found.end);
        const out = Math.hypot(at.ball.x - pitchWidth / 2, at.ball.y);
        if (out > 37) {
          continue;
        }
        const metres =
          script.frame(script.phases.zoom).players[shooter]!.travelled -
          at.players[shooter]!.travelled;
        if (metres > 9) {
          carries.push(
            `seed ${seed}, ${kind}, shooter ${shooter}: found ${out.toFixed(1)} m out, carries ${metres.toFixed(1)} m`
          );
        }
      }
    }
  }
  expect(carries).toEqual([]);
}, 60_000);

test('every ball in from wide passes the clip checks', () => {
  const kindsFor: Record<
    NonNullable<ClipInput['cross']>,
    readonly ClipInput['kind'][]
  > = {
    'cut-back': ['goal', 'save', 'near-miss'],
    'half-clear': ['goal', 'save', 'near-miss'],
    'headed-clear': ['clearance'],
    low: ['goal', 'save', 'near-miss'],
    punch: ['save']
  };
  const found: string[] = [];
  for (const cross of crosses) {
    for (const shooter of [9, 6]) {
      // From any restart the seed picks.
      for (let seed = 0; seed < 40; seed++) {
        const kinds = kindsFor[cross];
        const script = createClipScript(
          input({ cross, kind: kinds[seed % kinds.length]!, seed, shooter })
        );
        for (const issue of checkClip(script)) {
          found.push(
            `${cross}, seed ${script.input.seed}, ${script.input.kind}, shooter ${shooter}: ${issue.message} (${issue.start}–${issue.end})`
          );
        }
      }
    }
  }
  expect(found).toEqual([]);
}, 120_000);

test('the seed puts about a third of chances in from wide without a header', () => {
  const tally = new Map<string, [number, number]>();
  const count = (key: string, crossed: boolean) => {
    const [all, from] = tally.get(key) ?? [0, 0];
    tally.set(key, [all + 1, from + (crossed ? 1 : 0)]);
  };
  const seen = new Set<string>();
  for (const shooter of [9, 6]) {
    for (let seed = 0; seed < 150; seed++) {
      for (const kind of ['goal', 'save', 'near-miss', 'clearance'] as const) {
        const script = createClipScript(input({ kind, seed, shooter }));
        if (script.restart === 'corner' || script.restart === 'penalty') {
          continue;
        }
        if (script.cross) {
          seen.add(script.cross);
        }
        if (kind === 'clearance') {
          count('clearance', script.cross === 'headed-clear');
        } else if (script.finish === 'long-range') {
          count('from range', script.cross === 'half-clear');
        } else if (script.finish === 'shot') {
          count('shot', script.cross === 'low' || script.cross === 'cut-back');
        } else if (
          script.finish === 'header' &&
          kind === 'save' &&
          script.outcome !== 'claim'
        ) {
          count('header saved', script.cross === 'punch');
        }
      }
    }
  }
  for (const [key, [all, from]] of tally) {
    expect([key, from / all > 0.22 && from / all < 0.45]).toEqual([key, true]);
  }
  expect([...seen].toSorted()).toEqual([...crosses].toSorted());
}, 120_000);

test('finding the shooter in range keeps the mix of finishes', () => {
  // The shares measured before the final pass was placed by the back line
  // (#223), as the seed picks them and the clip settles them: a one-on-one
  // with the line too deep is a shot, and a shot found out of range and
  // time is one from range.
  const before = {
    forward: {
      header: 29.1,
      'long-range': 6.9,
      'one-on-one': 19.6,
      shot: 44.4
    },
    midfielder: {
      header: 20.4,
      'long-range': 34,
      'one-on-one': 8.7,
      shot: 36.9
    }
  };
  for (const [who, shooter] of [
    ['forward', 9],
    ['midfielder', 6]
  ] as const) {
    const seen = { header: 0, 'long-range': 0, 'one-on-one': 0, shot: 0 };
    let clips = 0;
    for (let seed = 0; seed < 150; seed++) {
      for (const kind of ['goal', 'save', 'near-miss'] as const) {
        const script = createClipScript(
          input({ attackingUp: seed % 2 === 0, kind, seed, shooter })
        );
        seen[script.finish]++;
        clips++;
      }
    }
    for (const finish of finishes) {
      expect(
        Math.abs((seen[finish] / clips) * 100 - before[who][finish])
      ).toBeLessThanOrEqual(5);
    }
  }
}, 120_000);

/** Paces are judged over 5 frames, so a step apart from a team-mate doesn't count. */
const over = 5;
/** The pace from `b` to `a` over those frames, in metres a second. */
const paceOver = (a: { x: number; y: number }, b: typeof a) =>
  (Math.hypot(a.x - b.x, a.y - b.y) * clipFps) / over;

test('the defender closing the ball down jockeys rather than sprinting in', () => {
  const fast: string[] = [];
  for (let seed = 0; seed < 40; seed++) {
    for (const kind of ['goal', 'save', 'near-miss', 'clearance'] as const) {
      const script = createClipScript(
        input({ attackingUp: seed % 2 === 0, kind, seed })
      );
      const up = script.input.attackingUp ? -1 : 1;
      const from = (script.passes[0]?.end ?? 0) + over;
      for (let at = from; at < script.phases.zoom; at++) {
        if (
          script.passes.some(p => at >= p.start - over && at <= p.end + over)
        ) {
          continue;
        }
        const now = script.frame(at);
        const was = script.frame(at - over);
        // On their feet, within 3 m of the ball and goal side of it.
        const closing = now.players.findIndex(
          p =>
            p.side === 'defence' &&
            !p.keeper &&
            (p.pose === 'run' || p.pose === 'stand') &&
            Math.hypot(p.x - now.ball.x, p.y - now.ball.y) < 3 &&
            (p.y - now.ball.y) * up > 0.5
        );
        if (closing < 0) {
          continue;
        }
        // The carrier, with the ball at their feet, running into them shoves
        // them along (#226): that's not closing in, so a defender within
        // touching distance of the carrier doesn't count.
        const defender = now.players[closing]!;
        const shoved = now.players.some(
          p =>
            p.side === 'attack' &&
            Math.hypot(p.x - now.ball.x, p.y - now.ball.y) < 1.5 &&
            Math.hypot(p.x - defender.x, p.y - defender.y) < 1.4
        );
        if (shoved) {
          continue;
        }
        // Their pace towards the ball: one pushed back off it isn't closing.
        const [p, q] = [now.players[closing]!, was.players[closing]!];
        const gap = Math.hypot(now.ball.x - q.x, now.ball.y - q.y) || 1;
        const towards =
          (((p.x - q.x) * (now.ball.x - q.x) +
            (p.y - q.y) * (now.ball.y - q.y)) /
            gap) *
          (clipFps / over);
        const extra = towards - paceOver(now.ball, was.ball);
        if (extra > 1.5) {
          fast.push(
            `seed ${seed}, ${kind}, frame ${at}: defender ${closing} closes ${extra.toFixed(1)} m/s faster than the ball goes`
          );
          break;
        }
      }
    }
  }
  expect(fast).toEqual([]);
}, 60_000);

/**
 * Clips of one finish, as the debug page forces it, from open play but for
 * headers. A one-on-one with the defence too deep to get in behind is a
 * shot instead, so only the clips that kept their finish are given.
 */
const finished = (finish: (typeof finishes)[number], seeds = 30) => {
  const scripts = Array.from({ length: seeds }, (_, seed) =>
    createClipScript(
      input({
        finish,
        kind: (['goal', 'save', 'near-miss'] as const)[seed % 3]!,
        ...(finish === 'header' ? {} : { restart: 'open-play' as const }),
        seed
      })
    )
  );
  const kept = scripts.filter(script => script.finish === finish);
  expect(kept.length).toBeGreaterThanOrEqual(seeds * 0.8);
  return kept;
};

/** Clips with a cross forced, as the debug page forces it, from open play. */
const crossed = (
  cross: NonNullable<ClipInput['cross']>,
  kinds: readonly ClipInput['kind'][],
  seeds = 20
) =>
  Array.from({ length: seeds }, (_, seed) =>
    createClipScript(
      input({
        cross,
        kind: kinds[seed % kinds.length]!,
        restart: 'open-play',
        seed
      })
    )
  );

test('a low cross is driven in from wide for the shooter to strike first time', () => {
  for (const script of crossed('low', ['goal', 'save', 'near-miss'])) {
    expect(script.cross).toBe('low');
    expect(script.finish).toBe('shot');
    const cross = script.passes.at(-1)!;
    expect(cross).toMatchObject({ kind: 'cross', receiver: 9 });
    // From wide, low along the ground or just off it.
    expect(
      Math.abs(script.frame(cross.start).ball.x - pitchWidth / 2)
    ).toBeGreaterThan(14);
    for (let at = cross.start; at < cross.end; at++) {
      expect(script.frame(at).ball.height).toBeLessThan(0.15);
    }
    // Met first time: the shooter runs onto it and strikes it as it arrives.
    const [a, b] = [cross.end - 6, cross.end - 1].map(
      at => script.frame(at).players[9]!
    );
    expect(
      Math.hypot(b!.x - a!.x, b!.y - a!.y) * (clipFps / 5)
    ).toBeGreaterThan(2);
    const strikes = Array.from(
      { length: 8 },
      (_, k) => script.frame(cross.end + k).players[9]!.pose
    );
    expect(strikes).toContain('kick');
  }
});

test('a cut-back is pulled back from the byline for the shooter to strike first time', () => {
  const scripts = crossed('cut-back', ['goal', 'save', 'near-miss']);
  // With the byline beyond a winger's run, the ball goes in low instead.
  const kept = scripts.filter(script => script.cross === 'cut-back');
  expect(kept.length).toBeGreaterThanOrEqual(scripts.length * 0.6);
  expect(
    scripts.every(
      script => script.cross === 'cut-back' || script.cross === 'low'
    )
  ).toBe(true);
  for (const script of kept) {
    expect(script.finish).toBe('shot');
    const cross = script.passes.at(-1)!;
    expect(cross).toMatchObject({ kind: 'cross', receiver: 9 });
    const from = script.frame(cross.start).ball;
    const to = script.frame(cross.end - 1).ball;
    // From the byline, within the depth of the six-yard box, back away
    // from goal, to the shooter in the box.
    expect(depth(from.y)).toBeGreaterThan(pitchLength - 5.5);
    expect(depth(to.y)).toBeLessThan(depth(from.y) - 5);
    const out = pitchLength - depth(to.y);
    expect(out).toBeGreaterThan(9);
    expect(out).toBeLessThan(17);
    for (let at = cross.start; at < cross.end; at++) {
      expect(script.frame(at).ball.height).toBeLessThan(0.15);
    }
    const strikes = Array.from(
      { length: 8 },
      (_, k) => script.frame(cross.end + k).players[9]!.pose
    );
    expect(strikes).toContain('kick');
  }
});

test('a cross is headed clear by a defender', () => {
  for (const script of crossed('headed-clear', ['clearance'])) {
    expect(script.cross).toBe('headed-clear');
    expect(script.outcome).toBe('interception');
    const cross = script.passes.at(-1)!;
    expect(cross).toMatchObject({ cutOut: true, kind: 'cross', receiver: 9 });
    const at = script.momentFrame;
    // In the air across the box, met in it by a defender's head.
    const mid = script.frame(Math.round((cross.start + at) / 2)).ball;
    expect(mid.height).toBeGreaterThan(0.3);
    const met = script.frame(at);
    expect(
      met.players.some(p => p.side === 'defence' && p.pose === 'header')
    ).toBe(true);
    expect(pitchLength - depth(met.ball.y)).toBeLessThan(16.5);
    // Headed away from goal at once, and that's the clearance: no one
    // strikes it again in the reaction.
    const later = script.frame(at + 20).ball;
    expect(depth(later.y)).toBeLessThan(depth(met.ball.y) - 3);
    const { reaction } = script.phases;
    for (let f = reaction + 1; f < reaction + 80; f++) {
      const [b0, b1] = [script.frame(f - 1).ball, script.frame(f).ball];
      expect(Math.hypot(b1.x - b0.x, b1.y - b0.y) * clipFps).toBeLessThan(8);
    }
  }
});

test('a cross half-cleared to the edge of the box is struck from there', () => {
  for (const script of crossed('half-clear', ['goal', 'save', 'near-miss'])) {
    expect(script.cross).toBe('half-clear');
    expect(script.finish).toBe('long-range');
    const cross = script.passes.at(-1)!;
    expect(cross).toMatchObject({ cutOut: true, kind: 'cross' });
    // A defender heads it out of the box...
    const frames = Array.from(
      { length: script.momentFrame - cross.start },
      (_, k) => script.frame(cross.start + k)
    );
    const headedOut = frames.findIndex(frame =>
      frame.players.some(p => p.side === 'defence' && p.pose === 'header')
    );
    expect(headedOut).toBeGreaterThanOrEqual(0);
    // ...and the shooter strikes it first time from the edge of the box.
    const struck = frames.findIndex(
      (frame, k) => k > headedOut && frame.players[9]!.pose === 'kick'
    );
    expect(struck).toBeGreaterThan(headedOut);
    const out = pitchLength - depth(frames[struck]!.ball.y);
    expect(out).toBeGreaterThan(16.5);
    expect(out).toBeLessThan(30);
  }
});

test('a keeper comes and punches a cross away', () => {
  for (const script of crossed('punch', ['save'])) {
    expect(script.cross).toBe('punch');
    expect(script.outcome).toBe('punch');
    expect(script.finish).toBe('header');
    const cross = script.passes.at(-1)!;
    expect(cross).toMatchObject({ cutOut: true, kind: 'cross' });
    // Off their line, they meet it in the air...
    const at = script.frame(script.momentFrame);
    const keeper = at.players.find(p => p.side === 'defence' && p.keeper)!;
    expect(depth(keeper.y)).toBeLessThan(pitchLength - 2);
    expect(Math.hypot(keeper.x - at.ball.x, keeper.y - at.ball.y)).toBeLessThan(
      1.5
    );
    expect(at.ball.height).toBeGreaterThan(0.3);
    // ...and punch it away from goal, not hold it.
    const later = script.frame(script.momentFrame + 20).ball;
    expect(depth(later.y)).toBeLessThan(depth(at.ball.y) - 4);
    const end = script.frame(script.phases.reaction + 60);
    const held = end.players.find(p => p.side === 'defence' && p.keeper)!;
    expect(held.pose).not.toBe('hold');
  }
});

test('the seed picks every finish; corners and defenders head it, clearances shoot', () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < 120; seed++) {
    const forward = createClipScript(input({ seed }));
    seen.add(forward.finish);
    if (forward.restart === 'corner') {
      expect(forward.finish).toBe('header');
    }
    expect(createClipScript(input({ kind: 'clearance', seed })).finish).toBe(
      'shot'
    );
    // A centre-back has come up for a set piece, to head it.
    expect(createClipScript(input({ seed, shooter: 2 })).finish).toBe('header');
  }
  expect([...seen].sort()).toEqual([...finishes].sort());
});

test('a header runs onto a cross from out wide at a pace a player can run', () => {
  let wide = 0;
  const scripts = finished('header', 100);
  for (const script of scripts) {
    const cross = script.passes.at(-1)!;
    if (cross.kind !== 'cross') {
      continue;
    }
    const from = script.frame(cross.start).ball;
    if (from.x < 15 || from.x > pitchWidth - 15) {
      wide++;
    }
    for (let f = cross.start + 1; f <= cross.end; f++) {
      const a = script.frame(f - 1).players[cross.receiver]!;
      const b = script.frame(f).players[cross.receiver]!;
      expect(Math.hypot(b.x - a.x, b.y - a.y) * clipFps).toBeLessThan(12);
    }
  }
  expect(wide).toBeGreaterThan(scripts.length * 0.6);
});

test('a header meets a cross at head height, with a crouch and a leap first', () => {
  for (const script of finished('header')) {
    if (script.outcome === 'claim' || script.outcome === 'punch') {
      continue;
    }
    const cross = script.passes.at(-1)!;
    expect(['corner', 'cross']).toContain(cross.kind);
    expect(cross.receiver).toBe(9);
    const meet = script.frame(cross.end);
    const header = meet.players[9]!;
    // The ball reaches the head, in the box.
    expect(
      Math.hypot(header.x - meet.ball.x, header.y - meet.ball.y)
    ).toBeLessThan(1);
    expect(meet.ball.height).toBeGreaterThan(0.3);
    expect(depth(header.y)).toBeGreaterThan(pitchLength - 13);
    // Crouch, leap, then the forehead.
    const poses = [cross.end - 12, cross.end - 3, cross.end + 2].map(at => {
      const p = script.frame(at).players[9]!;
      return [p.pose, p.poseFrame];
    });
    expect(poses).toEqual([
      ['header', 0],
      ['header', 1],
      ['header', 2]
    ]);
    // The clip reaches its moment as the header arrives, after the cross.
    expect(script.momentFrame).toBeGreaterThan(cross.end);
  }
});

test('a shot from range is struck from 22 m or more', () => {
  for (const script of finished('long-range')) {
    const shot = script.frame(script.phases.moment);
    const shooter = shot.players[9]!;
    expect(
      Math.hypot(shooter.x - 34, depth(shooter.y) - pitchLength)
    ).toBeGreaterThan(21);
  }
});

test('one on one, the shooter has beaten the defence and the keeper comes out', () => {
  for (const script of finished('one-on-one')) {
    const shot = script.frame(script.phases.moment);
    const shooter = shot.players[9]!;
    const keeper = shot.players.find(p => p.side === 'defence' && p.keeper)!;
    expect(depth(keeper.y)).toBeLessThan(pitchLength - 3);
    // No outfield defender stands between the shooter and the goal line.
    const between = shot.players.filter(
      p =>
        p.side === 'defence' && !p.keeper && depth(p.y) > depth(shooter.y) + 1
    );
    expect(between).toEqual([]);
  }
});

test('through on goal, no midfielder pushes on to crowd the defence past the shooter', () => {
  // Pushing on in support ahead of the ball, as in other build-ups, the
  // midfielders would step the chasing defenders ahead of the shooter.
  const script = createClipScript(
    input({
      finish: 'one-on-one',
      kind: 'near-miss',
      restart: 'open-play',
      seed: 74
    })
  );
  expect(script.finish).toBe('one-on-one');
  const shot = script.frame(script.phases.moment);
  const shooter = shot.players[9]!;
  const between = shot.players.filter(
    p => p.side === 'defence' && !p.keeper && depth(p.y) > depth(shooter.y) + 1
  );
  expect(between).toEqual([]);
});

test('players count the ground they cover, for their stride', () => {
  const script = createClipScript(input());
  const first = script.frame(0);
  const last = script.frame(script.length - 1);
  last.players.forEach((p, i) => {
    const start = first.players[i]!;
    expect(p.travelled).toBeGreaterThanOrEqual(
      Math.hypot(p.x - start.x, p.y - start.y) - 0.01
    );
  });
  expect(Math.max(...last.players.map(p => p.travelled))).toBeGreaterThan(20);
});

test('a keeper comes off their line to catch a cross before it is headed', () => {
  let claims = 0;
  for (let seed = 0; seed < 60; seed++) {
    const script = createClipScript(
      input({ finish: 'header', kind: 'save', seed })
    );
    if (script.outcome !== 'claim') {
      continue;
    }
    claims++;
    const cross = script.passes.at(-1)!;
    expect(cross.cutOut).toBe(true);
    // Caught in the air, off the line, and before the header gets there.
    const caught = script.frame(script.momentFrame);
    const keeper = caught.players.find(p => p.side === 'defence' && p.keeper)!;
    expect(keeper.pose).toBe('hold');
    expect(depth(keeper.y)).toBeLessThan(pitchLength - 2);
    expect(
      Math.hypot(keeper.x - caught.ball.x, keeper.y - caught.ball.y)
    ).toBeLessThan(0.5);
    expect(script.momentFrame).toBeLessThan(cross.end);
    // The header never gets their forehead to it.
    for (let at = script.momentFrame; at < script.phases.reaction; at++) {
      expect(script.frame(at).players[9]!.poseFrame).not.toBe(2);
    }
  }
  // About a third of saves from a cross.
  expect(claims).toBeGreaterThan(8);
  expect(claims).toBeLessThan(35);
  // Forced, a claim brings its cross.
  const forced = createClipScript(input({ kind: 'save', outcome: 'claim' }));
  expect([forced.outcome, forced.finish]).toEqual(['claim', 'header']);
});

/** How far `p` is from the line from `a` to `b`, all on the screen. */
const offLine = (
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
) => {
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return (
    Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / length
  );
};

test('a keeper stands on the angle, further off their line the further off the ball', () => {
  const near: number[] = [];
  const far: number[] = [];
  const misses: number[] = [];
  for (let seed = 0; seed < 20; seed++) {
    const script = createClipScript(input({ seed }));
    // Shooting up the screen, the defending goal's middle is at the top.
    const goal = { x: 34, y: 0 };
    for (let at = 50; at < script.phases.zoom; at += 10) {
      const frame = script.frame(at);
      const keeper = frame.players.find(p => p.side === 'defence' && p.keeper)!;
      misses.push(offLine(keeper, goal, frame.ball));
      const out = Math.hypot(keeper.x - goal.x, keeper.y - goal.y);
      const ball = Math.hypot(frame.ball.x - goal.x, frame.ball.y - goal.y);
      (ball > 50 ? far : ball < 30 ? near : []).push(out);
    }
  }
  const median = (list: number[]) =>
    list.toSorted((a, b) => a - b)[Math.floor(list.length / 2)]!;
  expect(median(misses)).toBeLessThan(1);
  expect(median(far)).toBeGreaterThan(median(near) + 1.5);
  expect(Math.max(...near, ...far)).toBeLessThan(9);
});

/** The defending keeper in a frame. */
const keeperOf = (
  frame: ReturnType<ReturnType<typeof createClipScript>['frame']>
) => frame.players.find(p => p.side === 'defence' && p.keeper)!;

test('after a catch the keeper throws or rolls it to a team-mate, or kicks it long', () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < 60; seed++) {
    const script = createClipScript(
      input({ kind: 'save', outcome: seed % 2 ? 'hold' : 'dive', seed })
    );
    let release = -1;
    for (let at = script.phases.reaction; at < script.length; at++) {
      const frame = script.frame(at);
      const keeper = keeperOf(script.frame(at));
      if (Math.hypot(frame.ball.x - keeper.x, frame.ball.y - keeper.y) > 1.5) {
        release = at;
        break;
      }
    }
    expect(release).toBeGreaterThan(0);
    const heights: number[] = [];
    let reached = -1;
    for (let at = release; at < script.length; at++) {
      const frame = script.frame(at);
      heights.push(frame.ball.height);
      // A team-mate gathers it at their feet.
      const mate = frame.players.findIndex(
        p =>
          p.side === 'defence' &&
          !p.keeper &&
          Math.hypot(p.x - frame.ball.x, p.y - frame.ball.y) < 1.2 &&
          frame.ball.height === 0
      );
      if (mate >= 0 && at > release + 10) {
        reached = at;
        break;
      }
    }
    const top = Math.max(...heights);
    const way =
      reached < 0 ? 'kick' : top === 0 ? 'roll' : top < 0.45 ? 'throw' : 'kick';
    seen.add(way);
    if (way !== 'kick') {
      // Thrown from over the head, or bowled from the hands.
      expect(keeperOf(script.frame(release - 2)).pose).toBe(
        way === 'throw' ? 'hold' : 'kick'
      );
    }
  }
  expect([...seen].sort()).toEqual(['kick', 'roll', 'throw']);
});

test('a lofted ball lands and bounces once before it is controlled', () => {
  let bounced = 0;
  for (let seed = 0; seed < 40; seed++) {
    const script = createClipScript(input({ restart: 'goal-kick', seed }));
    const kick = script.passes[0]!;
    expect(kick.kind).toBe('goal-kick');
    const heights = Array.from(
      { length: kick.end - kick.start },
      (_, k) => script.frame(kick.start + k).ball.height
    );
    const landed = heights.findIndex((h, k) => k > 3 && h < 0.02);
    if (
      landed > 0 &&
      landed < heights.length - 3 &&
      Math.max(...heights.slice(landed)) > 0.03
    ) {
      bounced++;
    }
  }
  expect(bounced).toBeGreaterThan(30);
});

test('a first touch takes the pace off the ball, and the receiver comes onto it', () => {
  let knocked = 0;
  let checked = 0;
  for (const { pass, receiver, script } of everyPass()) {
    if (
      pass.kind !== 'pass' ||
      pass.cutOut ||
      pass.end + 30 > script.phases.zoom
    ) {
      continue;
    }
    checked++;
    const frames = Array.from({ length: 30 }, (_, k) =>
      script.frame(pass.end + k)
    );
    const apart = frames.map(frame => {
      const p = frame.players[receiver]!;
      return Math.hypot(p.x - frame.ball.x, p.y - frame.ball.y);
    });
    // On ahead of the stride, then back at the feet.
    if (Math.max(...apart) > 1 && apart.at(-1)! < 0.85) {
      knocked++;
    }
    // Through the touch, at least 25 frames, the ball slows but never runs
    // back the way it came.
    const before = script.frame(pass.end - 1).ball;
    const came = {
      x: frames[0]!.ball.x - before.x,
      y: frames[0]!.ball.y - before.y
    };
    const pace = Math.hypot(came.x, came.y) || 1;
    for (let k = 1; k < 25; k++) {
      const a = frames[k - 1]!.ball;
      const b = frames[k]!.ball;
      const on = ((b.x - a.x) * came.x + (b.y - a.y) * came.y) / pace;
      expect(on).toBeGreaterThan(-0.005);
    }
  }
  expect(knocked).toBeGreaterThan(checked * 0.6);
});

test('crosses and shots bend a little; passes along the ground do not', () => {
  let crosses = 0;
  let curled = 0;
  for (let seed = 0; seed < 30; seed++) {
    const script = createClipScript(
      input({ finish: 'header', kind: 'goal', seed })
    );
    const cross = script.passes.at(-1)!;
    const from = script.frame(cross.start).ball;
    const to = script.frame(cross.end).ball;
    const middle = script.frame(Math.round((cross.start + cross.end) / 2)).ball;
    crosses++;
    if (offLine(middle, from, to) > 0.4) {
      curled++;
    }
  }
  expect(curled).toBeGreaterThan(crosses * 0.8);
  for (const { pass, script } of everyPass()) {
    const middle = script.frame(Math.round((pass.start + pass.end) / 2));
    if (pass.kind !== 'pass' || middle.ball.height > 0) {
      continue;
    }
    const from = script.frame(pass.start).ball;
    const to = script.frame(pass.end).ball;
    expect(offLine(middle.ball, from, to)).toBeLessThan(0.05);
  }
});

test('a clearance lands, bounces and runs on before it stops', () => {
  for (let seed = 0; seed < 20; seed++) {
    // A cross headed clear (#224) has landed by the reaction.
    const script = createClipScript(
      input({ cross: null, kind: 'clearance', seed })
    );
    const balls = Array.from(
      { length: script.length - script.phases.reaction },
      (_, k) => script.frame(script.phases.reaction + k).ball
    );
    const top = balls.findIndex(b => b.height > 0.3);
    expect(top).toBeGreaterThanOrEqual(0);
    // Down near the grass after its peak, then up again: a bounce.
    const h = balls.map(b => b.height);
    const bounce = h.some(
      (height, k) =>
        k > top &&
        height < 0.06 &&
        height < h[k - 1]! &&
        (h[k + 1] ?? 0) > height
    );
    expect(bounce).toBe(true);
    // Along the grass it runs on a few metres, off the boards if it meets
    // them, and stops, if the clip lasts long enough to see it: a long one
    // can still be rolling as it ends.
    const settled = balls.findLastIndex(b => b.height > 0) + 1;
    if (balls.length - settled > 30) {
      const runOn = balls
        .slice(settled + 1, settled + 31)
        .reduce(
          (sum, b, k) =>
            sum +
            Math.hypot(
              b.x - balls[settled + k]!.x,
              b.y - balls[settled + k]!.y
            ),
          0
        );
      expect(runOn).toBeGreaterThan(2);
      const stopped = balls[settled + 30]!;
      const after = balls[settled + 29]!;
      expect(Math.hypot(stopped.x - after.x, stopped.y - after.y)).toBeLessThan(
        0.01
      );
    }
  }
});

test('after a save or a miss the shooter holds their head, then all turn back', () => {
  for (let seed = 0; seed < 30; seed++) {
    const kind = seed % 2 ? 'save' : 'near-miss';
    const script = createClipScript(input({ kind, seed }));
    const { reaction } = script.phases;
    expect(script.frame(reaction + 10).players[9]!.pose).toBe('head');
    // By the end the attackers have headed back up their own half.
    const start = script.frame(reaction);
    const end = script.frame(script.length - 1);
    if (script.outcome === 'parry') {
      // Out for a corner: an attacker heads for the flag, the keeper back
      // to their line.
      const flag = {
        x: end.ball.x < pitchWidth / 2 ? 0 : pitchWidth,
        y: end.ball.y
      };
      const toFlag = (p: { x: number; y: number }) =>
        Math.hypot(p.x - flag.x, p.y - flag.y);
      const nearest = Math.min(
        ...start.players.flatMap(p => (p.side === 'attack' ? [toFlag(p)] : []))
      );
      const closing = start.players.some(
        (p, i) =>
          p.side === 'attack' &&
          toFlag(end.players[i]!) < Math.min(toFlag(p) - 8, nearest)
      );
      expect(closing).toBe(true);
      expect(depth(keeperOf(end).y)).toBeGreaterThan(pitchLength - 3);
      continue;
    }
    const back = start.players.filter(
      (p, i) =>
        p.side === 'attack' &&
        !p.keeper &&
        depth(end.players[i]!.y) < depth(p.y) - 2
    );
    expect(back.length).toBeGreaterThanOrEqual(5);
  }
});

test('after a goal a defender despairs and the keeper fetches the ball', () => {
  for (let seed = 0; seed < 20; seed++) {
    const script = createClipScript(input({ kind: 'goal', seed }));
    const { reaction } = script.phases;
    const despair = script
      .frame(reaction + 30)
      .players.filter(p => p.side === 'defence' && p.pose === 'head');
    expect(despair.length).toBeGreaterThanOrEqual(1);
    const end = script.frame(script.length - 1);
    const keeper = end.players.find(p => p.side === 'defence' && p.keeper)!;
    expect(keeper.pose).toBe('hold');
    expect(
      Math.hypot(keeper.x - end.ball.x, keeper.y - end.ball.y)
    ).toBeLessThan(1);
  }
});

test('a keeper off their line jogs back to fetch the ball from the net', () => {
  // Beaten from off their line, the keeper is too far from the net to walk
  // back in time.
  const script = createClipScript(
    input({ attackingUp: false, kind: 'goal', seed: 63 })
  );
  const end = script.frame(script.length - 1);
  const keeper = end.players.find(p => p.side === 'defence' && p.keeper)!;
  expect(keeper.pose).toBe('hold');
});

test('no one freezes once the ball arrives', () => {
  for (let seed = 0; seed < 30; seed++) {
    const kind = (['goal', 'save', 'near-miss', 'clearance'] as const)[
      seed % 4
    ]!;
    const script = createClipScript(input({ kind, seed }));
    const from = script.frame(script.momentFrame);
    const to = script.frame(script.momentFrame + clipFps);
    const moved = from.players.filter((p, i) => {
      const q = to.players[i]!;
      return Math.hypot(q.x - p.x, q.y - p.y) > 1;
    });
    expect(moved.length).toBeGreaterThanOrEqual(5);
  }
});

test('after a goal the scorer wheels away and team-mates pile in', () => {
  for (let seed = 0; seed < 20; seed++) {
    const script = createClipScript(input({ kind: 'goal', seed }));
    const { reaction } = script.phases;
    // Arms up where they scored, then off at a run.
    expect(script.frame(reaction + 5).players[9]!.pose).toBe('celebrate');
    const start = script.frame(reaction).players[9]!;
    const end = script.frame(script.length - 1);
    const scorer = end.players[9]!;
    expect(Math.hypot(scorer.x - start.x, scorer.y - start.y)).toBeGreaterThan(
      4
    );
    // Arms up, jumping for joy or on their knees.
    expect(['celebrate', 'jump', 'slide']).toContain(scorer.pose);
    // Team-mates celebrate around them.
    const huddle = end.players.filter(
      (p, i) =>
        i !== 9 &&
        p.side === 'attack' &&
        (p.pose === 'celebrate' || p.pose === 'jump') &&
        Math.hypot(p.x - scorer.x, p.y - scorer.y) < 3
    );
    expect(huddle.length).toBeGreaterThanOrEqual(1);
  }
});

/**
 * Whether team-mate `i` has reached the scorer at frame `f`: close enough,
 * with the scorer stopped where they celebrate, so staying put into the
 * next frame.
 */
const joinedScorer = (script: ClipScript, f: number, i: number) => {
  const { shooter } = script.input;
  const now = script.frame(f).players;
  const next = script.frame(f + 1).players;
  const apart = (a: number, b: { x: number; y: number }) =>
    Math.hypot(now[a]!.x - b.x, now[a]!.y - b.y);
  return (
    apart(shooter, next[shooter]!) < 0.01 &&
    apart(i, now[shooter]!) < huddleReach
  );
};

test('a team-mate joining the scorer jumps for joy on the frame they get there', () => {
  // Their pose is chosen after everyone moves, so it shows on the frame
  // they arrive, not the one after (#248).
  let arrivals = 0;
  for (let seed = 0; seed < 20; seed++) {
    const script = createClipScript(input({ kind: 'goal', seed }));
    const from = script.phases.reaction + leapFrames;
    script.frame(from).players.forEach((p, i) => {
      if (i === script.input.shooter || p.side !== 'attack') {
        return;
      }
      for (let f = from + 1; f < script.length; f++) {
        const pose = script.frame(f).players[i]!.pose;
        if (pose === 'jump' || pose === 'celebrate') {
          if (script.frame(f - 1).players[i]!.pose !== 'run') {
            break;
          }
          expect(joinedScorer(script, f, i)).toBe(true);
          expect(joinedScorer(script, f - 1, i)).toBe(false);
          arrivals++;
          break;
        }
      }
    });
  }
  expect(arrivals).toBeGreaterThan(10);
});

test('after a catch the keeper walks out with the ball as a team-mate breaks wide', () => {
  for (let seed = 0; seed < 20; seed++) {
    const script = createClipScript(
      input({ kind: 'save', outcome: 'hold', seed })
    );
    const { reaction } = script.phases;
    const from = keeperOf(script.frame(reaction));
    const out = keeperOf(script.frame(reaction + 45));
    expect(out.pose).not.toBe('dive');
    expect(depth(out.y)).toBeLessThan(depth(from.y) - 1);
  }
});

test('the seed sometimes plays a rebound, and only from close in', () => {
  let rebounds = 0;
  for (let seed = 0; seed < 200; seed++) {
    const script = createClipScript(
      input({ kind: seed % 2 ? 'goal' : 'save', seed })
    );
    if (script.rebound) {
      rebounds++;
      expect(['shot', 'header']).toContain(script.finish);
    }
  }
  expect(rebounds).toBeGreaterThan(10);
  expect(rebounds).toBeLessThan(60);
  // Never for a clearance, nor a keeper's catch of the cross.
  for (let seed = 0; seed < 20; seed++) {
    expect(
      createClipScript(input({ kind: 'clearance', rebound: true, seed }))
        .rebound
    ).toBe(false);
    expect(
      createClipScript(
        input({ finish: 'header', outcome: 'claim', rebound: true, seed })
      ).rebound
    ).toBe(false);
  }
});

test('a rebound is parried out into the box, and the shooter strikes again', () => {
  let seen = 0;
  for (let seed = 0; seed < 30; seed++) {
    const kind = (['goal', 'save', 'near-miss'] as const)[seed % 3]!;
    const script = createClipScript(input({ kind, rebound: true, seed }));
    if (!script.rebound) {
      continue;
    }
    seen++;
    const { moment } = script.phases;
    // The ball reaches the keeper in the goal mouth, then comes back out.
    let parried = -1;
    let out = -1;
    for (let at = moment; at <= script.momentFrame; at++) {
      const { ball } = script.frame(at);
      const mouth = Math.abs(ball.x - pitchWidth / 2) < 5;
      if (parried < 0 && mouth && depth(ball.y) > pitchLength - 1.5) {
        parried = at;
      }
      if (parried >= 0 && depth(ball.y) < pitchLength - 4.5) {
        out = at;
        break;
      }
    }
    expect(parried).toBeGreaterThan(0);
    expect(out).toBeGreaterThan(parried);
    expect(keeperOf(script.frame(parried + 2)).pose).toBe('dive');
    // The shooter is there to strike it again.
    const kicks = new Set<number>();
    for (let at = out; at <= script.momentFrame; at++) {
      if (script.frame(at).players[9]!.pose === 'kick') {
        kicks.add(at);
      }
    }
    expect(kicks.size).toBeGreaterThan(0);
    // And it ends as the moment says: in the net after a goal.
    const end = script.frame(script.phases.reaction - 1).ball;
    if (kind === 'goal') {
      expect(depth(end.y)).toBeGreaterThan(pitchLength);
    }
    expect(outcomeKind(script.outcome)).toBe(kind);
  }
  expect(seen).toBeGreaterThan(10);
});

test('a shot is struck in range, however the build-up goes', () => {
  for (const shooter of [9, 6]) {
    for (let seed = 0; seed < 60; seed++) {
      const script = createClipScript(
        input({ kind: seed % 2 ? 'goal' : 'save', seed, shooter })
      );
      // A ball in from wide (#224) has its moment start with the cross:
      // its own tests check where it is struck.
      if (
        (script.finish !== 'shot' && script.finish !== 'long-range') ||
        script.cross
      ) {
        continue;
      }
      const struck = script.frame(script.phases.moment).ball;
      const out = Math.hypot(struck.x - pitchWidth / 2, struck.y);
      // An ordinary shot within 25 m; one from range, or turned into one
      // when the shooter was found late and deep, within about 30.
      expect(out).toBeLessThan(script.finish === 'shot' ? 25 : 31);
    }
  }
});

test('a scorer wheels away arms up, then celebrates arms up, jumping or on their knees', () => {
  const ends = new Set<string>();
  for (let seed = 0; seed < 60; seed++) {
    const script = createClipScript(input({ kind: 'goal', seed }));
    const poses = Array.from(
      { length: script.length - script.phases.reaction },
      (_, k) => script.frame(script.phases.reaction + k).players[9]!.pose
    );
    expect(poses).toContain('cheer');
    expect(poses).not.toContain('run');
    ends.add(poses.at(-1)!);
    // A jump shows the crouch, then the leap.
    if (poses.at(-1) === 'jump') {
      const frames = new Set(
        Array.from(
          { length: 40 },
          (_, k) => script.frame(script.length - 1 - k).players[9]!
        ).flatMap(p => (p.pose === 'jump' ? [p.poseFrame] : []))
      );
      expect([...frames].sort()).toEqual([0, 1]);
    }
  }
  expect([...ends].sort()).toEqual(['celebrate', 'jump', 'slide']);
});

test('a goal is announced from its moment for 2.5 s, naming the scorer in place of the label', () => {
  const goal = createClipScript(input({ outcome: 'goal', score: [2, 1] }));
  const { momentFrame } = goal;
  expect(goal.frame(momentFrame - 1).goal).toBeUndefined();
  expect(goal.frame(momentFrame - 1).label?.text).toBe('#d70000 9');
  const shown = goal.frame(momentFrame + 10);
  expect(shown.goal).toMatchObject({
    at: 10,
    minute: '34′',
    name: '#d70000 9',
    score: [2, 1]
  });
  expect(shown.label).toBeUndefined();
  // Gone before the wipe out of the clip.
  const end = momentFrame + shown.goal!.length;
  expect(shown.goal!.length).toBeLessThanOrEqual(goalFrames);
  expect(end).toBeLessThanOrEqual(goal.length - 20);
  expect(goal.frame(end - 1).goal).toBeDefined();
  expect(goal.frame(end).goal).toBeUndefined();
  // No other outcome is announced.
  const saved = createClipScript(input({ kind: 'save', outcome: 'hold' }));
  for (let at = 0; at < saved.length; at += 5) {
    expect(saved.frame(at).goal).toBeUndefined();
  }
});

/** Player `i`'s poses from frame `from` to the end of the clip. */
const posesFrom = (script: ClipScript, from: number, i: number) =>
  Array.from(
    { length: script.length - from },
    (_, k) => script.frame(from + k).players[i]!.pose
  );
/** Player `i` slid in around the clip's moment. */
const slid = (script: ClipScript, i: number) =>
  posesFrom(script, script.momentFrame - 10, i)
    .slice(0, 20)
    .includes('tackle');

/** A player in the penalty area of the goal their side attacks. */
const inBox = (p: Readonly<{ x: number; y: number }>, up: boolean) => {
  const out = up ? p.y : pitchLength - p.y;
  return out < 16.5 && Math.abs(p.x - pitchWidth / 2) < 20.16;
};

test('an injured player goes down outside the box, where no one could ask for a penalty', () => {
  for (const shooter of [9, 6, 2]) {
    for (let seed = 0; seed < 40; seed++) {
      for (const tackled of [true, false]) {
        const attackingUp = seed % 2 === 0;
        const script = createClipScript(
          input({ attackingUp, kind: 'injury', seed, shooter, tackled })
        );
        for (const at of [script.momentFrame, script.length - 1]) {
          const down = script.frame(at).players[shooter]!;
          expect({
            at,
            in: inBox(down, attackingUp),
            seed,
            shooter,
            tackled
          }).toEqual({ at, in: false, seed, shooter, tackled });
        }
      }
    }
  }
}, 60_000);

test('a player fouled in the box goes down in it, and play stops', () => {
  for (const shooter of [9, 6, 2]) {
    for (let seed = 0; seed < 40; seed++) {
      const attackingUp = seed % 2 === 0;
      const script = createClipScript(
        input({
          attackingUp,
          foul: true,
          kind: 'injury',
          seed,
          shooter,
          tackled: true
        })
      );
      expect(checkClip(script)).toEqual([]);
      for (const at of [script.momentFrame, script.length - 1]) {
        const down = script.frame(at).players[shooter]!;
        expect({ at, in: inBox(down, attackingUp), seed, shooter }).toEqual({
          at,
          in: true,
          seed,
          shooter
        });
      }
      // Nobody clears it: the ball lies where it ran.
      expect(script.frame(script.length - 1).ball).toEqual(
        script.frame(script.phases.reaction).ball
      );
    }
  }
}, 60_000);

test('a penalty is struck from the spot, with only the taker and the keeper in the box', () => {
  for (const kind of ['goal', 'save', 'near-miss'] as const) {
    for (const shooter of [9, 6, 2]) {
      for (let seed = 0; seed < 15; seed++) {
        const attackingUp = seed % 2 === 0;
        const made = input({ attackingUp, kind, penalty: true, seed, shooter });
        const script = createClipScript(made);
        expect(script.restart).toBe('penalty');
        expect(script.rebound).toBe(false);
        expect(script.passes).toEqual([]);
        expect(outcomeKind(script.outcome)).toBe(kind);
        expect(checkClip(script)).toEqual([]);
        expect(script.length).toBeLessThanOrEqual(longestClip);
        expect(cardText(script.frame(10))).toContain('Penalty');
        const keeper = script.input.attack.players.length;
        for (let at = 0; at < script.phases.moment; at++) {
          const frame = script.frame(at);
          expect(frame.ball.x).toBeCloseTo(pitchWidth / 2);
          expect(
            attackingUp ? frame.ball.y : pitchLength - frame.ball.y
          ).toBeCloseTo(11);
          const inside = frame.players.flatMap((p, i) =>
            i !== shooter && i !== keeper && inBox(p, attackingUp) ? [i] : []
          );
          expect({ at, inside }).toEqual({ at, inside: [] });
        }
        // The taker strikes it.
        const struck = script.frame(script.phases.moment + 1);
        expect(struck.players[shooter]!.pose).toBe('kick');
        expect(createClipScript(made).frame(script.momentFrame)).toEqual(
          script.frame(script.momentFrame)
        );
      }
    }
  }
}, 60_000);

test('an injured player is tackled by the named defender, or pulls up, and stays down', () => {
  for (const shooter of [9, 6, 2]) {
    for (let seed = 0; seed < 12; seed++) {
      for (const tackled of [true, false]) {
        const script = createClipScript(
          input({
            attackingUp: seed % 2 === 0,
            kind: 'injury',
            seed,
            shooter,
            tackled,
            ...(tackled ? { tackler: 3 } : {})
          })
        );
        expect(script.outcome).toBe('tackle');
        expect(checkClip(script)).toEqual([]);
        const attackers = script.input.attack.players.length;
        // Down from just after the moment to the end of the clip.
        expect(
          new Set(posesFrom(script, script.momentFrame + 12, shooter))
        ).toEqual(new Set(['fall']));
        // And stays where they fell, however the camera moves.
        const fell = script.frame(script.momentFrame + 12).players[shooter]!;
        const last = script.frame(script.length - 1).players[shooter]!;
        expect([last.x, last.y]).toEqual([fell.x, fell.y]);
        // The named defender slides in; pulling up, nobody does.
        expect(slid(script, attackers + 3)).toBe(tackled);
        if (!tackled) {
          for (let j = 0; j < script.input.defence.players.length; j++) {
            expect(slid(script, attackers + j)).toBe(false);
          }
        }
      }
    }
  }
}, 30_000);

/** Faster than 1 m/s, a step of a frame. */
const quick = (step: readonly [number, number]) =>
  Math.hypot(...step) * clipFps > 1;

/**
 * Each player's shuffles in `script`: three turns back on themselves, at
 * over 1 m/s either way, within six frames.
 */
const shufflesIn = (script: ClipScript) => {
  const found: string[] = [];
  const frames = Array.from({ length: script.length }, (_, at) =>
    script.frame(at)
  );
  for (let p = 0; p < frames[0]!.players.length; p++) {
    const turns: number[] = [];
    let last: [number, number] | undefined;
    for (let at = 1; at < frames.length; at++) {
      const a = frames[at - 1]!.players[p]!;
      const b = frames[at]!.players[p]!;
      const step: [number, number] = [b.x - a.x, b.y - a.y];
      if (
        last &&
        quick(last) &&
        quick(step) &&
        last[0] * step[0] + last[1] * step[1] < 0
      ) {
        turns.push(at);
        while (turns[0]! < at - 6) {
          turns.shift();
        }
        if (turns.length === 3) {
          found.push(`player ${p} at ${at}`);
        }
      }
      last = step;
    }
  }
  return found;
};

test('no one shuffles back and forth after a tackle', () => {
  // The team-mate who runs onto the loose ball stays on it, rather than
  // drift off it and step back on every few frames.
  const found: string[] = [];
  for (let seed = 0; seed < 60; seed++) {
    const script = createClipScript(
      input({
        attackingUp: seed % 2 === 0,
        foul: seed % 5 === 0,
        kind: 'injury',
        seed,
        shooter: [9, 10, 5, 6, 2, 0][seed % 6]!,
        tackled: seed % 3 !== 0
      })
    );
    found.push(...shufflesIn(script).map(at => `seed ${seed}: ${at}`));
  }
  expect(found).toEqual([]);
}, 60_000);

test('an attacker waiting by a defender stays put', () => {
  // Nudged just over where they may wait, they don't turn to drop back and
  // turn again once onside; with their spot just beyond a defender, they
  // wait on their own side of them rather than walk into them again and
  // again.
  const found = (
    [
      ['headed-clear', 'clearance', 28],
      ['half-clear', 'save', 22]
    ] as const
  ).flatMap(([cross, kind, seed]) =>
    shufflesIn(createClipScript(input({ cross, kind, seed }))).map(
      at => `${cross}, seed ${seed}: ${at}`
    )
  );
  expect(found).toEqual([]);
});

/** `side` with every player's skill, and any energy, set. */
const withSkill = (
  side: ClipSide,
  skill: number,
  energy?: number
): ClipSide => ({
  ...side,
  players: side.players.map(p => ({
    ...p,
    ...(energy === undefined ? {} : { energy }),
    skill
  }))
});
/** The mean of `values`. */
const mean = (values: readonly number[]) =>
  values.reduce((sum, v) => sum + v, 0) / values.length;
/** How far across from the middle of the goal the ball is as it arrives. */
const acrossAtMoment = (script: ClipScript) =>
  Math.abs(script.frame(script.momentFrame).ball.x - pitchWidth / 2);
/** The finishes of 60 seeds for an attack and a defence of these skills. */
const finishesFor = (
  attack: number,
  defence: number,
  overrides: Partial<ClipInput>
) =>
  Array.from({ length: 60 }, (_, seed) =>
    createClipScript(
      input({
        attack: withSkill(side('#d70000'), attack),
        cross: null,
        defence: withSkill(side('#0000d7'), defence),
        rebound: false,
        seed,
        ...overrides
      })
    )
  );

/** The ball's pace, in metres a second, just before it arrives. */
const pace = (script: ClipScript) => {
  const { ball: was } = script.frame(script.momentFrame - 2);
  const { ball } = script.frame(script.momentFrame - 1);
  return Math.hypot(ball.x - was.x, ball.y - was.y) * clipFps;
};
/** How far wide of the post the ball is as it arrives. */
const wideBy = (script: ClipScript) => acrossAtMoment(script) - 3.66;
/** The share of `scripts` that end in a parry. */
const parried = (scripts: readonly ClipScript[]) =>
  scripts.filter(s => s.outcome === 'parry').length / scripts.length;

test('a player without a skill plays as an average one', () => {
  for (const kind of ['goal', 'save', 'near-miss'] as const) {
    const plain = createClipScript(input({ kind }));
    // Fresh, too: full energy slows no one.
    const average = createClipScript(
      input({
        attack: withSkill(side('#d70000'), 3, 20),
        defence: withSkill(side('#0000d7'), 3, 20),
        kind
      })
    );
    expect(average.length).toBe(plain.length);
    for (const at of [0, plain.momentFrame, plain.length - 1]) {
      expect(average.frame(at)).toEqual(plain.frame(at));
    }
  }
});

test('a skilled shooter places a goal nearer the post, and harder', () => {
  const strong = finishesFor(5, 3, { kind: 'goal' });
  const weak = finishesFor(1, 3, { kind: 'goal' });
  for (const script of [...strong, ...weak]) {
    expect(acrossAtMoment(script)).toBeLessThan(3.66);
  }
  expect(mean(strong.map(acrossAtMoment))).toBeGreaterThan(
    mean(weak.map(acrossAtMoment)) + 0.6
  );
  expect(mean(strong.map(pace))).toBeGreaterThan(mean(weak.map(pace)) * 1.1);
});

test('a skilled shooter misses narrowly, a weak one by further', () => {
  for (const outcome of ['wide-left', 'wide-right'] as const) {
    const strong = finishesFor(5, 3, { kind: 'near-miss', outcome });
    const weak = finishesFor(1, 3, { kind: 'near-miss', outcome });
    expect(mean(weak.map(wideBy))).toBeGreaterThan(
      mean(strong.map(wideBy)) + 0.6
    );
  }
});

test('a skilled keeper holds more saves and gets further across', () => {
  const strong = finishesFor(3, 5, { kind: 'save' });
  const weak = finishesFor(3, 1, { kind: 'save' });
  expect(parried(weak)).toBeGreaterThan(parried(strong) + 0.2);
  const reached = (defence: number) =>
    mean(
      finishesFor(3, defence, { kind: 'save', outcome: 'dive' }).map(
        acrossAtMoment
      )
    );
  expect(reached(5)).toBeGreaterThan(reached(1) + 0.3);
});

/** The decisions of 1,000 seeds for an attack of this skill. */
const decisionsFor = (attack: number, overrides: Partial<ClipInput> = {}) =>
  Array.from({ length: 1000 }, (_, seed) =>
    decideClip(
      input({ attack: withSkill(side('#d70000'), attack), seed, ...overrides })
    )
  );
/** The share of `list` for which `is` holds. */
const shareOf = <T>(list: readonly T[], is: (item: T) => boolean) =>
  list.filter(is).length / list.length;

test('a skilled shooter goes one-on-one or shoots from range more often', () => {
  // A forward, then a midfielder.
  for (const shooter of [9, 5]) {
    const daring = (skill: number) =>
      shareOf(
        decisionsFor(skill, { cross: null, shooter }),
        d => d.finish === 'one-on-one' || d.finish === 'long-range'
      );
    expect(daring(5)).toBeGreaterThan(daring(3) + 0.08);
    expect(daring(3)).toBeGreaterThan(daring(1) + 0.08);
  }
  // Headers and restarts come as they would for any side.
  const average = decisionsFor(3);
  for (const skill of [1, 5]) {
    const decided = decisionsFor(skill);
    expect(decided.map(d => d.restart)).toEqual(average.map(d => d.restart));
    expect(decided.map(d => d.finish === 'header')).toEqual(
      average.map(d => d.finish === 'header')
    );
  }
});

/** The mean number of passes 1,000 seeds decide on, for this skill. */
const passesFor = (skill: number) =>
  mean(decisionsFor(skill).map(d => d.passCount));

test('a weak side builds up with more passes than a strong one', () => {
  expect(passesFor(3)).toBeCloseTo(3, 1);
  expect(passesFor(1)).toBeGreaterThan(3.4);
  expect(passesFor(5)).toBeLessThan(2.6);
});

/**
 * The passes in open play of `script`, but the final one to `shooter`, in
 * metres.
 */
const passLengths = (script: ClipScript, shooter = input().shooter) =>
  script.passes.flatMap(p => {
    if (p.kind !== 'pass' || p.receiver === shooter) {
      return [];
    }
    const { ball: from } = script.frame(p.start);
    const { ball: to } = script.frame(p.end);
    return [Math.hypot(to.x - from.x, to.y - from.y)];
  });

/** The mean pass length of 100 goals and saves, for this skill. */
const passLengthFor = (skill: number) =>
  mean(
    Array.from({ length: 100 }, (_, seed) =>
      createClipScript(
        input({
          attack: withSkill(side('#d70000'), skill),
          kind: (['goal', 'save'] as const)[seed % 2]!,
          restart: 'open-play',
          seed
        })
      )
    ).flatMap(script => passLengths(script))
  );

test('a weak side plays shorter passes than a strong one', () => {
  expect(passLengthFor(5)).toBeGreaterThan(passLengthFor(1) + 2);
}, 60_000);

test('an average side plays as one without skill, seed after seed', () => {
  for (let seed = 0; seed < 40; seed++) {
    const kind = (['goal', 'save', 'near-miss', 'clearance'] as const)[
      seed % 4
    ]!;
    const plain = createClipScript(input({ kind, seed }));
    const average = createClipScript(
      input({
        attack: withSkill(side('#d70000'), 3),
        defence: withSkill(side('#0000d7'), 3),
        kind,
        seed
      })
    );
    expect(average.finish).toBe(plain.finish);
    expect(average.restart).toBe(plain.restart);
    expect(average.passes).toEqual(plain.passes);
    expect(average.length).toBe(plain.length);
  }
}, 60_000);

/**
 * How fast the players from `from` to `to` (screen order) run at the top
 * of their pace, in metres a second, over `scripts`: the 90th percentile
 * of their speeds while running, over 1.5 m/s, on their feet.
 */
const topPace = (scripts: readonly ClipScript[], from: number, to: number) => {
  const speeds: number[] = [];
  for (const script of scripts) {
    for (let at = 1; at < script.length; at++) {
      const was = script.frame(at - 1).players;
      const now = script.frame(at).players;
      for (let p = from; p < to; p++) {
        const speed =
          Math.hypot(now[p]!.x - was[p]!.x, now[p]!.y - was[p]!.y) * clipFps;
        if (speed > 1.5 && now[p]!.pose === 'run') {
          speeds.push(speed);
        }
      }
    }
  }
  return speeds.toSorted((a, b) => a - b)[Math.floor(speeds.length * 0.9)]!;
};
/** 30 clips, goals and saves, between `attack` and `defence`. */
const clipsBetween = (attack: ClipSide, defence: ClipSide) =>
  Array.from({ length: 30 }, (_, seed) =>
    createClipScript(
      input({
        attack,
        defence,
        kind: (['goal', 'save'] as const)[seed % 2]!,
        seed
      })
    )
  );

test('skill and energy set how fast players run', () => {
  // The best of them, fresh, and the worst, spent, against the same side.
  const fresh = (kit: string) => withSkill(side(kit), 5, 20);
  const spent = (kit: string) => withSkill(side(kit), 1, 1);
  const red = side('#d70000');
  const blue = side('#0000d7');
  const defending = (defence: ClipSide) =>
    topPace(clipsBetween(red, defence), 11, 22);
  expect(defending(fresh('#0000d7'))).toBeGreaterThan(
    defending(spent('#0000d7')) * 1.15
  );
  const attacking = (attack: ClipSide) =>
    topPace(clipsBetween(attack, blue), 0, 11);
  expect(attacking(fresh('#d70000'))).toBeGreaterThan(
    attacking(spent('#d70000')) * 1.1
  );
  // No one runs faster than anyone could.
  for (const script of clipsBetween(fresh('#d70000'), fresh('#0000d7'))) {
    expect(
      checkClip(script).filter(issue => issue.kind === 'too-fast')
    ).toEqual([]);
  }
}, 60_000);

test('weak and strong sides pass the clip checks, whoever shoots', () => {
  const found: string[] = [];
  for (const skill of [1, 5]) {
    // A forward, a midfielder and a defender shoot, on both ends.
    for (const shooter of [9, 6, 2]) {
      for (let seed = 0; seed < 15; seed++) {
        for (const kind of [
          'goal',
          'save',
          'near-miss',
          'clearance'
        ] as const) {
          const script = createClipScript(
            input({
              attack: withSkill(side('#d70000'), skill),
              attackingUp: seed % 2 === 0,
              defence: withSkill(side('#0000d7'), skill),
              kind,
              seed,
              shooter
            })
          );
          for (const issue of checkClip(script)) {
            found.push(
              `skill ${skill}, seed ${seed}, ${kind}, shooter ${shooter}: ${issue.message} (${issue.start}–${issue.end})`
            );
          }
        }
      }
    }
  }
  expect(found).toEqual([]);
  // 360 clips, each built and checked frame by frame.
}, 60_000);

test('a shot from range after a throw-in is found in range', () => {
  // Thrown back towards the thrower's own goal from deep, the ball was
  // still too far out when the final pass was due, and the shooter ran a
  // long way with it (#241).
  const found: string[] = [];
  for (const skill of [1, 3]) {
    for (let seed = 0; seed < 400; seed++) {
      const script = createClipScript(
        input({
          attack: withSkill(side('#d70000'), skill),
          cross: null,
          finish: 'long-range',
          kind: (['goal', 'save', 'near-miss'] as const)[seed % 3]!,
          restart: 'throw-in',
          seed,
          shooter: seed % 3 ? 9 : 6
        })
      );
      for (const issue of checkClip(script)) {
        if (issue.kind === 'long-run' || issue.kind === 'slow-build-up') {
          found.push(`skill ${skill}, seed ${seed}: ${issue.message}`);
        }
      }
    }
  }
  expect(found).toEqual([]);
}, 60_000);

/**
 * Each slide in `script` by a defender, from `from` on: the frame it
 * starts, who slides, and how far they go before they stop.
 */
const slidesIn = (script: ClipScript, from = 0) => {
  const slides: { at: number; metres: number; who: number }[] = [];
  const open = new Map<number, { at: number; travelled: number }>();
  for (let at = from; at < script.length; at++) {
    script.frame(at).players.forEach((p, i) => {
      const sliding = p.side === 'defence' && p.pose === 'tackle';
      const started = open.get(i);
      if (sliding && !started) {
        open.set(i, { at, travelled: p.travelled });
      } else if (!sliding && started) {
        slides.push({
          at: started.at,
          metres: p.travelled - started.travelled,
          who: i
        });
        open.delete(i);
      }
    });
  }
  // A slide still under way at the end.
  const last = script.frame(script.length - 1).players;
  for (const [who, started] of open) {
    slides.push({
      at: started.at,
      metres: last[who]!.travelled - started.travelled,
      who
    });
  }
  return slides;
};
/** 200 clips between sides of these skills. */
const duelsBetween = (
  attack: number,
  defence: number,
  overrides: Partial<ClipInput>
) =>
  Array.from({ length: 200 }, (_, seed) =>
    createClipScript(
      input({
        attack: withSkill(side('#d70000'), attack),
        defence: withSkill(side('#0000d7'), defence),
        seed,
        ...overrides
      })
    )
  );

/** How far each challenger slides, in a goal's build-up, for this defence. */
const challengeSlides = (defence: number) =>
  // In a goal's build-up, every slide is a challenge.
  duelsBetween(3, defence, { kind: 'goal' }).flatMap(script =>
    slidesIn(script).map(s => s.metres)
  );

test('a weak defender slides further in a challenge than a strong one', () => {
  const weak = challengeSlides(1);
  const strong = challengeSlides(5);
  expect(weak.length).toBeGreaterThan(30);
  expect(mean(weak)).toBeGreaterThan(mean(strong) + 0.8);
}, 60_000);

/**
 * How far aside of the way they were going each carrier has moved, six
 * frames into a challenge's slide, for this attack.
 */
const skippedAside = (attack: number) =>
  duelsBetween(attack, 3, { kind: 'goal' }).flatMap(script => {
    const [slide] = slidesIn(script);
    if (!slide) {
      return [];
    }
    const at = (n: number) => script.frame(slide.at + n);
    const { ball, players } = at(0);
    const carrier = players.reduce(
      (best, p, i) =>
        p.side === 'attack' &&
        Math.hypot(p.x - ball.x, p.y - ball.y) <
          Math.hypot(players[best]!.x - ball.x, players[best]!.y - ball.y)
          ? i
          : best,
      0
    );
    const before = at(-1).players[carrier]!;
    const start = players[carrier]!;
    const later = at(6).players[carrier]!;
    const way = { x: start.x - before.x, y: start.y - before.y };
    const size = Math.hypot(way.x, way.y) || 1;
    return [
      Math.abs(
        ((later.x - start.x) * way.y - (later.y - start.y) * way.x) / size
      )
    ];
  });

test('a skilled carrier skips aside from a challenge sooner', () => {
  expect(mean(skippedAside(5))).toBeGreaterThan(mean(skippedAside(1)) + 0.08);
}, 60_000);

/** How far each tackler slides, ball won and run out, for this defence. */
const tackleSlides = (defence: number) =>
  duelsBetween(3, defence, {
    cross: null,
    kind: 'clearance',
    outcome: 'tackle'
  }).flatMap(script =>
    slidesIn(script, script.momentFrame - 3 * clipFps)
      .map(s => s.metres)
      .slice(-1)
  );

test("a weak tackler's slide runs on further than a strong one's", () => {
  const weak = tackleSlides(1);
  const strong = tackleSlides(5);
  expect(weak.length).toBeGreaterThan(150);
  expect(mean(weak)).toBeGreaterThan(mean(strong) + 1);
}, 60_000);

/** Whether the defender on the ball at the moment slid in to block it. */
const blockedSliding = (script: ClipScript) => {
  const { ball, players } = script.frame(script.momentFrame);
  const blocker = players.reduce(
    (best, p, i) =>
      p.side === 'defence' &&
      (best < 0 ||
        Math.hypot(p.x - ball.x, p.y - ball.y) <
          Math.hypot(players[best]!.x - ball.x, players[best]!.y - ball.y))
        ? i
        : best,
    -1
  );
  return Array.from(
    { length: clipFps / 2 },
    (_, k) => script.frame(script.momentFrame - k).players[blocker]!.pose
  ).includes('tackle');
};
/** The share of blocks made sliding in, for this defence. */
const slidingBlocks = (defence: number) =>
  shareOf(
    // Half the blocks of a shooter on the ball are tackles instead.
    duelsBetween(3, defence, {
      cross: null,
      kind: 'clearance',
      outcome: 'block'
    }).filter(script => script.outcome === 'block'),
    blockedSliding
  );

test('a weak defender blocks sliding in more often than a strong one', () => {
  // A block no one can reach at a run is always made sliding in, so skill
  // shows only in the rest: about a third.
  expect(slidingBlocks(1)).toBeGreaterThan(slidingBlocks(3) + 0.05);
  expect(slidingBlocks(3)).toBeGreaterThan(slidingBlocks(5) + 0.05);
}, 60_000);
