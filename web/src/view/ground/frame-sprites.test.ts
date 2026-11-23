import { expect, test } from 'bun:test';

import { cupArt, shadowArt } from '../assets/clip-sprites';
import { ballSprite, spriteFor, statusSprite } from '../clip-sprites';
import {
  kickOffFrame,
  pitchLength,
  pitchWidth,
  type ClipFrame,
  type ClipSide,
  type FramePlayer,
  type Line
} from '../clips';
import { favouring, type MatchGround } from '../match-ground';
import {
  createFrameSprites,
  layerBounds,
  pitchSprites,
  playerRows,
  splitIntoLayers,
  type Billboard
} from './frame-sprites';
import { groundPlan } from './grounds';

const lines: readonly Line[] = [
  'keeper',
  ...Array<Line>(4).fill('defence'),
  ...Array<Line>(4).fill('midfield'),
  ...Array<Line>(2).fill('attack')
];
const side = (kit: string, home = false): ClipSide => ({
  ...(home ? { home: true } : {}),
  keeper: '#ff8c1a',
  kit,
  players: lines.map((line, i) => ({ label: `${kit} ${i}`, line }))
});
const sides = { attack: side('#d70000'), defence: side('#0000d7', true) };
const groundOf = (club: number, division: number): MatchGround => ({
  crowd: favouring('#0000d7', '#d70000'),
  plan: groundPlan({ club, division, seats: '#0000d7' })
});
const ground = groundOf(1, 1);
const kickOff = kickOffFrame(sides.attack, sides.defence, '');

const centre = { x: pitchWidth / 2, y: pitchLength / 2 };
const player = (over: Partial<FramePlayer> = {}): FramePlayer => ({
  facing: 'down',
  keeper: false,
  pose: 'stand',
  side: 'attack',
  travelled: 0,
  ...centre,
  ...over
});
const frameOf = (over: Partial<ClipFrame>): ClipFrame => ({
  ...kickOff,
  ...over
});

const isBall = (sprite: Billboard) =>
  !sprite.flat && sprite.grid === ballSprite(sprite.x, sprite.z);
const isShadow = (sprite: Billboard) =>
  sprite.flat === true && sprite.grid === shadowArt.player;
/** Each player's shirt and looks, where they stand. */
const palettes = (frame: ClipFrame) =>
  pitchSprites(frame, sides)
    .filter(s => !s.flat && 's' in s.palette)
    .map(s => JSON.stringify([s.x, s.z, s.palette]))
    .toSorted();
/** A sprite at depth `z`. */
const at = (z: number): Billboard => ({
  grid: ['x'],
  order: z,
  palette: {},
  x: 0,
  z
});

test('a held ball, and its shadow, are not drawn', () => {
  const ball = { height: 0, ...centre };
  const loose = pitchSprites(frameOf({ ball, players: [player()] }), sides);
  expect(loose.filter(isBall)).toHaveLength(1);
  expect(loose.filter(s => s.grid === shadowArt.ball)).toHaveLength(1);

  const held = pitchSprites(
    frameOf({ ball, players: [player({ pose: 'hold' })] }),
    sides
  );
  expect(held.filter(isBall)).toHaveLength(0);
  expect(held.filter(s => s.grid === shadowArt.ball)).toHaveLength(0);

  // In the cup celebration the ball is put away.
  const lifted = pitchSprites(
    frameOf({ ball, players: [player()], trophy: { raise: 0, ...centre } }),
    sides
  );
  expect(lifted.filter(isBall)).toHaveLength(0);
});

test('a shadow lies under every player, drawn before anything stands on it', () => {
  const layers = createFrameSprites().layers(kickOff, sides, ground);
  const drawn = layers.flat();
  const shadows = drawn.filter(isShadow);
  expect(shadows).toHaveLength(kickOff.players.length);
  // All in the first layer, ahead of every standing sprite.
  const firstStanding = drawn.findIndex(s => !s.flat);
  expect(drawn.findLastIndex(isShadow)).toBeLessThan(firstStanding);
  expect(layers[0]!.filter(isShadow)).toHaveLength(shadows.length);
});

