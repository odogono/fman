import {
  boardArt,
  goalArt,
  netDepthMetres,
  playerArt,
  type ArtGrid
} from './assets/clip-sprites';
import {
  artPixelMetres,
  looksFor,
  playerPalette,
  type ArtPalette
} from './clip-sprites';
import { hashSeed, pitchLength, pitchWidth, type ClipSide } from './clips';

// The ground around the pitch (#157): the goals, the advertising boards
// and the crowd, laid out in metres on the pitch. Each piece stands on a
// point and is drawn in depth order with the players, so a player can be
// in front of or behind a goal. Nothing here draws or touches the seed.

/** A piece of the ground: its art, the point it stands on, and its depth. */
export type GroundPiece = Readonly<{
  /** Where its art's bottom row stands, in metres on the screen's pitch. */
  at: Readonly<{ x: number; y: number }>;
  /** Sorts it among the players: larger is nearer the camera. */
  depth: number;
  grid: ArtGrid;
  mirrored: boolean;
  palette: ArtPalette;
}>;

/** The boards stand this far beyond the lines, and the stands begin past them. */
const boardMetres = 3;
const standMetres = 4.5;
/** Each row of the stand is this much deeper than the one in front. */
const rowMetres = 1.6;
const rows = 4;

/** The net is see-through, so what is behind it shows. */
const netPalette: ArtPalette = {
  l: '#f4f4f4',
  m: '#a8a8a8',
  o: '#141414',
  w: '#f4f4f4'
};
/** Shadows darken what they fall on, every other pixel. */
export const shadowPalette: ArtPalette = { x: '#000000a0' };
const boardPalette: ArtPalette = {
  '1': '#d72828',
  '2': '#fac81e',
  '3': '#1e5adc',
  '4': '#28bee6',
  o: '#141414',
  w: '#f4f4f4'
};
/** The backs of the boards, seen from behind the bottom goal. */
const boardBackPalette: ArtPalette = Object.fromEntries(
  Object.keys(boardPalette).map(k => [k, k === 'o' ? '#141414' : '#5a5a5a'])
);

/** The goals: each a net and a frame, placed apart in depth, and shadows. */
export const goalPieces = (): GroundPiece[] => {
  const x = pitchWidth / 2;
  // A shadow's grid is placed by its top-left corner, at the left of the
  // goal's footprint; it is drawn before anything stands on it.
  const shadowAt = (top: number) => {
    const grid = goalArt.shadow;
    const left = x - (goalArt.top.frame[0]!.length * artPixelMetres) / 2;
    return {
      at: {
        x: left + (grid[0]!.length * artPixelMetres) / 2,
        y: top + grid.length * artPixelMetres
      },
      depth: -Infinity,
      grid,
      mirrored: false,
      palette: shadowPalette
    };
  };
  return [
    shadowAt(-netDepthMetres),
    shadowAt(pitchLength),
    // The top goal is seen from the front: its net behind the line.
    {
      at: { x, y: 0 },
      depth: -netDepthMetres,
      grid: goalArt.top.net,
      mirrored: false,
      palette: netPalette
    },
    {
      at: { x, y: 0 },
      depth: 0,
      grid: goalArt.top.frame,
      mirrored: false,
      palette: netPalette
    },
    // The bottom goal is seen from behind: its net in front of the frame.
    {
      at: { x, y: pitchLength },
      depth: pitchLength,
      grid: goalArt.bottom.frame,
      mirrored: false,
      palette: netPalette
    },
    {
      at: { x, y: pitchLength + netDepthMetres },
      depth: pitchLength + netDepthMetres,
      grid: goalArt.bottom.net,
      mirrored: false,
      palette: netPalette
    }
  ];
};

/** One board panel turned to stand along a touchline. */
const sideBoard: ArtGrid = boardArt[0]!
  .split('')
  .map((_, x) => boardArt.map(row => row[x]).join(''));

