import type { Club } from '../sim/catalogue';
import type { Attack, SpriteDraw } from '../sim/highlights';
import { clubInk, clubText } from '../sim/names';
import { rasterText } from './glyphs';

// BASIC DATA 261: fifteen 8×8 UDGs, transcribed for the recreated view.
const sprites = [
  [24, 88, 126, 26, 120, 72, 206, 2],
  [48, 48, 24, 60, 28, 56, 48, 40],
  [24, 24, 30, 58, 24, 42, 36, 32],
  [24, 24, 24, 28, 60, 24, 28, 8],
  [24, 24, 60, 90, 90, 60, 36, 102],
  [0, 0, 0, 0, 0, 0, 3, 3],
  [24, 26, 126, 88, 30, 18, 115, 64],
  [12, 12, 24, 60, 56, 28, 12, 20],
  [24, 24, 120, 92, 24, 84, 36, 4],
  [24, 24, 24, 56, 60, 24, 56, 8],
  [0, 0, 0, 0, 0, 0, 192, 192],
  [24, 24, 61, 90, 56, 28, 20, 36],
  [24, 24, 188, 90, 28, 56, 40, 36],
  [12, 12, 60, 91, 152, 62, 64, 192],
  [48, 48, 60, 218, 25, 124, 2, 3]
];
const colours = [
  [0, 0, 0],
  [0, 0, 255],
  [255, 0, 0],
  [255, 0, 255],
  [0, 255, 0],
  [0, 255, 255],
  [255, 255, 0],
  [255, 255, 255]
];
type Line = readonly [number, number];
const pitch = (right: boolean, progress = Infinity) => {
  // The last BASIC DRAW contains the eight arc chords.
  const limit = progress <= 29 ? progress : 29 + (progress - 29) * 8;
  let command = 0;
  const bits = new Uint8Array(256 * 176);
  const pixel = (x: number, y: number) => {
    if (x >= 0 && x < 256 && y >= 0 && y < 176) {
      bits[(175 - y) * 256 + x] = 1;
    }
  };
  const plot = (x: number, y: number) => {
    if (++command <= limit) {
      pixel(x, y);
    }
  };
  const line = (x: number, y: number, endX: number, endY: number) => {
    const fraction = Math.min(1, Math.max(0, limit - command++));
    if (fraction === 0) {
      return;
    }
    const dx = Math.abs(endX - x),
      dy = -Math.abs(endY - y);
    const sx = x < endX ? 1 : -1,
      sy = y < endY ? 1 : -1;
    let error = dx + dy;
    let remaining = Math.ceil(Math.max(dx, -dy) * fraction);
    while (true) {
      pixel(x, y);
      if ((x === endX && y === endY) || remaining-- <= 0) {
        break;
      }
      const twice = error * 2;
      if (twice >= dy) {
        error += dy;
        x += sx;
      }
      if (twice <= dx) {
        error += dx;
        y += sy;
      }
    }
  };
  const path = (x: number, y: number, deltas: readonly Line[]) => {
    plot(x, y);
    for (const [dx, dy] of deltas) {
      line(x, y, x + dx, y + dy);
      x += dx;
      y += dy;
    }
  };
  if (right) {
    path(184, 88, [
      [16, -8],
      [8, -16],
      [-24, 0]
    ]);
    path(247, 0, [[-175, 175]]);
    path(183, 64, [
      [0, 24],
      [-48, 48],
      [0, -24]
    ]);
    path(191, 56, [
      [-24, 0],
      [-64, 64],
      [24, 0]
    ]);
    path(223, 24, [
      [-96, 0],
      [-115, 115],
      [96, 0]
    ]);
    path(136, 135, [
      [16, -8],
      [8, -16],
      [-24, 0]
    ]);
    path(153, 126, [[48, -48]]);
    path(94, 84, [[2, 0]]);
    path(94, 85, [[2, 0]]);
  } else {
    path(71, 88, [
      [-16, -8],
      [-8, -16],
      [24, 0]
    ]);
    path(8, 0, [[175, 175]]);
    path(72, 64, [
      [0, 24],
      [48, 48],
      [0, -24]
    ]);
    path(64, 56, [
      [24, 0],
      [64, 64],
      [-24, 0]
    ]);
    path(32, 24, [
      [96, 0],
      [115, 115],
      [-96, 0]
    ]);
    path(119, 135, [
      [-16, -8],
      [-8, -16],
      [24, 0]
    ]);
    path(102, 126, [[-48, -48]]);
    path(158, 84, [[2, 0]]);
    path(158, 85, [[2, 0]]);
  }
  // ROM-rounded chords for this game's fixed DRAW ±40,-40,±2*PI/5.
  // Numeric vertices are captured independently of the pixel hashes used in tests.
  const arc: readonly Line[] = [
    [2, -7],
    [3, -7],
    [4, -7],
    [5, -5],
    [5, -5],
    [7, -4],
    [7, -3],
    [7, -2]
  ];
  path(
    right ? 55 : 201,
    96,
    arc.map(([dx, dy]) => [right ? dx : -dx, dy])
  );
  return bits;
};
const pitches = { left: pitch(false), right: pitch(true) };

