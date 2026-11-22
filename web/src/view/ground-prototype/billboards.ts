import {
  CanvasTexture,
  DynamicDrawUsage,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  NearestFilter,
  NoColorSpace,
  ShaderMaterial,
  Vector2
} from 'three';

import type { ArtGrid } from '../assets/clip-sprites';
import { artPixelMetres, rasterise, type ArtPalette } from '../clip-sprites';

// The prototype's sprites (#263): every grid and palette drawn once into one
// atlas, and every sprite in a frame drawn in one call. A billboard stands
// on its foot point and faces the screen, so it looks as today's sprites do
// from straight above and stands up as the camera tilts. A decal lies flat
// on the ground, as a shadow does.

const atlasSize = 2048;

type Rect = readonly [number, number, number, number];

/** Each grid and palette, rasterised once into a shared texture. */
export const createAtlas = () => {
  const canvas = document.createElement('canvas');
  canvas.width = atlasSize;
  canvas.height = atlasSize;
  const ctx = canvas.getContext('2d')!;
  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.colorSpace = NoColorSpace;
  const rects = new Map<string, Rect>();
  let x = 0;
  let y = 0;
  let shelf = 0;
  const rect = (grid: ArtGrid, palette: ArtPalette, mirrored: boolean) => {
    const key = `${grid.join('/')}|${Object.entries(palette).join()}|${mirrored}`;
    let found = rects.get(key);
    if (!found) {
      const { data, height, width } = rasterise(grid, palette, mirrored);
      if (x + width + 1 > atlasSize) {
        x = 0;
        y += shelf + 1;
        shelf = 0;
      }
      if (y + height > atlasSize) {
        throw new Error('The sprite atlas is full');
      }
      ctx.putImageData(new ImageData(data, width, height), x, y);
      found = [
        x / atlasSize,
        y / atlasSize,
        width / atlasSize,
        height / atlasSize
      ];
      rects.set(key, found);
      x += width + 1;
      shelf = Math.max(shelf, height);
      texture.needsUpdate = true;
    }
    return found;
  };
  return { rect, texture };
};

export type Atlas = ReturnType<typeof createAtlas>;

/** One sprite in a frame. */
export type Billboard = Readonly<{
  /** Lies flat on the ground, rather than standing facing the screen. */
  flat?: boolean;
  grid: ArtGrid;
  /** Raised this many art pixels up the screen above its foot. */
  lift?: number;
  mirrored?: boolean;
  /** Sorts it: larger is drawn later, over what is behind. */
  order: number;
  palette: ArtPalette;
  /** Its foot, in metres: across, up from the ground, and down the pitch. */
  x: number;
  y?: number;
  z: number;
}>;

const vertexShader = /* glsl */ `
  attribute vec2 corner;
  attribute vec3 foot;
  attribute vec2 size;
  attribute vec4 rect;
  attribute float lift;
  attribute float isFlat;
  uniform vec2 viewport;
  varying vec2 vUv;
  void main() {
    vUv = rect.xy + vec2(corner.x + 0.5, 1.0 - corner.y) * rect.zw;
    if (isFlat > 0.5) {
      vec3 world = foot + vec3(
        corner.x * size.x * ${artPixelMetres},
        0.04,
        -(corner.y * size.y + lift) * ${artPixelMetres}
      );
      gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      return;
    }
    vec4 mv = viewMatrix * vec4(foot, 1.0);
    vec4 at = projectionMatrix * mv;
    vec2 px = (at.xy / at.w * 0.5 + 0.5) * viewport;
    // Whole render pixels to each art pixel near the camera's distance, as
    // the flat clips draw them; further off, a sprite shrinks smoothly.
    float perMetre = projectionMatrix[1][1] * viewport.y * 0.5 / -mv.z;
    float art = perMetre * ${artPixelMetres};
    art = art >= 0.75 ? floor(art + 0.5) : art;
    float left = floor(px.x - size.x * art * 0.5 + 0.5);
    float bottom = floor(px.y + 0.5) + lift * art;
    vec2 placed = vec2(
      left + (corner.x + 0.5) * size.x * art,
      bottom + corner.y * size.y * art
    );
    // A metre towards the camera, so it stands clear of the ground it is on.
    vec4 depth = projectionMatrix * vec4(mv.xy, mv.z + 1.0, 1.0);
    gl_Position = vec4(placed / viewport * 2.0 - 1.0, depth.z / depth.w, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D atlas;
  varying vec2 vUv;
  void main() {
    vec4 colour = texture2D(atlas, vUv);
    if (colour.a < 0.01) discard;
    gl_FragColor = colour;
  }
`;

/** The mesh that draws a frame's sprites, and how to fill it. */
export const createBillboards = (atlas: Atlas, capacity = 4096) => {
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      [-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0],
      3
    )
  );
  geometry.setAttribute(
    'corner',
    new Float32BufferAttribute([-0.5, 0, 0.5, 0, 0.5, 1, -0.5, 1], 2)
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const attribute = (name: string, width: number) => {
    const made = new InstancedBufferAttribute(
      new Float32Array(capacity * width),
      width
    );
    made.setUsage(DynamicDrawUsage);
    geometry.setAttribute(name, made);
    return made;
  };
  const foot = attribute('foot', 3);
  const size = attribute('size', 2);
  const rect = attribute('rect', 4);
  const lift = attribute('lift', 1);
  const flat = attribute('isFlat', 1);
  const viewport = new Vector2(1, 1);
  const material = new ShaderMaterial({
    depthTest: true,
    depthWrite: false,
    fragmentShader,
    transparent: true,
    uniforms: {
      atlas: { value: atlas.texture },
      viewport: { value: viewport }
    },
    vertexShader
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;

  const fill = (sprites: readonly Billboard[]) => {
    const sorted = sprites.toSorted((a, b) => a.order - b.order);
    const count = Math.min(capacity, sorted.length);
    for (let i = 0; i < count; i++) {
      const sprite = sorted[i]!;
      const [u, v, w, h] = atlas.rect(
        sprite.grid,
        sprite.palette,
        sprite.mirrored ?? false
      );
      foot.setXYZ(i, sprite.x, sprite.y ?? 0, sprite.z);
      size.setXY(i, sprite.grid[0]!.length, sprite.grid.length);
      rect.setXYZW(i, u, v, w, h);
      lift.setX(i, sprite.lift ?? 0);
      flat.setX(i, sprite.flat ? 1 : 0);
    }
    for (const changed of [foot, size, rect, lift, flat]) {
      changed.needsUpdate = true;
    }
    geometry.instanceCount = count;
  };
  return { fill, mesh, viewport };
};
