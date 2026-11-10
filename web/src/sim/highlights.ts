import { createExecution, executionBudget } from './execution';
import { spectrumFrameT } from './frame-clock';
import { createRng } from './rng';

export type Position = Readonly<{ x: number; y: number }>;
export type AttackCarry = Readonly<{
  attackers: readonly Position[];
  defenders: readonly Position[];
}>;
export type SpriteDraw = Position & Readonly<{ glyph: number; ink: number }>;
export type HighlightFrame = Readonly<{
  checkpoint?: 'initial' | 'dribble' | 'release' | 'collision' | 'ball';
  clearKey?: boolean;
  draws: readonly SpriteDraw[];
  duration: number;
  interrupts?: boolean;
  intro?: boolean;
  kind: 'draw' | 'goal' | 'miss' | 'pause';
  outcomeChars?: number;
  pitch?: number;
  scoreChars?: number;
  stars?: number;
  text?: number;
  tones: readonly { duration: number; pitch: number }[];
  trophy?: number;
}>;
export type Attack = Readonly<{
  carry: AttackCarry;
  direction: 'left' | 'right';
  frames: readonly HighlightFrame[];
  goal: boolean;
  path?: readonly string[];
  seed: number;
  trace: readonly number[][];
}>;

export const emptyAttackCarry = (): AttackCarry => ({
  attackers: Array.from({ length: 3 }, () => ({ x: 0, y: 0 })),
  defenders: Array.from({ length: 3 }, () => ({ x: 0, y: 0 }))
});

