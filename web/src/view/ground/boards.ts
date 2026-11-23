import { boardArt } from '../assets/clip-sprites';
import { artPixelMetres, rasterise, type ArtPalette } from '../clip-sprites';
import { boardMetres, pitchLength, pitchWidth } from '../clips';
import { distance, merge, quad, type Point, type Solid } from './solid';
import { place, type Side } from './stands';

// The advertising boards as models (#263): a wedge along each side of the
// pitch, its face leaning back from the pitch and painted with today's
// board art, so it scales with the ground as the camera zooms rather than
// jumping between whole-pixel sizes as a sprite does. Along the touchlines
// the boards lean further back, so their faces still show from straight
// above.

/** As tall as the art, in metres. */
const height = boardArt.length * artPixelMetres;
/** One run of the art, in metres along the boards. */
const run = boardArt[0]!.length * artPixelMetres;
/** How far each side's face leans back from upright, in degrees. */
const lean: Record<Side, number> = { bottom: 20, left: 60, right: 60, top: 20 };

/** The boards' panels: plain colours and shapes, like no flag or brand. */
const boardPalette: ArtPalette = {
  '1': '#d72828',
  '2': '#fac81e',
  '3': '#1e5adc',
  '4': '#28bee6',
  o: '#141414',
  w: '#f4f4f4'
};
/** The boards' backs, greyed. */
const boardBackPalette: ArtPalette = Object.fromEntries(
  Object.keys(boardPalette).map(k => [k, k === 'o' ? '#141414' : '#5a5a5a'])
);

const artCanvas = (palette: ArtPalette) => {
  const { data, height: high, width } = rasterise(boardArt, palette);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = high;
  canvas.getContext('2d')!.putImageData(new ImageData(data, width, high), 0, 0);
  return canvas;
};

/** The boards' art, painted on their faces and, greyed, on their backs. */
export const boardCanvases = () => ({
  backs: artCanvas(boardBackPalette),
  faces: artCanvas(boardPalette)
});

/** A four-cornered panel, `a` to `b` along the bottom, `d` above `a`. */
const panel = (a: Point, b: Point, c: Point, d: Point) =>
  quad([a, b, c, d], '#ffffff', distance(a, b) / run);

const span = (side: Side) =>
  side === 'left' || side === 'right'
    ? ([-boardMetres, pitchLength + boardMetres] as const)
    : ([-boardMetres, pitchWidth + boardMetres] as const);

/**
 * Along a side, its corners turned so each panel faces out of the wedge:
 * `from` and `to` swap where the side's axis runs the other way.
 */
const ends = (side: Side): readonly [number, number] => {
  const [from, to] = span(side);
  return side === 'left' || side === 'bottom' ? [to, from] : [from, to];
};

/** The boards: their art-painted faces, and their plain backs. */
export const boardSolids = (): Readonly<{ backs: Solid; faces: Solid }> => {
  const faces: Solid[] = [];
  const backs: Solid[] = [];
  for (const side of ['top', 'bottom', 'left', 'right'] as const) {
    const [from, to] = ends(side);
    const angle = (lean[side] * Math.PI) / 180;
    const top = boardMetres + height * Math.sin(angle);
    const up = height * Math.cos(angle);
    faces.push(
      panel(
        place(side, boardMetres, from, 0),
        place(side, boardMetres, to, 0),
        place(side, top, to, up),
        place(side, top, from, up)
      )
    );
    backs.push(
      panel(
        place(side, top, to, 0),
        place(side, top, from, 0),
        place(side, top, from, up),
        place(side, top, to, up)
      )
    );
  }
  return { backs: merge(backs), faces: merge(faces) };
};