test("a status icon stands a pixel clear of its player's head, the top of them", () => {
  const tired = player({ status: 'tired' });
  const sprites = pitchSprites(frameOf({ players: [tired] }), sides);
  const icon = sprites.find(s => s.grid === statusSprite('tired'))!;
  const rows = spriteFor(tired).grid.length;
  expect(icon.lift).toBe(rows + 1);
  expect(icon.order).toBe(tired.y);
  expect(playerRows(tired)).toBe(rows + 1 + statusSprite('tired').length);
  // Without an icon, a player is as tall as their sprite.
  expect(playerRows(player())).toBe(rows);
});

test('the cup is drawn just in front of whoever holds it', () => {
  const holder = player({ pose: 'lift' });
  const frame = frameOf({
    players: [holder, player({ x: centre.x + 0.5, y: centre.y + 0.5 })],
    trophy: { raise: 1, x: holder.x, y: holder.y }
  });
  const drawn = createFrameSprites().layers(frame, sides, ground).flat();
  const cup = drawn.findIndex(s => s.grid === cupArt);
  const held = drawn.findIndex(
    s => !s.flat && s.grid === spriteFor(holder).grid
  );
  const behind = drawn.findIndex(s => !s.flat && s.z === centre.y + 0.5);
  expect(cup).toBeGreaterThan(held);
  // Still behind a player nearer the camera.
  expect(cup).toBeLessThan(behind);
});

test('confetti is drawn over everything', () => {
  const frame = frameOf({
    confetti: [{ colour: '#ffff00', x: 10, y: 1 }],
    players: [player({ y: pitchLength + 1 })]
  });
  const layers = createFrameSprites().layers(frame, sides, ground);
  const last = layers.at(-1)!;
  expect(last.at(-1)!.palette).toEqual({ c: '#ffff00' });
});

test('a player wears their own looks, whichever side the frame lists first', () => {
  const of = (team: FramePlayer['side']) =>
    kickOff.players.filter(p => p.side === team);
  const defendersFirst = frameOf({
    players: [...of('defence'), ...of('attack')]
  });
  expect(palettes(defendersFirst)).toEqual(palettes(kickOff));
});

test('sprites fall into layers between the goals’ nets and frames, by depth', () => {
  const bounds = layerBounds();
  expect(bounds).toHaveLength(4);
  const layers = splitIntoLayers(
    [at(pitchLength + 3), at(centre.y), at(-3), at(bounds[1]!)],
    bounds
  );
  expect(layers).toHaveLength(bounds.length + 1);
  // Behind the top goal's net; on the pitch; past the bottom goal's net.
  expect(layers[0]!.map(s => s.z)).toEqual([-3]);
  expect(layers[2]!.map(s => s.z)).toEqual([bounds[1]!, centre.y]);
  expect(layers[4]!.map(s => s.z)).toEqual([pitchLength + 3]);
});

test('the crowd is made again only for another ground, or another side cheering', () => {
  const made = createFrameSprites();
  const crowdOf = (
    frame: ClipFrame,
    at = sides,
    where = ground
  ): Billboard | undefined =>
    made
      .layers(frame, at, where)
      .flat()
      .find(s => s.z < -2 || s.x < -2);
  const first = crowdOf(kickOff);
  expect(first).toBeDefined();
  // A later frame of the same clip keeps the same fans.
  expect(crowdOf(frameOf({ ball: { height: 0, x: 1, y: 1 } }))).toBe(first);
  const cheering = crowdOf(frameOf({ cheer: true }));
  expect(cheering).not.toBe(first);
  expect(crowdOf(frameOf({ cheer: true }))).toBe(cheering);
  // The other side scoring stands other fans up.
  const swapped = { attack: sides.defence, defence: sides.attack };
  expect(crowdOf(frameOf({ cheer: true }), swapped)).not.toBe(cheering);
  expect(crowdOf(kickOff, sides, groundOf(2, 4))).not.toBe(crowdOf(kickOff));
});
