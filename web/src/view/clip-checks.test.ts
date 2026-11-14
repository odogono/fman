import { expect, test } from 'bun:test';

import { checkClip } from './clip-checks';
import type {
  ClipFrame,
  ClipPass,
  ClipScript,
  FramePlayer,
  Line,
  Restart
} from './clips';

// Small clips made by hand: one attacker passes to another up the screen,
// past one defender, with each test moving someone into trouble.

type Spot = Partial<FramePlayer> & { x: number; y: number };
const player = (side: 'attack' | 'defence', spot: Spot): FramePlayer => ({
  facing: 'up',
  keeper: false,
  pose: 'run',
  side,
  travelled: 0,
  ...spot
});

/**
 * A clip of `length` frames: the passer at (30, 60) plays the ball 10 m up
 * to the receiver over frames 10 to 30, with one defender well wide.
 * `change` moves anyone at any frame.
 */
const clip = (
  options: {
    change?: (at: number, players: FramePlayer[]) => void;
    lines?: readonly Line[];
    pass?: Partial<ClipPass>;
    restart?: Restart;
  } = {}
): ClipScript => {
  const length = 60;
  const pass: ClipPass = {
    end: 30,
    from: 'A',
    kind: 'pass',
    passer: 0,
    receiver: 1,
    start: 10,
    to: 'B',
    ...options.pass
  };
  const lines = options.lines ?? ['midfield', 'attack'];
  const frame = (at: number): ClipFrame => {
    const u = Math.min(
      1,
      Math.max(0, (at - pass.start) / (pass.end - pass.start))
    );
    const ball = {
      height: 0,
      x: 30,
      y: at < pass.start ? 59.2 : 59.2 - 10 * u
    };
    const players = [
      player('attack', { x: 30, y: 60 }),
      player('attack', { x: 30, y: 50 }),
      player('defence', { x: 50, y: 50 })
    ];
    options.change?.(at, players);
    return {
      ball,
      camera: { width: 40, x: 34, y: 52 },
      minimap: true,
      phase: at < 40 ? 'build-up' : 'moment',
      players
    };
  };
  return {
    finish: 'shot',
    frame,
    input: {
      attack: {
        keeper: '#f80',
        kit: '#d70000',
        players: lines.map((line, i) => ({ label: `A${i}`, line }))
      },
      attackingUp: true,
      defence: {
        keeper: '#7cd616',
        kit: '#0000d7',
        players: [{ label: 'D0', line: 'defence' }]
      },
      kind: 'goal',
      minute: 30,
      seed: 1,
      shooter: 1
    },
    length,
    momentFrame: 45,
    outcome: 'goal',
    passes: [pass],
    phases: { moment: 40, reaction: 55, zoom: 38 },
    restart: options.restart ?? 'open-play'
  };
};

const kinds = (script: ClipScript) => checkClip(script).map(i => i.kind);

test('a clean clip shows no problems', () => {
  expect(checkClip(clip())).toEqual([]);
});

/** The defender stands on the passer from frame 2, for `frames` frames. */
const crowd = (frames: number) =>
  clip({
    change: (at, players) => {
      if (at >= 2 && at < 2 + frames) {
        players[2] = { ...players[2]!, x: 30.3, y: 60 };
      }
    }
  });

test('players standing inside each other for a few frames are crowded', () => {
  const found = checkClip(crowd(8)).filter(i => i.kind === 'crowded');
  expect(found).toHaveLength(1);
  expect(found[0]).toMatchObject({ end: 9, players: [0, 2], start: 2 });
  // Passing through each other in a moment is not crowding.
  expect(kinds(crowd(3))).not.toContain('crowded');
});

test('a defender in the way of a pass along the ground is flagged', () => {
  const script = clip({
    change: (_, players) => {
      players[2] = { ...players[2]!, x: 30.5, y: 55 };
    }
  });
  const found = checkClip(script).find(i => i.kind === 'pass-through-defender');
  expect(found?.players).toEqual([0, 1, 2]);
});

test('a passer facing away from the pass is flagged', () => {
  const script = clip({
    change: (_, players) => {
      players[0] = { ...players[0]!, facing: 'down' };
    }
  });
  expect(kinds(script)).toContain('facing-away');
});

test('a slow pass, and a receiver who never reaches the ball, are flagged', () => {
  // 10 m in 2 s is 5 m/s.
  const slow = clip({ pass: { end: 110 } });
  expect(kinds({ ...slow, length: 120 })).toContain('slow-pass');
  const missed = clip({
    change: (at, players) => {
      players[1] = { ...players[1]!, x: 40 };
    }
  });
  expect(kinds(missed)).toContain('receiver-misses');
});

test('a defender shooting after open play is unlikely; after a corner it is not', () => {
  const lines: Line[] = ['midfield', 'defence'];
  expect(kinds(clip({ lines }))).toContain('unlikely-scorer');
  expect(kinds(clip({ lines, restart: 'corner' }))).not.toContain(
    'unlikely-scorer'
  );
});
