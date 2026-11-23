import {
  Camera,
  Geometry,
  Mat4,
  Mesh,
  Program,
  RenderTarget,
  Renderer,
  Texture,
  Transform,
  Vec3,
  type OGLRenderingContext
} from 'ogl';

import { cupArt, shadowArt } from '../assets/clip-sprites';
import type { ClipSides } from '../clip-canvas';
import {
  artPixelMetres,
  ballHeld,
  ballLiftMetres,
  ballSprite,
  cupPalette,
  iconPalette,
  looksFor,
  playerPalette,
  spriteFor,
  statusSprite,
  type ArtPalette
} from '../clip-sprites';
import { pitchLength, pitchWidth, type ClipFrame } from '../clips';
import { createAtlas, createLayers, type Billboard } from './billboards';
import { boardCanvases, boardSolids } from './boards';
import { goalPieces, netCanvas } from './goals';
import { markings, mowPitch, surround, type GrassPattern } from './pitch';
import { towardsSun, type Solid } from './solid';
import { fans, standsSolid } from './stands';

// The ground's painter (#263, ADR 0018): a clip's frame drawn over a 3D
// ground with OGL. The ground, the stands, the boards and the goals are
// geometry, lit by a sun that casts their shadows across the pitch; the
// players, the ball and the fans are sprites, standing on their points. The
// scene is rendered at one pixel to an art pixel, for the clip's canvas to
// scale up in whole pixels, so it reads as pixel art.

/** Shadows darken what they fall on, every other pixel. */
const shadowPalette: ArtPalette = { x: '#000000a0' };

/** The camera's field of view, top to bottom: narrow, so near-flat. */
const fieldOfView = 20;
/** The ground beyond the lines that the pitch texture covers, in metres. */
const beyond = 40;
const texelsPerMetre = 10;
/** How much of the light a shadow takes from the ground. */
const shadowStrength = 0.32;
/** The shadow map's size, in texels, and the ground it covers, in metres. */
const shadowTexels = 2048;
const shadowReach = 95;

/** The pitch, mown in `pattern` and marked as today's, on `canvas`. */
const paintPitch = (canvas: HTMLCanvasElement, pattern: GrassPattern) => {
  canvas.width = (pitchWidth + 2 * beyond) * texelsPerMetre;
  canvas.height = (pitchLength + 2 * beyond) * texelsPerMetre;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = surround;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.putImageData(
    mowPitch(pattern, texelsPerMetre),
    beyond * texelsPerMetre,
    beyond * texelsPerMetre
  );
  ctx.scale(texelsPerMetre, texelsPerMetre);
  ctx.translate(beyond, beyond);
  markings(ctx);
  return canvas;
};

const whiteCanvas = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1, 1);
  return canvas;
};

/** Pixel art: never smoothed, never shrunk into mipmaps. */
const artTexture = (
  gl: OGLRenderingContext,
  image: HTMLCanvasElement,
  repeat = false
) =>
  new Texture(gl, {
    flipY: true,
    generateMipmaps: false,
    image,
    magFilter: gl.NEAREST,
    minFilter: gl.NEAREST,
    wrapS: repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE,
    wrapT: repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE
  });

/** The ground, flat at the foot of everything, with the pitch on it. */
const groundGeometry = (gl: OGLRenderingContext) => {
  const [x0, x1] = [-beyond, pitchWidth + beyond];
  const [z0, z1] = [-beyond, pitchLength + beyond];
  return new Geometry(gl, {
    index: { data: new Uint16Array([0, 1, 2, 0, 2, 3]) },
    position: {
      data: new Float32Array([x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1]),
      size: 3
    },
    // The canvas's top row is the far end of the ground.
    uv: { data: new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), size: 2 }
  });
};

const solidGeometry = (gl: OGLRenderingContext, solid: Solid) =>
  new Geometry(gl, {
    colour: { data: new Float32Array(solid.colour), size: 3 },
    position: { data: new Float32Array(solid.position), size: 3 },
    uv: { data: new Float32Array(solid.uv), size: 2 }
  });

