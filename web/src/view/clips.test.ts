import { expect, test } from 'bun:test';

import { longestClip } from '../sim/ticker';
import {
  cameraWide,
  captionFrames,
  clipFps,
  createClipScript,
  missOutcomes,
  outcomeKind,
  pitchLength,
  saveOutcomes,
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
      expect(script.length).toBeGreaterThanOrEqual(10 * clipFps);
      expect(script.length).toBeLessThanOrEqual(35 * clipFps);
      expect(script.length).toBeLessThanOrEqual(longestClip);
      expect(Number.isInteger(script.length)).toBe(true);
      // The build-up, the zoom, the moment, then the reaction, in order.
      const { moment, reaction, zoom } = script.phases;
      expect(zoom).toBeGreaterThanOrEqual(6 * clipFps);
      expect(zoom).toBeLessThan(moment);
      expect(script.momentFrame).toBeGreaterThan(moment);
      expect(script.momentFrame).toBeLessThan(reaction);
      expect(reaction).toBeLessThan(script.length);
      expect(script.passes.length).toBeGreaterThanOrEqual(2);
      expect(script.passes.length).toBeLessThanOrEqual(5);
      expect(script.passes.at(-1)!.to).toBe(`#d70000 ${9}`);
    }
  }
});

test('the seed picks each outcome of a save and a near miss', () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < 200; seed++) {
    for (const kind of ['save', 'near-miss'] as const) {
      const { outcome } = createClipScript(input({ kind, seed }));
      expect(outcomeKind(outcome)).toBe(kind);
      seen.add(outcome);
    }
  }
  expect([...seen].sort()).toEqual([...saveOutcomes, ...missOutcomes].sort());
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
  const script = createClipScript(input());
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
