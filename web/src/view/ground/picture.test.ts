import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, setDefaultTimeout, test } from 'bun:test';

import type { Moment } from '../../sim/moments';
import { ballLiftMetres } from '../clip-sprites';
import {
  createClipScript,
  pitchLength,
  pitchWidth,
  type ClipInput,
  type ClipSide,
  type Line
} from '../clips';
import { celebrationFrame } from '../cup-celebration';
import { framePicture, patchFor, type Picture } from './picture';

// Every clip is played out on three boxes, which is slow on a busy runner.
setDefaultTimeout(60_000);

test('down to square, the camera keeps its width and the box sets the length', () => {
  expect(patchFor(40, 400, 500)).toEqual({ length: 50, width: 40 });
  expect(patchFor(40, 400, 400)).toEqual({ length: 40, width: 40 });
});

test('wider than square, the box keeps a square’s length and widens, closing in', () => {
  const patch = patchFor(40, 1600, 1000);
  expect(patch.length).toBeCloseTo(40);
  expect(patch.width).toBeCloseTo(64);
  // The moment's tighter camera narrows it in the same way.
  expect(patchFor(30, 1600, 1000).length).toBeCloseTo(30);
});

test('past the pitch and a little touchline, a wider box shows more length', () => {
  const patch = patchFor(40, 2000, 1000);
  expect(patch.width).toBe(pitchWidth + 12);
  expect(patch.length).toBeCloseTo((pitchWidth + 12) / 2);
});

const middle = { x: pitchWidth / 2, y: pitchLength / 2 };

test('from the tilt, the patch reaches further up the pitch than down, and widens away', () => {
  // 40 m by 40 m at its centre, as measured for #285.
  const { patch, x, y } = framePicture({ across: 40, ...middle }, middle, {
    height: 400,
    width: 400
  });
  expect(x).toBeCloseTo(middle.x);
  expect(y).toBeCloseTo(middle.y);
  const [farLeft, farRight, nearRight, nearLeft] = patch;
  expect(y - farLeft.y).toBeCloseTo(27.9, 1);
  expect(nearLeft.y - y).toBeCloseTo(21.7, 1);
  expect(farRight.x - farLeft.x).toBeGreaterThan(40);
  expect(nearRight.x - nearLeft.x).toBeLessThan(40);
});

/** A tall phone, a square box and a wide window, in CSS pixels. */
const boxes = {
  square: { height: 400, width: 400 },
  tall: { height: 760, width: 380 },
  wide: { height: 600, width: 1200 }
};

const inBox = (
  [px, py]: readonly [number, number],
  box: Readonly<{ height: number; width: number }>
) =>
  px >= -1e-6 &&
  px <= box.width + 1e-6 &&
  py >= -1e-6 &&
  py <= box.height + 1e-6;

test("the patch's corners are the picture's corners, as the mini-map draws them", () => {
  for (const box of Object.values(boxes)) {
    const picture = framePicture({ across: 30, x: 20, y: 30 }, middle, box);
    const corners = picture.patch.map(c => picture.project(c.x, c.y));
    const expected = [
      [0, 0],
      [box.width, 0],
      [box.width, box.height],
      [0, box.height]
    ];
    corners.forEach(([px, py], i) => {
      expect(px).toBeCloseTo(expected[i]![0]!, 6);
      expect(py).toBeCloseTo(expected[i]![1]!, 6);
    });
  }
});

/** The ground shown beyond each line: goal lines at the top and bottom edges, touchlines at the bottom. */
const beyond = ({ patch }: Picture) => ({
  bottom: patch[2].y - pitchLength,
  left: -patch[3].x,
  right: patch[2].x - pitchWidth,
  top: -patch[0].y
});