/** The boards around the pitch, a panel run at a time. */
export const boardPieces = (): GroundPiece[] => {
  const pieces: GroundPiece[] = [];
  const along = boardArt[0]!.length * artPixelMetres;
  for (let x = -boardMetres; x < pitchWidth + boardMetres; x += along) {
    const centre = x + along / 2;
    pieces.push(
      {
        at: { x: centre, y: -boardMetres },
        depth: -boardMetres,
        grid: boardArt,
        mirrored: false,
        palette: boardPalette
      },
      {
        at: { x: centre, y: pitchLength + boardMetres },
        depth: pitchLength + boardMetres,
        grid: boardArt,
        mirrored: false,
        palette: boardBackPalette
      }
    );
  }
  const down = sideBoard.length * artPixelMetres;
  for (let y = -boardMetres + down; y < pitchLength + boardMetres; y += down) {
    for (const x of [-boardMetres, pitchWidth + boardMetres]) {
      pieces.push({
        at: { x, y },
        depth: y,
        grid: sideBoard,
        mirrored: x > 0,
        palette: boardPalette
      });
    }
  }
  return pieces;
};

const neutralShirts = ['#f4f4f4', '#3c3c3c', '#d7d7d7', '#2a4a8a'] as const;

/** The top of a pose, a fan's head and shirt over the seat in front. */
const upperBody = (grid: ArtGrid) => {
  const shirt = grid.findIndex(row => row.includes('s'));
  return grid.slice(0, Math.min(grid.length, shirt + 5));
};

type Facing = 'down' | 'left' | 'right' | 'up';
/** Each fan's art, worked out once for each facing, seated and cheering. */
const fanGrids = new Map<string, ArtGrid>();
const fanArt = (facing: Facing, cheering: boolean) => {
  const key = `${facing}|${cheering}`;
  let grid = fanGrids.get(key);
  if (!grid) {
    const drawn = facing === 'right' ? 'left' : facing;
    grid = upperBody(
      cheering ? playerArt.celebrate[drawn] : playerArt.stand[drawn]
    );
    fanGrids.set(key, grid);
  }
  return grid;
};

/**
 * The crowd: rows of fans in four stands, each facing the pitch. Seven in
 * ten wear the home kit, some the away kit and the rest a neutral colour.
 * After a goal the scorers' fans and the neutrals stand and cheer.
 */
export const crowdPieces = (
  sides: Readonly<{ attack: ClipSide; defence: ClipSide }>,
  cheer: boolean
): GroundPiece[] => {
  const home = sides.defence.home ? sides.defence : sides.attack;
  const away = home === sides.attack ? sides.defence : sides.attack;
  const pieces: GroundPiece[] = [];
  const seat = 16 * artPixelMetres;
  const fan = (
    stand: string,
    row: number,
    place: number,
    at: Readonly<{ x: number; y: number }>,
    facing: Facing
  ) => {
    const hash = hashSeed(`${stand}|${row}|${place}`);
    const roll = (hash % 100) / 100;
    const shirt =
      roll < 0.7
        ? home.kit
        : roll < 0.85
          ? away.kit
          : neutralShirts[(hash >>> 8) % neutralShirts.length]!;
    const cheering = cheer && (shirt === sides.attack.kit || roll >= 0.85);
    pieces.push({
      at,
      depth: at.y,
      grid: fanArt(facing, cheering),
      mirrored: facing === 'right',
      palette: playerPalette(shirt, looksFor('', hash >>> 4))
    });
  };
  for (let row = 0; row < rows; row++) {
    const out = standMetres + row * rowMetres;
    for (let x = -12, place = 0; x < pitchWidth + 12; x += seat, place++) {
      fan('top', row, place, { x, y: -out }, 'down');
      fan('bottom', row, place, { x, y: pitchLength + out + 1 }, 'up');
    }
    for (let y = -2, place = 0; y < pitchLength + 3; y += seat, place++) {
      fan('left', row, place, { x: -out, y }, 'right');
      fan('right', row, place, { x: pitchWidth + out, y }, 'left');
    }
  }
  return pieces;
};

/** Where the stands' concrete begins, beyond the boards, in metres. */
export const terraceFrom = boardMetres + 0.6;
export const terraceRow = rowMetres;
