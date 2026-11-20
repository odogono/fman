import {
  ballArt,
  liftArt,
  playerArt,
  slumpArt,
  statusArt,
  type ArtGrid
} from './assets/clip-sprites';
import { hashSeed, type FramePlayer, type Pose } from './clips';

// How the sprite highlights' artwork (#146) is picked and coloured for a
// player in a frame: the pose's grid for their facing, tinted by kit, with
// skin and hair from their name. Nothing here touches the canvas.

/** One art pixel covers about this much pitch, so a player stands about 2 m. */
export const artPixelMetres = 0.09;
/** The ball is drawn this far up for each unit of its `height`, in metres. */
export const ballLiftMetres = 2.5;
/**
 * A run frame changes each time a player covers this much ground, so a
 * cycle of four frames is two strides.
 */
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

/** The cup's silver, its highlight and its ribbon (the cup celebration). */
export const cupPalette: ArtPalette = {
  a: '#e8e8e8',
  b: '#b8b8b8',
  e: '#808080',
  o: '#141414',
  r: '#d70000',
  w: '#ffffff'
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
 * mirrored. A runner's frame, arms up or not, changes with the ground they
 * cover, so the stride keeps pace with their speed; a header or a jump for
 * joy shows the frame the clip names.
 */
export const spriteFor = (
  player: Pick<FramePlayer, 'facing' | 'pose' | 'poseFrame' | 'travelled'>
): Sprite => {
  const { facing, pose } = player;
  // The cup celebration's poses are drawn facing down only.
  if (pose === 'lift' || pose === 'slump') {
    const frames = pose === 'lift' ? liftArt : slumpArt;
    const at = Math.min(frames.length - 1, Math.max(0, player.poseFrame ?? 0));
    return { grid: frames[at]!, mirrored: false };
  }
  if (pose === 'dive') {
    return { grid: playerArt.dive.left, mirrored: facing === 'right' };
  }
  // On the ground, drawn side on: the frame the clip names.
  if (pose === 'tackle' || pose === 'fall' || pose === 'getup') {
    const frames = playerArt[pose].left;
    const at = Math.min(frames.length - 1, Math.max(0, player.poseFrame ?? 0));
    return { grid: frames[at]!, mirrored: facing === 'right' };
  }
  const drawn: 'down' | 'left' | 'up' = facing === 'right' ? 'left' : facing;
  const mirrored = facing === 'right';
  const art: Record<
    Exclude<
      Pose,
      | 'cheer'
      | 'dive'
      | 'fall'
      | 'getup'
      | 'header'
      | 'jump'
      | 'lift'
      | 'run'
      | 'slump'
      | 'tackle'
    >,
    typeof playerArt.stand
  > = {
    celebrate: playerArt.celebrate,
    head: playerArt.head,
    hold: playerArt.hold,
    kick: playerArt.kick,
    slide: playerArt.slide,
    stand: playerArt.stand
  };
  // A run, with arms up or not, strides with the ground covered.
  if (pose === 'run' || pose === 'cheer') {
    const frames = playerArt[pose][drawn];
    const at = Math.floor(player.travelled / strideMetres);
    return { grid: frames[at % frames.length]!, mirrored };
  }
  // A header and a jump for joy show the frame the clip names.
  if (pose === 'header' || pose === 'jump') {
    const frames = playerArt[pose][drawn];
    const at = Math.min(frames.length - 1, Math.max(0, player.poseFrame ?? 0));
    return { grid: frames[at]!, mirrored };
  }
  return { grid: art[pose][drawn], mirrored };
};

/** Where a facing on the pitch points on a pitch turned on its side. */
const turnedFacing = {
  down: 'left',
  left: 'up',
  right: 'down',
  up: 'right'
} as const;

/** A grid turned a quarter clockwise. */
export const turnGrid = (grid: ArtGrid): ArtGrid => {
  const width = grid[0]?.length ?? 0;
  return Array.from({ length: width }, (_, row) =>
    grid.map((_, column) => grid[grid.length - 1 - column]![row]).join('')
  );
};
const turnedDives = new Map<boolean, ArtGrid>();

/**
 * The art for a player as the screen shows them. On a pitch turned on its
 * side (#255), the pitch's up is the screen's right, so every facing turns
 * a quarter clockwise. A dive, lying flat, turns with it; the other poses
 * drawn side on only keep their side-on art.
 */
export const spriteOnScreen = (
  player: Pick<FramePlayer, 'facing' | 'pose' | 'poseFrame' | 'travelled'>,
  landscape: boolean
): Sprite => {
  if (!landscape) {
    return spriteFor(player);
  }
  if (player.pose === 'dive') {
    const right = player.facing === 'right';
    let grid = turnedDives.get(right);
    if (!grid) {
      const dive = playerArt.dive.left;
      grid = turnGrid(
        right ? dive.map(row => row.split('').reverse().join('')) : dive
      );
      turnedDives.set(right, grid);
    }
    return { grid, mirrored: false };
  }
  return spriteFor({ ...player, facing: turnedFacing[player.facing] });
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