export const rasterizeAttack = (
  attack: Attack,
  index: number
): Uint8ClampedArray<ArrayBuffer> => {
  const progress = attack.frames
    .slice(0, index + 1)
    .findLast(frame => frame.pitch !== undefined)?.pitch;
  const bits =
    progress === undefined || progress >= 30
      ? pitches[attack.direction].slice()
      : pitch(attack.direction === 'right', progress);
  const inks = new Uint8Array(22 * 32).fill(6);
  const draw = ({ glyph, ink, x, y }: SpriteDraw) => {
    inks[y * 32 + x] = ink;
    for (let row = 0; row < 8; row++) {
      const byte = sprites[glyph]![row]!;
      for (let col = 0; col < 8; col++) {
        if (byte & (128 >> col)) {
          const address = (y * 8 + row) * 256 + x * 8 + col;
          bits[address] = bits[address]! ^ 1;
        }
      }
    }
  };
  for (const frame of attack.frames.slice(0, index + 1)) {
    for (const sprite of frame.draws) {
      draw(sprite);
    }
  }
  const rgba = new Uint8ClampedArray(256 * 176 * 4);
  for (let y = 0; y < 176; y++) {
    for (let x = 0; x < 256; x++) {
      const colour =
        colours[
          bits[y * 256 + x]
            ? inks[Math.floor(y / 8) * 32 + Math.floor(x / 8)]!
            : 4
        ]!;
      const offset = (y * 256 + x) * 4;
      rgba[offset] = colour[0]!;
      rgba[offset + 1] = colour[1]!;
      rgba[offset + 2] = colour[2]!;
      rgba[offset + 3] = 255;
    }
  }
  return rgba;
};

const banner =
  '****█    ██  ███  ██ ████ █*********█ ██▄█ ██ █ ██ █ ████ █*********█ █▄ █ ██ █ ▄▄ █ ████▄█*********█    ██  ██ ██ █    █ █*****';
export const rasterizeHighlight = (
  attack: Attack,
  index: number,
  score: readonly number[],
  home: Club,
  away: Club
) => {
  const rgba = rasterizeAttack(attack, index);
  const outcome = attack.frames
    .slice(0, index + 1)
    .find(frame => frame.kind === 'goal' || frame.kind === 'miss');
  if (!outcome) {
    return rgba;
  }
  const shown =
    attack.frames
      .slice(0, index + 1)
      .findLast(frame => frame.outcomeChars !== undefined)?.outcomeChars ??
    Infinity;
  if (outcome.kind === 'miss') {
    rasterText(rgba, 256, 80, 8, 'NO GOAL!'.slice(0, shown), { bright: true });
    return rgba;
  }
  for (let i = 0; i < Math.min(banner.length, shown); i++) {
    rasterText(rgba, 256, (i % 32) * 8, Math.floor(i / 32) * 8, banner[i]!, {
      bright: true,
      ink: 6,
      paper: 2
    });
  }
  const scoreShown =
    attack.frames
      .slice(0, index + 1)
      .findLast(frame => frame.scoreChars !== undefined)?.scoreChars ??
    Infinity;
  if (scoreShown === 0) {
    return rgba;
  }
  const homeStyle = { bright: true, ink: clubInk(home) };
  const awayStyle = { bright: true, ink: clubInk(away, clubInk(home)) };
  // TAB and comma spaces, and both numbers, inherit the preceding name's INK.
  const homeText = `${clubText(home).padEnd(12)}${score[0]}`.padEnd(16);
  const awayText = `${clubText(away).padEnd(12)}${score[1]}`;
  rasterText(rgba, 256, 0, 32, homeText.slice(0, scoreShown), homeStyle);
  rasterText(
    rgba,
    256,
    128,
    32,
    awayText.slice(0, Math.max(0, scoreShown - homeText.length)),
    awayStyle
  );
  return rgba;
};

export const paintAttack = (
  context: CanvasRenderingContext2D,
  attack: Attack,
  index: number,
  score: readonly number[],
  home: Club,
  away: Club
) =>
  context.putImageData(
    new ImageData(
      rasterizeHighlight(attack, index, score, home, away),
      256,
      176
    ),
    0,
    0
  );
