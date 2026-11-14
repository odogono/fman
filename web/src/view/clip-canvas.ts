import {
  cameraAspect,
  pitchLength,
  pitchWidth,
  type ClipFrame,
  type ClipSide
} from './clips';

// Paints a clip's frame (#144) with placeholder shapes: a circle in its
// side's kit for each player, a white dot for the ball, and lines for the
// markings. The camera shows a patch of the pitch; a mini-map shows it all.

export type ClipSides = Readonly<{ attack: ClipSide; defence: ClipSide }>;

export type ClipOverlays = Readonly<{
  /** Each player's place in their side, for the debug page. */
  ids?: boolean;
  /** The ball's path, on the pitch in metres. */
  path?: readonly Readonly<{ x: number; y: number }>[];
}>;

const grass = ['#2f7d32', '#2a7230'] as const;
const surround = '#245f28';
const line = 'rgba(255, 255, 255, 0.85)';

/**
 * Sizes `canvas` to its box at the screen's resolution, keeping the
 * camera's shape, and returns its size in CSS pixels.
 */
export const fitClipCanvas = (canvas: HTMLCanvasElement) => {
  const ratio = globalThis.devicePixelRatio || 1;
  const width = Math.max(1, canvas.clientWidth);
  const height = width * cameraAspect;
  const pixelsWide = Math.round(width * ratio);
  const pixelsHigh = Math.round(height * ratio);
  if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) {
    canvas.width = pixelsWide;
    canvas.height = pixelsHigh;
  }
  return { height, ratio, width };
};

const markings = (ctx: CanvasRenderingContext2D) => {
  ctx.strokeStyle = line;
  ctx.lineWidth = 0.15;
  ctx.strokeRect(0, 0, pitchWidth, pitchLength);
  ctx.beginPath();
  ctx.moveTo(0, pitchLength / 2);
  ctx.lineTo(pitchWidth, pitchLength / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(pitchWidth / 2, pitchLength / 2, 9.15, 0, Math.PI * 2);
  ctx.stroke();
  for (const top of [true, false]) {
    const edge = top ? 0 : pitchLength;
    const into = top ? 1 : -1;
    for (const [width, depth] of [
      [40.32, 16.5],
      [18.32, 5.5]
    ] as const) {
      const x = (pitchWidth - width) / 2;
      ctx.strokeRect(x, Math.min(edge, edge + into * depth), width, depth);
    }
    ctx.fillStyle = line;
    for (const [x, y, r] of [
      [pitchWidth / 2, pitchLength / 2, 0.3],
      [pitchWidth / 2, edge + into * 11, 0.25]
    ] as const) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(
      pitchWidth / 2,
      edge + into * 11,
      9.15,
      top ? 0.2 * Math.PI : 1.2 * Math.PI,
      top ? 0.8 * Math.PI : 1.8 * Math.PI
    );
    ctx.stroke();
    // The goal and its net, behind the line.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(pitchWidth / 2 - 3.66, top ? -2 : pitchLength, 7.32, 2);
    ctx.lineWidth = 0.25;
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(pitchWidth / 2 - 3.66, top ? -2 : pitchLength, 7.32, 2);
    ctx.lineWidth = 0.15;
    ctx.strokeStyle = line;
  }
};

const colourOf = (sides: ClipSides, player: ClipFrame['players'][number]) => {
  const side = sides[player.side];
  return player.keeper ? side.keeper : side.kit;
};

/** Paints one frame into a box `width` by `height` CSS pixels. */
export const paintClip = (
  ctx: CanvasRenderingContext2D,
  frame: ClipFrame,
  sides: ClipSides,
  size: Readonly<{ height: number; ratio: number; width: number }>,
  overlays: ClipOverlays = {}
) => {
  const { height, ratio, width } = size;
  const { camera } = frame;
  const scale = width / camera.width;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = surround;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(scale, scale);
  ctx.translate(-camera.x, -camera.y);
  for (let y = 0; y < pitchLength; y += 5) {
    ctx.fillStyle = grass[(y / 5) % 2]!;
    ctx.fillRect(0, y, pitchWidth, Math.min(5, pitchLength - y));
  }
  markings(ctx);
  if (overlays.path && overlays.path.length > 1) {
    ctx.strokeStyle = 'rgba(255, 230, 0, 0.8)';
    ctx.lineWidth = 0.2;
    ctx.beginPath();
    overlays.path.forEach((p, i) =>
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)
    );
    ctx.stroke();
  }
  const { ball } = frame;
  const lift = ball.height * 2.5;
  // The ball's shadow on the grass, then the players, then the ball.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(ball.x + lift * 0.3, ball.y, 0.45, 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const player of frame.players) {
    const colour = colourOf(sides, player);
    ctx.fillStyle = colour;
    ctx.strokeStyle = colour === '#000000' ? '#e8e8e8' : '#141414';
    ctx.lineWidth = 0.15;
    ctx.beginPath();
    if (player.pose === 'dive') {
      ctx.ellipse(player.x, player.y, 1.5, 0.7, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(player.x, player.y, 0.9, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
    if (player.pose === 'celebrate') {
      ctx.strokeStyle = '#ffe14d';
      ctx.lineWidth = 0.25;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 1.5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (player.pose === 'head') {
      ctx.fillStyle = '#f2c9a0';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(player.x + side * 0.9, player.y - 0.5, 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#141414';
  ctx.lineWidth = 0.1;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y - lift, 0.45 + ball.height * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  const onScreen = (x: number, y: number) => [
    width / 2 + (x - camera.x) * scale,
    height / 2 + (y - camera.y) * scale
  ];
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  if (overlays.ids) {
    ctx.font = '600 10px system-ui, sans-serif';
    const counts = { attack: 0, defence: 0 };
    for (const player of frame.players) {
      const [x, y] = onScreen(player.x, player.y);
      const id = counts[player.side]++;
      ctx.fillStyle = player.side === 'attack' ? '#fff' : '#ffe14d';
      ctx.fillText(String(id), x! + scale * 1.4, y! - scale * 1.2);
    }
  }
  if (frame.label) {
    const [x, y] = onScreen(frame.label.x, frame.label.y);
    ctx.font = '600 14px system-ui, sans-serif';
    const textWidth = ctx.measureText(frame.label.text).width;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(
      x! - textWidth / 2 - 5,
      y! - scale * 1.6 - 20,
      textWidth + 10,
      20
    );
    ctx.fillStyle = '#fff';
    ctx.fillText(frame.label.text, x!, y! - scale * 1.6 - 10);
  }
  if (frame.caption) {
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.textAlign = 'left';
    const textWidth = ctx.measureText(frame.caption).width;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(8, 8, textWidth + 16, 30);
    ctx.fillStyle = '#fff';
    ctx.fillText(frame.caption, 16, 24);
  }
  if (frame.minimap) {
    const mapWidth = Math.round(width * 0.2);
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
    // The patch the camera shows.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.strokeRect(
      left + (camera.x - camera.width / 2) * unit,
      top + (camera.y - (camera.width * cameraAspect) / 2) * unit,
      camera.width * unit,
      camera.width * cameraAspect * unit
    );
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
};