export const simulateAttack = (input: {
  awayInk: number;
  carry: AttackCarry;
  direction: 'left' | 'right';
  homeInk: number;
  seed: number;
  startT?: number;
}): Attack => {
  const right = input.direction === 'right';
  const direction = right ? 1 : -1;
  const attackInk = right ? input.homeInk : input.awayInk;
  const defendInk = right ? input.awayInk : input.homeInk;
  const rng = createRng(input.seed);
  const execution = createExecution(input.startT);
  const base = right ? 400 : 300;
  const at = (line: number, statement = 0) =>
    execution.at(base + line, statement);
  const run = (line: number, start: number, end: number) =>
    execution.run(base + line, start, end);
  const roll = (n: number) => rng.int(1, n);
  // Rows in not-yet-overwritten slots participate in rejection sampling.
  const f = input.carry.attackers.map(p => ({ ...p }));
  const g = input.carry.defenders.map(p => ({ ...p }));
  const attributes = new Uint8Array(24 * 32).fill(102);
  attributes.fill(56, 22 * 32);
  const trace: number[][] = [];
  const glyphs = right
    ? [6, 7, 8, 9, 4, 14, 12, 1]
    : [0, 1, 2, 3, 4, 13, 11, 7];
  const ballGlyph = right ? 10 : 5;
  const keeperGlyphs = right ? [12, 1] : [11, 7];
  const attr = (x: number, y: number) => {
    // ATTR uses the ROM's absolute byte conversion and XOR address mapping;
    // it does not clamp columns to the visible 0..31 range.
    const row = Math.abs(y) & 255;
    const column = Math.abs(x) & 255;
    const low = ((row & 7) * 32) ^ column;
    const high = ((row >> 3) & 3) ^ 88;
    return attributes[(high - 88) * 256 + low] ?? 56;
  };
  const print = (p: Position, glyph: number, ink: number) => {
    attr(p.x, p.y);
    if (ink < 0 || ink > 7) {
      throw new RangeError('Invalid highlight INK');
    }
    attributes[p.y * 32 + p.x] = 96 + ink;
    execution.draw({ ...p, glyph, ink });
  };
  const foot = (p: Position, index: number, ink: number) =>
    print(p, glyphs[index - 1]!, ink);
  // Each pitch statement completes in order; placement runs over the completed
  // pitch before the first player is printed.
  execution.pitch(0);
  run(0, 0, 9);
  let pitchProgress = 0;
  for (const [line, count] of [
    [1, 18],
    [2, 4],
    [3, 8]
  ]) {
    for (let statement = 0; statement < count!; statement++) {
      at(line!, statement);
      if (line === 1 && statement === 0) {
        execution.clearKey();
      }
      execution.drawing(pitchProgress++);
    }
  }
  at(4);
  execution.pitch(pitchProgress);
  let attempts = 0;
  const retry = () => {
    if (++attempts > 10_000) {
      throw new Error('Highlight placement did not converge');
    }
  };
  at(10);
  f[0]!.y = 3 + roll(18);
  at(10, 1);
  f[0]!.x = right ? 6 - roll(6) : 25 + roll(6);
  run(10, 2, 6);
  const ball = { dx: direction, dy: 0, x: f[0]!.x + direction, y: f[0]!.y };
  let keeperFrame = 1;
  let keeperX = right
    ? 20 - roll(2) - 2 * Number(f[0]!.y < 11) + 2 * Number(f[0]!.y > 10)
    : 11 + roll(2) + 2 * Number(f[0]!.y < 11) - 2 * Number(f[0]!.y > 10);
  let keeperY = right ? keeperX - 8 : 23 - keeperX;
  at(10, 7);
  at(11);
  for (let i = 1; i < 3; i++) {
    while (true) {
      at(12);
      retry();
      f[i]!.x = right ? 21 - roll(20) : 10 + roll(20);
      at(12, 1);
      f[i]!.y = roll(21);
      at(13);
      if (
        right
          ? f[i]!.x - f[i]!.y > 6 || f[i]!.x < f[0]!.x + 4
          : f[i]!.x + f[i]!.y < 25 || f[i]!.x > f[0]!.x - 4
      ) {
        continue;
      }
      at(14);
      let rejected = false;
      for (let j = 0; j < 3; j++) {
        at(14, 1);
        if (j !== i && f[j]!.y === f[i]!.y) {
          rejected = true;
          break;
        }
        at(15);
      }
      if (!rejected) {
        break;
      }
    }
    at(15, 1);
  }
  at(16);
  for (let i = 0; i < 3; i++) {
    while (true) {
      at(17);
      retry();
      g[i]!.x = right ? 21 - roll(10) : 10 + roll(10);
      at(17, 1);
      g[i]!.y = roll(18);
      at(18);
      if (
        right
          ? g[i]!.x - g[i]!.y > 7 || g[i]!.x < f[0]!.x + 4
          : g[i]!.x + g[i]!.y < 24 || g[i]!.x > f[0]!.x - 4
      ) {
        continue;
      }
      at(19);
      let rejected = false;
      for (let j = 0; j < 3; j++) {
        at(19, 1);
        if (f[j]!.y === g[i]!.y || (j !== i && g[j]!.y === g[i]!.y)) {
          rejected = true;
          break;
        }
        at(20);
      }
      if (!rejected) {
        break;
      }
    }
    at(20, 1);
  }
  at(22);
  foot(f[0]!, 1, attackInk);
  at(22, 1);
  for (let i = 1; i < 3; i++) {
    at(22, 2);
    foot(f[i]!, 1 + 2 * Number(f[i]!.y < 10), attackInk);
    at(22, 3);
  }
  at(23);
  for (const p of g) {
    at(23, 1);
    foot(p, 2 + 2 * Number(p.y < 10), defendInk);
    at(23, 2);
  }
  at(25);
  print(ball, ballGlyph, 1);
  at(26);
  print({ x: keeperX, y: keeperY }, keeperGlyphs[0]!, defendInk);
  at(40);
  execution.mark('initial');
  let wm = 1;
  let wm1 = 1;
  at(40, 1);
  const dribbles = roll(3) * 2 - 1;
  at(40, 2);
  at(41);
  for (let i = 0; i < dribbles; i++) {
    at(41, 1);
    wm1 = wm;
    at(41, 2);
    wm = 3 - wm;
    at(41, 3);
    print(ball, ballGlyph, 6);
    ball.x += direction;
    print(ball, ballGlyph, 1);
    run(41, 4, 5);
    at(60);
    foot(f[0]!, wm1, 6);
    f[0]!.x += direction;
    foot(f[0]!, wm, attackInk);
    run(60, 1, 2);
    for (const [players, start, ink, old, next, threshold, line] of [
      [f, 1, attackInk, wm1, wm, right ? 7 : 24, 60],
      [g, 0, defendInk, wm, wm1, right ? 8 : 23, 65]
    ] as const) {
      if (line === 65) {
        at(65);
      }
      for (let j: number = start; j < 3; j++) {
        run(line, line === 60 ? 3 : 1, line === 60 ? 5 : 3);
        const p = players[j]!;
        const y = p.y + Number(p.y < 10) - Number(p.y > 9);
        const x = p.x + direction;
        const move =
          attr(x, y) === 102 && (right ? x - y < threshold : x + y > threshold);
        at(line + 1);
        if (!move) {
          at(line + 2);
        }
        foot(p, old + 2 * Number(p.y < 10), 6);
        if (move) {
          at(line + 1, 2);
        }
        if (move) {
          p.x = x;
          p.y = y;
        }
        foot(p, next + 2 * Number(p.y < 10), ink);
        if (move) {
          run(line + 1, 3, 5);
        }
        at(line + 3);
        if (line === 65 && j === 2) {
          execution.mark('dribble');
        }
      }
    }
    at(79);
    at(41, 6);
  }
  at(42);
  for (const p of g) {
    at(42, 1);
    foot(p, wm1 + 2 * Number(p.y < 10), 6);
    foot(p, 5, defendInk);
    at(42, 2);
  }
  at(42, 3);
  for (let i = 1; i < 3; i++) {
    at(42, 4);
    foot(f[i]!, wm + 2 * Number(f[i]!.y < 10), 6);
    foot(f[i]!, 5, attackInk);
    at(42, 5);
  }
  at(42, 6);
  foot(f[0]!, 2, 6);
  at(43);
  foot(f[0]!, 1, attackInk);
  at(43, 1);
  execution.mark('release');
  execution.tone({ duration: 0.15, pitch: -40 });
  at(43, 2);
  // Sinclair's arithmetic boolean expressions evaluate random operands eagerly.
  ball.dy =
    Number(ball.y < 8) -
    Number(ball.y > 15) +
    Number(ball.y > 12 && ball.y < 16) * (roll(2) - 2);
  ball.dx = direction * 2;
  at(43, 3);
  let was = 6;
  let out = false;
  const stepBall = () => {
    at(50);
    const x = ball.x + ball.dx;
    const y = ball.y + ball.dy;
    const des = attr(x, y);
    const diagonal = right ? x - y : x + y;
    run(50, 1, 3);
    if (
      (right
        ? diagonal >= 4 && diagonal <= 7
        : diagonal >= 24 && diagonal <= 27) &&
      y > 7 &&
      y < 14
    ) {
      execution.at(right ? 280 : 270);
      print({ x: keeperX, y: keeperY }, keeperGlyphs[keeperFrame - 1]!, 6);
      execution.run(right ? 280 : 270, 1, 3);
      keeperFrame = 3 - keeperFrame;
      const delta =
        Number(ball.y > keeperY + Number(ball.dy !== 0)) -
        Number(ball.y < keeperY - Number(ball.dy !== 0));
      keeperY += delta;
      keeperX = right ? keeperY + 8 : 23 - keeperY;
      print(
        { x: keeperX, y: keeperY },
        keeperGlyphs[keeperFrame - 1]!,
        defendInk
      );
      execution.run(right ? 280 : 270, 4, 5);
      execution.at(right ? 281 : 271);
    }
    at(51);
    const outside =
      (right ? x - y > 9 || x < 0 : x + y < 22 || x > 31) || y < 0 || y > 21;
    if (outside) {
      at(51, 2);
      out = true;
      at(51, 3);
      print(ball, ballGlyph, was);
      run(51, 4, 5);
      ball.x = x;
      ball.y = y;
      at(58);
      if (
        (right ? x - y > 9 : x + y < 22) &&
        y >= 0 &&
        y <= 21 &&
        x >= 0 &&
        x <= 31
      ) {
        print(ball, ballGlyph, 1);
        at(58, 2);
      }
    } else {
      at(52);
      if (des !== 102) {
        ball.dx =
          (des === 96 + input.homeInk ? 2 : 0) +
          (des === 96 + input.awayInk ? -2 : 0);
        at(52, 2);
        // Both random draws occur, even when one term's multiplier is zero.
        ball.dy =
          Number(ball.dx === direction * 2) * (roll(2) - 2) +
          Number(ball.dx === -direction * 2) * (roll(3) - 2);
        at(52, 3);
        print(ball, ballGlyph, was);
        const destination = { x, y };
        print(destination, ballGlyph, des - 96);
        const keeperCell = right ? x - y === 8 : x + y === 23;
        const standing = keeperCell ? 6 + keeperFrame : 5;
        foot(destination, standing, des - 96);
        foot(destination, 6, des - 96);
        at(52, 4);
        execution.mark('collision');
        execution.tone({ duration: 0.15, pitch: -30 });
        at(52, 5);
        execution.tone({ duration: 0.08, pitch: -40 });
        at(52, 6);
        foot(destination, 6, des - 96);
        foot(destination, standing, des - 96);
        run(52, 7, 9);
        ball.x = x;
        ball.y = y;
      } else {
        at(53);
        print(ball, ballGlyph, was);
        print({ x, y }, ballGlyph, 1);
        run(53, 1, 3);
        ball.x = x;
        ball.y = y;
      }
    }
    was = des - 96;
    trace.push([ball.x, ball.y, ball.dx, ball.dy, rng.seed]);
    at(59);
    execution.mark('ball');
    at(59, 1);
  };
  at(43, 4);
  stepBall();
  at(43, 5);
  stepBall();
  at(43, 6);
  stepBall();
  at(43, 7);
  foot(f[0]!, 1, attackInk);
  foot(f[0]!, 5, attackInk);
  let steps = 3;
  at(44);
  while (!out) {
    if (++steps > 10_000) {
      throw new Error('Highlight ball did not leave play');
    }
    stepBall();
    at(44, 2);
    at(44);
  }
  at(45);
  const goal = right
    ? ball.x - ball.y > 9 &&
      ball.y < 14 &&
      ball.y > 4 &&
      ball.x > 16 &&
      ball.x < 25 &&
      !(ball.x === 24 && ball.y === 13 && ball.dy < 0)
    : ball.x + ball.y < 22 &&
      ball.y < 14 &&
      ball.y > 4 &&
      ball.x < 15 &&
      ball.x > 6 &&
      !(ball.x === 7 && ball.y === 13 && ball.dy < 0);
  if (goal) {
    at(45, 2);
    execution.at(290);
    execution.at(292);
    execution.outcome('goal');
    execution.printing('outcomeChars');
    execution.at(293);
    const count = 5 + roll(5);
    for (let i = 0; i < count; i++) {
      execution.at(293, 1);
      execution.tone({ duration: 0.05, pitch: roll(36) });
      execution.at(293, 2);
    }
    execution.at(294);
    execution.at(1090);
    execution.printing('scoreChars');
    execution.at(1092);
    execution.at(295);
    at(45, 3);
  } else {
    at(46);
    at(46, 1);
    execution.outcome('miss');
    execution.printing('outcomeChars');
    at(46, 2);
    execution.tone({ duration: 0.25, pitch: -50 });
  }
  at(47);
  execution.pause(200);
  at(49);
  const frames = execution.finish();
  return {
    carry: { attackers: f, defenders: g },
    direction: input.direction,
    frames,
    goal,
    path: execution.path,
    seed: rng.seed,
    trace
  };
};

