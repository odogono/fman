import { fontHeight } from './assets/clip-font';
import { drawText, textColumns } from './clip-card';
import type { ClipGoal } from './clips';

// The goal announcement over a clip: GOAL! in big letters that drop in one
// by one, confetti in the scorer's kit, and under the letters a tile with
// the new score beside the scorer's name and the minute. Drawn on the
// art-pixel grid, as the match-time card is.

const ink = '#141414';
const white = '#f4f4f4';
const yellow = '#fac81e';
const shadow = 'rgba(0, 0, 0, 0.5)';

const word = 'GOAL!';
/** The letters' and the tile's font pixels, in art pixels. */
const letterSize = 4;
const tileSize = 2;
/** Each letter drops in this many frames after the last, over `drop`. */
const letterGap = 4;
const drop = 8;
/** The tile shows from this frame until the letters fall away. */
const tileFrom = 25;
/** The letters fall away over the announcement's last frames. */
const fallFrames = 15;
const confettiPieces = 90;

const clamp01 = (u: number) => Math.max(0, Math.min(1, u));

/** A fixed pseudo-random number in [0, 1) for `n`, for the confetti. */
const hash = (n: number) => {
  let h = Math.imul(n ^ 61 ^ (n >>> 16), 9);
  h ^= h >>> 4;
  h = Math.imul(h, 0x27_d4_eb_2d);
  h ^= h >>> 15;
  return (h >>> 0) / 4_294_967_296;
};

const channels = (hex: string) =>
  [1, 3, 5].map(k => Number.parseInt(hex.slice(k, k + 2), 16));

/** `hex` darkened towards ink. */
const darker = (hex: string) =>
  `rgb(${channels(hex)
    .map(c => Math.round(c * 0.6))
    .join(', ')})`;

/** White text, or ink on a light kit. */
export const textOn = (kit: string) => {
  const [r, g, b] = channels(kit);
  return 0.299 * r! + 0.587 * g! + 0.114 * b! > 160 ? ink : white;
};

/** `text` in `colour` with an ink outline and a drop shadow. */
const outlined = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  colour: string
) => {
  for (const [dx, dy] of [
    [2, 2],
    [1, 2],
    [2, 1]
  ] as const) {
    drawText(ctx, text, x + dx * size, y + dy * size, size, shadow);
  }
  for (const dx of [-1, 0, 1]) {
    for (const dy of [-1, 0, 1]) {
      if (dx || dy) {
        drawText(ctx, text, x + dx * size, y + dy * size, size, ink);
      }
    }
  }
  drawText(ctx, text, x, y, size, colour);
};

/** The tile's text: the new score, and the scorer's name and the minute. */
export const goalTile = (goal: ClipGoal, columns: number) => {
  const score = `${goal.score[0] ?? 0}-${goal.score[1] ?? 0}`;
  const scorer = `${goal.name}  ${goal.minute}`.trim();
  const width = (size: number) =>
    textColumns(score) * size + 10 + textColumns(scorer) * size + 12;
  // A long name drops to the small letters to fit the picture.
  const size = width(tileSize) <= columns - 8 ? tileSize : 1;
  return {
    height: fontHeight * size + 8,
    score,
    scorer,
    scoreWidth: textColumns(score) * size + 10,
    size,
    width: width(size)
  };
};

/**
 * Draws the goal announcement over a picture `columns` by `rows` art
 * pixels, each `unit` device pixels, in the scorer's `kit`.
 */
export const drawGoal = (
  ctx: CanvasRenderingContext2D,
  goal: ClipGoal,
  kit: string,
  unit: number,
  columns: number,
  rows: number
) => {
  const { at } = goal;
  const fallStart = goal.length - fallFrames;
  const fall = clamp01((at - fallStart) / fallFrames) ** 3;
  const rect = (x: number, y: number, w: number, h: number) =>
    ctx.fillRect(
      Math.round(x) * unit,
      Math.round(y) * unit,
      Math.round(w) * unit,
      Math.round(h) * unit
    );

  // Confetti, falling from the top and swaying.
  const colours = [kit, white, yellow, darker(kit)];
  for (let k = 0; k < confettiPieces; k++) {
    const age = at - (2 + hash(k) * 10);
    if (age < 0) {
      continue;
    }
    const y = -4 + age * (1.2 + hash(k + 600) * 2.4);
    if (y > rows) {
      continue;
    }
    const x = hash(k + 300) * columns + Math.sin(age * 0.15 + k) * 2;
    ctx.fillStyle = colours[k % colours.length]!;
    rect(x, y, 2, k % 3 ? 2 : 1);
  }

  // The letters drop in one by one, overshoot and settle, then fall away.
  const total = textColumns(word) * letterSize;
  const top = Math.round(rows * 0.3);
  let left = Math.round((columns - total) / 2);
  [...word].forEach((c, k) => {
    const u = clamp01((at - k * letterGap) / drop);
    if (u > 0) {
      const bounce = u < 1 ? -(1 - u) * 75 + Math.sin(u * Math.PI) * 7 : 0;
      const y = Math.round(top + bounce + fall * (rows * 0.7 + k * 10));
      outlined(
        ctx,
        c,
        left * unit,
        y * unit,
        letterSize * unit,
        c === '!' ? yellow : white
      );
    }
    left += (textColumns(c) + 1) * letterSize;
  });

  // The tile: the score on white, the scorer and minute in their kit.
  if (at >= tileFrom && at < fallStart) {
    const tile = goalTile(goal, columns);
    const x = Math.round((columns - tile.width) / 2);
    const y = top + fontHeight * letterSize + 6;
    ctx.fillStyle = ink;
    rect(x - 1, y - 1, tile.width + 2, tile.height + 2);
    ctx.fillStyle = kit;
    rect(x, y, tile.width, tile.height);
    ctx.fillStyle = white;
    rect(x, y, tile.scoreWidth, tile.height);
    ctx.fillStyle = ink;
    rect(x + tile.scoreWidth, y, 1, tile.height);
    drawText(
      ctx,
      tile.score,
      (x + 5) * unit,
      (y + 4) * unit,
      tile.size * unit,
      ink
    );
    drawText(
      ctx,
      tile.scorer,
      (x + tile.scoreWidth + 6) * unit,
      (y + 4) * unit,
      tile.size * unit,
      textOn(kit)
    );
  }
};
