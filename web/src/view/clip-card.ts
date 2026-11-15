import { fontGlyphs, fontHeight } from './assets/clip-font';
import type { ClipCard } from './clips';

// The highlights' own lettering and the match-time card, drawn over the
// picture on a grid of art pixels that scales with the canvas, so they take
// the same share of it on any screen and stay crisp.

/** The picture is this many art pixels across, for the lettering. */
export const overlayColumns = 210;

const ink = '#141414';
const white = '#f4f4f4';
const yellow = '#fac81e';

/** How big an art pixel is, in device pixels, on a canvas this wide. */
export const overlayUnit = (deviceWidth: number) =>
  Math.max(1, Math.round(deviceWidth / overlayColumns));

/**
 * The glyph for `c`, in capitals: an accented letter takes its plain one
 * and an apostrophe the prime; anything else the font lacks is a space.
 */
const glyph = (c: string) => {
  const plain = c.normalize('NFD').charAt(0).toUpperCase();
  return fontGlyphs[plain === "'" ? '′' : plain] ?? fontGlyphs[' ']!;
};

/** The width of `text`, in the font's pixels: its letters a pixel apart. */
export const textColumns = (text: string) =>
  [...text].reduce((width, c) => width + glyph(c)[0]!.length + 1, -1);

/** Draws `text` with its top left at `x`, `y`, each font pixel `size` square. */
export const drawText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  colour: string
) => {
  ctx.fillStyle = colour;
  let left = x;
  for (const c of text) {
    const grid = glyph(c);
    grid.forEach((row, r) => {
      for (let k = 0; k < row.length; k++) {
        if (row[k] === '#') {
          ctx.fillRect(left + k * size, y + r * size, size, size);
        }
      }
    });
    left += (grid[0]!.length + 1) * size;
  }
};

/** The minute's figures and the restart's letters, in art pixels a font pixel. */
const minuteSize = 4;
const textSize = 2;
/** The card's margins, in art pixels: a kit stripe and space at the left. */
const stripe = 3;
const left = 8;
const right = 6;
const edge = 5;
const gap = 6;

/** The card's size in art pixels. */
export const cardSize = (card: ClipCard) => {
  const minute = card.minute ? textColumns(card.minute) * minuteSize : 0;
  const text = card.text ? textColumns(card.text) * textSize : 0;
  const rows = [
    card.minute ? fontHeight * minuteSize : 0,
    card.text ? fontHeight * textSize : 0
  ].filter(Boolean);
  return {
    height:
      edge * 2 + rows.reduce((a, b) => a + b, 0) + gap * (rows.length - 1),
    width: left + Math.max(minute, text) + right
  };
};

/**
 * The match-time card in the top left, in device pixels: ink with a white
 * edge, a stripe in the kit of the side with the ball, the minute large in
 * yellow and the restart under it. It slides in from the left as `shown`
 * goes from 0 to 1.
 */
export const drawCard = (
  ctx: CanvasRenderingContext2D,
  card: ClipCard,
  kit: string,
  unit: number
) => {
  if (card.shown <= 0) {
    return;
  }
  const { height, width } = cardSize(card);
  const x = Math.round(8 - (1 - card.shown) * (width + 10)) * unit;
  const y = 8 * unit;
  ctx.fillStyle = white;
  ctx.fillRect(x - unit, y - unit, (width + 2) * unit, (height + 2) * unit);
  ctx.fillStyle = ink;
  ctx.fillRect(x, y, width * unit, height * unit);
  ctx.fillStyle = kit;
  ctx.fillRect(x, y, stripe * unit, height * unit);
  let top = y + edge * unit;
  if (card.minute) {
    drawText(ctx, card.minute, x + left * unit, top, minuteSize * unit, yellow);
    top += (fontHeight * minuteSize + gap) * unit;
  }
  if (card.text) {
    drawText(ctx, card.text, x + left * unit, top, textSize * unit, white);
  }
};