const solidVertex = /* glsl */ `
  attribute vec3 position;
  attribute vec3 colour;
  attribute vec2 uv;
  uniform mat4 viewMatrix;
  uniform mat4 projectionMatrix;
  uniform float shear;
  varying vec3 vColour;
  varying vec2 vUv;
  void main() {
    vColour = colour;
    vUv = uv;
    // Heights drawn up the screen as well, as the sprites draw them.
    vec3 at = vec3(position.xy, position.z - shear * position.y);
    gl_Position = projectionMatrix * viewMatrix * vec4(at, 1.0);
  }
`;

const solidFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D map;
  uniform float alphaTest;
  varying vec3 vColour;
  varying vec2 vUv;
  void main() {
    vec4 colour = texture2D(map, vUv) * vec4(vColour, 1.0);
    if (colour.a < alphaTest) discard;
    gl_FragColor = colour;
  }
`;

/** The sun's view: how far each texel's nearest solid is from it. */
const depthVertex = /* glsl */ `
  attribute vec3 position;
  attribute vec2 uv;
  uniform mat4 viewMatrix;
  uniform mat4 projectionMatrix;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  }
`;

const depthFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D map;
  uniform float alphaTest;
  varying vec2 vUv;
  void main() {
    if (texture2D(map, vUv).a < alphaTest) discard;
    gl_FragColor = vec4(1.0);
  }
`;

const groundVertex = /* glsl */ `
  attribute vec3 position;
  attribute vec2 uv;
  uniform mat4 viewMatrix;
  uniform mat4 projectionMatrix;
  uniform mat4 sunMatrix;
  varying vec2 vUv;
  varying vec4 vSun;
  void main() {
    vUv = uv;
    vSun = sunMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  }
`;

const groundFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D map;
  uniform sampler2D shadowMap;
  uniform float shadowStrength;
  varying vec2 vUv;
  varying vec4 vSun;
  void main() {
    vec3 colour = texture2D(map, vUv).rgb;
    vec3 sun = vSun.xyz / vSun.w * 0.5 + 0.5;
    bool inside = all(greaterThan(sun, vec3(0.0))) && all(lessThan(sun, vec3(1.0)));
    if (inside && sun.z - 0.001 > texture2D(shadowMap, sun.xy).r) {
      colour *= 1.0 - shadowStrength;
    }
    gl_FragColor = vec4(colour, 1.0);
  }
