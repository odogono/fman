import {
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  NoColorSpace,
  RepeatWrapping,
  type Vector3
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { boardArt } from '../assets/clip-sprites';
import { artPixelMetres, rasterise } from '../clip-sprites';
import { boardBackPalette, boardPalette } from '../clip-stadium';
import { boardMetres, pitchLength, pitchWidth } from '../clips';
import { place, shade, type Side } from './stands';

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

const artTexture = (palette: typeof boardPalette) => {
  const { data, height: high, width } = rasterise(boardArt, palette);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = high;
  canvas.getContext('2d')!.putImageData(new ImageData(data, width, high), 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = RepeatWrapping;
  texture.colorSpace = NoColorSpace;
  return texture;
};

/** A four-cornered panel, `a` to `b` along the bottom, `d` above `a`. */
const panel = (a: Vector3, b: Vector3, c: Vector3, d: Vector3) => {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      [a, b, c, d].flatMap(p => [p.x, p.y, p.z]),
      3
    )
  );
  const across = a.distanceTo(b) / run;
  geometry.setAttribute(
    'uv',
    new Float32BufferAttribute([0, 0, across, 0, across, 1, 0, 1], 2)
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return shade(geometry, '#ffffff');
};

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
export const boardsMesh = () => {
  const faces: BufferGeometry[] = [];
  const backs: BufferGeometry[] = [];
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
  const face = new MeshBasicMaterial({
    map: artTexture(boardPalette),
    side: DoubleSide,
    vertexColors: true
  });
  const back = new MeshBasicMaterial({
    map: artTexture(boardBackPalette),
    side: DoubleSide,
    vertexColors: true
  });
  const made = [
    new Mesh(mergeGeometries(faces), face),
    new Mesh(mergeGeometries(backs), back)
  ];
  for (const mesh of made) {
    mesh.castShadow = true;
  }
  return made;
};
