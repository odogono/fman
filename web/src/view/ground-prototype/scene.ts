import {
  Camera,
  Geometry,
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
import { grass, markings, surround, type ClipSides } from '../clip-canvas';
import { drawCard, drawLabel, overlayUnit } from '../clip-card';
import { drawGoal } from '../clip-goal';
import {
  artPixelMetres,
  artPixelSize,
  ballHeld,
  ballLiftMetres,
  ballSprite,
  cupPalette,
  iconPalette,
  looksFor,
  playerPalette,
  spriteFor,
  statusSprite
} from '../clip-sprites';
import { shadowPalette } from '../clip-stadium';
import { pitchLength, pitchWidth, type ClipFrame } from '../clips';
import { createAtlas, createLayers, type Billboard } from './billboards';
import { boardCanvases, boardSolids } from './boards';
import { goalPieces, netCanvas } from './goals';
import { towardsSun, type Solid } from './solid';
import { fans, standsSolid } from './stands';

// The prototype's painter (#263): a clip's frame drawn over a 3D ground
// with OGL. The ground, the stands, the boards and the goals are geometry,
// lit by a sun that casts their shadows across the pitch; the players, the
// ball and the fans are today's sprites, standing on their points. The
// scene is rendered at one pixel to an art pixel and scaled up in whole
// pixels, so it reads as the same art.

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

/** Today's pitch, stripes and markings, painted once on a canvas. */
const pitchCanvas = () => {
  const canvas = document.createElement('canvas');
  canvas.width = (pitchWidth + 2 * beyond) * texelsPerMetre;
  canvas.height = (pitchLength + 2 * beyond) * texelsPerMetre;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = surround;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(texelsPerMetre, texelsPerMetre);
  ctx.translate(beyond, beyond);
  for (let y = 0; y < pitchLength; y += 5) {
    ctx.fillStyle = grass[(y / 5) % 2]!;
    ctx.fillRect(0, y, pitchWidth, Math.min(5, pitchLength - y));
  }
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

export type GroundView = ReturnType<typeof createGroundView>;

/**
 * A 3D painter on `canvas`, with a 2D `overlay` over it for the card, the
 * label and the goal announcement. `tilt` is the camera's angle from
 * straight down, in degrees, leaning back towards the bottom of the screen.
 */
export const createGroundView = (
  canvas: HTMLCanvasElement,
  overlay: HTMLCanvasElement
) => {
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
  const ground = new Mesh(gl, {
    frustumCulled: false,
    geometry: groundGeometry(gl),
    program: new Program(gl, {
      cullFace: false,
      fragment: groundFragment,
      uniforms: {
        map: { value: artTexture(gl, pitchCanvas()) },
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

  const camera = new Camera(gl, { far: 1000, fov: fieldOfView, near: 1 });
  camera.up.set(0, 0, -1);

  let crowd: { key: string; sprites: Billboard[] } | undefined;
  const crowdFor = (sides: ClipSides, cheer: boolean) => {
    const key = `${sides.attack.kit}|${sides.defence.kit}|${sides.attack.home}|${cheer}`;
    if (crowd?.key !== key) {
      crowd = { key, sprites: fans(sides, cheer) };
    }
    return crowd.sprites;
  };

  let size = { height: 0, width: 0 };
  let drawn = 0;

  const paint = (
    frame: ClipFrame,
    sides: ClipSides,
    box: Readonly<{ height: number; ratio: number; width: number }>,
    tilt: number,
    oblique = true
  ) => {
    const { height, ratio, width } = box;
    // Whole device pixels to an art pixel, as today's clips.
    const scale = width / frame.camera.width;
    const pixel = artPixelSize(scale, ratio);
    const wide = Math.ceil((width * ratio) / pixel);
    const high = Math.ceil((height * ratio) / pixel);
    if (size.width !== wide || size.height !== high) {
      size = { height: high, width: wide };
      renderer.setSize(wide, high);
      canvas.style.width = `${(wide * pixel) / ratio}px`;
      canvas.style.height = `${(high * pixel) / ratio}px`;
      billboards.setViewport(wide, high);
    }
    const metresPerPixel = pixel / (scale * ratio);
    const viewHeight = high * metresPerPixel;
    const distance =
      viewHeight / 2 / Math.tan(((fieldOfView / 2) * Math.PI) / 180);
    const angle = (tilt * Math.PI) / 180;
    // A metre of height rises a metre up the screen at any tilt, as the
    // sprites draw it: what the tilt leaves out is made up by leaning the
    // heights up the pitch.
    shear.value = oblique ? (1 - Math.sin(angle)) / Math.cos(angle) : 0;
    billboards.setShear(shear.value);
    const target = new Vec3(frame.camera.x, 0, frame.camera.y);
    camera.perspective({
      aspect: wide / high,
      far: distance + 400,
      near: Math.max(1, distance - 150)
    });
    camera.position
      .copy(target)
      .add(new Vec3(0, Math.cos(angle), Math.sin(angle)).scale(distance));
    camera.lookAt(target);

    const sprites: Billboard[] = [...crowdFor(sides, frame.cheer ?? false)];
    const { ball } = frame;
    const lift = ball.height * ballLiftMetres;
    const held = Boolean(frame.trophy) || ballHeld(frame.players, ball);
    const attackers = sides.attack.players.length;
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
    for (const speck of frame.confetti ?? []) {
      sprites.push({
        grid: ['cc', 'cc'],
        order: Infinity,
        palette: { c: speck.colour },
        x: speck.x,
        z: speck.y
      });
    }
    billboards.fill(sprites);
    // Every piece of the scene is a mesh, drawn in one call.
    drawn = scene.children.filter(node => node.visible).length;
    renderer.render({ camera, frustumCull: false, scene, sort: false });

    // The card, the label and the goal announcement, flat over the picture.
    overlay.width = Math.round(width * ratio);
    overlay.height = Math.round(height * ratio);
    const ctx = overlay.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const unit = overlayUnit(overlay.width);
    if (frame.label) {
      const at = new Vec3(frame.label.x, 0, frame.label.y).applyMatrix4(
        camera.projectionViewMatrix
      );
      const x = ((at.x + 1) / 2) * size.width * pixel;
      const y = ((1 - at.y) / 2) * size.height * pixel - 26 * pixel;
      drawLabel(ctx, frame.label.text, x, y, unit);
    }
    if (frame.card) {
      drawCard(ctx, frame.card, sides.attack.kit, unit);
    }
    if (frame.goal) {
      drawGoal(
        ctx,
        frame.goal,
        sides.attack.kit,
        unit,
        Math.ceil(overlay.width / unit),
        Math.ceil(overlay.height / unit)
      );
    }
  };

  return { calls: () => drawn, paint, scene };
};
