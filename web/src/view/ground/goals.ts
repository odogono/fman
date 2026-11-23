import { netDepthMetres } from '../assets/clip-sprites';
import { artPixelMetres } from '../clip-sprites';
import { pitchLength, pitchWidth } from '../clips';
import { box, distance, merge, quad, type Point, type Solid } from './solid';

// The goals as models (#263): posts and a crossbar, and a net of see-through
// panels, each casting its shadow. Each goal is two pieces drawn among the
// sprites by depth, as today's art is: the net and the frame, so a player
// can stand inside the net, behind the posts, or in front of them.

/** Between the posts, and up to the bar's underside, in metres. */
const mouth = 7.32;
const bar = 2.44;
/** The posts and bar, three art pixels thick, so they read at any zoom. */
const thickness = 3 * artPixelMetres;
/**
 * The net falls from the bar to this height at the back: low enough that,
 * with heights drawn up the screen, its back stays short of the boards.
 */
const backHeight = 0.8;
/** The frame's dark outline, an art pixel wide, as the sprites have. */
const outline = artPixelMetres;
/** Each square of the net, four art pixels across. */
const cell = 4 * artPixelMetres;

/** One square of the net: a line along its top and down its left. */
export const netCanvas = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 4;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 4, 1);
  ctx.fillRect(0, 0, 1, 4);
  return canvas;
};

/** A panel of net, its squares counted in metres along both edges. */
const panel = (a: Point, b: Point, c: Point, d: Point) =>
  quad([a, b, c, d], '#cfcfcf', distance(a, b) / cell, distance(a, d) / cell);

export type GoalPiece = Readonly<{
  kind: 'frame' | 'net';
  /** Sorts it among the sprites: larger is drawn later. */
  order: number;
  solid: Solid;
}>;

/**
 * Both goals' pieces, with the order each is drawn at among the sprites:
 * today's art's, the top goal's net behind its line and the bottom goal's
 * net in front of its frame.
 */
export const goalPieces = (): GoalPiece[] => {
  const centre = pitchWidth / 2;
  const left = centre - mouth / 2;
  const right = centre + mouth / 2;
  return [
    { into: -1, line: 0 },
    { into: 1, line: pitchLength }
  ].flatMap(({ into, line }): GoalPiece[] => {
    const back = line + into * netDepthMetres;
    // The back, the roof sloping down to it, and the sides.
    const net = merge([
      panel(
        [left, 0, back],
        [right, 0, back],
        [right, backHeight, back],
        [left, backHeight, back]
      ),
      panel(
        [left, bar, line],
        [right, bar, line],
        [right, backHeight, back],
        [left, backHeight, back]
      ),
      ...[left, right].map(x =>
        panel([x, 0, line], [x, 0, back], [x, backHeight, back], [x, bar, line])
      )
    ]);
    const half = thickness / 2;
    // The posts and bar, each drawn over a box one outline larger all
    // round, so a dark edge shows around the white.
    const bars: [Point, Point][] = [
      [
        [left - thickness, 0, line - half],
        [left, bar + thickness, line + half]
      ],
      [
        [right, 0, line - half],
        [right + thickness, bar + thickness, line + half]
      ],
      [
        [left, bar, line - half],
        [right, bar + thickness, line + half]
      ]
    ];
    const frame = merge([
      ...bars.map(([a, b]) =>
        box(
          [a[0] - outline, Math.max(0, a[1] - outline), a[2] - outline],
          [b[0] + outline, b[1] + outline, b[2] + outline],
          '#141414'
        )
      ),
      ...bars.map(([a, b]) => box(a, b, '#f4f4f4'))
    ]);
    return [
      { kind: 'net', order: back, solid: net },
      { kind: 'frame', order: line, solid: frame }
    ];
  });
};
