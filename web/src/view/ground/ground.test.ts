import { expect, test } from 'bun:test';

import { pitchLength, pitchWidth, type ClipSide } from '../clips';
import { boardSolids } from './boards';
import { goalPieces } from './goals';
import { fans } from './stands';

const side = (kit: string, home = false): ClipSide => ({
  ...(home ? { home: true } : {}),
  keeper: '#ff8c1a',
  kit,
  players: []
});
const sides = { attack: side('#0000d7'), defence: side('#d70000', true) };

test('most of the crowd wears the home kit, whichever side attacks', () => {
  const crowd = fans(sides, false);
  const home = crowd.filter(p => p.palette.s === '#d70000').length;
  const away = crowd.filter(p => p.palette.s === '#0000d7').length;
  expect(home / crowd.length).toBeGreaterThan(0.6);
  expect(away).toBeGreaterThan(0);
  expect(away).toBeLessThan(home);
});

test("after a goal the scorers' fans stand and cheer, and the others stay seated", () => {
  const seated = fans(sides, false);
  const cheering = fans(sides, true);
  const changed = (kit: string) =>
    seated.filter(
      (p, i) =>
        p.palette.s === kit && p.grid.join() !== cheering[i]!.grid.join()
    ).length;
  expect(changed('#0000d7')).toBe(
    seated.filter(p => p.palette.s === '#0000d7').length
  );
  expect(changed('#d70000')).toBe(0);
});

test('the top goal’s net is drawn before its frame, the bottom goal’s after', () => {
  const pieces = goalPieces();
  const order = (kind: 'frame' | 'net', end: 'bottom' | 'top') =>
    pieces.find(
      p => p.kind === kind && (end === 'top' ? p.order <= 0 : p.order > 0)
    )!.order;
  expect(order('net', 'top')).toBeLessThan(order('frame', 'top'));
  expect(order('net', 'bottom')).toBeGreaterThan(order('frame', 'bottom'));
  // A player on the goal line stands in front of the top net, behind the
  // bottom one.
  expect(order('net', 'top')).toBeLessThan(0);
  expect(order('net', 'bottom')).toBeGreaterThan(pitchLength);
});

test('the boards ring the pitch beyond the lines', () => {
  const { faces } = boardSolids();
  const xs = faces.position.filter((_, i) => i % 3 === 0);
  const zs = faces.position.filter((_, i) => i % 3 === 2);
  expect(Math.min(...zs)).toBeLessThan(0);
  expect(Math.max(...zs)).toBeGreaterThan(pitchLength);
  expect(Math.min(...xs)).toBeLessThan(0);
  expect(Math.max(...xs)).toBeGreaterThan(pitchWidth);
});
