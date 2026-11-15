import { paintClip, type ClipSides } from './clip-canvas';
import { overlayUnit } from './clip-card';
import {
  kickOffFrame,
  type ClipFrame,
  type ClipScript,
  type ClipSide
} from './clips';

// The wipe between the highlights' pictures: thin diagonal stripes in both
// kits sweep across from the left, the next picture showing behind them. It
// plays over the last 0.4 s of one picture and the first 0.4 s of the next,
// so the clips keep their lengths and the sim its timer (ADR 0013).

/** One picture of the highlights: a clip's frame, or a still, and its sides. */
export type ClipPicture = Readonly<{ frame: ClipFrame; sides: ClipSides }>;

/**
 * A wipe under way: the picture going out (`from`) when the shot is the one
 * coming in, or the one coming in (`to`) when the shot is going out, and how
 * far the stripes have swept, 0 to 1.
 */
export type ClipWipe = Readonly<
  | { from: ClipPicture; progress: number; to?: undefined }
  | { from?: undefined; progress: number; to: ClipPicture }
>;

/** What the clip canvas paints: a picture, and a wipe if one is under way. */
export type ClipShot = ClipPicture & Readonly<{ wipe?: ClipWipe }>;

/** How long a wipe takes, in frames at 50 a second: 0.8 s. */
export const wipeFrames = 40;
const half = wipeFrames / 2;

/**
 * One stage of the highlights in order: the kick-off still, each clip,
 * then the full-time still, `length` frames long.
 */
export type ClipStage = Readonly<{
  length: number;
  picture: (at: number) => ClipPicture;
}>;

/** A clip as a stage of the highlights. */
export const clipStage = (script: ClipScript): ClipStage => {
  const sides = { attack: script.input.attack, defence: script.input.defence };
  return {
    length: script.length,
    picture: at => ({ frame: script.frame(at), sides })
  };
};

/**
 * The still pitch under "Kick-off" or "Full time", both sides in shape, as
 * a stage `length` frames long.
 */
export const stillStage = (
  home: ClipSide,
  away: ClipSide,
  caption: string,
  length: number
): ClipStage => {
  const picture = {
    frame: kickOffFrame(home, away, caption),
    sides: { attack: home, defence: away }
  };
  return { length, picture: () => picture };
};

/**
 * The shot at frame `at` of stage `index`: its picture, wiped in from the
 * stage before over its first 0.4 s and out to the stage after over its
 * last 0.4 s. Each picture holds still at its end while the other plays.
 */
export const shotAt = (
  stages: readonly ClipStage[],
  index: number,
  at: number
): ClipShot => {
  const stage = stages[index]!;
  const picture = stage.picture(at);
  const before = stages[index - 1];
  const after = stages[index + 1];
  if (before && at < half) {
    return {
      ...picture,
      wipe: {
        from: before.picture(before.length - 1),
        progress: (at + half) / wipeFrames
      }
    };
  }
  // A clip too short for both halves wipes in before it wipes out.
  const out = Math.max(half, stage.length - half);
  if (after && at >= out) {
    return {
      ...picture,
      wipe: {
        progress: Math.min(1, (at - stage.length + half) / wipeFrames),
        to: after.picture(0)
      }
    };
  }
  return picture;
};

/**
 * Where the stripes have got on `row` of a picture `columns` by `rows` art
 * pixels: the columns left of `swept` show the next picture, and each
 * stripe covers `from` to `to`. They lean, the lower rows behind.
 */
export const wipeRow = (
  progress: number,
  row: number,
  columns: number,
  rows: number
) => {
  const total = stripeWidths.reduce((a, b) => a + b, 0);
  const lead = Math.round(
    progress * (columns + lean * rows + total) - lean * row
  );
  let edge = lead;
  const stripes = stripeWidths.map((width, k) => {
    const stripe = { from: edge - width, k, to: edge };
    edge -= width;
    return stripe;
  });
  return { stripes, swept: edge };
};

/** The stripes from the leading edge: ink, home, white, away, ink. */
const stripeWidths = [2, 10, 10, 10, 2] as const;
/** How far each row lags the one above, in columns. */
const lean = 0.6;
const ink = '#141414';
const white = '#f4f4f4';

/**
 * Paints `shot` into a box `width` by `height` CSS pixels: its picture, and
 * during a wipe the next picture behind the stripes, on the art-pixel grid.
 */
export const paintShot = (
  ctx: CanvasRenderingContext2D,
  shot: ClipShot,
  size: Readonly<{ height: number; ratio: number; width: number }>
) => {
  const { wipe } = shot;
  if (!wipe) {
    paintClip(ctx, shot.frame, shot.sides, size);
    return;
  }
  const out = wipe.from ?? shot;
  const next = wipe.to ?? shot;
  paintClip(ctx, out.frame, out.sides, size);
  const deviceWidth = Math.round(size.width * size.ratio);
  const deviceHeight = Math.round(size.height * size.ratio);
  const unit = overlayUnit(deviceWidth);
  const columns = Math.ceil(deviceWidth / unit);
  const rows = Math.ceil(deviceHeight / unit);
  const lines = Array.from({ length: rows }, (_, row) =>
    wipeRow(wipe.progress, row, columns, rows)
  );
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath();
  lines.forEach(({ swept }, row) => {
    if (swept > 0) {
      ctx.rect(0, row * unit, Math.min(columns, swept) * unit, unit);
    }
  });
  ctx.clip();
  paintClip(ctx, next.frame, next.sides, size);
  ctx.restore();
  const { attack, defence } = next.sides;
  const home = defence.home ? defence : attack;
  const away = home === attack ? defence : attack;
  const colours = [ink, home.kit, white, away.kit, ink];
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  lines.forEach(({ stripes }, row) => {
    for (const { from, k, to } of stripes) {
      const left = Math.max(0, from);
      const right = Math.min(columns, to);
      if (right > left) {
        ctx.fillStyle = colours[k]!;
        ctx.fillRect(left * unit, row * unit, (right - left) * unit, unit);
      }
    }
  });
  ctx.restore();
};
