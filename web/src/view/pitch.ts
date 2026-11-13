import type { Club } from '../sim/catalogue';
import {
  emptyAttackCarry,
  type Attack,
  type SpriteDraw
} from '../sim/highlights';
import { rasterText, rasterizeCells } from './glyphs';
import type { Cell } from './grid';
import { createPrintScreen } from './print-screen';
import { sprites } from './sprites';

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

const attackCells = (attack: Attack, index: number): Cell[] => {
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
  return Array.from({ length: 704 }, (_, i) => {
    const row = Math.floor(i / 32),
      column = i % 32;
    const pixels = Array.from({ length: 8 }, (_, y) => {
      let byte = 0;
      for (let x = 0; x < 8; x++) {
        byte |= bits[(row * 8 + y) * 256 + column * 8 + x]! << (7 - x);
      }
      return byte;
    });
    return {
      bright: true,
      ink: inks[i]!,
      inverse: false,
      paper: 4,
      pixels,
      text: ' '
    };
  });
};

export const rasterizeAttack = (attack: Attack, index: number) =>
  rasterizeCells(attackCells(attack, index));

const banner =
  '****█    ██  ███  ██ ████ █*********█ ██▄█ ██ █ ██ █ ████ █*********█ █▄ █ ██ █ ▄▄ █ ████▄█*********█    ██  ██ ██ █    █ █*****';
export const rasterizeHighlight = (
  attack: Attack,
  index: number,
  score: readonly number[],
  home: Club,
  away: Club,
  flashPhase = false
) => {
  const initial = attackCells(attack, index);
  const rgba = rasterizeCells(initial);
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
  const print = createPrintScreen(true, {
    cells: initial,
    permanent: { bright: true, ink: 6, paper: 4 }
  });
  print.text(banner.slice(0, shown), { ink: 6, paper: 2 });

  const scoreShown =
    attack.frames
      .slice(0, index + 1)
      .findLast(frame => frame.scoreChars !== undefined)?.scoreChars ??
    Infinity;
  if (scoreShown === 0) {
    return rasterizeCells(print.cells, flashPhase);
  }
  const names = createPrintScreen(true, {
    cells: print.cells,
    limit: scoreShown,
    permanent: { bright: true }
  });
  names.at(4, 0);
  names.club(home);
  names.tab(12);
  names.text(String(score[0]));
  names.comma();
  names.club(away);
  names.tab(28);
  names.text(String(score[1]));
  return rasterizeCells(names.cells, flashPhase);
};

export const paintAttack = (
  context: CanvasRenderingContext2D,
  attack: Attack,
  index: number,
  score: readonly number[],
  home: Club,
  away: Club,
  flashPhase = false
) =>
  context.putImageData(
    new ImageData(
      rasterizeHighlight(attack, index, score, home, away, flashPhase),
      256,
      176
    ),
    0,
    0
  );

/** The pitch with nobody on it, facing right as the home side attacks. */
export const paintEmptyPitch = (context: CanvasRenderingContext2D) =>
  context.putImageData(
    new ImageData(
      rasterizeAttack(
        {
          carry: emptyAttackCarry(),
          direction: 'right',
          frames: [],
          goal: false,
          seed: 0,
          trace: []
        },
        -1
      ),
      256,
      176
    ),
    0,
    0
  );