test('the picture shows no more than 8 m beyond a goal line and 6 m beyond a touchline', () => {
  for (const box of Object.values(boxes)) {
    for (const across of [30, 40]) {
      for (const x of [
        -20,
        0,
        10,
        pitchWidth / 2,
        pitchWidth,
        pitchWidth + 20
      ]) {
        for (const y of [-30, 0, 20, pitchLength / 2, pitchLength, 140]) {
          // A subject on the pitch never needs more.
          const subject = {
            x: Math.min(Math.max(x, 0), pitchWidth),
            y: Math.min(Math.max(y, 0), pitchLength)
          };
          const shown = beyond(framePicture({ across, x, y }, subject, box));
          expect(shown.top).toBeLessThanOrEqual(8 + 1e-6);
          expect(shown.bottom).toBeLessThanOrEqual(8 + 1e-6);
          expect(shown.left).toBeLessThanOrEqual(6 + 1e-6);
          expect(shown.right).toBeLessThanOrEqual(6 + 1e-6);
        }
      }
    }
  }
  // Pressed against the far goal, the margin holds at the picture's top.
  const far = beyond(
    framePicture({ across: 40, x: 34, y: 0 }, { x: 34, y: 6 }, boxes.square)
  );
  expect(far.top).toBeCloseTo(8);
});

test('a picture too big for the margins is centred on the pitch', () => {
  const shown = beyond(
    framePicture({ across: 40, x: 0, y: 0 }, middle, {
      height: 1600,
      width: 400
    })
  );
  expect(shown.top).toBeGreaterThan(8);
  expect(shown.top).toBeCloseTo(shown.bottom);
});

test('the subject beats the margins', () => {
  // The ball in the far net, on a short wide box looking up the pitch.
  const picture = framePicture(
    { across: 30, x: 34, y: 60 },
    { x: 34, y: -2 },
    boxes.wide
  );
  expect(inBox(picture.project(34, -2 - 2.99), boxes.wide)).toBe(true);
});

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
const side = (kit: string): ClipSide => ({
  keeper: '#ff8c1a',
  kit,
  players: lines.map((line, i) => ({ label: `${kit} ${i}`, line }))
});
const kinds: readonly Moment['kind'][] = [
  'clearance',
  'goal',
  'injury',
  'near-miss',
  'save'
];

/** The subject at least 3 m inside every edge of `picture`, on the ground. */
const keepsInside = (
  picture: Picture,
  subject: Readonly<{ x: number; y: number }>,
  box: Readonly<{ height: number; width: number }>
) =>
  [
    [0, 0],
    [-2.99, 0],
    [2.99, 0],
    [0, -2.99],
    [0, 2.99]
  ].every(([dx, dy]) =>
    inBox(picture.project(subject.x + dx!, subject.y + dy!), box)
  );

test('at the tilt, every clip keeps its subject, and the ball, in the picture on a tall phone, a square box and a wide window', () => {
  for (let seed = 0; seed < 12; seed++) {
    for (const kind of kinds) {
      const input: ClipInput = {
        attack: side('#d70000'),
        attackingUp: seed % 2 === 0,
        defence: side('#0000d7'),
        kind,
        minute: 34,
        score: [1, 0],
        seed,
        shooter: 9
      };
      const script = createClipScript(input);
      for (let at = 0; at < script.length; at += 4) {
        const frame = script.frame(at);
        for (const box of Object.values(boxes)) {
          const picture = framePicture(frame.focus, frame.subject, box);
          expect(keepsInside(picture, frame.subject, box)).toBe(true);
          const { ball } = frame;
          if (ball.x === frame.subject.x && ball.y === frame.subject.y) {
            expect(
              inBox(
                picture.project(ball.x, ball.y, ball.height * ballLiftMetres),
                box
              )
            ).toBe(true);
          }
        }
      }
    }
  }
});

test('the cup celebration keeps its huddle in the picture', () => {
  const sides = { losers: side('#0000d7'), winners: side('#d70000') };
  for (const trophy of [0, 0.5, 1]) {
    const frame = celebrationFrame(sides, { stars: 0, text: 0, trophy }, 0);
    for (const box of Object.values(boxes)) {
      const picture = framePicture(frame.focus, frame.subject, box);
      expect(keepsInside(picture, frame.subject, box)).toBe(true);
    }
  }
});

test('nothing outside the painter’s side names the tilt (ADR 0018)', () => {
  const view = join(import.meta.dir, '..');
  const naming = readdirSync(view, { recursive: true })
    .map(String)
    .filter(file => file.endsWith('.ts') && !file.startsWith('ground'))
    .filter(file => /\btilt/i.test(readFileSync(join(view, file), 'utf8')));
  expect(naming).toEqual([]);
});
