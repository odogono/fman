import {
  Geometry,
  Mesh,
  Program,
  Texture,
  type OGLRenderingContext
} from 'ogl';

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
export const createAtlas = (gl: OGLRenderingContext) => {
  const canvas = document.createElement('canvas');
  canvas.width = atlasSize;
  canvas.height = atlasSize;
  const ctx = canvas.getContext('2d')!;
  const texture = new Texture(gl, {
    flipY: false,
    generateMipmaps: false,
    image: canvas,
    magFilter: gl.NEAREST,
    minFilter: gl.NEAREST
  });
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
  uniform mat4 viewMatrix;
  uniform mat4 projectionMatrix;
  attribute vec3 foot;
  attribute vec2 size;
  attribute vec4 rect;
  attribute float lift;
  attribute float isFlat;
  uniform vec2 viewport;
  uniform float shear;
  varying vec2 vUv;
  void main() {
    // Heights drawn up the screen as well, as the sprites draw them.
    vec3 base = vec3(foot.x, foot.y, foot.z - shear * foot.y);
    vUv = rect.xy + vec2(corner.x + 0.5, 1.0 - corner.y) * rect.zw;
    if (isFlat > 0.5) {
      vec3 world = base + vec3(
        corner.x * size.x * ${artPixelMetres},
        0.04,
        -(corner.y * size.y + lift) * ${artPixelMetres}
      );
      gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      return;
    }
    vec4 mv = viewMatrix * vec4(base, 1.0);
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
  precision highp float;
  uniform sampler2D atlas;
  varying vec2 vUv;
  void main() {
    vec4 colour = texture2D(atlas, vUv);
    if (colour.a < 0.01) discard;
    gl_FragColor = colour;
  }
`;

/** The mesh that draws a frame's sprites, and how to fill it. */
export const createBillboards = (
  gl: OGLRenderingContext,
  atlas: Atlas,
  capacity = 4096
) => {
  const instanced = (size: number) => ({
    data: new Float32Array(capacity * size),
    instanced: 1,
    size,
    usage: gl.DYNAMIC_DRAW
  });
  const geometry = new Geometry(gl, {
    corner: {
      data: new Float32Array([-0.5, 0, 0.5, 0, 0.5, 1, -0.5, 1]),
      size: 2
    },
    foot: instanced(3),
    index: { data: new Uint16Array([0, 1, 2, 0, 2, 3]) },
    isFlat: instanced(1),
    lift: instanced(1),
    rect: instanced(4),
    size: instanced(2)
  });
  const { foot, isFlat, lift, rect, size } = geometry.attributes as Record<
    'foot' | 'isFlat' | 'lift' | 'rect' | 'size',
    { data: Float32Array; needsUpdate: boolean }
  >;
  const viewport = { value: [1, 1] };
  const shear = { value: 0 };
  const program = new Program(gl, {
    cullFace: false,
    depthTest: true,
    depthWrite: false,
    fragment: fragmentShader,
    transparent: true,
    uniforms: { atlas: { value: atlas.texture }, shear, viewport },
    vertex: vertexShader
  });
  const mesh = new Mesh(gl, { frustumCulled: false, geometry, program });

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
      foot.data.set([sprite.x, sprite.y ?? 0, sprite.z], i * 3);
      size.data.set([sprite.grid[0]!.length, sprite.grid.length], i * 2);
      rect.data.set([u, v, w, h], i * 4);
      lift.data[i] = sprite.lift ?? 0;
      isFlat.data[i] = sprite.flat ? 1 : 0;
    }
    for (const changed of [foot, size, rect, lift, isFlat]) {
      changed.needsUpdate = true;
    }
    geometry.setInstancedCount(count);
    mesh.visible = count > 0;
  };
  const setShear = (value: number) => {
    shear.value = value;
  };
  const setViewport = (width: number, height: number) => {
    viewport.value = [width, height];
  };
  return { fill, mesh, setShear, setViewport };
};

/**
 * Sprites drawn in layers between solid pieces of the scene, such as a
 * goal's net and frame: a sprite whose order is at or past a layer's
 * `from` is drawn after the piece at that order. The scene draws layer `i`
 * after the piece at `from[i - 1]` and before the piece at `from[i]`.
 */
export const createLayers = (
  gl: OGLRenderingContext,
  atlas: Atlas,
  from: readonly number[]
) => {
  const layers = [-Infinity, ...from].map(() => createBillboards(gl, atlas));
  const fill = (sprites: readonly Billboard[]) => {
    const split = layers.map((): Billboard[] => []);
    for (const sprite of sprites) {
      split[from.filter(f => sprite.order >= f).length]!.push(sprite);
    }
    layers.forEach((layer, i) => layer.fill(split[i]!));
  };
  const setViewport = (width: number, height: number) => {
    for (const layer of layers) {
      layer.setViewport(width, height);
    }
  };
  const setShear = (shear: number) => {
    for (const layer of layers) {
      layer.setShear(shear);
    }
  };
  return {
    fill,
    meshes: layers.map(layer => layer.mesh),
    setShear,
    setViewport
  };
};
