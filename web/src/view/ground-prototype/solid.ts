// The ground's solid pieces as plain triangles (#263): the stands, the
// goals and the boards are built here, apart from any renderer, and the
// scene hands them to the GPU. Each face is shaded flat once, by how it
// faces the sun, so nothing is lit per frame.

/** A point in world metres: across the pitch, up into the air, and down the screen. */
export type Point = readonly [number, number, number];

/** Triangles, three corners each: where, their colour, and their art's coordinates. */
export type Solid = Readonly<{
  colour: number[];
  position: number[];
  uv: number[];
}>;

const normalise = ([x, y, z]: Point): Point => {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
};

/** The sun: up, and to the top left of the screen. */
export const towardsSun = normalise([-1.1, 1, -0.45]);

const minus = (a: Point, b: Point): Point => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2]
];

const cross = (a: Point, b: Point): Point => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];

export const distance = (a: Point, b: Point) => Math.hypot(...minus(a, b));

const channels = (colour: string) =>
  [1, 3, 5].map(i => Number.parseInt(colour.slice(i, i + 2), 16) / 255);

/** Lit fully facing the sun, less from the side, least facing away. */
const lightFor = (normal: Point) => {
  const facing =
    normal[0] * towardsSun[0] +
    normal[1] * towardsSun[1] +
    normal[2] * towardsSun[2];
  return facing >= towardsSun[1] - 0.01 ? 1 : facing > 0 ? 0.85 : 0.68;
};

const face = (
  corners: readonly [Point, Point, Point, Point],
  normal: Point,
  colour: string,
  uv: readonly number[]
): Solid => {
  const rgb = channels(colour).map(c => c * lightFor(normalise(normal)));
  const order = [0, 1, 2, 0, 2, 3];
  return {
    colour: order.flatMap(() => rgb),
    position: order.flatMap(i => [...corners[i]!]),
    uv: order.flatMap(i => [uv[i * 2]!, uv[i * 2 + 1]!])
  };
};

/**
 * A flat four-cornered panel, `a` to `b` along one edge and `d` beside
 * `a`, facing the way its corners turn. `across` and `up` are how many
 * times its art repeats each way.
 */
export const quad = (
  corners: readonly [Point, Point, Point, Point],
  colour: string,
  across = 1,
  up = 1
): Solid => {
  const [a, b, , d] = corners;
  return face(corners, cross(minus(b, a), minus(d, a)), colour, [
    0,
    0,
    across,
    0,
    across,
    up,
    0,
    up
  ]);
};

/** A box between two corners, in world metres. */
export const box = (a: Point, b: Point, colour: string): Solid => {
  const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
  const [y0, y1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
  const [z0, z1] = [Math.min(a[2], b[2]), Math.max(a[2], b[2])];
  const plain = [0, 0, 1, 0, 1, 1, 0, 1];
  const sides: [readonly [Point, Point, Point, Point], Point][] = [
    [
      [
        [x1, y0, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x1, y0, z1]
      ],
      [1, 0, 0]
    ],
    [
      [
        [x0, y0, z0],
        [x0, y0, z1],
        [x0, y1, z1],
        [x0, y1, z0]
      ],
      [-1, 0, 0]
    ],
    [
      [
        [x0, y1, z0],
        [x0, y1, z1],
        [x1, y1, z1],
        [x1, y1, z0]
      ],
      [0, 1, 0]
    ],
    [
      [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
        [x0, y0, z1]
      ],
      [0, -1, 0]
    ],
    [
      [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1]
      ],
      [0, 0, 1]
    ],
    [
      [
        [x0, y0, z0],
        [x0, y1, z0],
        [x1, y1, z0],
        [x1, y0, z0]
      ],
      [0, 0, -1]
    ]
  ];
  return merge(
    sides.map(([corners, normal]) => face(corners, normal, colour, plain))
  );
};

export const merge = (parts: readonly Solid[]): Solid => ({
  colour: parts.flatMap(p => p.colour),
  position: parts.flatMap(p => p.position),
  uv: parts.flatMap(p => p.uv)
});
