import type { ArtGrid } from './assets/clip-sprites';
import {
  artPixelSize,
  ballHeld,
  ballSprite,
  iconPalette,
  looksFor,
  playerPalette,
  rasterise,
  spriteFor,
  statusSprite,
  type ArtPalette
} from './clip-sprites';
import {
  boardPieces,
  crowdPieces,
  goalPieces,
  terraceFrom,
  terraceRow
} from './clip-stadium';
import {
  cameraAspect,
  pitchLength,
  pitchWidth,
  type ClipFrame,
  type ClipSide
} from './clips';

// Paints a clip's frame (#144): the pitch and its markings, then each
// player and the ball as sprites (#146) on whole device pixels. The camera
// shows a patch of the pitch; a mini-map shows it all.

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
  }
};

/** The stands' concrete, a step for each row of the crowd. */
const terraces = (ctx: CanvasRenderingContext2D) => {
  const far = 40;
  const regions = [
    [-far, -far, pitchWidth + 2 * far, far - terraceFrom],
    [-far, pitchLength + terraceFrom, pitchWidth + 2 * far, far],
    [-far, -terraceFrom, far - terraceFrom, pitchLength + 2 * terraceFrom],
    [pitchWidth + terraceFrom, -terraceFrom, far, pitchLength + 2 * terraceFrom]
  ] as const;
  ctx.fillStyle = '#8c8c8c';
  for (const [x, y, w, h] of regions) {
    ctx.fillRect(x, y, w, h);
  }
  ctx.fillStyle = '#7a7a7a';
  for (let out = terraceFrom; out < far; out += terraceRow) {
    ctx.fillRect(-far, -out - 0.25, pitchWidth + 2 * far, 0.25);
    ctx.fillRect(-far, pitchLength + out, pitchWidth + 2 * far, 0.25);
    ctx.fillRect(
      -out - 0.25,
      -terraceFrom,
      0.25,
      pitchLength + 2 * terraceFrom
    );
    ctx.fillRect(
      pitchWidth + out,
      -terraceFrom,
      0.25,
      pitchLength + 2 * terraceFrom
    );
  }
};

const colourOf = (sides: ClipSides, player: ClipFrame['players'][number]) => {
  const side = sides[player.side];
  return player.keeper ? side.keeper : side.kit;
};

/** Each grid and palette drawn once, at one device pixel per art pixel. */
const spriteCache = new Map<string, HTMLCanvasElement>();
const spriteImage = (
  ctx: CanvasRenderingContext2D,
  grid: ArtGrid,
  palette: ArtPalette,
  mirrored: boolean
) => {
  const key = `${grid.join('/')}|${Object.values(palette).join()}|${mirrored}`;
  let image = spriteCache.get(key);
  if (!image) {
    const { data, height, width } = rasterise(grid, palette, mirrored);
    image = ctx.canvas.ownerDocument.createElement('canvas');
    image.width = width;
    image.height = height;
    image
      .getContext('2d')!
      .putImageData(new ImageData(data, width, height), 0, 0);
    spriteCache.set(key, image);
  }
  return image;
};

/**
 * Draws `grid` with its bottom centre at device pixel (x, y), `size` device
 * pixels to each art pixel, and returns the device row of its top.
 */
const drawSprite = (
  ctx: CanvasRenderingContext2D,
  grid: ArtGrid,
  palette: ArtPalette,
  at: Readonly<{ mirrored?: boolean; size: number; x: number; y: number }>
) => {
  const image = spriteImage(ctx, grid, palette, at.mirrored ?? false);
  const width = image.width * at.size;
  const height = image.height * at.size;
  const left = Math.round(at.x - width / 2);
  const top = Math.round(at.y - height);
  ctx.drawImage(image, left, top, width, height);
  return top;
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
  terraces(ctx);
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
  const held = ballHeld(frame.players, ball);
  if (!held) {
    // The ball's shadow on the grass.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(ball.x + lift * 0.3, ball.y, 0.35, 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // The sprites, in device pixels, from the far side of the ground to the
  // near: the stands, boards and goals with the players and the ball, so
  // the nearer stands in front.
  const onScreen = (x: number, y: number) => [
    width / 2 + (x - camera.x) * scale,
    height / 2 + (y - camera.y) * scale
  ];
  const pixel = artPixelSize(scale, ratio);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const attackers = sides.attack.players.length;
  /** The top of each player's sprite and icon, in CSS pixels. */
  const tops = new Map<ClipFrame['players'][number], number>();
  const draws: { depth: number; draw: () => void }[] = [];
  const reach = camera.width;
  for (const piece of [
    ...goalPieces(),
    ...boardPieces(),
    ...crowdPieces(sides, frame.cheer ?? false)
  ]) {
    if (
      Math.abs(piece.at.x - camera.x) > reach ||
      Math.abs(piece.at.y - camera.y) > reach * cameraAspect
    ) {
      continue;
    }
    draws.push({
      depth: piece.depth,
      draw: () => {
        const [x, y] = onScreen(piece.at.x, piece.at.y);
        drawSprite(ctx, piece.grid, piece.palette, {
          mirrored: piece.mirrored,
          size: pixel,
          x: x! * ratio,
          y: y! * ratio
        });
      }
    });
  }
  frame.players.forEach((player, i) => {
    draws.push({
      depth: player.y,
      draw: () => {
        const side = sides[player.side];
        const place = i < attackers ? i : i - attackers;
        const looks = looksFor(side.players[place]?.label ?? '', place);
        const [x, y] = onScreen(player.x, player.y);
        const sprite = spriteFor(player);
        let top = drawSprite(
          ctx,
          sprite.grid,
          playerPalette(colourOf(sides, player), looks),
          {
            mirrored: sprite.mirrored,
            size: pixel,
            x: x! * ratio,
            y: y! * ratio
          }
        );
        if (player.status) {
          top = drawSprite(ctx, statusSprite(player.status), iconPalette, {
            size: pixel,
            x: x! * ratio,
            y: top - pixel
          });
        }
        tops.set(player, top / ratio);
      }
    });
  });
  if (!held) {
    draws.push({
      depth: ball.y,
      draw: () => {
        const [x, y] = onScreen(ball.x, ball.y - lift);
        const grid = ballSprite(ball.x, ball.y);
        drawSprite(ctx, grid, iconPalette, {
          size: pixel,
          x: x! * ratio,
          y: y! * ratio + (grid.length * pixel) / 2
        });
      }
    });
  }
  for (const { draw } of draws.toSorted((a, b) => a.depth - b.depth)) {
    draw();
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

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
    const { label } = frame;
    const [x, y] = onScreen(label.x, label.y);
    // Over the named player's head, and any status icon.
    const named = frame.players.find(p => p.x === label.x && p.y === label.y);
    const above = (named && tops.get(named)) ?? y! - scale * 2;
    ctx.font = '600 14px system-ui, sans-serif';
    const textWidth = ctx.measureText(label.text).width;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x! - textWidth / 2 - 5, above - 24, textWidth + 10, 20);
    ctx.fillStyle = '#fff';
    ctx.fillText(label.text, x!, above - 14);
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
