import { expect, test } from 'bun:test';

import {
  kickOffFrame,
  type ClipPlayer,
  type ClipSide,
  type Line
} from './clips';
import { celebrationFrame, type CelebrationSides } from './cup-celebration';

const eleven = (name: string): ClipPlayer[] =>
  (
    [
      'keeper',
      ...Array<Line>(4).fill('defence'),
      ...Array<Line>(4).fill('midfield'),
      ...Array<Line>(2).fill('attack')
    ] as Line[]
  ).map((line, i) => ({ label: `${name} ${i}`, line }));
const winners: ClipSide = {
  home: true,
  keeper: '#7cd616',
  kit: '#d70000',
  players: eleven('Win')
};
const losers: ClipSide = {
  keeper: '#ff8c1a',
  kit: '#0000d7',
  players: eleven('Lose')
};
const sides: CelebrationSides = { losers, winners };

const at = (trophy: number, text: number, stars: number, clock = 0) =>
  celebrationFrame(sides, { stars, text, trophy }, clock);
const ofSide = (frame: ReturnType<typeof at>, side: 'attack' | 'defence') =>
  frame.players.filter(p => p.side === side);

test('at the start the winners stand in shape and the cup waits on the grass', () => {
  const frame = at(0, 0, 0);
  const shape = kickOffFrame(winners, losers, '').players;
  expect(ofSide(frame, 'attack').map(p => [p.x, p.y])).toEqual(
    shape.filter(p => p.side === 'attack').map(p => [p.x, p.y])
  );
  expect(frame.trophy?.raise).toBe(0);
  expect(frame.confetti).toBeUndefined();
  expect(frame.cheer).toBe(false);
  expect(ofSide(frame, 'defence').every(p => p.pose === 'stand')).toBe(true);
});

test('while the trophy draws, the winners run in and the losers sink', () => {
  const running = at(0.4, 0, 0);
  expect(ofSide(running, 'attack').every(p => p.pose === 'cheer')).toBe(true);
  const gathered = at(1, 0, 0);
  const huddle = gathered.trophy!;
  for (const p of ofSide(gathered, 'attack')) {
    expect(Math.hypot(p.x - huddle.x, p.y - huddle.y)).toBeLessThan(6);
  }
  for (const p of ofSide(gathered, 'defence')) {
    expect(p.pose).toBe('slump');
    expect(Math.hypot(p.x - huddle.x, p.y - huddle.y)).toBeGreaterThan(7);
  }
});

test('while the title prints, the captain lifts the cup and the crowd stands', () => {
  const before = at(1, 0.2, 0);
  expect(before.players.some(p => p.pose === 'lift')).toBe(false);
  expect(before.trophy!.raise).toBe(0);
  const overhead = at(1, 0.5, 0);
  const high = at(1, 1, 0);
  const captain = (frame: typeof high) =>
    frame.players.find(p => p.pose === 'lift')!;
  expect(captain(overhead).poseFrame).toBe(1);
  expect(captain(high).poseFrame).toBe(2);
  expect(high.trophy!.raise).toBeGreaterThan(overhead.trophy!.raise);
  expect(overhead.trophy!.raise).toBeGreaterThan(2);
  expect([high.trophy!.x, high.trophy!.y]).toEqual([
    captain(high).x,
    captain(high).y
  ]);
  expect(high.cheer).toBe(true);
});

const specks = (stars: number) => at(1, 1, stars).confetti?.length ?? 0;

test('each row of stars throws a burst of confetti', () => {
  expect(specks(0)).toBe(0);
  const one = specks(1 / 9);
  expect(one).toBeGreaterThan(0);
  expect(specks(1)).toBe(one * 9);
});

test('holding on the lift, the others keep jumping and the confetti falls', () => {
  const now = at(1, 1, 1, 100);
  const later = at(1, 1, 1, 109);
  expect(now.players.map(p => [p.x, p.y])).toEqual(
    later.players.map(p => [p.x, p.y])
  );
  expect(now.players.map(p => p.poseFrame)).not.toEqual(
    later.players.map(p => p.poseFrame)
  );
  expect(now.confetti).not.toEqual(later.confetti);
});

test('under reduced motion it shows the lift from the start, still', () => {
  const still = celebrationFrame(
    sides,
    { stars: 0, text: 0, trophy: 0 },
    0,
    true
  );
  expect(still.players.find(p => p.pose === 'lift')?.poseFrame).toBe(2);
  expect(still.confetti).toBeUndefined();
  const later = celebrationFrame(
    sides,
    { stars: 1, text: 1, trophy: 1 },
    50,
    true
  );
  expect(later).toEqual(
    celebrationFrame(sides, { stars: 0, text: 0, trophy: 0 }, 0, true)
  );
  expect(
    ofSide(still, 'attack')
      .filter(p => p.pose !== 'lift')
      .every(p => p.pose === 'celebrate')
  ).toBe(true);
});
