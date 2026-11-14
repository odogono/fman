import {
  ballArt,
  playerArt,
  statusArt,
  type ArtGrid
} from './assets/clip-sprites';
import { hashSeed, type FramePlayer, type Pose } from './clips';

// How the sprite highlights' artwork (#146) is picked and coloured for a
// player in a frame: the pose's grid for their facing, tinted by kit, with
// skin and hair from their name. Nothing here touches the canvas.

/** One art pixel covers about this much pitch, so a player stands about 2 m. */
export const artPixelMetres = 0.09;
/** A run frame changes each time a player covers this much ground. */
const strideMetres = 0.8;
/** The ball turns a spin frame each time it rolls this far. */
const spinMetres = 0.4;

/** Device pixels per art pixel: whole, so the art stays crisp. */
export const artPixelSize = (metresToCss: number, ratio: number) =>
  Math.max(1, Math.round(metresToCss * ratio * artPixelMetres));

const skinTones = ['#f2c9a0', '#e0ac7e', '#b9835a', '#7a4e32'] as const;
const hairColours = ['#4a2c1a', '#2a1d14', '#a8742a', '#d9b25a'] as const;

export type Looks = Readonly<{ hair: string; skin: string }>;

/**
 * A player's skin and hair, picked by a hash of their name so they look the
 * same in every clip; an unnamed player by their place in the side.
 */
export const looksFor = (label: string, place: number): Looks => {
  const hash = hashSeed(label || `#${place}`);
  return {
    hair: hairColours[(hash >>> 8) % hairColours.length]!,
    skin: skinTones[hash % skinTones.length]!
  };
};

const channels = (css: string) =>
  [1, 3, 5].map(i => Number.parseInt(css.slice(i, i + 2), 16)) as [
    number,
    number,
    number
  ];
const toCss = (rgb: readonly number[]) =>
  `#${rgb.map(c => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

/** The kit's colours: the shirt, the darker shorts and socks, the outline. */
export const kitColours = (shirt: string) => {
  const rgb = channels(shirt);
  if (Math.max(...rgb) < 40) {
    // Black would vanish into the outline; it is drawn as a near-black.
    return { outline: '#000000', shirt: '#333333', shorts: '#1c1c1c' };
  }
  return {
    outline: '#141414',
    shirt,
    shorts: toCss(rgb.map(c => c * 0.62))
  };
};

/**
 * What each character of a grid is painted in, as `#rrggbb` or, partly
 * see-through, `#rrggbbaa`; clear is left out.
 */
export type ArtPalette = Readonly<Record<string, string>>;

export const playerPalette = (shirt: string, looks: Looks): ArtPalette => {
  const kit = kitColours(shirt);
  return {
    d: kit.shorts,
    f: looks.skin,
    h: looks.hair,
    o: kit.outline,
    s: kit.shirt,
    w: '#f4f4f4'
  };
};

export const iconPalette: ArtPalette = {
  c: '#4aa8ff',
  o: '#141414',
  w: '#f4f4f4'
};

export type Sprite = Readonly<{ grid: ArtGrid; mirrored: boolean }>;

/** The parity of a point on a grid of `step`, for cycling frames by distance. */
const cell = (x: number, y: number, step: number) =>
  Math.floor(x / step) + Math.floor(y / step);

/**
 * The art for a player: the pose's grid for their facing, right being left
 * mirrored. A runner's frame changes with the ground they cover, so the
 * stride keeps pace with their speed.
 */
export const spriteFor = (
  player: Pick<FramePlayer, 'facing' | 'pose' | 'x' | 'y'>
): Sprite => {
  const { facing, pose } = player;
  if (pose === 'dive') {
    return { grid: playerArt.dive.left, mirrored: facing === 'right' };
  }
  const drawn: 'down' | 'left' | 'up' = facing === 'right' ? 'left' : facing;
  const mirrored = facing === 'right';
  const art: Record<Exclude<Pose, 'dive' | 'run'>, typeof playerArt.stand> = {
    celebrate: playerArt.celebrate,
    head: playerArt.head,
    hold: playerArt.hold,
    kick: playerArt.kick,
    stand: playerArt.stand
  };
  if (pose === 'run') {
    const frames = playerArt.run[drawn];
    const at = cell(player.x, player.y, strideMetres);
    return { grid: frames[Math.abs(at) % frames.length]!, mirrored };
  }
  return { grid: art[pose][drawn], mirrored };
};

/** The ball's spin frame, turning as it rolls. */
export const ballSprite = (x: number, y: number): ArtGrid =>
  ballArt[Math.abs(cell(x, y, spinMetres)) % ballArt.length]!;

export const statusSprite = (status: NonNullable<FramePlayer['status']>) =>
  statusArt[status];

/**
 * Whether a player holds the ball: their hold pose draws it over their
 * head, so the ball itself is not drawn.
 */
export const ballHeld = (
  players: readonly Pick<FramePlayer, 'pose' | 'x' | 'y'>[],
  ball: Readonly<{ x: number; y: number }>
) =>
  players.some(
    p => p.pose === 'hold' && Math.hypot(p.x - ball.x, p.y - ball.y) < 2
  );

/** A grid as RGBA pixels, one per art pixel, mirrored if asked. */
export const rasterise = (
  grid: ArtGrid,
  palette: ArtPalette,
  mirrored = false
) => {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const data = new Uint8ClampedArray(width * height * 4);
  grid.forEach((row, y) => {
    for (let x = 0; x < width; x++) {
      const colour = palette[row[mirrored ? width - 1 - x : x]!];
      if (!colour) {
        continue;
      }
      const [r, g, b] = channels(colour);
      // An eight-digit colour carries its own opacity, as the net does.
      const alpha =
        colour.length === 9 ? Number.parseInt(colour.slice(7), 16) : 255;
      data.set([r, g, b, alpha], (y * width + x) * 4);
    }
  });
  return { data, height, width };
};
