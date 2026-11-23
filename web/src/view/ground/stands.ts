import { playerArt, type ArtGrid } from '../assets/clip-sprites';
import { artPixelMetres, looksFor, playerPalette } from '../clip-sprites';
import {
  boardMetres,
  hashSeed,
  pitchLength,
  pitchWidth,
  type ClipSide
} from '../clips';
import type { Billboard } from './billboards';
import type { GroundPlan, Side, Stand } from './grounds';
import { box, merge, type Point, type Solid } from './solid';

// The stands (#263), as a ground's plan lays them out (#273). The stands
// are blocks of concrete in metres; the fans stand on their steps as
// sprites.

/** Where the stands' concrete begins, beyond the boards, in metres. */
const terraceFrom = boardMetres + 0.6;

/** Where the stands run along their side, clear of the corners. */
const span = (side: Side) =>
  side === 'left' || side === 'right'
    ? ([-1, pitchLength + 1] as const)
    : ([-1, pitchWidth + 1] as const);

/**
 * The world point `out` metres beyond `side`'s line, `along` it and `up`
 * from the ground. The world's x runs across the pitch as the screen's
 * does, y up into the air, and z down the screen.
 */
export const place = (
  side: Side,
  out: number,
  along: number,
  up: number
): Point =>
  side === 'left'
    ? [-out, up, along]
    : side === 'right'
      ? [pitchWidth + out, up, along]
      : side === 'top'
        ? [along, up, -out]
        : [along, up, pitchLength + out];

const concrete = '#8c8c8c';
const darkConcrete = '#7a7a7a';

/** The stands of `plan`, as one solid. */
export const standsSolid = (plan: GroundPlan): Solid => {
  const blocks: Solid[] = [];
  for (const stand of plan.stands) {
    const [from, to] = span(stand.side);
    const back = terraceFrom + stand.rows * stand.rowDepth;
    const top = stand.rows * stand.riser;
    for (let row = 0; row < stand.rows; row++) {
      const out = terraceFrom + row * stand.rowDepth;
      // Seats on every other step, and concrete between; a terrace's
      // steps are bare, a darker band on every other one.
      const colour =
        row % 2
          ? stand.seated
            ? (stand.seats ?? plan.seats)
            : concrete
          : darkConcrete;
      blocks.push(
        box(
          place(stand.side, out, from, 0),
          place(stand.side, out + stand.rowDepth, to, (row + 1) * stand.riser),
          colour
        )
      );
    }
    const wall = stand.roof ? top + stand.roof + 0.3 : top + 1;
    blocks.push(
      box(
        place(stand.side, back, from, 0),
        place(stand.side, back + 0.4, to, wall),
        '#5e5e5e'
      )
    );
    if (stand.roof) {
      // A cantilevered roof over the back rows only, so the front rows'
      // fans still show from above.
      const height = top + stand.roof;
      const front = terraceFrom + (stand.rows * stand.rowDepth) / 2;
      blocks.push(
        box(
          place(stand.side, front, from - 0.5, height),
          place(stand.side, back + 0.4, to + 0.5, height + 0.3),
          '#6f7a86'
        )
      );
    }
  }
  return merge(blocks);
};

const neutralShirts = ['#f4f4f4', '#3c3c3c', '#d7d7d7', '#2a4a8a'] as const;

/** The top of a pose, a fan's head and shirt over the seat in front. */
const upperBody = (grid: ArtGrid) => {
  const shirt = grid.findIndex(row => row.includes('s'));
  return grid.slice(0, Math.min(grid.length, shirt + 5));
};

type Facing = 'down' | 'left' | 'right' | 'up';
const facingFor: Record<Side, Facing> = {
  bottom: 'up',
  left: 'right',
  right: 'left',
  top: 'down'
};

/**
 * The fans on `stands`' steps, as today's crowd: seven in ten in the home
 * kit, some in the away kit and the rest neutral; after a goal the scorers'
 * fans and the neutrals stand and cheer.
 */
export const fans = (
  sides: Readonly<{ attack: ClipSide; defence: ClipSide }>,
  stands: readonly Stand[],
  cheer: boolean
): Billboard[] => {
  const home = sides.defence.home ? sides.defence : sides.attack;
  const away = home === sides.attack ? sides.defence : sides.attack;
  const seat = 16 * artPixelMetres;
  const made: Billboard[] = [];
  for (const stand of stands) {
    const [from, to] = span(stand.side);
    const facing = facingFor[stand.side];
    const drawn = facing === 'right' ? 'left' : facing;
    for (let row = 0; row < stand.rows; row++) {
      const out = terraceFrom + (row + 0.55) * stand.rowDepth;
      for (let along = from + seat / 2, k = 0; along < to; along += seat, k++) {
        const hash = hashSeed(`${stand.side}|${row}|${k}`);
        const roll = (hash % 100) / 100;
        const shirt =
          roll < 0.7
            ? home.kit
            : roll < 0.85
              ? away.kit
              : neutralShirts[(hash >>> 8) % neutralShirts.length]!;
        const cheering = cheer && (shirt === sides.attack.kit || roll >= 0.85);
        const [x, y, z] = place(
          stand.side,
          out,
          along,
          (row + 1) * stand.riser
        );
        made.push({
          grid: upperBody(
            cheering ? playerArt.celebrate[drawn] : playerArt.stand[drawn]
          ),
          mirrored: facing === 'right',
          order: z,
          palette: playerPalette(shirt, looksFor('', hash >>> 4)),
          x,
          y,
          z
        });
      }
    }
  }
  return made;
};
