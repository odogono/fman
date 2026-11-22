import {
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  NoColorSpace,
  RepeatWrapping,
  Vector3
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { netDepthMetres } from '../assets/clip-sprites';
import { artPixelMetres } from '../clip-sprites';
import { pitchLength, pitchWidth } from '../clips';
import { block } from './stands';

// The goals as models (#263): posts and a crossbar, and a net of see-through
// panels, each casting its shadow. Each goal is two pieces drawn among the
// sprites by depth, as today's art is: the net and the frame, so a player
// can stand inside the net, behind the posts, or in front of them.

/** Between the posts, and up to the bar's underside, in metres. */
const mouth = 7.32;
const bar = 2.44;
/** The posts and bar, three art pixels thick, so they read at any zoom. */
const thickness = 3 * artPixelMetres;
/** The net falls from the bar to this height at the back. */
const backHeight = 1.9;
/** Each square of the net, four art pixels across. */
const mesh = 4 * artPixelMetres;

const netTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 4;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 4, 1);
  ctx.fillRect(0, 0, 1, 4);
  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = NoColorSpace;
  return texture;
};

/**
 * A flat four-cornered panel, `a` to `b` along one edge and `a` to `d` up
 * the other, with the net's squares measured in metres along both.
 */
const panel = (a: Vector3, b: Vector3, c: Vector3, d: Vector3) => {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      [a, b, c, d].flatMap(p => [p.x, p.y, p.z]),
      3
    )
  );
  const across = a.distanceTo(b) / mesh;
  const up = a.distanceTo(d) / mesh;
  geometry.setAttribute(
    'uv',
    new Float32BufferAttribute([0, 0, across, 0, across, up, 0, up], 2)
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
};

const at = (x: number, y: number, z: number) => new Vector3(x, y, z);

export type GoalPiece = Readonly<{ mesh: Group | Mesh; order: number }>;

/**
 * Both goals' pieces, with the order each is drawn at among the sprites:
 * today's art's, the top goal's net behind its line and the bottom goal's
 * net in front of its frame.
 */
export const goalModels = (): GoalPiece[] => {
  const centre = pitchWidth / 2;
  const left = centre - mouth / 2;
  const right = centre + mouth / 2;
  const net = new MeshBasicMaterial({
    alphaTest: 0.5,
    color: '#cfcfcf',
    depthWrite: false,
    map: netTexture(),
    side: DoubleSide,
    transparent: true
  });
  const frame = new MeshBasicMaterial({
    depthWrite: false,
    transparent: true,
    vertexColors: true
  });
  return [
    { into: -1, line: 0 },
    { into: 1, line: pitchLength }
  ].flatMap(({ into, line }) => {
    const back = line + into * netDepthMetres;
    const netMesh = new Mesh(
      mergeGeometries([
        // The back, the roof sloping down to it, and the sides.
        panel(
          at(left, 0, back),
          at(right, 0, back),
          at(right, backHeight, back),
          at(left, backHeight, back)
        ),
        panel(
          at(left, bar, line),
          at(right, bar, line),
          at(right, backHeight, back),
          at(left, backHeight, back)
        ),
        ...[left, right].map(x =>
          panel(
            at(x, 0, line),
            at(x, 0, back),
            at(x, backHeight, back),
            at(x, bar, line)
          )
        )
      ]),
      net
    );
    const half = thickness / 2;
    const white = '#f4f4f4';
    const frameMesh = new Mesh(
      mergeGeometries([
        block(
          at(left - thickness, 0, line - half),
          at(left, bar + thickness, line + half),
          white
        ),
        block(
          at(right, 0, line - half),
          at(right + thickness, bar + thickness, line + half),
          white
        ),
        block(
          at(left, bar, line - half),
          at(right, bar + thickness, line + half),
          white
        )
      ]),
      frame
    );
    for (const made of [netMesh, frameMesh]) {
      made.castShadow = true;
    }
    return [
      { mesh: netMesh, order: back },
      { mesh: frameMesh, order: line }
    ];
  });
};
