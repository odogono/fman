import { drawCard, drawLabel, overlayUnit } from './clip-card';
import { drawGoal } from './clip-goal';
import { artPixelSize } from './clip-sprites';
import {
  cameraWide,
  pitchLength,
  pitchWidth,
  type ClipFrame,
  type ClipSide
} from './clips';
import { playerRows } from './ground/frame-sprites';
import { framePicture, patchFor } from './ground/picture';
import { surround } from './ground/pitch';
import { createGroundStage } from './ground/stage';
import type { MatchGround } from './match-ground';

// Paints a clip's frame (#144): the ground in 3D (ADR 0018), with each
// player and the ball as sprites (#146) on it, then the label, the card,
// the goal announcement and a mini-map over it, on whole device pixels.
// The picture shows a patch of the pitch (#285); the mini-map shows it all.

export type ClipSides = Readonly<{ attack: ClipSide; defence: ClipSide }>;

export type ClipOverlays = Readonly<{
  /** Each player's place in their side, for the debug page. */
  ids?: boolean;
  /** The ball's path, on the pitch in metres. */
  path?: readonly Readonly<{ x: number; y: number }>[];
  /**
   * The problems showing in this frame, for the debug page: each rings its
   * players (indexes into the frame's players) and is listed in a corner.
   */
  problems?: readonly Readonly<{ players: readonly number[]; text: string }>[];
}>;

/**
 * A box taller than this, height over width, as on a tall phone, is filled
 * down to it: the picture keeps its width, so a taller box shows more of
 * the pitch's length, never a closer picture.
 */
const tallestBox = 2;

/**
 * A box wider than square, as on a wide window (#255), is filled down to
 * this shape: half as tall as it is wide.
 */
const widestBox = 0.5;

/**
 * Sizes `canvas` to its box at the screen's resolution, and returns its
 * size in CSS pixels. Down to square, the picture keeps its width, so a
 * taller box shows more of the pitch's length, up to the tallest shape. A
 * box wider than square keeps the length a square shows and widens instead
 * (`patchFor`).
 */
export const fitClipCanvas = (canvas: HTMLCanvasElement) => {
  const ratio = globalThis.devicePixelRatio || 1;
  const width = Math.max(1, canvas.clientWidth);
  const height =
    width *
    Math.min(tallestBox, Math.max(widestBox, canvas.clientHeight / width));
  const pixelsWide = Math.round(width * ratio);
  const pixelsHigh = Math.round(height * ratio);
  if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) {
    canvas.width = pixelsWide;
    canvas.height = pixelsHigh;
  }
  return { height, ratio, width };
};

const colourOf = (sides: ClipSides, player: ClipFrame['players'][number]) => {
  const side = sides[player.side];
  return player.keeper ? side.keeper : side.kit;
};

/**
 * The ground is rendered into one WebGL canvas, shared by every clip's
 * canvas, which copies its picture. OGL loads only when the first clip
 * paints.
 */
const stage = createGroundStage({
  loadPainter: async () =>
    (await import('./ground/painter')).createGroundPainter,
  makeCanvas: () => document.createElement('canvas')
});

/**
 * Whether this browser can paint the clips: without WebGL, the highlights
 * show the ticker without clips (ADR 0018).
 */
export const canPaintClips = () => stage.usable();

/** Loads the ground's painter, once; clips paint only the surround until it has. */
export const loadGround = () => stage.load();

/**
 * Paints one frame, played at `playedAt`, into a box `width` by `height`
 * CSS pixels.
 */
