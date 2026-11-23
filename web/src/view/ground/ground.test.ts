import { expect, test } from 'bun:test';

import { pitchLength, pitchWidth, type ClipSide } from '../clips';
import { boardSolids } from './boards';
import { goalPieces } from './goals';
import { aimCamera, groundCamera, type GroundView } from './painter';
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

/** A 300 by 400 pixel picture of the centre spot, 10 cm to a pixel. */
const view = (tilt: number, changes: Partial<GroundView> = {}): GroundView => ({
  grass: 'stripes',
  high: 400,
  metresPerPixel: 0.1,
  tilt,
  wide: 300,
  x: pitchWidth / 2,
  y: pitchLength / 2,
  ...changes
});

for (const tilt of [0, 35]) {
  test(`at ${tilt}°, the picture's centre is the point it looks at, and a metre up rises a metre up the screen`, () => {
    // The camera works out its matrices without drawing anything.
    const { project } = aimCamera(groundCamera({} as never), view(tilt));
    const [x, y] = project(pitchWidth / 2, pitchLength / 2);
    expect(x).toBeCloseTo(150, 5);
    expect(y).toBeCloseTo(200, 5);
    // Further down the pitch is lower in the picture, across is across.
    const [, below] = project(pitchWidth / 2, pitchLength / 2 + 5);
    expect(below).toBeGreaterThan(200);
    const [right] = project(pitchWidth / 2 + 1, pitchLength / 2);
    expect(right - 150).toBeCloseTo(10, 0);
    // A head 1 m above the centre spot shows 10 pixels above it.
    const [, head] = project(pitchWidth / 2, pitchLength / 2, 1);
    expect(200 - head).toBeCloseTo(10, 0);
  });
}

test("a frame's projection stays as it was when the camera moves on", () => {
  const camera = groundCamera({} as never);
  const { project } = aimCamera(camera, view(35));
  const before = project(10, 20);
  aimCamera(camera, view(0, { x: 5, y: 90 }));
  expect(project(10, 20)).toEqual(before);
});
