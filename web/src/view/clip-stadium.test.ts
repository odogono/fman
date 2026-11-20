import { expect, test } from 'bun:test';

import { goalArt } from './assets/clip-sprites';
import { boardPieces, crowdPieces, goalPieces } from './clip-stadium';
import { pitchLength, type ClipSide } from './clips';

const side = (kit: string, home = false): ClipSide => ({
  ...(home ? { home: true } : {}),
  keeper: '#ff8c1a',
  kit,
  players: []
});
const sides = { attack: side('#0000d7'), defence: side('#d70000', true) };

test('most of the crowd wears the home kit, whichever side attacks', () => {
  const crowd = crowdPieces(sides, false);
  const home = crowd.filter(p => p.palette.s === '#d70000').length;
  const away = crowd.filter(p => p.palette.s === '#0000d7').length;
  expect(home / crowd.length).toBeGreaterThan(0.6);
  expect(away).toBeGreaterThan(0);
  expect(away).toBeLessThan(home);
});

test("after a goal the scorers' fans stand and cheer, and the others stay seated", () => {
  const seated = crowdPieces(sides, false);
  const cheering = crowdPieces(sides, true);
  const changed = (kit: string) =>
    seated.filter((p, i) => p.palette.s === kit && p.grid !== cheering[i]!.grid)
      .length;
  expect(changed('#0000d7')).toBe(
    seated.filter(p => p.palette.s === '#0000d7').length
  );
  expect(changed('#d70000')).toBe(0);
});

test('the top goal’s net is behind its frame, the bottom goal’s in front', () => {
  const pieces = goalPieces();
  const depth = (grid: readonly string[]) =>
    pieces.find(p => p.grid === grid)!.depth;
  expect(depth(goalArt.top.net)).toBeLessThan(depth(goalArt.top.frame));
  expect(depth(goalArt.bottom.net)).toBeGreaterThan(
    depth(goalArt.bottom.frame)
  );
  // A player on the goal line stands in front of the top net, behind the
  // bottom one.
  expect(depth(goalArt.top.net)).toBeLessThan(0);
  expect(depth(goalArt.bottom.net)).toBeGreaterThan(pitchLength);
});

test('the boards ring the pitch beyond the lines', () => {
  const boards = boardPieces();
  expect(boards.some(p => p.at.y < 0)).toBe(true);
  expect(boards.some(p => p.at.y > pitchLength)).toBe(true);
  expect(boards.some(p => p.at.x < 0)).toBe(true);
  expect(boards.some(p => p.at.x > 68)).toBe(true);
});
