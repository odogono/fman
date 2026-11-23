import { cupArt, shadowArt, type ArtGrid } from '../assets/clip-sprites';
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
import type { ClipFrame, FramePlayer } from '../clips';
import type { MatchGround } from '../match-ground';
import { goalPieces } from './goals';
import { fans } from './stands';

// What stands where in a clip's frame (#280): the sprites at a ground, in
// the order they are drawn and the layers they fall in between the goals'
// nets and frames. No WebGL here; the painter uploads and draws them.

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

/** Shadows go under everything, so everything stands on them. */
export const underEverything = -Infinity;
/** Confetti goes over everything. */
export const overEverything = Infinity;
/** The cup is drawn this far in front of whoever holds it, over the hands. */
export const inFrontOfHolder = 0.01;

/** Shadows darken what they fall on, every other pixel. */
const shadowPalette: ArtPalette = { x: '#000000a0' };

/** Art pixels between the top of a player and the icon over them. */
const iconGap = 1;

/** How high a player's status icon stands above their foot, in art pixels. */
const iconLift = (player: FramePlayer) =>
  spriteFor(player).grid.length + iconGap;

/** How tall a player stands, with any icon over them, in art pixels. */
export const playerRows = (player: FramePlayer) =>
  player.status
    ? iconLift(player) + statusSprite(player.status).length
    : spriteFor(player).grid.length;

/**
 * Where the sprites split into layers: a sprite whose order is at or past a
 * bound is drawn after the goal piece at that order. Layer `i` is drawn
 * after the piece at bound `i - 1` and before the piece at bound `i`.
 */
export const layerBounds = (): number[] =>
  goalPieces()
    .map(goal => goal.order)
    .toSorted((a, b) => a - b);

/** Sorts `sprites` by order and splits them into layers at `bounds`. */
export const splitIntoLayers = (
  sprites: readonly Billboard[],
  bounds: readonly number[]
): Billboard[][] => {
  const layers = [-Infinity, ...bounds].map((): Billboard[] => []);
  for (const sprite of sprites.toSorted((a, b) => a.order - b.order)) {
    layers[bounds.filter(bound => sprite.order >= bound).length]!.push(sprite);
  }
  return layers;
};

/** Each player's place in their side: the attackers' and defenders' counts. */
const placesOf = (players: readonly FramePlayer[]) => {
  const counts = { attack: 0, defence: 0 };
  return players.map(player => counts[player.side]++);
};

/** The frame's sprites, but for the crowd: the players, the ball and the cup. */
export const pitchSprites = (
  frame: ClipFrame,
  sides: ClipSides
): Billboard[] => {
  const sprites: Billboard[] = [];
  const { ball } = frame;
  const lift = ball.height * ballLiftMetres;
  // A ball is held, or, in the cup celebration, put away.
  const held = Boolean(frame.trophy) || ballHeld(frame.players, ball);
  // Shadows, lit from the top left.
  for (const player of frame.players) {
    sprites.push({
      flat: true,
      grid: shadowArt.player,
      order: underEverything,
      palette: shadowPalette,
      x: player.x + 0.3,
      z: player.y + 0.12
    });
  }
  if (!held) {
    sprites.push({
      flat: true,
      grid: shadowArt.ball,
      order: underEverything,
      palette: shadowPalette,
      x: ball.x + 0.15 + lift * 0.5,
      z: ball.y + 0.08 + lift * 0.2
    });
  }
  const places = placesOf(frame.players);
  frame.players.forEach((player, i) => {
    const side = sides[player.side];
    const place = places[i]!;
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
        lift: iconLift(player),
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
      order: frame.trophy.y + inFrontOfHolder,
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
  // Two art pixels square a speck.
  for (const speck of frame.confetti ?? []) {
    sprites.push({
      grid: ['cc', 'cc'],
      order: overEverything,
      palette: { c: speck.colour },
      x: speck.x,
      z: speck.y
    });
  }
  return sprites;
};

/**
 * The sprites of each frame at a ground, in the layers they are drawn in,
 * split at `bounds`, the goal pieces' orders. The crowd is made again only
 * for another ground, or when another side's fans cheer.
 */
export const createFrameSprites = () => {
  const bounds = layerBounds();
  let crowd:
    | {
        cheering: string | undefined;
        ground: MatchGround;
        sprites: Billboard[];
      }
    | undefined;
  /** The fans, the scorers' (`cheering`) and the neutrals on their feet. */
  const crowdFor = (ground: MatchGround, cheering?: string) => {
    if (crowd?.ground === ground && crowd.cheering === cheering) {
      return crowd.sprites;
    }
    const sprites = fans(ground.crowd, ground.plan.stands, cheering);
    crowd = { cheering, ground, sprites };
    return sprites;
  };
  const layers = (frame: ClipFrame, sides: ClipSides, ground: MatchGround) =>
    splitIntoLayers(
      [
        ...crowdFor(ground, frame.cheer ? sides.attack.kit : undefined),
        ...pitchSprites(frame, sides)
      ],
      bounds
    );
  return { bounds, layers };
};
