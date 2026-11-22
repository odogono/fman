import {
  BasicShadowMap,
  CanvasTexture,
  ColorManagement,
  DirectionalLight,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  NoColorSpace,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShadowMaterial,
  Vector3,
  WebGLRenderer
} from 'three';

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
import {
  boardPieces,
  goalPieces,
  shadowPalette,
  type GroundPiece
} from '../clip-stadium';
import { boardMetres, pitchLength, pitchWidth, type ClipFrame } from '../clips';
import { createAtlas, createBillboards, type Billboard } from './billboards';
import { fans, standsMesh, towardsSun } from './stands';

// The prototype's painter (#263): a clip's frame drawn over a 3D ground
// with three.js. The ground and the stands are geometry, lit by a sun that
// casts the stands' shadows across the pitch; the players, the ball, the
// goals, the boards and the fans are today's sprites, standing on their
// points. The scene is rendered at one pixel to an art pixel and scaled up
// in whole pixels, so it reads as the same art.

/** The camera's field of view, top to bottom: narrow, so near-flat. */
const fieldOfView = 20;
/** The ground beyond the lines that the pitch texture covers, in metres. */
const beyond = 40;
const texelsPerMetre = 10;

/** Today's pitch, stripes and markings, painted once as a texture. */
const pitchTexture = () => {
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
  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = NoColorSpace;
  return texture;
};

const groundPlane = () => {
  const geometry = new PlaneGeometry(
    pitchWidth + 2 * beyond,
    pitchLength + 2 * beyond
  );
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(pitchWidth / 2, 0, pitchLength / 2);
  return geometry;
};

/** A ground piece as a sprite: a shadow lies flat, the rest stand up. */
const fromPiece = (piece: GroundPiece): Billboard => ({
  ...(piece.depth === -Infinity ? { flat: true } : {}),
  grid: piece.grid,
  mirrored: piece.mirrored,
  order: piece.depth,
  palette: piece.palette,
  x: piece.at.x,
  z: piece.at.y
});

/**
 * The boards along the touchlines lie flat beside the pitch: drawn turned
 * to face up the screen, they would stand as posts once the camera tilts.
 */
const boards = boardPieces().map(piece => {
  const along =
    piece.at.x === -boardMetres || piece.at.x === pitchWidth + boardMetres;
  return along
    ? { ...fromPiece(piece), flat: true, order: -Infinity }
    : fromPiece(piece);
});
const goals = goalPieces().map(fromPiece);

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
  ColorManagement.enabled = false;
  const renderer = new WebGLRenderer({ antialias: false, canvas });
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = BasicShadowMap;
  renderer.setPixelRatio(1);

  const scene = new Scene();
  scene.add(
    new Mesh(groundPlane(), new MeshBasicMaterial({ map: pitchTexture() }))
  );
  const shade = new Mesh(
    groundPlane().translate(0, 0.02, 0),
    new ShadowMaterial({ opacity: 0.32 })
  );
  shade.receiveShadow = true;
  shade.renderOrder = 1;
  scene.add(shade);
  scene.add(standsMesh());

  const sun = new DirectionalLight(0xff_ff_ff, 1);
  const centre = new Vector3(pitchWidth / 2, 0, pitchLength / 2);
  sun.position.copy(centre).addScaledVector(towardsSun, 150);
  sun.target.position.copy(centre);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    bottom: -95,
    far: 320,
    left: -95,
    near: 1,
    right: 95,
    top: 95
  });
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun, sun.target);

  const atlas = createAtlas();
  const billboards = createBillboards(atlas);
  scene.add(billboards.mesh);

  const camera = new PerspectiveCamera(fieldOfView, 1, 1, 1000);
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

  const paint = (
    frame: ClipFrame,
    sides: ClipSides,
    box: Readonly<{ height: number; ratio: number; width: number }>,
    tilt: number
  ) => {
    const { height, ratio, width } = box;
    // Whole device pixels to an art pixel, as today's clips.
    const scale = width / frame.camera.width;
    const pixel = artPixelSize(scale, ratio);
    const wide = Math.ceil((width * ratio) / pixel);
    const high = Math.ceil((height * ratio) / pixel);
    if (size.width !== wide || size.height !== high) {
      size = { height: high, width: wide };
      renderer.setSize(wide, high, false);
      canvas.style.width = `${(wide * pixel) / ratio}px`;
      canvas.style.height = `${(high * pixel) / ratio}px`;
      billboards.viewport.set(wide, high);
    }
    const metresPerPixel = pixel / (scale * ratio);
    const viewHeight = high * metresPerPixel;
    const distance =
      viewHeight / 2 / Math.tan(((fieldOfView / 2) * Math.PI) / 180);
    const angle = (tilt * Math.PI) / 180;
    const target = new Vector3(frame.camera.x, 0, frame.camera.y);
    camera.aspect = wide / high;
    camera.near = Math.max(1, distance - 150);
    camera.far = distance + 400;
    camera.position
      .copy(target)
      .add(
        new Vector3(0, Math.cos(angle), Math.sin(angle)).multiplyScalar(
          distance
        )
      );
    camera.lookAt(target);
    camera.updateProjectionMatrix();

    const sprites: Billboard[] = [
      ...goals,
      ...boards,
      ...crowdFor(sides, frame.cheer ?? false)
    ];
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
    renderer.render(scene, camera);

    // The card, the label and the goal announcement, flat over the picture.
    overlay.width = Math.round(width * ratio);
    overlay.height = Math.round(height * ratio);
    const ctx = overlay.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const unit = overlayUnit(overlay.width);
    if (frame.label) {
      const at = new Vector3(frame.label.x, 0, frame.label.y).project(camera);
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

  return { info: () => renderer.info.render, paint };
};
