import { expect, test } from 'bun:test';
import { Vec3 } from 'ogl';

import { inkColours } from '../clip-match';
import { pitchLength, pitchWidth } from '../clips';
import { clubGround, evenly, favouring } from '../match-ground';
import { boardSolids } from './boards';
import { goalPieces } from './goals';
import { finalPlan, groundPlan, type GroundPlan } from './grounds';
import { aimCamera, groundCamera, type GroundView } from './painter';
import { shear } from './picture';
import { fans, standsSolid } from './stands';

const home = '#d70000';
const away = '#0000d7';
const homeCrowd = favouring(home, away);
const plan = (club: number, division = 1, seats = '#d70000'): GroundPlan =>
  groundPlan({ club, division, seats });
const { stands } = plan(1);
const clubs = Array.from({ length: 64 }, (_, i) => i + 1);

const wearing = (crowd: ReturnType<typeof fans>, kit: string) =>
  crowd.filter(p => p.palette.s === kit).length;

test('most of a crowd wears the kit of the side it favours', () => {
  const crowd = fans(homeCrowd, stands);
  expect(wearing(crowd, home) / crowd.length).toBeGreaterThan(0.6);
  expect(wearing(crowd, away)).toBeGreaterThan(0);
  expect(wearing(crowd, away)).toBeLessThan(wearing(crowd, home));
});

test('a crowd favouring neither side wears both kits about as much', () => {
  const crowd = fans(evenly(home, away), stands);
  for (const kit of [home, away]) {
    expect(wearing(crowd, kit) / crowd.length).toBeGreaterThan(0.3);
    expect(wearing(crowd, kit) / crowd.length).toBeLessThan(0.5);
  }
});

test("after a goal the scorers' fans stand and cheer, and the others stay seated", () => {
  const seated = fans(homeCrowd, stands);
  const cheering = fans(homeCrowd, stands, away);
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
const view = (changes: Partial<GroundView> = {}): GroundView => ({
  ground: clubGround({ club: 1, division: 1, seats: home }, homeCrowd),
  high: 400,
  metresPerPixel: 0.1,
  wide: 300,
  x: pitchWidth / 2,
  y: pitchLength / 2,
  ...changes
});

test("the picture's centre is the point it looks at, and a metre up rises a metre up the screen", () => {
  // The camera works out its matrices without drawing anything.
  const project = aimCamera(groundCamera({} as never), view());
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

test("the picture's projection is where the 3D camera draws the pitch's points", () => {
  const camera = groundCamera({} as never);
  const project = aimCamera(camera, view({ x: 20, y: 30 }));
  for (const [x, y, up] of [
    [20, 30, 0],
    [5, 10, 0],
    [40, 50, 2],
    [-3, 45, 1]
  ] as const) {
    const at = new Vec3(x, up, y - shear * up).applyMatrix4(
      camera.projectionViewMatrix
    );
    const [px, py] = project(x, y, up);
    expect(px).toBeCloseTo(((at.x + 1) / 2) * 300, 4);
    expect(py).toBeCloseTo(((1 - at.y) / 2) * 400, 4);
  }
});

test("a frame's projection stays as it was when the camera moves on", () => {
  const camera = groundCamera({} as never);
  const project = aimCamera(camera, view());
  const before = project(10, 20);
  aimCamera(camera, view({ x: 5, y: 90 }));
  expect(project(10, 20)).toEqual(before);
});

test('a club gets the same ground every time, and clubs’ grounds differ', () => {
  expect(plan(12)).toEqual(plan(12));
  const grounds = clubs.map(club => plan(club));
  expect(new Set(grounds.map(g => g.grass)).size).toBeGreaterThan(3);
  expect(new Set(grounds.map(g => JSON.stringify(g))).size).toBeGreaterThan(60);
});

test("a ground's seats are in its club's colours", () => {
  expect(plan(5, 2, '#00d700').seats).toBe('#00d700');
});

const tallest = (g: GroundPlan) =>
  Math.max(...g.stands.map(s => s.rows * s.riser));

test('the higher the division a club began in, the taller its stands', () => {
  for (const club of clubs) {
    const heights = [1, 2, 3, 4].map(d => tallest(plan(club, d)));
    expect(heights).toEqual(heights.toSorted((a, b) => b - a));
    expect(heights[0]).toBeGreaterThan(heights[3]!);
    // The club picks the same sides and pattern in any division.
    expect(plan(club, 4).grass).toBe(plan(club, 1).grass);
  }
});

test('only a Fourth Division ground leaves a side bare, and never both touchlines', () => {
  for (const club of clubs) {
    for (const division of [1, 2, 3]) {
      expect(plan(club, division).stands).toHaveLength(4);
    }
    const sides = plan(club, 4).stands.map(s => s.side);
    expect(sides.filter(s => s === 'left' || s === 'right')).toHaveLength(2);
  }
  expect(clubs.some(club => plan(club, 4).stands.length < 4)).toBe(true);
});

test('the final ground is grander than any club’s: tall, seated, roofed stands all round', () => {
  expect(finalPlan.stands.map(s => s.side).toSorted()).toEqual([
    'bottom',
    'left',
    'right',
    'top'
  ]);
  expect(finalPlan.stands.every(s => s.seated && s.roof)).toBe(true);
  const grandest = Math.max(
    ...clubs.flatMap(club => [1, 2, 3, 4].map(d => tallest(plan(club, d))))
  );
  const lowest = Math.min(...finalPlan.stands.map(s => s.rows * s.riser));
  expect(lowest).toBeGreaterThan(grandest);
});

test('the final ground’s seats are in no kit’s colours, and its steps are not bare concrete', () => {
  expect(inkColours).not.toContain(finalPlan.seats as never);
  const { steps: _steps, ...bare } = finalPlan;
  expect(standsSolid(finalPlan).colour).not.toEqual(standsSolid(bare).colour);
});
