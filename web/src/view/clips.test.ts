import { expect, test } from 'bun:test';

import { longestClip } from '../sim/ticker';
import {
  cameraWide,
  captionFrames,
  clearanceOutcomes,
  clipFps,
  createClipScript,
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
      expect(script.passes.length).toBeLessThanOrEqual(5);
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

/** How many players show tired over 200 clips. */
const tiredCount = (energy: number, minute: number) => {
  let tired = 0;
  for (let seed = 0; seed < 200; seed++) {
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
