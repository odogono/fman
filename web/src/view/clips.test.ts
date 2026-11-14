import { expect, test } from 'bun:test';

import { longestClip } from '../sim/ticker';
import { checkClip, type ClipIssueKind } from './clip-checks';
import {
  cameraWide,
  captionFrames,
  clearanceOutcomes,
  clipFps,
  createClipScript,
  finishes,
  kickOffFrame,
  missOutcomes,
  outcomeKind,
  pitchLength,
  restarts,
  saveOutcomes,
  seededOutcome,
  tiredPerSide,
  type ClipInput,
  type ClipSide,
  type Line
} from './clips';

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
const input = (overrides: Partial<ClipInput> = {}): ClipInput => ({
  attack: side('#d70000'),
  attackingUp: true,
  defence: side('#0000d7'),
  kind: 'goal',
  minute: 34,
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
  for (let seed = 0; seed < 200; seed++) {
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
      expect(zoom).toBeGreaterThanOrEqual((corner ? 3 : 6) * clipFps);
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
  for (let seed = 0; seed < 200; seed++) {
    for (const kind of ['save', 'clearance', 'near-miss'] as const) {
      const { outcome } = createClipScript(input({ kind, seed }));
      expect(outcomeKind(outcome)).toBe(kind);
      seen.add(outcome);
    }
  }
  expect([...seen].sort()).toEqual(
    [...saveOutcomes, ...clearanceOutcomes, ...missOutcomes].sort()
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

test('the sides change ends at half-time', () => {
  const first = createClipScript(input({ attackingUp: true }));
  const second = createClipScript(input({ attackingUp: false }));
  expect(first.frame(first.momentFrame).ball.y).toBeLessThan(1);
  expect(second.frame(second.momentFrame).ball.y).toBeGreaterThan(104);
});

test('the minute shows over the first half second; the label only zoomed in', () => {
  const script = createClipScript(input({ restart: 'open-play' }));
  expect(script.frame(0).caption).toBe('34′');
  expect(script.frame(captionFrames - 1).caption).toBe('34′');
  expect(script.frame(captionFrames).caption).toBeUndefined();
  const wide = script.frame(script.phases.zoom - 1);
  expect(wide.camera.width).toBe(cameraWide);
  expect(wide.label).toBeUndefined();
  expect(wide.minimap).toBe(true);
  const zoomed = script.frame(script.momentFrame);
  expect(zoomed.camera.width).toBeLessThan(cameraWide);
  expect(zoomed.label?.text).toBe('#d70000 9');
  expect(zoomed.minimap).toBe(false);
  expect(script.frame(script.length - 1).minimap).toBe(true);
});

test('the camera keeps the ball in its patch', () => {
  for (let seed = 0; seed < 50; seed++) {
    const script = createClipScript(input({ seed }));
    for (let at = 0; at < script.length; at += 10) {
      const { ball, camera } = script.frame(at);
      expect(Math.abs(ball.x - camera.x)).toBeLessThan(camera.width / 2);
      expect(Math.abs(ball.y - camera.y)).toBeLessThan(
        (camera.width * 5) / 8 + 2
      );
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
  expect(start.caption).toBe('34′ Throw-in');
  expect([0, 68]).toContain(start.ball.x);
  expect(start.ball.height).toBeGreaterThan(0);
  const thrower = start.players.find(p => p.pose === 'hold')!;
  expect(thrower.x < 0 || thrower.x > 68).toBe(true);
  expect(script.passes[0]!.kind).toBe('throw-in');
});

test('defenders stand back from a free kick until it is taken', () => {
  for (let seed = 0; seed < 30; seed++) {
    const script = createClipScript(input({ restart: 'free-kick', seed }));
    expect(script.frame(0).caption).toBe('34′ Free kick');
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
    expect(script.frame(0).caption).toBe('34′ Goal kick');
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
    expect(script.frame(0).caption).toBe('34′ Corner');
    const start = script.frame(0).ball;
    expect(depth(start.y)).toBeGreaterThan(104);
    expect(start.x < 1 || start.x > 67).toBe(true);
    expect(script.passes).toHaveLength(1);
    expect(script.passes[0]).toMatchObject({ kind: 'corner', to: '#d70000 9' });
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
    // The shooter never receives: the pass to them is the one cut out.
    expect(cut.passes.every(p => p.to !== '#d70000 9')).toBe(true);
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

test('the defender clears upfield or into touch', () => {
  let upfield = 0;
  let touch = 0;
  for (let seed = 0; seed < 100; seed++) {
    const script = createClipScript(input({ kind: 'clearance', seed }));
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

test("energy shows only as status, never changing the clip's play", () => {
  for (let seed = 0; seed < 20; seed++) {
    const fresh = createClipScript(input({ minute: 88, seed }));
    const tired = createClipScript(
      input({
        attack: spent('#d70000', 1),
        defence: spent('#0000d7', 1),
        minute: 88,
        seed
      })
    );
    expect(tired.length).toBe(fresh.length);
    for (const at of [0, fresh.momentFrame, fresh.length - 1]) {
      const strip = (frame: ReturnType<typeof fresh.frame>) =>
        frame.players.map(({ status: _, ...p }) => p);
      expect(strip(tired.frame(at))).toEqual(strip(fresh.frame(at)));
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
    // A header is met, not kicked: its own test follows.
    if (script.finish === 'header') {
      continue;
    }
    if (script.outcome === 'goal') {
      expect(script.frame(script.phases.moment).players[9]!.pose).toBe('kick');
    }
    // Shooting up the screen, the shooter faces up as the shot is struck.
    expect(script.frame(script.phases.moment).players[9]!.facing).toBe('up');
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

test('a header meets a cross at head height, with a crouch and a leap first', () => {
  for (const script of finished('header')) {
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