`;

/** How a frame is seen: where, at what size, and from what tilt. */
export type GroundView = Readonly<{
  /** The pitch mown in this pattern. */
  grass: GrassPattern;
  /** The render's size in pixels, one to an art pixel. */
  high: number;
  /** Metres on the ground to each pixel, at the picture's centre. */
  metresPerPixel: number;
  /** The camera's angle from straight down, in degrees, from behind the bottom goal. */
  tilt: number;
  wide: number;
  /** The point on the pitch at the picture's centre, in metres. */
  x: number;
  y: number;
}>;

/** A point on the pitch, `up` metres above it, in the render's pixels from its top left. */
export type GroundProjection = (
  x: number,
  y: number,
  up?: number
) => readonly [number, number];

/** The camera, looking down the pitch with the screen's top to the far end. */
export const groundCamera = (gl: OGLRenderingContext) => {
  const camera = new Camera(gl, { far: 1000, fov: fieldOfView, near: 1 });
  camera.up.set(0, 0, -1);
  return camera;
};

/**
 * Points `camera` at the patch `view` shows. Returns how far heights lean
 * up the pitch, and where the pitch's points fall in the picture, kept
 * apart from the camera, which the next frame moves.
 */
export const aimCamera = (camera: Camera, view: GroundView) => {
  const { high, wide } = view;
  const viewHeight = high * view.metresPerPixel;
  const distance =
    viewHeight / 2 / Math.tan(((fieldOfView / 2) * Math.PI) / 180);
  const angle = (view.tilt * Math.PI) / 180;
  // A metre of height rises a metre up the screen at any tilt, as the
  // sprites draw it: what the tilt leaves out is made up by leaning the
  // heights up the pitch.
  const shear = (1 - Math.sin(angle)) / Math.cos(angle);
  const target = new Vec3(view.x, 0, view.y);
  camera.perspective({
    aspect: wide / high,
    far: distance + 400,
    near: Math.max(1, distance - 150)
  });
  camera.position
    .copy(target)
    .add(new Vec3(0, Math.cos(angle), Math.sin(angle)).scale(distance));
  camera.lookAt(target);
  camera.updateMatrixWorld();
  const matrix = new Mat4().copy(camera.projectionViewMatrix);
  const project: GroundProjection = (x, y, up = 0) => {
    const at = new Vec3(x, up, y - shear * up).applyMatrix4(matrix);
    return [((at.x + 1) / 2) * wide, ((1 - at.y) / 2) * high];
  };
  return { project, shear };
};

export type GroundPainter = ReturnType<typeof createGroundPainter>;

/** A painter on `canvas`, a WebGL canvas the picture is rendered into. */
export const createGroundPainter = (canvas: HTMLCanvasElement) => {
  const renderer = new Renderer({ antialias: false, canvas, dpr: 1 });
  const { gl } = renderer;
  const [r, g, b] = [1, 3, 5].map(
    i => Number.parseInt(surround.slice(i, i + 2), 16) / 255
  );
  gl.clearColor(r!, g!, b!, 1);

  const shear = { value: 0 };
  const white = artTexture(gl, whiteCanvas());

  // The sun, looking down at the middle of the pitch from far off, and
  // what it sees of the solids, to tell the ground where it is shaded.
  const sun = new Camera(gl, {
    bottom: -shadowReach,
    far: 320,
    left: -shadowReach,
    near: 1,
    right: shadowReach,
    top: shadowReach
  });
  const centre = new Vec3(pitchWidth / 2, 0, pitchLength / 2);
  sun.position.copy(centre).add(new Vec3(...towardsSun).scale(150));
  sun.lookAt(centre);
  sun.updateMatrixWorld();
  const shadowMap = new RenderTarget(gl, {
    depthTexture: true,
    height: shadowTexels,
    width: shadowTexels
  });
  const castsShadow = new Transform();

  const scene = new Transform();
  let mown: GrassPattern = 'stripes';
  const pitch = paintPitch(document.createElement('canvas'), mown);
  const pitchTexture = artTexture(gl, pitch);
  const ground = new Mesh(gl, {
    frustumCulled: false,
    geometry: groundGeometry(gl),
    program: new Program(gl, {
      cullFace: false,
      fragment: groundFragment,
      uniforms: {
        map: { value: pitchTexture },
        shadowMap: { value: shadowMap.depthTexture },
        shadowStrength: { value: shadowStrength },
        sunMatrix: { value: sun.projectionViewMatrix }
      },
      vertex: groundVertex
    })
  });
  ground.setParent(scene);

  /**
   * A solid piece in the scene and in the sun's view. A see-through one
   * is drawn among the sprites, after what is behind it.
   */
  const addSolid = (
    solid: Solid,
    map = white,
    options: Readonly<{ alphaTest?: number; seeThrough?: boolean }> = {}
  ) => {
    const geometry = solidGeometry(gl, solid);
    const alphaTest = { value: options.alphaTest ?? 0 };
    const mesh = new Mesh(gl, {
      frustumCulled: false,
      geometry,
      program: new Program(gl, {
        cullFace: false,
        depthWrite: !options.seeThrough,
        fragment: solidFragment,
        transparent: options.seeThrough ?? false,
        uniforms: { alphaTest, map: { value: map }, shear },
        vertex: solidVertex
      })
    });
    new Mesh(gl, {
      frustumCulled: false,
      geometry,
      program: new Program(gl, {
        cullFace: false,
        fragment: depthFragment,
        uniforms: { alphaTest, map: { value: map } },
        vertex: depthVertex
      })
    }).setParent(castsShadow);
    return mesh;
  };

  addSolid(standsSolid()).setParent(scene);
  const boardArt = boardCanvases();
  const boards = boardSolids();
  addSolid(boards.faces, artTexture(gl, boardArt.faces, true)).setParent(scene);
  addSolid(boards.backs, artTexture(gl, boardArt.backs, true)).setParent(scene);

  // The sprites, drawn in layers between the goals' nets and frames.
  const atlas = createAtlas(gl);
  const net = artTexture(gl, netCanvas(), true);
  const goals = goalPieces().toSorted((a, b) => a.order - b.order);
  const billboards = createLayers(
    gl,
    atlas,
    goals.map(goal => goal.order)
  );
  billboards.meshes[0]!.setParent(scene);
  goals.forEach((goal, i) => {
    const mesh =
      goal.kind === 'net'
        ? addSolid(goal.solid, net, { alphaTest: 0.5, seeThrough: true })
        : addSolid(goal.solid, white, { seeThrough: true });
    mesh.setParent(scene);
    billboards.meshes[i + 1]!.setParent(scene);
  });

  renderer.render({ camera: sun, scene: castsShadow, target: shadowMap });

  const camera = groundCamera(gl);

  let crowd: { key: string; sprites: Billboard[] } | undefined;
  const crowdFor = (sides: ClipSides, cheer: boolean) => {
    const key = `${sides.attack.kit}|${sides.defence.kit}|${sides.attack.home}|${cheer}`;
    if (crowd?.key !== key) {
      crowd = { key, sprites: fans(sides, cheer) };
    }
    return crowd.sprites;
  };

  let size = { height: 0, width: 0 };

  /** The frame's sprites: the crowd, the players, the ball and the cup. */
  const spritesOf = (frame: ClipFrame, sides: ClipSides) => {
    const sprites: Billboard[] = [...crowdFor(sides, frame.cheer ?? false)];
    const { ball } = frame;
    const lift = ball.height * ballLiftMetres;
    // A ball is held, or, in the cup celebration, put away.
    const held = Boolean(frame.trophy) || ballHeld(frame.players, ball);
    const attackers = sides.attack.players.length;
    // Shadows first, lit from the top left, so everything stands on them.
    for (const player of frame.players) {
      sprites.push({
        flat: true,
        grid: shadowArt.player,
        order: -Infinity,
        palette: shadowPalette,
        x: player.x + 0.3,
        z: player.y + 0.12
      });
    }
    if (!held) {
      sprites.push({
        flat: true,
        grid: shadowArt.ball,
        order: -Infinity,
        palette: shadowPalette,
        x: ball.x + 0.15 + lift * 0.5,
        z: ball.y + 0.08 + lift * 0.2
      });
    }
    frame.players.forEach((player, i) => {
      const side = sides[player.side];
      const place = i < attackers ? i : i - attackers;
      const looks = looksFor(side.players[place]?.label ?? '', place);
      const sprite = spriteFor(player);
      const shirt = player.keeper ? side.keeper : side.kit;
      sprites.push({
        grid: sprite.grid,
        mirrored: sprite.mirrored,
        order: player.y,
        palette: playerPalette(shirt, looks),
        x: player.x,
        z: player.y
      });
      if (player.status) {
        sprites.push({
          grid: statusSprite(player.status),
          lift: sprite.grid.length + 1,
          order: player.y,
          palette: iconPalette,
          x: player.x,
          z: player.y
        });
      }
    });
    if (frame.trophy) {
      // Just in front of whoever holds it, so the hands stay behind the cup.
      sprites.push({
        grid: cupArt,
        lift: frame.trophy.raise / artPixelMetres,
        order: frame.trophy.y + 0.01,
        palette: cupPalette,
        x: frame.trophy.x,
        z: frame.trophy.y
      });
    }
    if (!held) {
      const grid = ballSprite(ball.x, ball.y);
      sprites.push({
        grid,
        lift: lift / artPixelMetres - grid.length / 2,
        order: ball.y,
        palette: iconPalette,
        x: ball.x,
        z: ball.y
      });
    }
    // Confetti over everything, two art pixels square a speck.
    for (const speck of frame.confetti ?? []) {
      sprites.push({
        grid: ['cc', 'cc'],
        order: Infinity,
        palette: { c: speck.colour },
        x: speck.x,
        z: speck.y
      });
    }
    return sprites;
  };

  /**
   * Renders `frame` as `view` sees it into the canvas, and returns where
   * the pitch's points fall in the picture.
   */
  const paint = (
    frame: ClipFrame,
    sides: ClipSides,
    view: GroundView
  ): GroundProjection => {
    const { high, wide } = view;
    if (size.width !== wide || size.height !== high) {
      size = { height: high, width: wide };
      renderer.setSize(wide, high);
      billboards.setViewport(wide, high);
    }
    if (view.grass !== mown) {
      mown = view.grass;
      paintPitch(pitch, mown);
      pitchTexture.needsUpdate = true;
    }
    const { project, shear: lean } = aimCamera(camera, view);
    shear.value = lean;
    billboards.setShear(lean);
    billboards.fill(spritesOf(frame, sides));
    renderer.render({ camera, frustumCull: false, scene, sort: false });
    return project;
  };

  return { paint };
};
