import {
  BoxGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Vector3,
  type BufferGeometry
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { playerArt, type ArtGrid } from '../assets/clip-sprites';
import { artPixelMetres, looksFor, playerPalette } from '../clip-sprites';
import { terraceFrom } from '../clip-stadium';
import { hashSeed, pitchLength, pitchWidth, type ClipSide } from '../clips';
import type { Billboard } from './billboards';

// The prototype's one ground (#263), from a fixed layout rather than a
// club's seed: a tall covered stand along the left touchline facing a low
// open terrace along the right, with open terraces behind each goal. The
// stands are blocks of concrete in metres; the fans stand on their steps
// as sprites.

type Side = 'bottom' | 'left' | 'right' | 'top';

type Stand = Readonly<{
  /** Each step's colour: seats, or bare concrete. */
  colour: string;
  /** How far each step rises above the one in front, in metres. */
  riser: number;
  /** A roof this far above the top step, carried on posts at the front. */
  roof?: number;
  /** How deep each step is, from front to back. */
  rowDepth: number;
  rows: number;
  side: Side;
}>;

export const layout: readonly Stand[] = [
  {
    colour: '#a83232',
    riser: 0.5,
    roof: 3,
    rowDepth: 0.9,
    rows: 10,
    side: 'left'
  },
  { colour: '#8c8c8c', riser: 0.3, rowDepth: 1.4, rows: 5, side: 'right' },
  { colour: '#8c8c8c', riser: 0.35, rowDepth: 1.2, rows: 6, side: 'top' },
  { colour: '#8c8c8c', riser: 0.35, rowDepth: 1.2, rows: 6, side: 'bottom' }
];

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
const place = (side: Side, out: number, along: number, up: number) =>
  side === 'left'
    ? new Vector3(-out, up, along)
    : side === 'right'
      ? new Vector3(pitchWidth + out, up, along)
      : side === 'top'
        ? new Vector3(along, up, -out)
        : new Vector3(along, up, pitchLength + out);

/** The sun: up, and to the top left of the screen. */
export const towardsSun = new Vector3(-1.1, 1, -0.45).normalize();

/** A box's faces shaded flat by how they face the sun, in bands. */
const shade = (geometry: BufferGeometry, colour: string) => {
  const rgb = [1, 3, 5].map(
    i => Number.parseInt(colour.slice(i, i + 2), 16) / 255
  );
  const normals = geometry.getAttribute('normal');
  const colours: number[] = [];
  const top = towardsSun.y;
  for (let i = 0; i < normals.count; i++) {
    const facing =
      normals.getX(i) * towardsSun.x +
      normals.getY(i) * towardsSun.y +
      normals.getZ(i) * towardsSun.z;
    const light = facing >= top - 0.01 ? 1 : facing > 0 ? 0.85 : 0.68;
    colours.push(...rgb.map(c => c * light));
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colours, 3));
  return geometry;
};

/** A box between two corners, in world metres. */
const block = (a: Vector3, b: Vector3, colour: string) => {
  const geometry = new BoxGeometry(
    Math.abs(b.x - a.x),
    Math.abs(b.y - a.y),
    Math.abs(b.z - a.z)
  );
  geometry.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return shade(geometry, colour);
};

/** The stands, as one mesh. */
export const standsMesh = () => {
  const blocks: BufferGeometry[] = [];
  for (const stand of layout) {
    const [from, to] = span(stand.side);
    const back = terraceFrom + stand.rows * stand.rowDepth;
    const top = stand.rows * stand.riser;
    for (let row = 0; row < stand.rows; row++) {
      const out = terraceFrom + row * stand.rowDepth;
      // Seats or concrete on the tread, a darker band on every other step.
      const colour = row % 2 ? stand.colour : '#7a7a7a';
      blocks.push(
        block(
          place(stand.side, out, from, 0),
          place(stand.side, out + stand.rowDepth, to, (row + 1) * stand.riser),
          stand.roof ? colour : row % 2 ? '#8c8c8c' : '#7a7a7a'
        )
      );
    }
    const wall = stand.roof ? top + stand.roof + 0.3 : top + 1;
    blocks.push(
      block(
        place(stand.side, back, from, 0),
        place(stand.side, back + 0.4, to, wall),
        '#5e5e5e'
      )
    );
    if (stand.roof) {
      const height = top + stand.roof;
      blocks.push(
        block(
          place(stand.side, terraceFrom - 0.4, from - 0.5, height),
          place(stand.side, back + 0.4, to + 0.5, height + 0.3),
          '#6f7a86'
        )
      );
      for (let along = from + 6; along < to; along += 18) {
        blocks.push(
          block(
            place(stand.side, terraceFrom, along - 0.15, 0),
            place(stand.side, terraceFrom + 0.3, along + 0.15, height),
            '#d0d0d0'
          )
        );
      }
    }
  }
  const mesh = new Mesh(
    mergeGeometries(blocks),
    new MeshBasicMaterial({ vertexColors: true })
  );
  mesh.castShadow = true;
  return mesh;
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
 * The fans on the stands' steps, as today's crowd: seven in ten in the home
 * kit, some in the away kit and the rest neutral; after a goal the scorers'
 * fans and the neutrals stand and cheer.
 */
export const fans = (
  sides: Readonly<{ attack: ClipSide; defence: ClipSide }>,
  cheer: boolean
): Billboard[] => {
  const home = sides.defence.home ? sides.defence : sides.attack;
  const away = home === sides.attack ? sides.defence : sides.attack;
  const seat = 16 * artPixelMetres;
  const made: Billboard[] = [];
  for (const stand of layout) {
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
        const at = place(stand.side, out, along, (row + 1) * stand.riser);
        made.push({
          grid: upperBody(
            cheering ? playerArt.celebrate[drawn] : playerArt.stand[drawn]
          ),
          mirrored: facing === 'right',
          order: at.z,
          palette: playerPalette(shirt, looksFor('', hash >>> 4)),
          x: at.x,
          y: at.y,
          z: at.z
        });
      }
    }
  }
  return made;
};