export const paintClip = (
  ctx: CanvasRenderingContext2D,
  frame: ClipFrame,
  sides: ClipSides,
  playedAt: MatchGround,
  size: Readonly<{ height: number; ratio: number; width: number }>,
  overlays: ClipOverlays = {}
) => {
  const { height, ratio, width } = size;
  const picture = framePicture(frame.focus, frame.subject, { height, width });
  /** CSS pixels to a metre on the ground, at the picture's centre. */
  const scale = 1 / picture.metresPerPixel;
  // The width the cards and mini-map are sized to: the box's, or on a box
  // wider than square, as if it were only as wide as the camera's own patch
  // at its widest, so they keep their size beside the players.
  const playersWidth =
    width * Math.min(1, cameraWide / patchFor(cameraWide, width, height).width);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = surround;
  ctx.fillRect(0, 0, width, height);

  // The ground and the sprites, rendered at one pixel to an art pixel and
  // scaled up in whole device pixels.
  const pixel = artPixelSize(scale, ratio);
  const project = stage.paint(frame, sides, {
    ground: playedAt,
    high: Math.ceil((height * ratio) / pixel),
    metresPerPixel: pixel / (scale * ratio),
    wide: Math.ceil((width * ratio) / pixel),
    x: picture.x,
    y: picture.y
  });
  if (project) {
    const { picture } = stage;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(picture, 0, 0, picture.width * pixel, picture.height * pixel);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  /** A point on the pitch, `up` metres above it, in CSS pixels on the box. */
  const onScreen = (
    x: number,
    y: number,
    up = 0
  ): readonly [number, number] => {
    // The render's own projection, once there is one, is the picture's in
    // its whole art pixels.
    if (!project) {
      return picture.project(x, y, up);
    }
    const [px, py] = project(x, y, up);
    return [(px * pixel) / ratio, (py * pixel) / ratio];
  };
  /** The top of a player's sprite and any icon over it, in CSS pixels. */
  const topOf = (player: ClipFrame['players'][number]) =>
    onScreen(player.x, player.y)[1] - (playerRows(player) * pixel) / ratio;
  if (overlays.path && overlays.path.length > 1) {
    ctx.strokeStyle = 'rgba(255, 230, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    overlays.path.forEach((p, i) => {
      const [x, y] = onScreen(p.x, p.y);
      if (i) {
        ctx.lineTo(x, y);
      } else {
        ctx.moveTo(x, y);
      }
    });
    ctx.stroke();
  }

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  if (overlays.ids) {
    ctx.font = '600 10px system-ui, sans-serif';
    const counts = { attack: 0, defence: 0 };
    for (const player of frame.players) {
      const [x, y] = onScreen(player.x, player.y);
      const id = counts[player.side]++;
      ctx.fillStyle = player.side === 'attack' ? '#fff' : '#ffe14d';
      ctx.fillText(String(id), x + scale * 1.4, y - scale * 1.2);
    }
  }
  if (overlays.problems?.length) {
    ctx.strokeStyle = '#ff3b30';
    ctx.lineWidth = 2;
    const ringed = new Set(overlays.problems.flatMap(p => p.players));
    for (const i of ringed) {
      const player = frame.players[i];
      if (player) {
        const [x, y] = onScreen(player.x, player.y);
        ctx.beginPath();
        ctx.arc(x, y - scale * 0.6, scale * 1.2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  // The label, the card and the goal announcement, on the art-pixel grid
  // in device pixels.
  // Sized with the players: on a box wider than square, as if the box were
  // only as wide as the camera's own patch at its widest.
  const unit = overlayUnit(Math.round(playersWidth * ratio));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (frame.label) {
    const { label } = frame;
    const [x, y] = onScreen(label.x, label.y);
    // Over the named player's head, and any status icon.
    const named = frame.players.find(p => p.x === label.x && p.y === label.y);
    const above = named ? topOf(named) : y - scale * 2;
    drawLabel(ctx, label.text, x * ratio, (above - 4) * ratio, unit);
  }
  if (frame.card) {
    drawCard(ctx, frame.card, sides.attack.kit, unit);
  }
  if (frame.goal) {
    drawGoal(
      ctx,
      frame.goal,
      sides.attack.kit,
      unit,
      Math.ceil((width * ratio) / unit),
      Math.ceil((height * ratio) / unit)
    );
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  if (frame.minimap) {
    const { ball } = frame;
    const mapWidth = Math.round(playersWidth * 0.2);
    const mapHeight = (mapWidth * pitchLength) / pitchWidth;
    const left = width - mapWidth - 8;
    const top = height - mapHeight - 8;
    const unit = mapWidth / pitchWidth;
    ctx.fillStyle = 'rgba(20, 60, 24, 0.8)';
    ctx.fillRect(left, top, mapWidth, mapHeight);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(left, top, mapWidth, mapHeight);
    ctx.beginPath();
    ctx.moveTo(left, top + mapHeight / 2);
    ctx.lineTo(left + mapWidth, top + mapHeight / 2);
    ctx.stroke();
    // The patch the picture shows, wider at the far end.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    for (const corner of picture.patch) {
      ctx.lineTo(left + corner.x * unit, top + corner.y * unit);
    }
    ctx.closePath();
    ctx.stroke();
    for (const player of frame.players) {
      ctx.fillStyle = colourOf(sides, player);
      ctx.fillRect(
        left + player.x * unit - 1.5,
        top + player.y * unit - 1.5,
        3,
        3
      );
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(left + ball.x * unit, top + ball.y * unit, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // The problems' list, in the bottom left, clear of the card and map.
  if (overlays.problems?.length) {
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const { problems } = overlays;
    problems.forEach(({ text }, k) => {
      const top = height - 8 - (problems.length - k) * 18;
      const textWidth = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(140, 0, 0, 0.85)';
      ctx.fillRect(6, top, textWidth + 10, 16);
      ctx.fillStyle = '#fff';
      ctx.fillText(text, 11, top + 8);
    });
  }
};
