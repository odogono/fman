import { expect, test } from 'bun:test';

import { goalArt } from './assets/clip-sprites';
import {
  boardPieces,
  crowdPieces,
  goalPieces,
  sideGoalArt,
  sidewaysPitch
} from './clip-stadium';
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

test('on its side, the stands and boards ring the turned pitch, facing it', () => {
  const crowd = crowdPieces(sides, false, sidewaysPitch);
  const { height, width } = sidewaysPitch;
  // The long stands are now the top and bottom, the ends left and right.
  expect(crowd.some(p => p.at.x > width + 4)).toBe(true);
  expect(crowd.some(p => p.at.y > height + 4)).toBe(true);
  expect(Math.max(...crowd.map(p => p.at.x))).toBeGreaterThan(pitchLength);
  const boards = boardPieces(sidewaysPitch);
  expect(boards.some(p => p.at.x > width && p.at.y < height)).toBe(true);
  expect(boards.some(p => p.at.y > height)).toBe(true);
});

test('on its side, a goal stands at each end with its net behind the line', () => {
  const pieces = goalPieces(true);
  const { height, width } = sidewaysPitch;
  const left = pieces.filter(p => !p.mirrored);
  const right = pieces.filter(p => p.mirrored);
  expect(left).toHaveLength(3);
  expect(right).toHaveLength(3);
  expect(left.every(p => p.at.x < 0)).toBe(true);
  expect(right.every(p => p.at.x > width)).toBe(true);
  // The net sits behind anyone between the posts, the near post in front.
  const depth = (grid: readonly string[]) =>
    left.find(p => p.grid === grid)!.depth;
  expect(depth(sideGoalArt.net)).toBeLessThan(depth(sideGoalArt.crossbar));
  expect(depth(sideGoalArt.crossbar)).toBeLessThan(height / 2);
  expect(depth(sideGoalArt.near)).toBeGreaterThan(height / 2);
  // Every grid is a rectangle of the same width, so the parts line up.
  const widths = new Set(
    [sideGoalArt.net, sideGoalArt.crossbar, sideGoalArt.near].flatMap(grid =>
      grid.map(row => row.length)
    )
  );
  expect(widths.size).toBe(1);
});
