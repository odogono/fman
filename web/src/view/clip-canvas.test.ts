import { expect, test } from 'bun:test';

import { fitClipCanvas, onScreenPitch } from './clip-canvas';
import { pitchLength } from './clips';

/** A canvas laid out `width` by `height` CSS pixels. */
const box = (width: number, height: number) =>
  ({
    clientHeight: height,
    clientWidth: width,
    height: 0,
    width: 0
  }) as unknown as HTMLCanvasElement;

test('on its side, the pitch’s top end is the screen’s right', () => {
  expect(onScreenPitch(true, 10, 0)).toEqual({ x: pitchLength, y: 10 });
  expect(onScreenPitch(true, 10, pitchLength)).toEqual({ x: 0, y: 10 });
  expect(onScreenPitch(false, 10, 20)).toEqual({ x: 10, y: 20 });
});

test('on its side, the camera keeps its height and shows 1.25 to 2 times as much length', () => {
  expect(fitClipCanvas(box(1000, 600), true)).toMatchObject({
    height: 600,
    landscape: true,
    width: 1000
  });
  // Too long a box shows no more than twice the height; too short, 1.25.
  expect(fitClipCanvas(box(2000, 600), true).width).toBe(1200);
  expect(fitClipCanvas(box(700, 600), true).width).toBe(750);
  expect(fitClipCanvas(box(400, 600)).height).toBe(600);
});