export const simulateHighlights = (input: {
  awayInk: number;
  carry?: AttackCarry;
  home: boolean;
  homeInk: number;
  opponent: readonly number[];
  seed: number;
  startT?: number;
  strength: readonly number[];
}) => {
  let seed = input.seed;
  let carry = input.carry ?? emptyAttackCarry();
  const score = [0, 0];
  const attacks: Attack[] = [];
  let t = input.startT ?? 0;
  let pending = 0;
  let dispatch = '5000:0';
  const top = (next: string) => {
    const elapsed = executionBudget(dispatch, next)[0]!;
    t += elapsed;
    pending += elapsed;
    dispatch = next;
  };
  const extendPrevious = () => {
    const previous = attacks.at(-1)!;
    const frames = [...previous.frames];
    const last = frames.at(-1)!;
    frames[frames.length - 1] = {
      ...last,
      duration: last.duration + pending / spectrumFrameT
    };
    attacks[attacks.length - 1] = { ...previous, frames };
    pending = 0;
  };
  const attack = (home: boolean) => {
    const line = home ? 400 : 300;
    top(`${line}:0`);
    const opening = attacks.length === 0 ? pending : 0;
    if (attacks.length > 0) {
      extendPrevious();
    }
    const result = simulateAttack({
      ...input,
      carry,
      direction: home ? 'right' : 'left',
      seed,
      startT: t
    });
    t += result.frames.reduce(
      (sum, frame) => sum + Math.round(frame.duration * spectrumFrameT),
      0
    );
    pending = 0;
    dispatch = `${line + 49}:0`;
    carry = result.carry;
    seed = result.seed;
    if (result.goal) {
      score[home ? 0 : 1] = score[home ? 0 : 1]! + 1;
    }
    attacks.push(
      opening > 0
        ? {
            ...result,
            frames: [
              {
                draws: [],
                duration: opening / spectrumFrameT,
                intro: true,
                kind: 'draw',
                tones: []
              },
              ...result.frames
            ]
          }
        : result
    );
  };
  top('5001:0');
  top('5001:1');
  top('5001:2');
  top('5002:0');
  for (let i = 0; i < 5; i++) {
    for (const user of [true, false]) {
      top(user ? '5005:0' : '5050:0');
      const rng = createRng(seed);
      const difference =
        (input.strength[i]! - input.opponent[i]!) * (user ? 1 : -1);
      const n = rng.int(1, 100) + difference * 5;
      seed = rng.seed;
      top(user ? '5010:0' : '5060:0');
      if (n >= 75) {
        attack(user ? input.home : !input.home);
        top(user ? '5010:2' : '5060:2');
        attack(user ? input.home : !input.home);
      }
    }
    top('5100:0');
  }
  top('5101:0');
  if (score[0]! + score[1]! === 0) {
    attack(true);
    top('5101:2');
    attack(false);
  }
  for (let statement = 0; statement <= 6; statement++) {
    top(`5105:${statement}`);
  }
  top('1090:0');
  top('1092:0');
  top('5105:7');
  top('5110:0');
  extendPrevious();
  return { attacks, carry, score, seed };
};
